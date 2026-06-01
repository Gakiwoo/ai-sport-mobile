import { ExerciseType } from '../../../types';

export type GoldenPosePreset =
  | 'standing'
  | 'squat_bottom'
  | 'lying'
  | 'sitting_up'
  | 'jumping_jack_open'
  | 'airborne'
  | 'rope_swing'
  | 'long_jump_landing'
  | 'low_confidence'
  | 'missing_keypoint';

export interface GoldenPoseStep {
  preset: GoldenPosePreset;
  frames: number;
}

export interface GoldenPoseExpectation {
  minCount?: number;
  maxCount?: number;
  finalPhaseOneOf?: string[];
  calibrated?: boolean;
}

export interface GoldenPoseFixture {
  id: string;
  description: string;
  exerciseType: ExerciseType;
  frameIntervalMs: number;
  steps: GoldenPoseStep[];
  expect: GoldenPoseExpectation;
}
