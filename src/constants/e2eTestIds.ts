/** Maestro / Detox E2E 使用的 testID 常量 */
export const E2E_TEST_IDS = {
  loginGuestButton: 'login-guest-button',
  homeExerciseCard: (type: string) => `home-exercise-${type}`,
  workoutStartButton: 'workout-start-button',
  workoutStopButton: 'workout-stop-button',
} as const;
