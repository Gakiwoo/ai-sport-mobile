import { ExerciseType, Pose } from '../types';
import { ExerciseCounter } from '../services/ExerciseCounter';
import { JumpRopeCounter } from '../services/counters/JumpRopeCounter';
import { JumpingJacksCounter } from '../services/counters/JumpingJacksCounter';
import { SquatsCounter } from '../services/counters/SquatsCounter';
import { StandingLongJumpCounter } from '../services/counters/StandingLongJumpCounter';
import { VerticalJumpCounter } from '../services/counters/VerticalJumpCounter';
import { SitUpCounter } from '../services/counters/SitUpCounter';
import {
  airbornePose,
  jumpingJackOpenPose,
  longJumpLandingPose,
  lowConfidencePose,
  lyingPose,
  missingKeypointPose,
  ropeSwingPose,
  sittingUpPose,
  squatBottomPose,
  standingPose,
} from './testHelpers';
import { GoldenPoseFixture, GoldenPosePreset } from './fixtures/goldenPoses/types';

const PRESET_BUILDERS: Record<GoldenPosePreset, () => Pose> = {
  standing: standingPose,
  squat_bottom: squatBottomPose,
  lying: lyingPose,
  sitting_up: sittingUpPose,
  jumping_jack_open: jumpingJackOpenPose,
  airborne: airbornePose,
  rope_swing: ropeSwingPose,
  long_jump_landing: longJumpLandingPose,
  low_confidence: lowConfidencePose,
  missing_keypoint: missingKeypointPose,
};

export function poseFromPreset(preset: GoldenPosePreset): Pose {
  const builder = PRESET_BUILDERS[preset];
  if (!builder) {
    throw new Error(`Unknown golden pose preset: ${preset}`);
  }
  return builder();
}

export function createCounterForExercise(type: ExerciseType): ExerciseCounter {
  switch (type) {
    case 'jump_rope':
      return new JumpRopeCounter();
    case 'jumping_jacks':
      return new JumpingJacksCounter();
    case 'squats':
      return new SquatsCounter();
    case 'standing_long_jump':
      return new StandingLongJumpCounter();
    case 'vertical_jump':
      return new VerticalJumpCounter();
    case 'sit_ups':
      return new SitUpCounter();
  }
}

export interface GoldenPoseRunResult {
  count: number;
  phase: string;
  calibrated?: boolean;
}

export function runGoldenPoseFixture(fixture: GoldenPoseFixture): GoldenPoseRunResult {
  const counter = createCounterForExercise(fixture.exerciseType);
  counter.setFrameInterval(fixture.frameIntervalMs);

  for (const step of fixture.steps) {
    const pose = poseFromPreset(step.preset);
    for (let i = 0; i < step.frames; i++) {
      counter.processFrame(pose);
    }
  }

  const calibrated =
    'isCalibrated' in counter &&
    typeof (counter as { isCalibrated: () => boolean }).isCalibrated === 'function'
      ? (counter as { isCalibrated: () => boolean }).isCalibrated()
      : undefined;

  return {
    count: counter.getCount(),
    phase: counter.getPhase(),
    calibrated,
  };
}

export function assertGoldenExpectation(
  fixture: GoldenPoseFixture,
  result: GoldenPoseRunResult,
): void {
  const { expect: exp } = fixture;

  if (exp.minCount !== undefined) {
    expect(result.count).toBeGreaterThanOrEqual(exp.minCount);
  }
  if (exp.maxCount !== undefined) {
    expect(result.count).toBeLessThanOrEqual(exp.maxCount);
  }
  if (exp.finalPhaseOneOf?.length) {
    expect(exp.finalPhaseOneOf).toContain(result.phase);
  }
  if (exp.calibrated !== undefined && result.calibrated !== undefined) {
    expect(result.calibrated).toBe(exp.calibrated);
  }
}
