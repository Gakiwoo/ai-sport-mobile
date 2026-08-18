/**
 * SyncService
 *
 * 负责训练记录的云端同步。
 *
 * 触发时机：
 * 1. App 启动后（延迟执行，不阻塞首屏）
 * 2. 每次训练保存后（fire-and-forget）
 * 3. 应用回到前台 / 网络恢复时（AppState 监听，可选 NetInfo 增强）
 *
 * 当前后端同步默认关闭：本地读写已完备，只有显式开启云同步并配置 API 后才会标记为已同步。
 *
 * 同步策略：
 * - 增量同步：仅同步 _syncStatus !== 'synced' 的记录
 * - 离线优先：本地始终可读写，同步失败不影响本地功能
 *
 * TODO: 实现双向同步（pull 接口 + 按 _serverId 合并）
 * TODO: 实现真正的冲突解决（基于 _lastModified 时间戳对比）
 */

import { workoutRepository } from './WorkoutRepository';
import AuthService from './AuthService';
import ErrorReporter from './ErrorReporter';
import { apiClient } from './ApiClient';
import { LocalWorkoutRecord, ExerciseType } from '../types';
import { getEnvVar } from '../utils/getEnv';
import { getEffectiveApiBaseUrl } from '../utils/serverConfig';
import { AppState, type NativeEventSubscription } from 'react-native';

// ── 配置 ──
const SYNC_API_PATH = '/api/workouts/sync';
const SYNC_INITIAL_DELAY_MS = 3000; // 启动后延迟 3s 再同步
const SYNC_RETRY_BASE_DELAY_MS = 30000; // 重试基础延迟 30s
const SYNC_RETRY_MAX_DELAY_MS = 300000; // 最大重试延迟 5min
const SYNC_MAX_RETRIES = 5; // 最大重试次数
const SYNC_FETCH_TIMEOUT_MS = 15000; // fetch 超时 15s

/** 服务端 workout_sessions 行的合法运动类型集合（P1-8 字段映射用） */
const VALID_EXERCISE_TYPES: ReadonlySet<string> = new Set([
  'jump_rope',
  'jumping_jacks',
  'squats',
  'standing_long_jump',
  'vertical_jump',
  'sit_ups',
]);

function isCloudSyncEnabled(): boolean {
  return getEnvVar('EXPO_PUBLIC_ENABLE_CLOUD_SYNC') === 'true';
}

/** 同步 API 地址：env 覆盖 → 与 AuthService/ApiClient 共用单一来源（M4 修复） */
async function getSyncApiUrl(): Promise<string> {
  const syncUrl = getEnvVar('EXPO_PUBLIC_SYNC_API_URL');
  if (syncUrl) return syncUrl;
  const baseUrl = await getEffectiveApiBaseUrl();
  return `${baseUrl}${SYNC_API_PATH}`;
}

interface SyncResult {
  synced: number;
  failed: number;
  skipped: number;
  errors: string[];
}

class SyncService {
  private isSyncing = false;
  private syncTimer: ReturnType<typeof setTimeout> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private retryCount = 0;
  private networkListener: (() => void) | null = null;
  /** AppState 订阅（零新依赖，覆盖「应用回到前台 / 恢复网络」场景） */
  private appStateSub: NativeEventSubscription | null = null;
  /** 上次成功 pull 的时间戳（ISO 字符串），用于增量拉取 */
  private lastSyncTimestamp: string | null = null;

  /** 启动同步服务：初始延迟同步 + 注册网络监听 */
  start(): void {
    // 延迟初始同步，避免阻塞启动
    this.syncTimer = setTimeout(() => {
      this.sync().catch((err) => {
        ErrorReporter.captureWarning('Initial sync failed', {
          source: 'SyncService.start',
          error: err?.message ?? String(err),
        });
      });
    }, SYNC_INITIAL_DELAY_MS);

    // 注册网络/前台恢复监听：离线→在线时自动补传待同步记录
    this.registerNetworkListener();
  }

