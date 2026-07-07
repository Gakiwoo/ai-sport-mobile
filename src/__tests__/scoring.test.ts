import { scoreSession, RATING_LABELS, QUALITY_LABELS } from '../services/scoring';
import type { ScoringInput } from '../services/scoring';

function base(input: Partial<ScoringInput>): ScoringInput {
  return {
    exerciseType: 'jump_rope',
    score: 0,
    scoreUnit: 'reps',
    validCount: 0,
    invalidCount: 0,
    foulCount: 0,
    confidence: 1,
    targetCount: 30,
    ...input,
  };
}

describe('scoreSession - 评级档位（按有效次数÷目标比例）', () => {
  it('≥150% → 优秀', () => {
    const r = scoreSession(base({ score: 45, validCount: 45 }));
    expect(r.rating).toBe('excellent');
    expect(r.ratingLabel).toBe(RATING_LABELS.excellent);
    expect(r.passed).toBe(true);
    expect(r.completionRatio).toBeCloseTo(1.5);
  });

  it('≥100% → 良好', () => {
    const r = scoreSession(base({ score: 30, validCount: 30 }));
    expect(r.rating).toBe('good');
    expect(r.passed).toBe(true);
    expect(r.completionRatio).toBeCloseTo(1.0);
  });

  it('≥60% → 及格', () => {
    const r = scoreSession(base({ score: 18, validCount: 18 }));
    expect(r.rating).toBe('pass');
    expect(r.passed).toBe(false);
    expect(r.completionRatio).toBeCloseTo(0.6);
  });

  it('<60% → 待提升', () => {
    const r = scoreSession(base({ score: 10, validCount: 10 }));
    expect(r.rating).toBe('weak');
    expect(r.passed).toBe(false);
  });
});

describe('scoreSession - cm 距离类项目', () => {
  it('standing_long_jump 用 DISTANCE_REFERENCE 目标 150cm', () => {
    const r = scoreSession(
      base({
        exerciseType: 'standing_long_jump',
        scoreUnit: 'cm',
        score: 225,
        validCount: 225,
        targetCount: undefined,
      }),
    );
    expect(r.completionRatio).toBeCloseTo(1.5);
    expect(r.rating).toBe('excellent');
  });

  it('厘米目标可被显式 targetCm 覆盖', () => {
    const r = scoreSession(
      base({
        exerciseType: 'standing_long_jump',
        scoreUnit: 'cm',
        score: 150,
        validCount: 150,
        targetCm: 100,
      }),
    );
    expect(r.completionRatio).toBeCloseTo(1.5);
  });
});

describe('scoreSession - 动作质量分', () => {
  it('无无效/犯规 + 高置信度 → 100 标准', () => {
    const r = scoreSession(base({ score: 30, validCount: 30, confidence: 1 }));
    expect(r.qualityScore).toBe(100);
    expect(r.qualityTier).toBe('standard');
    expect(r.qualityLabel).toBe(QUALITY_LABELS.standard);
  });

  it('8 有效 / 2 无效 → 质量比 0.8 → 约 80 一般', () => {
    const r = scoreSession(base({ score: 10, validCount: 8, invalidCount: 2, foulCount: 0 }));
    expect(r.qualityScore).toBe(80);
    expect(r.qualityTier).toBe('fair');
  });

  it('低置信度(0.3) 折减质量分上限', () => {
    const r = scoreSession(base({ score: 30, validCount: 30, confidence: 0.3 }));
    // confFactor = 0.8 + 0.2*0.3 = 0.86 → 100*0.86 = 86
    expect(r.qualityScore).toBe(86);
  });

  it('无任何有效/无效数据 → 默认质量满分（仅受置信度影响）', () => {
    const r = scoreSession(base({ score: 0, validCount: 0, invalidCount: 0, foulCount: 0 }));
    expect(r.qualityScore).toBe(100);
  });
});

describe('scoreSession - 综合分（基础分 × 质量系数）', () => {
  it('reps：有效 50 × 质量 100% → 综合 50', () => {
    const r = scoreSession(base({ score: 50, validCount: 50 }));
    expect(r.compositeScore).toBe(50);
  });

  it('reps：有效 40 / 无效 10 → 质量 80% → 综合 32', () => {
    const r = scoreSession(base({ score: 40, validCount: 40, invalidCount: 10, foulCount: 0 }));
    expect(r.qualityScore).toBe(80);
    expect(r.compositeScore).toBe(32);
  });

  it('cm：150cm × 质量 100% → 综合 150', () => {
    const r = scoreSession(
      base({ exerciseType: 'standing_long_jump', scoreUnit: 'cm', score: 150, validCount: 150 }),
    );
    expect(r.compositeScore).toBe(150);
  });
});

describe('scoreSession - 无目标降级', () => {
  it('reps 无 targetCount → 比例 null，评级待提升，未达标', () => {
    const r = scoreSession(base({ score: 30, validCount: 30, targetCount: undefined }));
    expect(r.completionRatio).toBeNull();
    expect(r.rating).toBe('weak');
    expect(r.passed).toBe(false);
  });
});

describe('scoreSession - 鲁棒性', () => {
  it('NaN 置信度不抛错且结果有限', () => {
    const r = scoreSession(base({ score: 30, validCount: 30, confidence: Number.NaN }));
    expect(Number.isFinite(r.qualityScore)).toBe(true);
    expect(Number.isFinite(r.compositeScore)).toBe(true);
    expect(r.qualityScore).toBe(80);
  });

  it('全零输入不抛错，默认质量满分', () => {
    const r = scoreSession(base({ score: 0, validCount: 0, invalidCount: 0, foulCount: 0 }));
    expect(Number.isFinite(r.compositeScore)).toBe(true);
    expect(r.qualityScore).toBe(100);
  });
});
