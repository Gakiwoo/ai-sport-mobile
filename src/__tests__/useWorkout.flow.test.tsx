import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { useWorkout } from '../hooks/useWorkout';
import StorageService from '../services/StorageService';
import { standingPose } from './testHelpers';

const mockCounter = {
  getCount: jest.fn(() => 0),
  reset: jest.fn(),
  setFrameInterval: jest.fn(),
  processFrame: jest.fn(),
};

jest.mock('../services/counters/SquatsCounter', () => ({
  SquatsCounter: jest.fn(() => mockCounter),
}));

jest.mock('../services/StorageService', () => ({
  __esModule: true,
  default: {
    saveWorkout: jest.fn().mockResolvedValue(true),
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
  });

  it('start activates workout and resets counter', () => {
    const harness = mountWorkout();

    act(() => {
      harness.api.start();
    });
    harness.rerender();

    expect(harness.api.isActive).toBe(true);
    expect(mockCounter.reset).toHaveBeenCalled();
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

    expect(mockCounter.processFrame).toHaveBeenCalled();
    expect(harness.api.count).toBe(5);
  });

  it('stop persists session when count > 0', async () => {
    const harness = mountWorkout();

    act(() => {
      harness.api.start();
    });
    harness.rerender();

    mockCounter.getCount.mockReturnValue(12);

    let result!: Awaited<ReturnType<typeof harness.api.stop>>;
    await act(async () => {
      result = await harness.api.stop();
    });
    harness.rerender();

    expect(StorageService.saveWorkout).toHaveBeenCalled();
    expect(result.saved).toBe(true);
    expect(result.session?.count).toBe(12);
    expect(result.session?.exerciseType).toBe('squats');
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

    expect(StorageService.saveWorkout).not.toHaveBeenCalled();
    expect(result.session).toBeNull();
    expect(result.saved).toBe(false);
  });
});
