import type { ExerciseType, ExerciseResult } from '../types';

/**
 * Pilot 评分引擎（纯函数，双端共享同构实现）
 *
 * 设计依据（产品规则，可由体育老师调整）：
 * - 评级档位按「完成比例 = 实测结果 ÷ 目标」划分：
 *     ≥150% 优秀 / ≥100% 良好 / ≥60% 及格 / 否则 待提升
 *   reps 项目目标取任务 targetCount；cm 项目取 DISTANCE_REFERENCE 参考目标。
 * - 动作质量分 = valid/(valid+invalid+foul) × 置信度折减系数，0–100，
 *   分 标准(≥85) / 一般(≥60) / 需改进。
 * - 综合分 = 基础分（reps=有效次数，cm=厘米）× 质量系数（qualityScore/100），
 *   与原始成绩并列展示（原始成绩保留为官方实测值）。
 */

export type RatingTier = 'excellent' | 'good' | 'pass' | 'weak';
export type QualityTier = 'standard' | 'fair' | 'needs_improvement';

export interface ScoringInput {
  exerciseType: ExerciseType;
  /** 实测结果：reps 项目为有效次数，cm 项目为厘米数 */
  score: number;
  scoreUnit: 'reps' | 'cm';
  /** 有效次数（cm 项目可取 score 或有效跳数） */
  validCount: number;
  invalidCount: number;
  foulCount: number;
  /** 检测置信度 0..1 */
  confidence: number;
  /** 任务目标次数（reps 项目）；cm 项目忽略 */
  targetCount?: number;
  /** 显式厘米目标；缺省回退 DISTANCE_REFERENCE */
  targetCm?: number;
}

export interface ScoringResult {
  rating: RatingTier;
  ratingLabel: string;
  /** 是否达标（良好及以上） */
  passed: boolean;
  /** 完成比例 = 实测/目标；无目标时为 null */
  completionRatio: number | null;
  /** 动作质量分 0..100 */
  qualityScore: number;
  qualityTier: QualityTier;
  qualityLabel: string;
  /** 质量调整后的综合分（四舍五入整数） */
  compositeScore: number;
}

/** 评级阈值（按完成比例降序） */
export const RATING_THRESHOLDS: ReadonlyArray<{ tier: RatingTier; min: number }> = [
  { tier: 'excellent', min: 1.5 },
  { tier: 'good', min: 1.0 },
  { tier: 'pass', min: 0.6 },
  { tier: 'weak', min: 0 },
];

/** 距离类项目参考目标（厘米）：达标线基准，按项目标定（默认 PE 参考值，可调整） */
export const DISTANCE_REFERENCE: Partial<Record<ExerciseType, number>> = {
  standing_long_jump: 150,
  vertical_jump: 35,
};

/** 动作质量阈值（按 qualityScore 降序） */
export const QUALITY_THRESHOLDS: ReadonlyArray<{ tier: QualityTier; min: number }> = [
  { tier: 'standard', min: 85 },
  { tier: 'fair', min: 60 },
  { tier: 'needs_improvement', min: 0 },
];

/** 置信度对质量分的折减：confidence 越低，质量分上限越低 */
export const SCORING_CONFIG = {
  /** qualityScore = qualityRatio × 100 × (confidenceFloor + (1-confidenceFloor) × confidence) */
  confidenceFloor: 0.8,
};

export const RATING_LABELS: Record<RatingTier, string> = {
  excellent: '优秀',
  good: '良好',
  pass: '及格',
  weak: '待提升',
};

export const QUALITY_LABELS: Record<QualityTier, string> = {
  standard: '标准',
  fair: '一般',
  needs_improvement: '需改进',
};

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function resolveTarget(input: ScoringInput): number | null {
  if (input.scoreUnit === 'cm') {
    return input.targetCm != null
      ? input.targetCm
      : (DISTANCE_REFERENCE[input.exerciseType] ?? null);
  }
  return input.targetCount != null ? input.targetCount : null;
}

function rateByRatio(ratio: number | null): RatingTier {
  if (ratio == null) return 'weak';
  for (const threshold of RATING_THRESHOLDS) {
    if (ratio >= threshold.min) return threshold.tier;
  }
  return 'weak';
}

function qualityByScore(score: number): QualityTier {
  for (const threshold of QUALITY_THRESHOLDS) {
    if (score >= threshold.min) return threshold.tier;
  }
  return 'needs_improvement';
}

/**
 * 计算一次训练记录的评分结果。
 * 纯函数、无副作用，可单测，双端同构。
 */
export function scoreSession(input: ScoringInput): ScoringResult {
  const target = resolveTarget(input);
  const ratio = target != null && target > 0 ? input.score / target : null;
  const rating = rateByRatio(ratio);
  const passed = rating === 'excellent' || rating === 'good';

  const denom = input.validCount + input.invalidCount + input.foulCount;
  const qualityRatio = denom > 0 ? clamp01(input.validCount / denom) : 1;
  const confFactor =
    SCORING_CONFIG.confidenceFloor +
    (1 - SCORING_CONFIG.confidenceFloor) * clamp01(input.confidence);
  const qualityScore = Math.round(qualityRatio * 100 * confFactor);
  const qualityTier = qualityByScore(qualityScore);

  const base = input.scoreUnit === 'cm' ? input.score : input.validCount;
  const compositeScore = Math.round(base * (qualityScore / 100));

  return {
    rating,
    ratingLabel: RATING_LABELS[rating],
    passed,
    completionRatio: ratio,
    qualityScore,
    qualityTier,
    qualityLabel: QUALITY_LABELS[qualityTier],
    compositeScore,
  };
}

/**
 * 从 WorkoutSession 中提取评分输入（纯函数，双端共享）。
 * 消除 useWorkoutScreen / PilotDataPackageService 之间的重复提取逻辑。
 */
export function extractScoringInput(
  session: {
    exerciseType: ExerciseType;
    count: number;
    accuracy?: number;
    exerciseResult?: ExerciseResult;
  },
  targetCount?: number,
  targetCm?: number,
): ScoringInput {
  const result = session.exerciseResult;
  const scoreUnit: 'reps' | 'cm' = result?.distanceCm || result?.heightCm ? 'cm' : 'reps';
  const score = result?.distanceCm ?? result?.heightCm ?? result?.reps ?? session.count;
  return {
    exerciseType: session.exerciseType,
    score,
    scoreUnit,
    validCount: result?.validCount ?? session.count,
    invalidCount: result?.invalidCount ?? 0,
    foulCount: result?.foulCount ?? 0,
    confidence: result?.confidence ?? session.accuracy ?? 0,
    targetCount,
    targetCm,
  };
}
