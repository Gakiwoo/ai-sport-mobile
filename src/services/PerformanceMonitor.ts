/**
 * PerformanceMonitor — 生产级设备性能监控
 *
 * 在训练过程中持续采集 FPS / 推理耗时数据，
 * 上报到 AsyncStorage 以供分析。
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DevicePerformanceTier } from '../types';

const STORAGE_KEY = '@perf_logs';
const MAX_STORED_SESSIONS = 50;
const FPS_WINDOW_SIZE = 60; // 滑动窗口帧数
const FPS_TARGET = 25; // 期望帧率
export const FPS_LOW_THRESHOLD = 15; // FPS 低于此值视为"卡顿"
const INFERENCE_BUCKET_MS = 5;
const INFERENCE_BUCKET_COUNT = 202; // 0..1000ms，最后一档包含更慢样本

export interface PerfFrameRecord {
  /** 推理耗时 (ms) */
  inferenceMs: number;
  /** 是否活跃训练态 */
  isActive: boolean;
  /** 记录时的时间戳 */
  timestamp: number;
}

export interface PerfSessionReport {
  sessionId: string;
  startTime: number;
  endTime: number;
  durationMs: number;
  totalFrames: number;
  avgInferenceMs: number;
  medianInferenceMs: number;
  p95InferenceMs: number;
  maxInferenceMs: number;
  avgFps: number;
  lowFpsCount: number;
  lowFpsRatio: number; // 0-1
  performanceTier: DevicePerformanceTier;
  deviceInfo?: string;
}

export function classifyPerformanceTier(input: {
  avgInferenceMs: number;
  lowFpsRatio: number;
}): DevicePerformanceTier {
  if (input.avgInferenceMs <= 30 && input.lowFpsRatio <= 0.15) {
    return 'high';
  }
  if (input.avgInferenceMs <= 55 && input.lowFpsRatio <= 0.35) {
    return 'balanced';
  }
  return 'constrained';
}

class PerformanceMonitor {
  private frames: PerfFrameRecord[] = [];
  private sessionStartTime: number = 0;
  private sessionId: string = '';
  private _isRunning: boolean = false;
  private static readonly MAX_FRAMES = 5000; // 帧数组上限（约 8 分钟 @ 10fps）
  private totalFramesRecorded = 0;
  private activeFrameCount = 0;
  private activeInferenceTotal = 0;
  private activeInferenceMax = 0;
  private lowFpsCountTotal = 0;
  private inferenceBuckets = new Array<number>(INFERENCE_BUCKET_COUNT).fill(0);
  private activeIntervalTotalMs = 0;
  private activeIntervalCount = 0;
  private previousFrameTimestamp = 0;
  private previousFrameWasActive = false;

  /** 开始一个新的监控会话 */
  start(): void {
    this.frames = [];
    this.resetAggregates();
    this.sessionStartTime = Date.now();
    this.sessionId = `perf_${this.sessionStartTime}_${Math.random().toString(36).slice(2, 8)}`;
    this._isRunning = true;
  }

  /** 重置监控器（清空当前会话但不保存） */
  reset(): void {
    this.frames = [];
    this.resetAggregates();
    this._isRunning = false;
    this.sessionStartTime = 0;
    this.sessionId = '';
  }

  /** 记录一帧的性能数据 */
  recordFrame(inferenceMs: number, isActive: boolean): void {
    if (!this._isRunning) return;
    if (!Number.isFinite(inferenceMs) || inferenceMs < 0) return;

    const timestamp = Date.now();
    this.totalFramesRecorded += 1;

    if (isActive) {
      this.activeFrameCount += 1;
      this.activeInferenceTotal += inferenceMs;
      this.activeInferenceMax = Math.max(this.activeInferenceMax, inferenceMs);
      if (inferenceMs > 1000 / FPS_TARGET) this.lowFpsCountTotal += 1;

      const bucket = Math.min(
        Math.floor(inferenceMs / INFERENCE_BUCKET_MS),
        INFERENCE_BUCKET_COUNT - 1,
      );
      this.inferenceBuckets[bucket] += 1;

      if (this.previousFrameWasActive && timestamp > this.previousFrameTimestamp) {
        this.activeIntervalTotalMs += timestamp - this.previousFrameTimestamp;
        this.activeIntervalCount += 1;
      }
    }

    this.previousFrameTimestamp = timestamp;
    this.previousFrameWasActive = isActive;

    this.frames.push({
      inferenceMs,
      isActive,
      timestamp,
    });

    // 超过上限时保留最近 80% 的数据（丢弃旧帧但保留近期统计精度）
    if (this.frames.length > PerformanceMonitor.MAX_FRAMES) {
      this.frames = this.frames.slice(-Math.floor(PerformanceMonitor.MAX_FRAMES * 0.8));
    }
  }

  /** 停止并保存会话报告 */
  async stop(): Promise<PerfSessionReport | null> {
    if (!this._isRunning) return null;
    this._isRunning = false;

    const report = this.buildReport();
    await this.persistReport(report);
    return report;
  }

