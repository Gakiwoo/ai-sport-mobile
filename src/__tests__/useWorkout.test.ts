jest.mock('react', () => ({
  useCallback: (fn: any) => fn,
  useEffect: (fn: () => void) => fn(),
  useRef: (initial: any) => ({ current: initial }),
  useState: (initial: any) => {
    const value = typeof initial === 'function' ? initial() : initial;
    return [value, jest.fn()];
  },
}));

const mockCounter = {
  getCount: jest.fn(() => 3),
  reset: jest.fn(),
  setFrameInterval: jest.fn(),
};

jest.mock('../services/counters/JumpRopeCounter', () => ({
  JumpRopeCounter: jest.fn(() => mockCounter),
}));

jest.mock('../services/StorageService', () => ({
  __esModule: true,
  default: {
    saveWorkout: jest.fn(),
  },
}));

import { useWorkout } from '../hooks/useWorkout';
import StorageService from '../services/StorageService';

describe('useWorkout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCounter.getCount.mockReturnValue(3);
  });

  it('returns saved false when workout persistence reports failure', async () => {
    (StorageService.saveWorkout as jest.Mock).mockResolvedValue(false);

    const workout = useWorkout('jump_rope');
    const result = await workout.stop();

    expect(result.session).not.toBeNull();
    expect(result.saved).toBe(false);
  });
});