  /** 停止同步服务 */
  stop(): void {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
      this.syncTimer = null;
    }
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    this.retryCount = 0;
    this.removeNetworkListener();
  }

  /** 手动触发同步（训练保存后调用） */
  async syncAfterWorkout(): Promise<void> {
    // fire-and-forget，不阻塞 UI
    this.sync().catch((err) => {
      ErrorReporter.captureWarning('Post-workout sync failed', {
        source: 'SyncService.syncAfterWorkout',
        error: err?.message ?? String(err),
      });
    });
  }

  /** 核心同步逻辑 */
  async sync(): Promise<SyncResult> {
    if (this.isSyncing) {
      return { synced: 0, failed: 0, skipped: 0, errors: ['Already syncing'] };
    }

    this.isSyncing = true;

    try {
      const pending = await workoutRepository.getPendingSync();

      if (pending.length === 0) {
        this.retryCount = 0;
        return { synced: 0, failed: 0, skipped: 0, errors: [] };
      }

      if (!isCloudSyncEnabled()) {
        return {
          synced: 0,
          failed: 0,
          skipped: pending.length,
          errors: ['Cloud sync is disabled; local records remain pending.'],
        };
      }

      const serverIdsByLocalId = await this.pushToServer(pending);

      // 修复 M3/M4：只标记服务端确认已入库的 id——
      // ① 响应契约为 { synced: [id] }（NestJS），解析后得到已确认集合；
      // ② 服务端单批上限 100，超出部分保持 pending，下一轮继续推送，
      //    避免"全部标记 synced"导致超限/失败记录被静默丢弃。
      const confirmedIds = pending.filter((r) => serverIdsByLocalId.has(r.id)).map((r) => r.id);
      const syncedCount = await workoutRepository.batchMarkSynced(confirmedIds, serverIdsByLocalId);

      this.retryCount = 0;
      return { synced: syncedCount, failed: 0, skipped: 0, errors: [] };
    } catch (error) {
      ErrorReporter.captureError(error, { source: 'SyncService', action: 'syncPending' });
      this.scheduleRetry();
      const message = error instanceof Error ? error.message : String(error);
      return { synced: 0, failed: 1, skipped: 0, errors: [message] };
    } finally {
      this.isSyncing = false;
    }
  }

  /** 推送记录到服务端；后端可返回 { synced: [{ localId, serverId }] }。 */
  private async pushToServer(records: LocalWorkoutRecord[]): Promise<Map<string, string>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SYNC_FETCH_TIMEOUT_MS);

    try {
      const token = await AuthService.getAccessToken().catch(() => null);
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(await getSyncApiUrl(), {
        method: 'POST',
        headers,
        body: JSON.stringify({ workouts: records }),
        signal: controller.signal as AbortSignal & EventTarget,
      });

      if (!response.ok) {
        throw new Error(`Sync failed: ${response.status}`);
      }

      const body = await response.json().catch(() => null);
      const syncedRaw: unknown[] = Array.isArray(body?.synced) ? body.synced : [];
      // 修复 M4：NestJS 契约 synced 为 id 字符串数组（如 ["w1","w2"]）；
      // 兼容旧后端（Express gakiwoo-api）的 [{ localId, serverId }] 对象格式。
      const serverIdsByLocalId = new Map<string, string>();
      for (const item of syncedRaw) {
        if (typeof item === 'string' && item.length > 0) {
          serverIdsByLocalId.set(item, item);
        } else if (item !== null && typeof item === 'object') {
          const candidate = item as { localId?: unknown; serverId?: unknown };
          if (typeof candidate.localId === 'string' && typeof candidate.serverId === 'string') {
            serverIdsByLocalId.set(candidate.localId, candidate.serverId);
          }
        }
      }
      return serverIdsByLocalId;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private scheduleRetry(): void {
    if (this.retryTimer) return;
    if (this.retryCount >= SYNC_MAX_RETRIES) {
      ErrorReporter.captureWarning('Max sync retries reached', {
        source: 'SyncService.scheduleRetry',
        retryCount: this.retryCount,
      });
      this.retryCount = 0;
      return;
    }
    // 指数退避：30s → 60s → 120s → 240s → 300s（封顶）
    const delay = Math.min(
      SYNC_RETRY_BASE_DELAY_MS * Math.pow(2, this.retryCount),
      SYNC_RETRY_MAX_DELAY_MS,
    );
    this.retryCount++;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.sync().catch((err) => {
        ErrorReporter.captureWarning('Retry sync failed', {
          source: 'SyncService.scheduleRetry',
          retryCount: this.retryCount,
          error: err?.message ?? String(err),
        });
      });
    }, delay);
  }

  /** 注册网络恢复监听：主路径 AppState（零依赖），可选增强 NetInfo */
  private registerNetworkListener(): void {
    // 主路径：监听应用回到前台（覆盖「恢复网络后重新打开 App」最常见场景）
    this.appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        this.syncIfPending();
      }
    });

    // 增强路径：NetInfo 监听（需在项目环境先执行 `expo install @react-native-community/netinfo`）。
    // 安装后取消下方注释即可启用，无需改动任何业务逻辑：
    // import NetInfo from '@react-native-community/netinfo';
    // this.networkListener = NetInfo.addEventListener((state) => {
    //   if (state.isConnected && state.isInternetReachable) {
    //     this.syncIfPending();
    //   }
    // });
  }

  /** 仅当存在待同步记录时才触发同步（供网络/前台恢复时调用，避免空跑与初始延迟同步冲突） */
  private syncIfPending(): void {
    workoutRepository
      .getPendingSync()
      .then((pending) => {
        if (pending.length > 0) {
          this.sync().catch((err) =>
            ErrorReporter.captureWarning('Resume sync failed', {
              source: 'SyncService.resumePendingSync',
              error: err?.message ?? String(err),
            }),
          );
        }
      })
      .catch((err) =>
        ErrorReporter.captureWarning('Pending check failed', {
          source: 'SyncService.checkPendingAndSync',
          error: err?.message ?? String(err),
        }),
      );
  }

  private removeNetworkListener(): void {
    if (this.appStateSub) {
      this.appStateSub.remove();
      this.appStateSub = null;
    }
    if (this.networkListener) {
      this.networkListener();
      this.networkListener = null;
    }
  }

  /**
   * P1-8 修复：将服务端 workout_sessions 行（snake_case）映射为本地
   * LocalWorkoutRecord（camelCase + _syncStatus:'synced'）。
   * 此前直接把服务端记录 save() 落库：字段名不匹配（exerciseType 变 undefined，
   * UI 显示 "undefined" 项目名）且被标记为 local 导致循环重推。
   */
  private mapServerRecord(raw: Record<string, unknown>): LocalWorkoutRecord | null {
    const id = typeof raw.id === 'string' ? raw.id : '';
    if (!id) return null;
    const exerciseTypeRaw = raw.exercise_type;
    if (typeof exerciseTypeRaw !== 'string' || !VALID_EXERCISE_TYPES.has(exerciseTypeRaw)) {
      return null;
    }
    const toNum = (v: unknown, fallback = 0): number => {
      const n = typeof v === 'number' ? v : Number(v);
      return Number.isFinite(n) ? n : fallback;
    };
    const toStr = (v: unknown): string | undefined =>
      typeof v === 'string' && v.length > 0 ? v : undefined;

    const record: LocalWorkoutRecord = {
      id,
      exerciseType: exerciseTypeRaw as ExerciseType,
      mode: raw.mode === 'timed' ? 'timed' : 'count',
      count: toNum(raw.count),
      duration: toNum(raw.duration),
      timestamp: toNum(raw.timestamp, Date.now()),
      _syncStatus: 'synced',
      _lastModified: Date.now(),
      _serverId: id,
    };
    const schoolId = toStr(raw.school_id);
    if (schoolId) record.schoolId = schoolId;
    const classId = toStr(raw.class_id);
    if (classId) record.classId = classId;
    const studentId = toStr(raw.student_id);
    if (studentId) record.studentId = studentId;
    const taskId = toStr(raw.task_id);
    if (taskId) record.taskId = taskId;
    const deviceId = toStr(raw.device_id);
    if (deviceId) record.deviceId = deviceId;
    const deviceInfo = toStr(raw.device_info);
    if (deviceInfo) record.deviceInfo = deviceInfo;
    const tier = toStr(raw.performance_tier);
    if (tier === 'high' || tier === 'balanced' || tier === 'constrained') {
      record.performanceTier = tier;
    }
    const algorithmVersion = toStr(raw.algorithm_version);
    if (algorithmVersion) record.algorithmVersion = algorithmVersion;
    const algorithmLogSummary = toStr(raw.algorithm_log_summary);
    if (algorithmLogSummary) record.algorithmLogSummary = algorithmLogSummary;
    const accuracy = raw.accuracy;
    if (typeof accuracy === 'number' && Number.isFinite(accuracy)) record.accuracy = accuracy;
    return record;
  }

  /**
   * 从服务端拉取训练记录（双向同步 — pull 方向）。
   *
   * 策略：
   * - 增量拉取：仅拉取 lastSyncTimestamp 之后的记录
   * - 冲突处理：服务端版本优先（server wins），但本地含富数据
   *   （exerciseResult/algorithmLog，服务端只存汇总字段）时保留本地
   * - 离线安全：拉取失败不影响本地数据
   */
  async pull(): Promise<{ pulled: number; merged: number; errors: string[] }> {
    if (!isCloudSyncEnabled()) {
      return { pulled: 0, merged: 0, errors: ['Cloud sync is disabled'] };
    }

    try {
      const { records, total } = await apiClient.pullWorkouts(this.lastSyncTimestamp ?? undefined);

      if (!records || records.length === 0) {
        return { pulled: 0, merged: 0, errors: [] };
      }

      let merged = 0;
      // 修复 S-11：增量游标必须取服务端记录的最大 updated_at，
      // 不能使用客户端当前时间（时钟偏移会导致漏拉/重复拉）
      let maxServerUpdatedAt = this.lastSyncTimestamp;

      for (const record of records) {
        try {
          const raw = record as unknown as Record<string, unknown>;
          const id = typeof raw.id === 'string' ? raw.id : '';
          if (!id) continue;

          // P1-8：本地已有 synced 记录且含富数据（exerciseResult，服务端只存汇总
          // 字段，覆盖会丢本地富数据）时保留本地；否则以服务端为准
          const local = await workoutRepository.getById(id);
          if (local && local.exerciseResult && local._syncStatus === 'synced') {
            merged++;
            continue;
          }

          const mapped = this.mapServerRecord(raw);
          if (!mapped) continue;
          await workoutRepository.saveSynced(mapped);
          merged++;

          // 追踪服务端时间戳（record.updatedAt / record.updated_at / _lastModified）
          const serverTs =
            (raw.updatedAt as string | undefined) ??
            (raw.updated_at as string | undefined) ??
            (raw._lastModified as number | undefined);
          if (serverTs !== undefined) {
            const tsStr =
              typeof serverTs === 'number' ? new Date(serverTs).toISOString() : serverTs;
            if (!maxServerUpdatedAt || tsStr > maxServerUpdatedAt) {
              maxServerUpdatedAt = tsStr;
            }
          }
        } catch (mergeErr) {
          ErrorReporter.captureWarning('Pull merge record failed', {
            source: 'SyncService.pull',
            recordId: (record as { id?: unknown }).id ?? 'unknown',
            error: mergeErr instanceof Error ? mergeErr.message : String(mergeErr),
          });
        }
      }

      // 游标推进到服务端记录的最大时间戳；若记录无时间戳则维持原值，
      // 下次仍会拉取到这些记录，由 upsert 幂等兜底
      if (maxServerUpdatedAt) {
        this.lastSyncTimestamp = maxServerUpdatedAt;
      }

      return { pulled: total, merged, errors: [] };
    } catch (error) {
      ErrorReporter.captureError(error, { source: 'SyncService', action: 'pull' });
      const message = error instanceof Error ? error.message : String(error);
      return { pulled: 0, merged: 0, errors: [message] };
    }
  }

  /** 获取待同步数量（用于 UI 角标） */
  async getPendingCount(): Promise<number> {
    const pending = await workoutRepository.getPendingSync();
    return pending.length;
  }
}

export const syncService = new SyncService();
