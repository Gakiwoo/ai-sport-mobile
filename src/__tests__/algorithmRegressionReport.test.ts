type AlgorithmReport = {
  recorded: number;
  annotated: number;
  approved: number;
  evaluated: number;
  missingResults: string[];
  missedDetections: number;
  falseDetections: number;
  byExercise: Array<{
    exerciseType: string;
    samples: number;
    meanAbsoluteError: number;
    meanAbsolutePercentageError: number | null;
  }>;
  failureExamples: Array<{ id: string; absoluteError: number }>;
};

const { buildAlgorithmReport } = require('../../scripts/algorithm-regression-report') as {
  buildAlgorithmReport: (manifest: unknown) => AlgorithmReport;
};

describe('algorithm regression report', () => {
  it('computes per-exercise error, missed and false detections', () => {
    const report = buildAlgorithmReport({
      version: 1,
      requiredTotal: 3,
      videos: [
        {
          id: 'jr-1',
          exerciseType: 'jump_rope',
          status: 'approved',
          expected: { count: 10 },
          actual: { count: 9 },
        },
        {
          id: 'jr-2',
          exerciseType: 'jump_rope',
          status: 'approved',
          expected: { count: 10 },
          actual: { count: 12 },
        },
        {
          id: 'sq-1',
          exerciseType: 'squats',
          status: 'annotated',
          expected: { count: 8 },
        },
      ],
    });

    expect(report).toMatchObject({
      recorded: 3,
      annotated: 3,
      approved: 2,
      evaluated: 2,
      missingResults: ['sq-1'],
      missedDetections: 1,
      falseDetections: 2,
    });
    expect(report.byExercise).toContainEqual(
      expect.objectContaining({
        exerciseType: 'jump_rope',
        samples: 2,
        meanAbsoluteError: 1.5,
        meanAbsolutePercentageError: 0.15,
      }),
    );
    expect(report.failureExamples.map((item) => item.id)).toEqual(['jr-2', 'jr-1']);
  });
});
