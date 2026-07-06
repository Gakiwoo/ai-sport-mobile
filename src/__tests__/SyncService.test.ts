import { syncService } from '../services/SyncService';
import { workoutRepository } from '../services/WorkoutRepository';
import { LocalWorkoutRecord, WorkoutMode, WorkoutSession } from '../types';

jest.mock('../services/WorkoutRepository', () => ({
  workoutRepository: {
    getPendingSync: jest.fn(),
    markSynced: jest.fn(),
    batchMarkSynced: jest.fn(() => Promise.resolve(1)),
    getAll: jest.fn(),
  },
  LocalWorkoutRepository: jest.fn(),
}));

// Mock SecureStorageService：阻断 expo-secure-store 的 ESM 转译链路
// （SyncService → AuthService → SecureStorageService → expo-secure-store）
jest.mock('../services/SecureStorageService', () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    __store: store,
    default: {
      getItem: jest.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
      setItem: jest.fn((key: string, value: string) => {
        store.set(key, value);
        return Promise.resolve();
      }),
      removeItem: jest.fn((key: string) => {
        store.delete(key);
        return Promise.resolve();
      }),
      isAvailable: jest.fn(() => Promise.resolve(true)),
    },
  };
});

function makeSession(overrides: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    id: overrides.id || 'test-id',
    exerciseType: overrides.exerciseType || 'jump_rope',
    mode: (overrides.mode || 'count') as WorkoutMode,
    count: overrides.count ?? 100,
    duration: overrides.duration ?? 60,
    timestamp: overrides.timestamp ?? Date.now(),
  };
}

function makeRecord(id: string): LocalWorkoutRecord {
  return { ...makeSession({ id }), _syncStatus: 'local', _lastModified: Date.now() };
}

describe('SyncService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    syncService.stop();
  });

  afterEach(() => {
    syncService.stop();
  });

  describe('sync', () => {
    it('无待同步记录时应返回 0', async () => {
      (workoutRepository.getPendingSync as jest.Mock).mockResolvedValue([]);

      const result = await syncService.sync();
      expect(result.synced).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.skipped).toBe(0);
    });

    it('云同步未启用时保留待同步记录，不应假标记为已同步', async () => {
      const records = [makeRecord('r1'), makeRecord('r2')];
      (workoutRepository.getPendingSync as jest.Mock).mockResolvedValue(records);

      const result = await syncService.sync();
      expect(result.synced).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.skipped).toBe(2);
      expect(workoutRepository.markSynced).not.toHaveBeenCalled();
      expect(result.errors[0]).toContain('Cloud sync is disabled');
    });

    it('同步读取失败时应记录错误', async () => {
      const records = [makeRecord('r1'), makeRecord('r2')];
      void records;
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      (workoutRepository.getPendingSync as jest.Mock).mockRejectedValue(new Error('DB error'));

      try {
        const result = await syncService.sync();
        expect(result.failed).toBe(1);
        expect(result.errors[0]).toBe('DB error');
      } finally {
        errorSpy.mockRestore();
      }
    });

    it('正在同步时不重复执行', async () => {
      let resolvePending: (value: LocalWorkoutRecord[]) => void;
      const pendingPromise = new Promise<LocalWorkoutRecord[]>((resolve) => {
        resolvePending = resolve;
      });
      (workoutRepository.getPendingSync as jest.Mock).mockReturnValue(pendingPromise);

      const firstSync = syncService.sync();
      const secondResult = await syncService.sync();

      expect(secondResult.errors).toContain('Already syncing');

      resolvePending!([]);
      await firstSync;
    });
  });

  describe('sync with cloud enabled', () => {
    const originalEnableCloudSync = process.env.EXPO_PUBLIC_ENABLE_CLOUD_SYNC;
    const originalFetch = global.fetch;

    afterEach(() => {
      process.env.EXPO_PUBLIC_ENABLE_CLOUD_SYNC = originalEnableCloudSync;
      global.fetch = originalFetch;
    });

    it('后端同步成功后才标记为已同步', async () => {
      process.env.EXPO_PUBLIC_ENABLE_CLOUD_SYNC = 'true';
      const records = [makeRecord('r1')];
      (workoutRepository.getPendingSync as jest.Mock).mockResolvedValue(records);
      (workoutRepository.markSynced as jest.Mock).mockResolvedValue(true);
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ synced: [{ localId: 'r1', serverId: 'server-r1' }] }),
      }) as typeof fetch;

      const result = await syncService.sync();

      expect(result.synced).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.skipped).toBe(0);
      expect(workoutRepository.batchMarkSynced).toHaveBeenCalledWith(
        ['r1'],
        new Map([['r1', 'server-r1']]),
      );
    });
  });

  describe('getPendingCount', () => {
    it('应返回待同步数量', async () => {
      const records = [
        { id: 'r1', _syncStatus: 'local' },
        { id: 'r2', _syncStatus: 'local' },
        { id: 'r3', _syncStatus: 'synced' },
      ];
      (workoutRepository.getPendingSync as jest.Mock).mockResolvedValue(records);

      const count = await syncService.getPendingCount();
      expect(count).toBe(3);
    });
  });

  describe('syncAfterWorkout', () => {
    it('训练后调用不应抛出异常', async () => {
      (workoutRepository.getPendingSync as jest.Mock).mockResolvedValue([]);

      await expect(syncService.syncAfterWorkout()).resolves.toBeUndefined();
    });
  });
});
