import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { useWorkout } from '../hooks/useWorkout';
import { workoutRepository } from '../services/WorkoutRepository';
import { standingPose } from './testHelpers';

const mockCounter = {
  getCount: jest.fn(() => 0),
  reset: jest.fn(),
  setFrameInterval: jest.fn(),
  processFrame: jest.fn(),
  processFrameResult: jest.fn(),
  startSession: jest.fn(),
  getSessionResult: jest.fn(),
};

jest.mock('../services/counters/SquatsCounter', () => ({
  SquatsCounter: jest.fn(() => mockCounter),
}));

jest.mock('../services/WorkoutRepository', () => ({
  workoutRepository: {
    save: jest.fn().mockResolvedValue(true),
    getAll: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('../services/SyncService', () => ({
  syncService: {
    syncAfterWorkout: jest.fn().mockResolvedValue(undefined),
    start: jest.fn(),
    stop: jest.fn(),
  },
}));

jest.mock('../services/PerformanceMonitor', () => ({
  performanceMonitor: {
    start: jest.fn(),
    stop: jest.fn(),
    recordFrame: jest.fn(),
  },
}));

function mountWorkout(exerciseType: 'squats' = 'squats') {
  let api!: ReturnType<typeof useWorkout>;
  let renderer!: TestRenderer.ReactTestRenderer;

  function Harness() {
    api = useWorkout(exerciseType);
    return null;
  }

  act(() => {
    renderer = TestRenderer.create(<Harness />);
  });

  return {
    get api() {
      return api;
    },
    rerender: () => {
      act(() => {
        renderer.update(<Harness />);
      });
    },
  };
}

describe('useWorkout flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCounter.getCount.mockReturnValue(0);
    mockCounter.getSessionResult.mockReturnValue({
      sessionId: 'session-flow',
      exerciseType: 'squats',
      reps: 0,
      validCount: 0,
      invalidCount: 0,
      foulCount: 0,
      confidence: 0,
      durationMs: 0,
      feedback: [],
      algorithmLog: [],
      startedAt: '2026-07-01T00:00:00.000Z',
      endedAt: '2026-07-01T00:00:01.000Z',
    });
  });

  it('start activates workout and resets counter', () => {
    const harness = mountWorkout();

    act(() => {
      harness.api.start();
    });
    harness.rerender();

    expect(harness.api.isActive).toBe(true);
    expect(mockCounter.reset).toHaveBeenCalled();
    expect(mockCounter.startSession).toHaveBeenCalledWith(
      'squats',
      expect.objectContaining({
        sessionId: expect.any(String),
        startedAt: expect.any(String),
      }),
    );
  });

  it('processFrame updates count while active', () => {
    const harness = mountWorkout();

    act(() => {
      harness.api.start();
    });
    harness.rerender();

    mockCounter.getCount.mockReturnValue(5);
    act(() => {
      harness.api.processFrame(standingPose());
    });
    harness.rerender();

    expect(mockCounter.processFrameResult).toHaveBeenCalled();
    expect(harness.api.count).toBe(5);
  });

  it('stop persists session when count > 0', async () => {
    const harness = mountWorkout();

    act(() => {
      harness.api.start();
    });
    harness.rerender();

    mockCounter.getCount.mockReturnValue(12);
    mockCounter.getSessionResult.mockReturnValue({
      sessionId: 'session-flow',
      exerciseType: 'squats',
      reps: 12,
      validCount: 12,
      invalidCount: 0,
      foulCount: 0,
      confidence: 1,
      durationMs: 1000,
      feedback: [],
      algorithmLog: [],
      startedAt: '2026-07-01T00:00:00.000Z',
      endedAt: '2026-07-01T00:00:01.000Z',
    });

    let result!: Awaited<ReturnType<typeof harness.api.stop>>;
    await act(async () => {
      result = await harness.api.stop();
    });
    harness.rerender();

    expect(workoutRepository.save).toHaveBeenCalled();
    expect(result.saved).toBe(true);
    expect(result.session?.count).toBe(12);
    expect(result.session?.exerciseType).toBe('squats');
    expect(result.session?.exerciseResult).toMatchObject({
      exerciseType: 'squats',
      reps: 12,
      validCount: 12,
      confidence: 1,
    });
    expect(harness.api.isActive).toBe(false);
  });

  it('stop skips save when count is zero in count mode', async () => {
    const harness = mountWorkout();

    act(() => {
      harness.api.start();
    });
    harness.rerender();

    mockCounter.getCount.mockReturnValue(0);

    let result!: Awaited<ReturnType<typeof harness.api.stop>>;
    await act(async () => {
      result = await harness.api.stop();
    });

    expect(workoutRepository.save).not.toHaveBeenCalled();
    expect(result.session).toBeNull();
    expect(result.saved).toBe(false);
  });
});
