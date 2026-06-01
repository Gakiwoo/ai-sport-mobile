import { ExerciseType } from '../types';

const MIN_INTERVAL_MS = 50;
const MAX_INTERVAL_MS = 300;

export interface ExerciseRuntimeProfile {
  activePoseIntervalMs: number;
  previewPoseIntervalMs: number;
  maxAdaptiveIntervalMs: number;
  modelComplexity: 0 | 1;
}

interface ExerciseRegistryEntry {
  type: ExerciseType;
  name: string;
  icon: string;
  defaultTargetCount: number;
  defaultDurationSec: number;
  runtime: ExerciseRuntimeProfile;
}

const REGISTRY_ENTRIES: ExerciseRegistryEntry[] = [
  {
    type: 'jump_rope',
    name: '跳绳',
    icon: '🪢',
    defaultTargetCount: 100,
    defaultDurationSec: 60,
    runtime: {
      activePoseIntervalMs: 80,
      previewPoseIntervalMs: 240,
      maxAdaptiveIntervalMs: 180,
      modelComplexity: 0,
    },
  },
  {
    type: 'jumping_jacks',
    name: '开合跳',
    icon: '🤸',
    defaultTargetCount: 50,
    defaultDurationSec: 60,
    runtime: {
      activePoseIntervalMs: 90,
      previewPoseIntervalMs: 240,
      maxAdaptiveIntervalMs: 190,
      modelComplexity: 0,
    },
  },
  {
    type: 'squats',
    name: '深蹲',
    icon: '🏋️',
    defaultTargetCount: 30,
    defaultDurationSec: 60,
    runtime: {
      activePoseIntervalMs: 130,
      previewPoseIntervalMs: 260,
      maxAdaptiveIntervalMs: 240,
      modelComplexity: 0,
    },
  },
  {
    type: 'standing_long_jump',
    name: '立定跳远',
    icon: '🦘',
    defaultTargetCount: 10,
    defaultDurationSec: 30,
    runtime: {
      activePoseIntervalMs: 100,
      previewPoseIntervalMs: 260,
      maxAdaptiveIntervalMs: 200,
      modelComplexity: 0,
    },
  },
  {
    type: 'vertical_jump',
    name: '纵跳摸高',
    icon: '⬆️',
    defaultTargetCount: 20,
    defaultDurationSec: 30,
    runtime: {
      activePoseIntervalMs: 90,
      previewPoseIntervalMs: 240,
      maxAdaptiveIntervalMs: 190,
      modelComplexity: 0,
    },
  },
  {
    type: 'sit_ups',
    name: '仰卧起坐',
    icon: '🧘',
    defaultTargetCount: 40,
    defaultDurationSec: 60,
    runtime: {
      activePoseIntervalMs: 130,
      previewPoseIntervalMs: 260,
      maxAdaptiveIntervalMs: 240,
      modelComplexity: 0,
    },
  },
];

const REGISTRY_BY_TYPE = Object.fromEntries(
  REGISTRY_ENTRIES.map((entry) => [entry.type, entry]),
) as Record<ExerciseType, ExerciseRegistryEntry>;

function clampInterval(ms: number): number {
  return Math.max(MIN_INTERVAL_MS, Math.min(MAX_INTERVAL_MS, ms));
}

export function getExerciseDefinition(type: ExerciseType): ExerciseRegistryEntry {
  return REGISTRY_BY_TYPE[type];
}

export function getExerciseRuntimeProfile(type: ExerciseType): ExerciseRuntimeProfile {
  const { runtime } = getExerciseDefinition(type);
  return {
    activePoseIntervalMs: clampInterval(runtime.activePoseIntervalMs),
    previewPoseIntervalMs: clampInterval(runtime.previewPoseIntervalMs),
    maxAdaptiveIntervalMs: clampInterval(runtime.maxAdaptiveIntervalMs),
    modelComplexity: runtime.modelComplexity,
  };
}

/** @deprecated 使用 getExerciseDefinition；保留供 HomeScreen 列表渲染 */
export interface ExerciseConfig {
  type: ExerciseType;
  name: string;
  icon: string;
  targetDefault: number;
}

export const EXERCISE_REGISTRY = REGISTRY_ENTRIES;

export const EXERCISE_CONFIGS: ExerciseConfig[] = REGISTRY_ENTRIES.map((entry) => ({
  type: entry.type,
  name: entry.name,
  icon: entry.icon,
  targetDefault: entry.defaultTargetCount,
}));

export const EXERCISE_NAMES = Object.fromEntries(
  REGISTRY_ENTRIES.map((e) => [e.type, e.name]),
) as Record<ExerciseType, string>;

export const DEFAULT_TARGETS = Object.fromEntries(
  REGISTRY_ENTRIES.map((e) => [e.type, e.defaultTargetCount]),
) as Record<ExerciseType, number>;

export const DEFAULT_DURATIONS = Object.fromEntries(
  REGISTRY_ENTRIES.map((e) => [e.type, e.defaultDurationSec]),
) as Record<ExerciseType, number>;
