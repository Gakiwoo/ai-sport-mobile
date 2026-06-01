import {
  EXERCISE_REGISTRY,
  getExerciseDefinition,
  getExerciseRuntimeProfile,
} from '../constants/exerciseRegistry';

describe('exerciseRegistry', () => {
  it('lists every supported exercise type once', () => {
    expect(EXERCISE_REGISTRY).toHaveLength(6);
    const types = EXERCISE_REGISTRY.map((e) => e.type);
    expect(new Set(types).size).toBe(6);
  });

  it('aligns UI defaults with runtime profile', () => {
    const jumpRope = getExerciseDefinition('jump_rope');
    const profile = getExerciseRuntimeProfile('jump_rope');

    expect(jumpRope.name).toBe('跳绳');
    expect(jumpRope.defaultTargetCount).toBe(100);
    expect(profile.activePoseIntervalMs).toBe(80);
    expect(profile.previewPoseIntervalMs).toBeGreaterThan(profile.activePoseIntervalMs);
  });

  it('keeps every interval inside CameraView supported bounds', () => {
    EXERCISE_REGISTRY.forEach((entry) => {
      const profile = getExerciseRuntimeProfile(entry.type);
      expect(profile.activePoseIntervalMs).toBeGreaterThanOrEqual(50);
      expect(profile.activePoseIntervalMs).toBeLessThanOrEqual(300);
      expect(profile.previewPoseIntervalMs).toBeGreaterThanOrEqual(50);
      expect(profile.previewPoseIntervalMs).toBeLessThanOrEqual(300);
      expect(profile.maxAdaptiveIntervalMs).toBeGreaterThanOrEqual(profile.activePoseIntervalMs);
      expect(profile.modelComplexity === 0 || profile.modelComplexity === 1).toBe(true);
    });
  });
});
