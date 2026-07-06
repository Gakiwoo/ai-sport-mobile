/**
 * SyncService
 *
 * 负责训练记录的云端同步。
 *
 * 触发时机：
 * 1. App 启动后（延迟执行，不阻塞首屏）
 * 2. 每次训练保存后（fire-and-forget）
 * 3. 网络恢复时（NetInfo listener）
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
import { authService } from './AuthService';
import { LocalWorkoutRecord } from '../types';

// ── 配置 ──
const SYNC_API_PATH = '/api/workouts/sync';
const SYNC_INITIAL_DELAY_MS = 3000; // 启动后延迟 3s 再同步
const SYNC_RETRY_BASE_DELAY_MS = 30000; // 重试基础延迟 30s
const SYNC_RETRY_MAX_DELAY_MS = 300000; // 最大重试延迟 5min
const SYNC_MAX_RETRIES = 5; // 最大重试次数
const SYNC_FETCH_TIMEOUT_MS = 15000; // fetch 超时 15s

function getSyncEnv(): Record<string, string | undefined> {
  return (
    (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process
      ?.env ?? {}
  );
}

function isCloudSyncEnabled(): boolean {
  return getSyncEnv().EXPO_PUBLIC_ENABLE_CLOUD_SYNC === 'true';
}

function getSyncApiUrl(): string {
  const env = getSyncEnv();
  if (env.EXPO_PUBLIC_SYNC_API_URL) return env.EXPO_PUBLIC_SYNC_API_URL;
  if (env.EXPO_PUBLIC_API_BASE_URL) return `${env.EXPO_PUBLIC_API_BASE_URL}${SYNC_API_PATH}`;
  return SYNC_API_PATH;
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

  /** 启动同步服务：初始延迟同步 + 注册网络监听 */
  start(): void {
    // 延迟初始同步，避免阻塞启动
    this.syncTimer = setTimeout(() => {
      this.sync().catch((err) => {
        console.warn('[SyncService] Initial sync skipped:', err?.message ?? err);
      });
    }, SYNC_INITIAL_DELAY_MS);

    // TODO: 注册 NetInfo 监听（需要 @react-native-community/netinfo）
    // this.registerNetworkListener();
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
      console.warn('[SyncService] Post-workout sync failed:', err?.message ?? err);
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

      // 批量标记已同步（一次性重写，避免串行 O(n²) 写放大）
      const ids = pending.map((r) => r.id);
      const syncedCount = await workoutRepository.batchMarkSynced(ids, serverIdsByLocalId);

      this.retryCount = 0;
      return { synced: syncedCount, failed: 0, skipped: 0, errors: [] };
    } catch (error) {
      console.error('[SyncService] Sync error:', error);
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
      const token = await authService.getAccessToken().catch(() => null);
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(getSyncApiUrl(), {
        method: 'POST',
        headers,
        body: JSON.stringify({ workouts: records }),
        signal: controller.signal as AbortSignal & EventTarget,
      });

      if (!response.ok) {
        throw new Error(`Sync failed: ${response.status}`);
      }

      const body = await response.json().catch(() => null);
      const synced: unknown[] = Array.isArray(body?.synced) ? body.synced : [];
      return new Map(
        synced
          .filter((item: unknown): item is { localId: string; serverId: string } => {
            if (!item || typeof item !== 'object') return false;
            const candidate = item as { localId?: unknown; serverId?: unknown };
            return typeof candidate.localId === 'string' && typeof candidate.serverId === 'string';
          })
          .map((item) => [item.localId, item.serverId]),
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private scheduleRetry(): void {
    if (this.retryTimer) return;
    if (this.retryCount >= SYNC_MAX_RETRIES) {
      console.warn('[SyncService] Max retries reached, giving up.');
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
        console.warn('[SyncService] Retry sync failed:', err?.message ?? err);
      });
    }, delay);
  }

  /** 注册网络恢复监听 */
  private registerNetworkListener(): void {
    // TODO: 接入 @react-native-community/netinfo
    // import NetInfo from '@react-native-community/netinfo';
    // this.networkListener = NetInfo.addEventListener((state) => {
    //   if (state.isConnected && state.isInternetReachable) {
    //     this.sync().catch(() => {});
    //   }
    // });
  }

  private removeNetworkListener(): void {
    if (this.networkListener) {
      // TODO: NetInfo remove
      this.networkListener = null;
    }
  }

  /** 获取待同步数量（用于 UI 角标） */
  async getPendingCount(): Promise<number> {
    const pending = await workoutRepository.getPendingSync();
    return pending.length;
  }
}

export const syncService = new SyncService();
