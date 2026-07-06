jest.mock('react', () => ({
  useCallback: (fn: unknown) => fn,
  useEffect: (fn: () => void) => fn(),
  useRef: (initial: unknown) => ({ current: initial }),
  useState: (initial: unknown) => {
    const value = typeof initial === 'function' ? initial() : initial;
    return [value, jest.fn()];
  },
}));

const mockCounter = {
  getCount: jest.fn(() => 3),
  reset: jest.fn(),
  setFrameInterval: jest.fn(),
  startSession: jest.fn(),
  getSessionResult: jest.fn(() => ({
    sessionId: 'session-use-workout',
    exerciseType: 'jump_rope',
    reps: 3,
    validCount: 3,
    invalidCount: 0,
    foulCount: 0,
    confidence: 1,
    durationMs: 1000,
    feedback: [],
    algorithmLog: [],
    startedAt: '2026-07-01T00:00:00.000Z',
    endedAt: '2026-07-01T00:00:01.000Z',
  })),
};

jest.mock('../services/counters/JumpRopeCounter', () => ({
  JumpRopeCounter: jest.fn(() => mockCounter),
}));

jest.mock('../services/WorkoutRepository', () => ({
  workoutRepository: {
    save: jest.fn(),
  },
}));

jest.mock('../services/SyncService', () => ({
  syncService: {
    syncAfterWorkout: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../services/PerformanceMonitor', () => ({
  performanceMonitor: {
    start: jest.fn(),
    stop: jest.fn(),
  },
}));

import { useWorkout } from '../hooks/useWorkout';
import { workoutRepository } from '../services/WorkoutRepository';

describe('useWorkout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCounter.getCount.mockReturnValue(3);
  });

  it('returns saved false when workout persistence reports failure', async () => {
    (workoutRepository.save as jest.Mock).mockResolvedValue(false);

    const workout = useWorkout('jump_rope');
    const result = await workout.stop();

    expect(result.session).not.toBeNull();
    expect(result.saved).toBe(false);
  });
});
