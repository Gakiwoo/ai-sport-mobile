const fs = require('fs');
const path = require('path');

const MIN_DURATION_MS = 30 * 60 * 1000;
const MAX_AVG_INFERENCE_MS = 150;

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function validateDeviceStabilityReport(report) {
  const errors = [];
  if (!report || typeof report !== 'object') {
    return {
      errors: ['report must be an object'],
      summary: {
        wallClockDurationMs: 0,
        totalDurationMs: 0,
        totalFrames: 0,
        weightedAverageInferenceMs: null,
        maxP95InferenceMs: 0,
        crashCount: null,
      },
    };
  }
  if (report.schemaVersion !== 1) errors.push('schemaVersion must be 1');
  if (report.status !== 'completed') errors.push('status must be completed');

  const device = report.device;
  if (!device || typeof device !== 'object') {
    errors.push('device metadata is required');
  } else {
    for (const field of ['manufacturer', 'model', 'osVersion', 'appVersion']) {
      if (typeof device[field] !== 'string' || !device[field].trim()) {
        errors.push(`device.${field} is required`);
      }
    }
  }

  const startedAt = Date.parse(report.startedAt);
  const endedAt = Date.parse(report.endedAt);
  if (Number.isNaN(startedAt) || Number.isNaN(endedAt) || endedAt <= startedAt) {
    errors.push('startedAt/endedAt must define a valid positive interval');
  } else if (endedAt - startedAt < MIN_DURATION_MS) {
    errors.push(`wall-clock duration must be at least ${MIN_DURATION_MS}ms`);
  }

  if (!Number.isInteger(report.crashCount) || report.crashCount < 0) {
    errors.push('crashCount must be a non-negative integer');
  } else if (report.crashCount !== 0) {
    errors.push(`crashCount must be 0, received ${report.crashCount}`);
  }

  const sessions = Array.isArray(report.sessions) ? report.sessions : [];
  if (sessions.length === 0) {
    errors.push('sessions must contain at least one performance report');
  }

  let totalDurationMs = 0;
  let totalFrames = 0;
  let weightedInferenceMs = 0;
  let maxP95InferenceMs = 0;
  for (const [index, session] of sessions.entries()) {
    const prefix = `sessions[${index}]`;
    if (!isFiniteNumber(session.durationMs) || session.durationMs <= 0) {
      errors.push(`${prefix}.durationMs must be positive`);
    } else {
      totalDurationMs += session.durationMs;
    }
    if (!Number.isInteger(session.totalFrames) || session.totalFrames <= 0) {
      errors.push(`${prefix}.totalFrames must be a positive integer`);
    } else if (isFiniteNumber(session.avgInferenceMs) && session.avgInferenceMs >= 0) {
      totalFrames += session.totalFrames;
      weightedInferenceMs += session.avgInferenceMs * session.totalFrames;
    }
    if (!isFiniteNumber(session.avgInferenceMs) || session.avgInferenceMs < 0) {
      errors.push(`${prefix}.avgInferenceMs must be non-negative`);
    }
    if (!isFiniteNumber(session.p95InferenceMs) || session.p95InferenceMs < 0) {
      errors.push(`${prefix}.p95InferenceMs must be non-negative`);
    } else {
      maxP95InferenceMs = Math.max(maxP95InferenceMs, session.p95InferenceMs);
    }
  }

  if (totalDurationMs < MIN_DURATION_MS) {
    errors.push(`summed session duration must be at least ${MIN_DURATION_MS}ms`);
  }
  const averageInferenceMs = totalFrames > 0 ? weightedInferenceMs / totalFrames : NaN;
  if (!Number.isFinite(averageInferenceMs)) {
    errors.push('weighted average inference time cannot be calculated');
  } else if (averageInferenceMs > MAX_AVG_INFERENCE_MS) {
    errors.push(
      `weighted average inference time ${averageInferenceMs.toFixed(1)}ms exceeds ${MAX_AVG_INFERENCE_MS}ms`,
    );
  }

  return {
    errors,
    summary: {
      wallClockDurationMs:
        Number.isNaN(startedAt) || Number.isNaN(endedAt) ? 0 : endedAt - startedAt,
      totalDurationMs,
      totalFrames,
      weightedAverageInferenceMs: Number.isFinite(averageInferenceMs)
        ? Math.round(averageInferenceMs * 10) / 10
        : null,
      maxP95InferenceMs,
      crashCount: report.crashCount,
    },
  };
}

function main() {
  const input = process.argv[2];
  if (!input) {
    throw new Error('Usage: npm run test:device-stability -- <device-stability-report.json>');
  }
  const filePath = path.resolve(process.cwd(), input);
  const report = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const result = validateDeviceStabilityReport(report);
  const { errors, summary } = result;

  console.log(`Device stability report: ${filePath}`);
  console.log(JSON.stringify(summary, null, 2));
  if (errors.length > 0) {
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log('Device stability gate passed');
}

if (require.main === module) main();

module.exports = { validateDeviceStabilityReport };
