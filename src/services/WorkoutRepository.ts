/**
 * LocalWorkoutRepository
 *
 * 基于 AsyncStorage 的 WorkoutRepository 实现。
 * 负责训练记录的本地持久化、查询，以及同步状态管理。
 *
 * 设计原则：
 * - 遵循 IWorkoutRepository 接口，与 StorageService 保持兼容
 * - 每条记录自动附加 _syncStatus 和 _lastModified
 * - 支持按同步状态筛选（getPendingSync）
 * - 旧数据自动迁移（无 _syncStatus 的记录标记为 'local'）
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  WorkoutSession,
  LocalWorkoutRecord,
  SyncStatus,
  IWorkoutRepository,
  WorkoutAnalytics,
} from '../types';

const STORAGE_KEY = '@workout_history';
const MAX_RECENT_WORKOUTS = 10;
const MAX_STORED_WORKOUTS = 1000;

function toLocalRecord(session: WorkoutSession): LocalWorkoutRecord {
  return {
    ...session,
    _syncStatus: 'local' as SyncStatus,
    _lastModified: Date.now(),
  };
}

/** 将旧版 WorkoutSession 升级为 LocalWorkoutRecord */
function migrateToLocalRecord(session: WorkoutSession | LocalWorkoutRecord): LocalWorkoutRecord {
  const record = session as LocalWorkoutRecord;
  return {
    ...session,
    _syncStatus: record._syncStatus || 'local',
    _lastModified: record._lastModified || session.timestamp,
    _serverId: record._serverId,
  };
}

export class LocalWorkoutRepository implements IWorkoutRepository {
  private storageKey: string;

  constructor(storageKey?: string) {
    this.storageKey = storageKey || STORAGE_KEY;
  }

  async save(session: WorkoutSession): Promise<boolean> {
    try {
      const history = await this.getAll();
      const record = toLocalRecord(session);
      history.push(record);
      const trimmed = history.sort((a, b) => a.timestamp - b.timestamp).slice(-MAX_STORED_WORKOUTS);
      await AsyncStorage.setItem(this.storageKey, JSON.stringify(trimmed));
      return true;
    } catch (error) {
      console.error('[LocalWorkoutRepository] save error:', error);
      return false;
    }
  }

  async getAll(): Promise<LocalWorkoutRecord[]> {
    try {
      const data = await AsyncStorage.getItem(this.storageKey);
      if (!data) return [];
      const sessions: (WorkoutSession | LocalWorkoutRecord)[] = JSON.parse(data);
      return sessions.map((s) => {
        const record = migrateToLocalRecord(s);
        return {
          ...record,
          mode: record.mode || 'count',
        };
      });
    } catch (error) {
      // JSON.parse 失败时备份原始数据到单独的键，便于事后恢复，避免静默丢弃全部历史
      try {
        const raw = await AsyncStorage.getItem(this.storageKey);
        if (raw) {
          await AsyncStorage.setItem(`${this.storageKey}_corrupt_${Date.now()}`, raw);
        }
      } catch {
        // 备份失败不阻塞主流程
      }
      console.error('[LocalWorkoutRepository] getAll error:', error);
      return [];
    }
  }

  async getById(id: string): Promise<LocalWorkoutRecord | null> {
    const all = await this.getAll();
    return all.find((r) => r.id === id) || null;
  }

  async getPendingSync(): Promise<LocalWorkoutRecord[]> {
    const all = await this.getAll();
    return all.filter((r) => r._syncStatus === 'local' || r._syncStatus === 'conflict');
  }

  async markSynced(id: string, serverId?: string): Promise<boolean> {
    try {
      const all = await this.getAll();
      const index = all.findIndex((r) => r.id === id);
      if (index === -1) return false;

      all[index] = {
        ...all[index],
        _syncStatus: 'synced',
        _lastModified: Date.now(),
        _serverId: serverId || all[index]._serverId,
      };

      await AsyncStorage.setItem(this.storageKey, JSON.stringify(all));
      return true;
    } catch (error) {
      console.error('[LocalWorkoutRepository] markSynced error:', error);
      return false;
    }
  }

  /**
   * 批量标记已同步——一次性重写，避免串行 markSynced 导致的 O(n²) 写放大。
   * @returns 成功标记的条目数
   */
  async batchMarkSynced(ids: string[], serverIds?: Map<string, string>): Promise<number> {
    try {
      const all = await this.getAll();
      let updated = 0;
      const sidMap = serverIds ?? new Map<string, string>();

      const updatedAll = all.map((record) => {
        if (ids.includes(record.id) && record._syncStatus !== 'synced') {
          updated++;
          return {
            ...record,
            _syncStatus: 'synced' as SyncStatus,
            _lastModified: Date.now(),
            _serverId: sidMap.get(record.id) || record._serverId,
          };
        }
        return record;
      });

      if (updated > 0) {
        await AsyncStorage.setItem(this.storageKey, JSON.stringify(updatedAll));
      }
      return updated;
    } catch (error) {
      console.error('[LocalWorkoutRepository] batchMarkSynced error:', error);
      return 0;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const all = await this.getAll();
      const filtered = all.filter((r) => r.id !== id);
      await AsyncStorage.setItem(this.storageKey, JSON.stringify(filtered));
      return true;
    } catch (error) {
      console.error('[LocalWorkoutRepository] delete error:', error);
      return false;
    }
  }

  async getAnalytics(): Promise<WorkoutAnalytics> {
    const history = await this.getAll();
    const totalWorkouts = history.length;
    const totalReps = history.reduce((sum, r) => sum + r.count, 0);
    const totalDuration = history.reduce((sum, r) => sum + r.duration, 0);
    const avgReps = totalWorkouts > 0 ? totalReps / totalWorkouts : 0;

    return {
      totalWorkouts,
      totalReps,
      avgReps,
      totalDuration,
      recentWorkouts: history.slice(-MAX_RECENT_WORKOUTS).reverse(),
    };
  }
}

/** 默认单例 */
export const workoutRepository = new LocalWorkoutRepository();
