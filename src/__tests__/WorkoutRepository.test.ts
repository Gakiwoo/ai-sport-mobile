import { LocalWorkoutRepository } from '../services/WorkoutRepository';
import { WorkoutSession, WorkoutMode } from '../types';

// Mock AsyncStorage
const mockStore: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    setItem: jest.fn((key: string, value: string) => {
      mockStore[key] = value;
      return Promise.resolve();
    }),
    getItem: jest.fn((key: string) => {
      return Promise.resolve(mockStore[key] || null);
    }),
    removeItem: jest.fn((key: string) => {
      delete mockStore[key];
      return Promise.resolve();
    }),
    multiGet: jest.fn((keys: string[]) =>
      Promise.resolve(keys.map((k) => [k, mockStore[k] ?? null] as [string, string | null])),
    ),
  },
}));

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

describe('LocalWorkoutRepository', () => {
  let repo: LocalWorkoutRepository;

  beforeEach(() => {
    // Clear mock store
    Object.keys(mockStore).forEach((k) => delete mockStore[k]);
    repo = new LocalWorkoutRepository('@test_workouts');
  });

  describe('save', () => {
    it('应保存训练记录并返回 true', async () => {
      const session = makeSession();
      const result = await repo.save(session);
      expect(result).toBe(true);
    });

    it('保存后应能通过 getAll 读取', async () => {
      const session = makeSession({ id: 'session-1' });
      await repo.save(session);

      const all = await repo.getAll();
      expect(all.length).toBe(1);
      expect(all[0].id).toBe('session-1');
      expect(all[0].count).toBe(100);
    });

    it('多条记录应按时间戳排序', async () => {
      const session1 = makeSession({ id: 's1', timestamp: 1000 });
      const session2 = makeSession({ id: 's2', timestamp: 2000 });
      const session3 = makeSession({ id: 's3', timestamp: 500 });

      await repo.save(session1);
      await repo.save(session2);
      await repo.save(session3);

      const all = await repo.getAll();
      expect(all.length).toBe(3);
      expect(all[0].id).toBe('s3'); // timestamp 500
      expect(all[2].id).toBe('s2'); // timestamp 2000
    });
  });

  describe('getAll', () => {
    it('空数据库应返回空数组', async () => {
      const all = await repo.getAll();
      expect(all).toEqual([]);
    });

    it('所有记录应有 _syncStatus 和 _lastModified 字段', async () => {
      await repo.save(makeSession({ id: 's1' }));
      const all = await repo.getAll();
      expect(all[0]._syncStatus).toBe('local');
      expect(all[0]._lastModified).toBeGreaterThan(0);
    });

    it('旧数据无 _syncStatus 应自动迁移为 local', async () => {
      // Simulate old data without sync fields
      const oldData = JSON.stringify([
        {
          id: 'old-1',
          exerciseType: 'jump_rope',
          mode: 'count',
          count: 50,
          duration: 30,
          timestamp: 1000,
        },
      ]);
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      await AsyncStorage.setItem('@test_workouts', oldData);

      const all = await repo.getAll();
      expect(all[0]._syncStatus).toBe('local');
      expect(all[0]._lastModified).toBe(1000); // falls back to timestamp
    });
  });

  describe('getById', () => {
    it('应返回匹配 ID 的记录', async () => {
      await repo.save(makeSession({ id: 'match-me' }));
      await repo.save(makeSession({ id: 'not-me' }));

      const found = await repo.getById('match-me');
      expect(found).not.toBeNull();
      expect(found!.id).toBe('match-me');
    });

    it('不存在的 ID 应返回 null', async () => {
      const found = await repo.getById('nonexistent');
      expect(found).toBeNull();
    });
  });

  describe('getPendingSync', () => {
    it('新保存的记录应在待同步列表中', async () => {
      await repo.save(makeSession({ id: 'pending-1' }));
      const pending = await repo.getPendingSync();
      expect(pending.length).toBe(1);
      expect(pending[0].id).toBe('pending-1');
    });

    it('markSynced 后的记录不应在待同步列表中', async () => {
      await repo.save(makeSession({ id: 'to-sync' }));
      await repo.markSynced('to-sync');

      const pending = await repo.getPendingSync();
      expect(pending.length).toBe(0);
    });
  });

  describe('markSynced', () => {
    it('应标记记录为已同步', async () => {
      await repo.save(makeSession({ id: 'sync-me' }));
      const result = await repo.markSynced('sync-me', 'server-123');
      expect(result).toBe(true);

      const record = await repo.getById('sync-me');
      expect(record!._syncStatus).toBe('synced');
      expect(record!._serverId).toBe('server-123');
    });

    it('不存在的 ID 应返回 false', async () => {
      const result = await repo.markSynced('nope');
      expect(result).toBe(false);
    });
  });

  describe('batchMarkSynced', () => {
    it('应批量将多条记录标记为已同步（一次性重写，避免 O(n²)）', async () => {
      await repo.save(makeSession({ id: 'b1' }));
      await repo.save(makeSession({ id: 'b2' }));
      await repo.save(makeSession({ id: 'b3' }));

      const updated = await repo.batchMarkSynced(['b1', 'b2']);
      expect(updated).toBe(2);

      const pending = await repo.getPendingSync();
      expect(pending.map((r) => r.id).sort()).toEqual(['b3']);
      const b1 = await repo.getById('b1');
      expect(b1!._syncStatus).toBe('synced');
    });

    it('应写入 serverId 映射', async () => {
      await repo.save(makeSession({ id: 's1' }));
      const serverIds = new Map<string, string>([['s1', 'server-xyz']]);
      await repo.batchMarkSynced(['s1'], serverIds);
      const rec = await repo.getById('s1');
      expect(rec!._serverId).toBe('server-xyz');
    });

    it('已同步记录不应被重复计数', async () => {
      await repo.save(makeSession({ id: 'x1' }));
      await repo.markSynced('x1', 'svr');
      const updated = await repo.batchMarkSynced(['x1']);
      expect(updated).toBe(0);
    });

    it('空 ids 应返回 0 且不执行任何写入', async () => {
      await repo.save(makeSession({ id: 'e1' }));
      const updated = await repo.batchMarkSynced([]);
      expect(updated).toBe(0);
    });

    it('ids 含不存在的 id 时只更新存在的记录', async () => {
      await repo.save(makeSession({ id: 'real' }));
      const updated = await repo.batchMarkSynced(['real', 'ghost']);
      expect(updated).toBe(1);
      const rec = await repo.getById('real');
      expect(rec!._syncStatus).toBe('synced');
    });
  });

  describe('delete', () => {
    it('应删除指定记录', async () => {
      await repo.save(makeSession({ id: 'del-me' }));
      await repo.save(makeSession({ id: 'keep-me' }));

      await repo.delete('del-me');
      const all = await repo.getAll();
      expect(all.length).toBe(1);
      expect(all[0].id).toBe('keep-me');
    });

    it('删除不存在的记录不应报错', async () => {
      const result = await repo.delete('nope');
      expect(result).toBe(true);
    });
  });

  describe('getAnalytics', () => {
    it('应返回正确的统计数据', async () => {
      await repo.save(makeSession({ id: 'a', count: 100, duration: 60 }));
      await repo.save(makeSession({ id: 'b', count: 200, duration: 120 }));

      const analytics = await repo.getAnalytics();
      expect(analytics.totalWorkouts).toBe(2);
      expect(analytics.totalReps).toBe(300);
      expect(analytics.avgReps).toBe(150);
      expect(analytics.totalDuration).toBe(180);
      expect(analytics.recentWorkouts.length).toBe(2);
    });

    it('空数据库应返回零值', async () => {
      const analytics = await repo.getAnalytics();
      expect(analytics.totalWorkouts).toBe(0);
      expect(analytics.totalReps).toBe(0);
      expect(analytics.avgReps).toBe(0);
    });
  });

  describe('最大记录数', () => {
    it('超过最大记录数时应裁剪旧记录', async () => {
      // Save 1005 records (max is 1000)
      for (let i = 0; i < 1005; i++) {
        await repo.save(makeSession({ id: `rec-${i}`, timestamp: i }));
      }

      const all = await repo.getAll();
      expect(all.length).toBeLessThanOrEqual(1000);
      // Oldest records should be trimmed
      expect(all[0].id).toBe('rec-5');
    });
  });

  describe('分键存储结构', () => {
    it('save 应以分键形式存储，不再把整个历史写进 storageKey', async () => {
      await repo.save(makeSession({ id: 'sharded-1' }));
      await repo.save(makeSession({ id: 'sharded-2' }));
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      // 旧「单大数组」键不应再被写入
      expect(await AsyncStorage.getItem('@test_workouts')).toBeNull();
      // 每条记录独立存储
      expect(await AsyncStorage.getItem('@test_workouts:sharded-1')).not.toBeNull();
      expect(await AsyncStorage.getItem('@test_workouts:sharded-2')).not.toBeNull();
      // 索引键存在且内容正确
      const idxRaw = await AsyncStorage.getItem('@test_workouts:__index');
      expect(idxRaw).not.toBeNull();
      expect(JSON.parse(idxRaw as string)).toEqual(['sharded-1', 'sharded-2']);
    });

    it('旧大数组格式应迁移为分键并备份原键', async () => {
      const oldData = JSON.stringify([
        { id: 'legacy-1', exerciseType: 'jump_rope', mode: 'count', count: 50, duration: 30, timestamp: 1000 },
      ]);
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      await AsyncStorage.setItem('@test_workouts', oldData);

      await repo.getAll(); // 触发迁移

      // 原大数组键应被删除
      expect(await AsyncStorage.getItem('@test_workouts')).toBeNull();
      // 分键记录应已写入
      expect(await AsyncStorage.getItem('@test_workouts:legacy-1')).not.toBeNull();
      // 原数据应备份到 _legacy_backup_ 键
      const backupKey = Object.keys(mockStore).find((k) => k.includes('_legacy_backup_'));
      expect(backupKey).toBeDefined();
      expect(mockStore[backupKey as string]).toBe(oldData);
    });
  });
});