  /** 实时 FPS（基于滑动窗口） */
  getCurrentFps(): number {
    const window = this.frames.slice(-FPS_WINDOW_SIZE);
    if (window.length < 2) return 0;

    const timeSpan = window[window.length - 1].timestamp - window[0].timestamp;
    if (timeSpan <= 0) return 0;

    return (window.length - 1) / (timeSpan / 1000);
  }

  /** 实时平均推理耗时 */
  getAverageInferenceMs(): number {
    const window = this.frames.slice(-FPS_WINDOW_SIZE);
    if (window.length === 0) return 0;

    const sum = window.reduce((acc, f) => acc + f.inferenceMs, 0);
    return sum / window.length;
  }

  /** 当前真机性能档位，用于调试展示和后续运行策略降级 */
  getCurrentTier(): DevicePerformanceTier {
    const window = this.frames.slice(-FPS_WINDOW_SIZE).filter((frame) => frame.isActive);
    if (window.length === 0) return 'balanced';

    const avgInferenceMs =
      window.reduce((sum, frame) => sum + frame.inferenceMs, 0) / window.length;
    const lowFpsCount = window.filter((frame) => frame.inferenceMs > 1000 / FPS_TARGET).length;
    const lowFpsRatio = lowFpsCount / window.length;
    return classifyPerformanceTier({ avgInferenceMs, lowFpsRatio });
  }

  /** 是否正在运行 */
  get isRunning(): boolean {
    return this._isRunning;
  }

  /** 当前会话的帧数 */
  get frameCount(): number {
    return this.totalFramesRecorded;
  }

  // ── 内部 ──

  private buildReport(): PerfSessionReport {
    const avgInferenceMs =
      this.activeFrameCount > 0 ? this.activeInferenceTotal / this.activeFrameCount : 0;
    const medianInferenceMs = this.getInferencePercentile(0.5);
    const p95InferenceMs = this.getInferencePercentile(0.95);
    const avgIntervalMs =
      this.activeIntervalCount > 0 ? this.activeIntervalTotalMs / this.activeIntervalCount : 0;
    const avgFps = avgIntervalMs > 0 ? 1000 / avgIntervalMs : 0;
    const lowFpsRatio =
      this.activeFrameCount > 0 ? this.lowFpsCountTotal / this.activeFrameCount : 0;
    const roundedAvgInferenceMs = Math.round(avgInferenceMs * 10) / 10;
    const roundedLowFpsRatio = Math.round(lowFpsRatio * 100) / 100;

    const now = Date.now();
    return {
      sessionId: this.sessionId,
      startTime: this.sessionStartTime,
      endTime: now,
      durationMs: now - this.sessionStartTime,
      totalFrames: this.totalFramesRecorded,
      avgInferenceMs: roundedAvgInferenceMs,
      medianInferenceMs: Math.round(medianInferenceMs * 10) / 10,
      p95InferenceMs: Math.round(p95InferenceMs * 10) / 10,
      maxInferenceMs: Math.round(this.activeInferenceMax * 10) / 10,
      avgFps: Math.round(avgFps * 10) / 10,
      lowFpsCount: this.lowFpsCountTotal,
      lowFpsRatio: roundedLowFpsRatio,
      performanceTier: classifyPerformanceTier({
        avgInferenceMs: roundedAvgInferenceMs,
        lowFpsRatio: roundedLowFpsRatio,
      }),
    };
  }

  private resetAggregates(): void {
    this.totalFramesRecorded = 0;
    this.activeFrameCount = 0;
    this.activeInferenceTotal = 0;
    this.activeInferenceMax = 0;
    this.lowFpsCountTotal = 0;
    this.inferenceBuckets.fill(0);
    this.activeIntervalTotalMs = 0;
    this.activeIntervalCount = 0;
    this.previousFrameTimestamp = 0;
    this.previousFrameWasActive = false;
  }

  private getInferencePercentile(percentile: number): number {
    if (this.activeFrameCount === 0) return 0;
    const target = Math.ceil(this.activeFrameCount * percentile);
    let cumulative = 0;
    for (let index = 0; index < this.inferenceBuckets.length; index += 1) {
      cumulative += this.inferenceBuckets[index];
      if (cumulative >= target) {
        if (index === this.inferenceBuckets.length - 1) return this.activeInferenceMax;
        return index * INFERENCE_BUCKET_MS;
      }
    }
    return this.activeInferenceMax;
  }

  private async persistReport(report: PerfSessionReport): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const logs: PerfSessionReport[] = raw ? JSON.parse(raw) : [];
      logs.unshift(report);
      // 保持上限
      if (logs.length > MAX_STORED_SESSIONS) {
        logs.length = MAX_STORED_SESSIONS;
      }
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
    } catch {
      // 静默失败，不阻塞训练流程
    }
  }

  /** 获取历史性能报告 */
  async getHistory(): Promise<PerfSessionReport[]> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  /** 清除历史 */
  async clearHistory(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch {
      // 忽略
    }
  }
}

export const performanceMonitor = new PerformanceMonitor();
export default PerformanceMonitor;
