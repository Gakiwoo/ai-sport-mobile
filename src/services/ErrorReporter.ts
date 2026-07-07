/**
 * 错误上报服务（Mobile）— 统一监控接入层
 *
 * 功能：
 * 1. 错误分级（error / warning / info）统一出口
 * 2. 接入 Sentry（@sentry/react-native）：生产环境自动上报；测试环境由 jest moduleNameMapper 指向 mock，不会真正发送
 * 3. 本地持久化到 AsyncStorage（最多 50 条，FIFO），便于离线排查
 * 4. console 输出保留开发可见性
 *
 * 与 Desktop 端 src/services/ErrorReporter.ts 保持同名同签名（captureError / captureWarning / captureInfo），
 * 便于双端统一治理静默 catch。
 *
 * 使用方式：
 *   import ErrorReporter from '../services/ErrorReporter';
 *   ErrorReporter.captureError(new Error('something'), { source: 'CameraView' });
 */
import * as Sentry from '@sentry/react-native';

export type ErrorLevel = 'error' | 'warning' | 'info';

interface PersistEntry {
  level: ErrorLevel;
  message: string;
  stack?: string;
  metadata?: Record<string, unknown>;
  timestamp: number;
}

const LOCAL_STORAGE_KEY = 'ai_sport_error_log';
const MAX_LOCAL_ENTRIES = 50;

class ErrorReporter {
  private persistQueue: PersistEntry[] = [];

  /** 上报错误：Sentry + console + 本地持久化 */
  captureError(error: Error | unknown, metadata?: Record<string, unknown>): void {
    const message = toMessage(error);
    const stack = error instanceof Error ? error.stack : undefined;
    Sentry.captureException(error instanceof Error ? error : new Error(message), {
      extra: metadata,
    });
    console.error('[ErrorReporter]', message, error);
    this.persist('error', message, stack, metadata);
  }

  /** 上报警告：Sentry + console + 本地持久化 */
  captureWarning(message: string, metadata?: Record<string, unknown>): void {
    Sentry.captureMessage(message, 'warning');
    console.warn('[ErrorReporter]', message, metadata ?? '');
    this.persist('warning', message, undefined, metadata);
  }

  /** 上报信息：Sentry + 本地持久化（不打印 console，避免噪音） */
  captureInfo(message: string, metadata?: Record<string, unknown>): void {
    Sentry.captureMessage(message, 'info');
    this.persist('info', message, undefined, metadata);
  }

  /** 读取本地错误日志（异步，离线排查用） */
  async getLocalErrors(): Promise<PersistEntry[]> {
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const raw = await AsyncStorage.getItem(LOCAL_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private persist(level: ErrorLevel, message: string, stack?: string, metadata?: Record<string, unknown>): void {
    this.persistQueue.push({ level, message, stack, metadata, timestamp: Date.now() });
    if (this.persistQueue.length > MAX_LOCAL_ENTRIES) {
      this.persistQueue = this.persistQueue.slice(-MAX_LOCAL_ENTRIES);
    }
    // fire-and-forget：不阻塞调用方，持久化失败静默忽略
    Promise.resolve()
      .then(async () => {
        try {
          const AsyncStorage = require('@react-native-async-storage/async-storage').default;
          await AsyncStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(this.persistQueue));
        } catch {
          // 存储不可用，忽略
        }
      })
      .catch(() => {
        /* 忽略持久化失败 */
      });
  }
}

function toMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return String(error);
}

// 单例导出
export default new ErrorReporter();
