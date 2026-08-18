import { syncService } from '../services/SyncService';
import { workoutRepository } from '../services/WorkoutRepository';
import { LocalWorkoutRecord, WorkoutMode, WorkoutSession } from '../types';

jest.mock('../services/WorkoutRepository', () => ({
  workoutRepository: {
    getPendingSync: jest.fn(),
    markSynced: jest.fn(),
    batchMarkSynced: jest.fn(() => Promise.resolve(1)),
    getAll: jest.fn(),
    getById: jest.fn(),
    saveSynced: jest.fn(() => Promise.resolve(true)),
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

    it('NestJS 契约：synced 为 id 字符串数组时也能正确标记（M4 回归）', async () => {
      process.env.EXPO_PUBLIC_ENABLE_CLOUD_SYNC = 'true';
      const records = [makeRecord('w1'), makeRecord('w2')];
      (workoutRepository.getPendingSync as jest.Mock).mockResolvedValue(records);
      (workoutRepository.batchMarkSynced as jest.Mock).mockResolvedValue(2);
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ synced: ['w1', 'w2'], conflicts: [] }),
      }) as typeof fetch;

      const result = await syncService.sync();

      expect(result.synced).toBe(2);
      // 服务端 id 同时作为 _serverId 写入
      expect(workoutRepository.batchMarkSynced).toHaveBeenCalledWith(
        ['w1', 'w2'],
        new Map([
          ['w1', 'w1'],
          ['w2', 'w2'],
        ]),
      );
    });

    it('服务端只确认部分 id 时，仅标记已确认记录，其余保持 pending（M3 回归）', async () => {
      process.env.EXPO_PUBLIC_ENABLE_CLOUD_SYNC = 'true';
      const records = [makeRecord('ok-1'), makeRecord('drop-1')];
      (workoutRepository.getPendingSync as jest.Mock).mockResolvedValue(records);
      (workoutRepository.batchMarkSynced as jest.Mock).mockResolvedValue(1);
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ synced: ['ok-1'], conflicts: ['drop-1'] }),
      }) as typeof fetch;

      const result = await syncService.sync();

      // 只标记 ok-1；drop-1 保持 pending，下一轮重推（不静默丢失）
      expect(workoutRepository.batchMarkSynced).toHaveBeenCalledWith(
        ['ok-1'],
        new Map([['ok-1', 'ok-1']]),
      );
      expect(result.synced).toBe(1);
      expect(result.errors).toEqual([]);
    });
  });

  describe('pull（P1-8 回归：字段映射 + 保持 synced + 富字段保护）', () => {
    const originalEnableCloudSync = process.env.EXPO_PUBLIC_ENABLE_CLOUD_SYNC;
    const originalFetch = global.fetch;

    beforeEach(() => {
      process.env.EXPO_PUBLIC_ENABLE_CLOUD_SYNC = 'true';
      (workoutRepository.getById as jest.Mock).mockResolvedValue(null);
    });

    afterEach(() => {
      process.env.EXPO_PUBLIC_ENABLE_CLOUD_SYNC = originalEnableCloudSync;
      global.fetch = originalFetch;
      jest.clearAllMocks();
    });

    it('服务端 snake_case 记录被映射为 camelCase 并以 synced 状态落库（不再循环重推）', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          records: [
            {
              id: 'srv-1',
              exercise_type: 'jump_rope',
              mode: 'count',
              count: 120,
              duration: 60,
              timestamp: 1780000000000,
              school_id: 'school-a',
              task_id: 'task-1',
              updated_at: '2026-08-14 06:00:00',
            },
          ],
          total: 1,
        }),
      }) as typeof fetch;

      const result = await syncService.pull();

      expect(result.merged).toBe(1);
      expect(workoutRepository.saveSynced).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'srv-1',
          exerciseType: 'jump_rope',
          count: 120,
          schoolId: 'school-a',
          taskId: 'task-1',
          _syncStatus: 'synced',
          _serverId: 'srv-1',
        }),
      );
      // 游标推进到服务端最大 updated_at
      expect((syncService as unknown as { lastSyncTimestamp: string }).lastSyncTimestamp).toBe(
        '2026-08-14 06:00:00',
      );
    });

    it('本地已有 synced 且含 exerciseResult 富数据时保留本地，不覆盖', async () => {
      (workoutRepository.getById as jest.Mock).mockResolvedValue({
        id: 'srv-1',
        exerciseType: 'jump_rope',
        _syncStatus: 'synced',
        exerciseResult: { sessionId: 's1', reps: 120 },
      });
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          records: [
            {
              id: 'srv-1',
              exercise_type: 'jump_rope',
              count: 999,
              updated_at: '2026-08-14 06:00:00',
            },
          ],
          total: 1,
        }),
      }) as typeof fetch;

      const result = await syncService.pull();

      expect(result.merged).toBe(1);
      expect(workoutRepository.saveSynced).not.toHaveBeenCalled();
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
