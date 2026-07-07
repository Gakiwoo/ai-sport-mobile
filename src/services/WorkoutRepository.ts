/**
 * LocalWorkoutRepository
 *
 * 基于 AsyncStorage 的 WorkoutRepository 实现（分键存储）。
 *
 * 设计原则：
 * - 遵循 IWorkoutRepository 接口，与 StorageService 保持兼容
 * - 每条记录单独存于 `@key:${id}`，索引存于 `@key:__index`，
 *   避免每次保存都全量重写整个数组（消除 O(n) 写放大）
 * - 旧版「单大数组」格式在首次访问时自动迁移为分键结构，并备份原数据
 * - 每条记录自动附加 _syncStatus 和 _lastModified
 * - 支持按同步状态筛选（getPendingSync）
 * - 旧数据自动迁移（无 _syncStatus 的记录标记为 'local'）
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import ErrorReporter from './ErrorReporter';
import {
  WorkoutSession,
  LocalWorkoutRecord,
  SyncStatus,
  IWorkoutRepository,
  WorkoutAnalytics,
} from '../types';

const STORAGE_KEY = '@workout_history';
const INDEX_KEY_SUFFIX = ':__index';
const LEGACY_BACKUP_SUFFIX = '_legacy_backup_';
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
  private indexKey: string;

  constructor(storageKey?: string) {
    this.storageKey = storageKey || STORAGE_KEY;
    this.indexKey = `${this.storageKey}${INDEX_KEY_SUFFIX}`;
  }

  /**
   * 读取索引数组（仅存 id）。若不存在则尝试从旧版大数组迁移，返回 id 列表。
   * 迁移：检测 storageKey 下是否仍为旧版「记录数组」，若是则拆分写入分键并构建索引。
   */
  private async ensureIndex(): Promise<string[]> {
    const idxRaw = await AsyncStorage.getItem(this.indexKey);
    if (idxRaw) {
      try {
        const parsed = JSON.parse(idxRaw);
        if (Array.isArray(parsed)) return parsed as string[];
      } catch {
        // 索引损坏，继续走迁移/重建逻辑
      }
    }

    // 迁移旧版：storageKey 下直接存记录数组
    const legacyRaw = await AsyncStorage.getItem(this.storageKey);
    if (legacyRaw) {
      try {
        const arr = JSON.parse(legacyRaw);
        if (Array.isArray(arr) && arr.length > 0) {
          const ids: string[] = [];
          for (const item of arr) {
            const rec = migrateToLocalRecord(item);
            if (!rec.id) continue;
            await AsyncStorage.setItem(`${this.storageKey}:${rec.id}`, JSON.stringify(rec));
            ids.push(rec.id);
          }
          // 备份旧键后删除，避免重复迁移
          await AsyncStorage.setItem(
            `${this.storageKey}${LEGACY_BACKUP_SUFFIX}${Date.now()}`,
            legacyRaw,
          );
          await AsyncStorage.removeItem(this.storageKey);
          await AsyncStorage.setItem(this.indexKey, JSON.stringify(ids));
          return ids;
        }
      } catch (error) {
        ErrorReporter.captureError(error, {
          source: 'WorkoutRepository',
          storageKey: this.storageKey,
          action: 'migrateLegacy',
        });
        try {
          await AsyncStorage.setItem(`${this.storageKey}_corrupt_${Date.now()}`, legacyRaw);
        } catch {
          // 备份失败不阻塞主流程
        }
      }
    }
    return [];
  }

  /** 按索引批量读取记录；单条损坏不影响整体（跳过） */
  private async readAllRecords(index: string[]): Promise<LocalWorkoutRecord[]> {
    if (index.length === 0) return [];
    const keys = index.map((id) => `${this.storageKey}:${id}`);
    const pairs = await AsyncStorage.multiGet(keys);
    const records: LocalWorkoutRecord[] = [];
    for (const [, raw] of pairs) {
      if (!raw) continue;
      try {
        const rec = migrateToLocalRecord(JSON.parse(raw));
        records.push({ ...rec, mode: rec.mode || 'count' });
      } catch {
        // 单条损坏跳过，避免整体失败
      }
    }
    return records;
  }

  /** 超过最大记录数时裁剪最旧的若干条（O(超出条数) 删除） */
  private async trimExcess(index: string[]): Promise<string[]> {
    if (index.length <= MAX_STORED_WORKOUTS) return index;
    const records = await this.readAllRecords(index);
    records.sort((a, b) => a.timestamp - b.timestamp);
    const excess = records.slice(0, records.length - MAX_STORED_WORKOUTS);
    const excessIds = new Set(excess.map((r) => r.id));
    for (const id of excessIds) {
      await AsyncStorage.removeItem(`${this.storageKey}:${id}`);
    }
    const newIndex = index.filter((id) => !excessIds.has(id));
    await AsyncStorage.setItem(this.indexKey, JSON.stringify(newIndex));
    return newIndex;
  }

  async save(session: WorkoutSession): Promise<boolean> {
    try {
      const record = toLocalRecord(session);
      let index = await this.ensureIndex();
      // 仅写入单条记录，不再序列化整个历史数组
      await AsyncStorage.setItem(`${this.storageKey}:${record.id}`, JSON.stringify(record));
      if (!index.includes(record.id)) {
        index.push(record.id);
        await AsyncStorage.setItem(this.indexKey, JSON.stringify(index));
      }
      index = await this.trimExcess(index);
      return true;
    } catch (error) {
      ErrorReporter.captureError(error, { source: 'WorkoutRepository', action: 'save' });
      return false;
    }
  }

  async getAll(): Promise<LocalWorkoutRecord[]> {
    try {
      const index = await this.ensureIndex();
      const records = await this.readAllRecords(index);
      return records.sort((a, b) => a.timestamp - b.timestamp);
    } catch (error) {
      // JSON.parse 失败时备份原始数据到单独的键，便于事后恢复，避免静默丢弃全部历史
      ErrorReporter.captureError(error, {
        source: 'WorkoutRepository',
        storageKey: this.storageKey,
        action: 'loadHistory',
      });
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
    try {
      const raw = await AsyncStorage.getItem(`${this.storageKey}:${id}`);
      if (!raw) return null;
      const rec = migrateToLocalRecord(JSON.parse(raw));
      return { ...rec, mode: rec.mode || 'count' };
    } catch (error) {
      ErrorReporter.captureError(error, { source: 'WorkoutRepository', action: 'getById' });
      return null;
    }
  }

  async getPendingSync(): Promise<LocalWorkoutRecord[]> {
    const all = await this.getAll();
    return all.filter((r) => r._syncStatus === 'local' || r._syncStatus === 'conflict');
  }

  async markSynced(id: string, serverId?: string): Promise<boolean> {
    try {
      const raw = await AsyncStorage.getItem(`${this.storageKey}:${id}`);
      if (!raw) return false;
      const record = migrateToLocalRecord(JSON.parse(raw));
      const updated: LocalWorkoutRecord = {
        ...record,
        _syncStatus: 'synced',
        _lastModified: Date.now(),
        _serverId: serverId || record._serverId,
      };
      await AsyncStorage.setItem(`${this.storageKey}:${id}`, JSON.stringify(updated));
      return true;
    } catch (error) {
      ErrorReporter.captureError(error, { source: 'WorkoutRepository', action: 'markSynced' });
      return false;
    }
  }

  /**
   * 批量标记已同步——逐条读写，O(ids) 而非 O(n) 全量重写，避免串行 markSynced 导致的 O(n²) 写放大。
   * @returns 成功标记的条目数
   */
  async batchMarkSynced(ids: string[], serverIds?: Map<string, string>): Promise<number> {
    try {
      if (ids.length === 0) return 0;
      const sidMap = serverIds ?? new Map<string, string>();
      let updated = 0;
      for (const id of ids) {
        const raw = await AsyncStorage.getItem(`${this.storageKey}:${id}`);
        if (!raw) continue;
        const record = migrateToLocalRecord(JSON.parse(raw));
        if (record._syncStatus === 'synced') continue;
        const updatedRecord: LocalWorkoutRecord = {
          ...record,
          _syncStatus: 'synced' as SyncStatus,
          _lastModified: Date.now(),
          _serverId: sidMap.get(id) || record._serverId,
        };
        await AsyncStorage.setItem(`${this.storageKey}:${id}`, JSON.stringify(updatedRecord));
        updated++;
      }
      return updated;
    } catch (error) {
      ErrorReporter.captureError(error, { source: 'WorkoutRepository', action: 'batchMarkSynced' });
      return 0;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await AsyncStorage.removeItem(`${this.storageKey}:${id}`);
      const index = await this.ensureIndex();
      if (index.includes(id)) {
        const newIndex = index.filter((x) => x !== id);
        await AsyncStorage.setItem(this.indexKey, JSON.stringify(newIndex));
      }
      return true;
    } catch (error) {
      ErrorReporter.captureError(error, { source: 'WorkoutRepository', action: 'delete' });
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
