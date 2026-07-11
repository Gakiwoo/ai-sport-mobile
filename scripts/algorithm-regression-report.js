const fs = require('fs');
const path = require('path');

function resolveMetric(video) {
  for (const key of ['count', 'distanceCm', 'heightCm']) {
    const expected = video.expected?.[key];
    const actual = video.actual?.[key];
    if (typeof expected === 'number' && Number.isFinite(expected)) {
      return {
        key,
        expected,
        actual: typeof actual === 'number' && Number.isFinite(actual) ? actual : null,
      };
    }
  }
  return null;
}

function round(value, digits = 3) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function buildAlgorithmReport(manifest) {
  const recorded = manifest.videos.filter((video) =>
    ['recorded', 'annotated', 'approved'].includes(video.status),
  );
  const annotated = manifest.videos.filter((video) =>
    ['annotated', 'approved'].includes(video.status),
  );
  const approved = manifest.videos.filter((video) => video.status === 'approved');
  const evaluated = [];
  const missingResults = [];

  for (const video of annotated) {
    const metric = resolveMetric(video);
    if (!metric || metric.actual == null) {
      missingResults.push(video.id || '<unassigned>');
      continue;
    }
    const absoluteError = Math.abs(metric.actual - metric.expected);
    const absolutePercentageError =
      metric.expected !== 0 ? absoluteError / Math.abs(metric.expected) : null;
    const derivedMissed = metric.key === 'count' ? Math.max(0, metric.expected - metric.actual) : 0;
    const derivedFalse = metric.key === 'count' ? Math.max(0, metric.actual - metric.expected) : 0;
    evaluated.push({
      id: video.id,
      exerciseType: video.exerciseType,
      metric: metric.key,
      expected: metric.expected,
      actual: metric.actual,
      absoluteError,
      absolutePercentageError,
      missedDetections: video.actual?.missedDetections ?? derivedMissed,
      falseDetections: video.actual?.falseDetections ?? derivedFalse,
    });
  }

  const grouped = new Map();
  for (const row of evaluated) {
    const group = grouped.get(row.exerciseType) || [];
    group.push(row);
    grouped.set(row.exerciseType, group);
  }

  const byExercise = Array.from(grouped.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([exerciseType, rows]) => {
      const percentageRows = rows.filter((row) => row.absolutePercentageError != null);
      return {
        exerciseType,
        metric: rows[0].metric,
        samples: rows.length,
        meanAbsoluteError: round(
          rows.reduce((sum, row) => sum + row.absoluteError, 0) / rows.length,
        ),
        meanAbsolutePercentageError:
          percentageRows.length > 0
            ? round(
                percentageRows.reduce((sum, row) => sum + row.absolutePercentageError, 0) /
                  percentageRows.length,
              )
            : null,
        missedDetections: rows.reduce((sum, row) => sum + row.missedDetections, 0),
        falseDetections: rows.reduce((sum, row) => sum + row.falseDetections, 0),
      };
    });

  const failures = evaluated
    .filter((row) => row.absoluteError > 0)
    .sort((left, right) => right.absoluteError - left.absoluteError)
    .slice(0, 20)
    .map((row) => ({
      id: row.id,
      exerciseType: row.exerciseType,
      metric: row.metric,
      expected: row.expected,
      actual: row.actual,
      absoluteError: row.absoluteError,
    }));

  return {
    schemaVersion: manifest.version,
    requiredTotal: manifest.requiredTotal,
    totalRows: manifest.videos.length,
    recorded: recorded.length,
    annotated: annotated.length,
    approved: approved.length,
    evaluated: evaluated.length,
    missingResults,
    byExercise,
    missedDetections: evaluated.reduce((sum, row) => sum + row.missedDetections, 0),
    falseDetections: evaluated.reduce((sum, row) => sum + row.falseDetections, 0),
    failureExamples: failures,
  };
}

function printText(report) {
  console.log('AI Sport algorithm regression report');
  for (const key of [
    'schemaVersion',
    'requiredTotal',
    'totalRows',
    'recorded',
    'annotated',
    'approved',
    'evaluated',
    'missedDetections',
    'falseDetections',
  ]) {
    console.log(`${key}: ${report[key]}`);
  }
  if (report.byExercise.length === 0) {
    console.log('metrics: n/a (waiting for annotated ground truth and algorithm results)');
  } else {
    console.log('byExercise:');
    for (const row of report.byExercise) {
      const mape =
        row.meanAbsolutePercentageError == null
          ? 'n/a'
          : `${round(row.meanAbsolutePercentageError * 100, 2)}%`;
      console.log(
        `- ${row.exerciseType}: n=${row.samples}, metric=${row.metric}, MAE=${row.meanAbsoluteError}, MAPE=${mape}, missed=${row.missedDetections}, false=${row.falseDetections}`,
      );
    }
  }
  if (report.missingResults.length > 0) {
    console.log(`missingResults: ${report.missingResults.slice(0, 20).join(', ')}`);
  }
  if (report.failureExamples.length > 0) {
    console.log('failureExamples:');
    for (const failure of report.failureExamples) {
      console.log(
        `- ${failure.id}: expected=${failure.expected}, actual=${failure.actual}, error=${failure.absoluteError}`,
      );
    }
  } else {
    console.log('failureExamples: none');
  }
}

function main() {
  const repoRoot = path.resolve(__dirname, '..');
  const manifestPath = path.join(repoRoot, 'docs', 'testing', 'video-dataset-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const report = buildAlgorithmReport(manifest);

  if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2));
  else printText(report);

  if (
    process.argv.includes('--strict') &&
    (report.approved !== report.requiredTotal || report.evaluated !== report.approved)
  ) {
    throw new Error(
      `Strict algorithm report failed: approved=${report.approved}/${report.requiredTotal}, evaluated=${report.evaluated}/${report.approved}`,
    );
  }
}

if (require.main === module) main();

module.exports = { buildAlgorithmReport, resolveMetric };
