type StabilityValidationResult = {
  errors: string[];
  summary: {
    totalDurationMs: number;
    totalFrames: number;
    weightedAverageInferenceMs: number | null;
  };
};

const { validateDeviceStabilityReport } = require('../../scripts/validate-device-stability') as {
  validateDeviceStabilityReport: (report: unknown) => StabilityValidationResult;
};

function completedReport() {
  return {
    schemaVersion: 1,
    status: 'completed',
    device: {
      manufacturer: 'Test Manufacturer',
      model: 'Low End Tablet',
      osVersion: 'Android 11',
      appVersion: '1.2.0',
    },
    startedAt: '2026-07-10T08:00:00.000Z',
    endedAt: '2026-07-10T08:30:00.000Z',
    crashCount: 0,
    sessions: [
      {
        durationMs: 900000,
        totalFrames: 1000,
        avgInferenceMs: 100,
        p95InferenceMs: 180,
      },
      {
        durationMs: 900000,
        totalFrames: 3000,
        avgInferenceMs: 140,
        p95InferenceMs: 220,
      },
    ],
  };
}

describe('device stability report validation', () => {
  it('accepts a complete 30-minute report under the inference budget', () => {
    const result = validateDeviceStabilityReport(completedReport());

    expect(result.errors).toEqual([]);
    expect(result.summary.totalDurationMs).toBe(1800000);
    expect(result.summary.totalFrames).toBe(4000);
    expect(result.summary.weightedAverageInferenceMs).toBe(130);
  });

  it('rejects incomplete, crashed or over-budget reports', () => {
    const report = completedReport();
    report.status = 'not_run';
    report.crashCount = 1;
    report.sessions[1].avgInferenceMs = 180;

    const result = validateDeviceStabilityReport(report);

    expect(result.errors).toEqual(
      expect.arrayContaining([
        'status must be completed',
        'crashCount must be 0, received 1',
        expect.stringContaining('exceeds 150ms'),
      ]),
    );
  });
});
