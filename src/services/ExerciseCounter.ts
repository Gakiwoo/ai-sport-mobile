import {
  Pose,
  ExerciseFeedback,
  ExerciseType,
  ExerciseFrameResult,
  ExerciseDebugState,
  ExerciseResult,
  ExerciseLogEntry,
} from '../types';
import { POSE_MIN_SCORE } from '../constants/exerciseConfig';
import PoseDetectionService from './PoseDetectionService';

export type CounterFeedback = ExerciseFeedback;

export interface CounterSessionOptions {
  sessionId?: string;
  startedAt?: string;
}

interface CounterSessionState {
  sessionId: string;
  exerciseType: ExerciseType;
  startedAt: string;
}

function createSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export abstract class ExerciseCounter {
  private static readonly MAX_ALGORITHM_LOG_ENTRIES = 1000;

  protected count = 0;
  protected isInPosition = false;
  protected lastState: string = 'neutral';
  protected totalFrames = 0;
  protected invalidCount = 0;

  private session: CounterSessionState | null = null;
  private algorithmLog: ExerciseLogEntry[] = [];

  /** 实际帧间隔（ms），默认 100ms ≈ 10fps。由外部通过 setFrameInterval 设置 */
  protected frameIntervalMs = 100;

  abstract processFrame(pose: Pose): void;

  /** 设置实际帧间隔，用于 getRate 的速率计算 */
  setFrameInterval(ms: number): void {
    this.frameIntervalMs = Math.max(16, ms);
    this.onFrameIntervalChanged();
  }

  protected onFrameIntervalChanged(): void {}

  protected framesForMs(ms: number): number {
    return Math.max(1, Math.ceil(ms / this.frameIntervalMs));
  }

  protected framesAt30Fps(frames: number): number {
    return this.framesForMs((frames * 1000) / 30);
  }

  getCount(): number {
    return this.count;
  }

  reset(): void {
    this.count = 0;
    this.isInPosition = false;
    this.lastState = 'neutral';
    this.totalFrames = 0;
    this.invalidCount = 0;
    this.algorithmLog = [];
  }

  /** 获取当前动作阶段（各子类自定义阶段名） */
  getPhase(): string {
    return this.lastState;
  }

  /** 获取实时动作反馈（指导用户改善动作质量） */
  getFeedback(_pose?: Pose): ExerciseFeedback | null {
    return null;
  }

  startSession(exerciseType: ExerciseType, options: CounterSessionOptions = {}): void {
    this.session = {
      sessionId: options.sessionId || createSessionId(),
      exerciseType,
      startedAt: options.startedAt || new Date().toISOString(),
    };
  }

  processFrameResult(pose: Pose): ExerciseFrameResult {
    const previousValue = this.getResultValue();
    this.processFrame(pose);
    const resultValue = this.getResultValue();
    const countDelta = Math.max(0, resultValue - previousValue);
    const feedback = this.getFeedback(pose);

    const frameResult = {
      state: this.getPhase(),
      countDelta,
      valid: countDelta > 0,
      confidence: this.getPoseConfidence(pose),
      feedback: feedback?.message,
      keyMetrics: this.getKeyMetrics(),
    };
    this.recordAlgorithmLog(frameResult);
    return frameResult;
  }

  getSessionResult(
    exerciseType?: ExerciseType,
    endedAt: string = new Date().toISOString(),
  ): ExerciseResult {
    const activeSession =
      this.session ||
      (exerciseType
        ? {
            sessionId: createSessionId(),
            exerciseType,
            startedAt: new Date(Date.parse(endedAt) - this.getDurationMs()).toISOString(),
          }
        : null);

    if (!activeSession) {
      throw new Error(
        'Exercise session has not been started. Call startSession() or pass exerciseType.',
      );
    }

    const resultValue = this.getResultValue();
    const resultUnit = this.getResultUnit();
    const result: ExerciseResult = {
      sessionId: activeSession.sessionId,
      exerciseType: activeSession.exerciseType,
      validCount: this.getValidCount(),
      invalidCount: this.getInvalidCount(),
      foulCount: this.getFoulCount(),
      confidence: this.getSessionConfidence(),
      durationMs: Math.max(
        this.getDurationMs(),
        Date.parse(endedAt) - Date.parse(activeSession.startedAt),
      ),
      feedback: this.getSessionFeedback(),
      algorithmLog: this.getAlgorithmLog(),
      startedAt: activeSession.startedAt,
      endedAt,
    };

    if (resultUnit === 'cm') {
      if (activeSession.exerciseType === 'standing_long_jump') {
        result.distanceCm = resultValue;
      } else if (activeSession.exerciseType === 'vertical_jump') {
        result.heightCm = resultValue;
      }
    } else {
      result.reps = resultValue;
    }

    return result;
  }

  getDebugState(): ExerciseDebugState {
    return {
      state: this.getPhase(),
      totalFrames: this.totalFrames,
      resultValue: this.getResultValue(),
      resultUnit: this.getResultUnit(),
      rate: this.getRate(),
      keyMetrics: this.getKeyMetrics(),
    };
  }

  getAlgorithmLog(): ExerciseLogEntry[] {
    return this.algorithmLog.map((entry) => ({
      ...entry,
      keyMetrics: { ...entry.keyMetrics },
    }));
  }

  protected getKeypoint(pose: Pose, name: string) {
    return PoseDetectionService.getKeypoint(pose, name);
  }

  protected calculateAngle(pose: Pose, a: string, b: string, c: string): number | null {
    const kpA = this.getKeypoint(pose, a);
    const kpB = this.getKeypoint(pose, b);
    const kpC = this.getKeypoint(pose, c);

    if (!kpA || !kpB || !kpC) return null;
    if (
      (kpA.score || 0) < POSE_MIN_SCORE ||
      (kpB.score || 0) < POSE_MIN_SCORE ||
      (kpC.score || 0) < POSE_MIN_SCORE
    )
      return null;

    return PoseDetectionService.calculateAngle(kpA, kpB, kpC);
  }

  /** 计算每分钟动作速率（次/分钟），基于实际帧间隔 */
  getRate(): number {
    if (this.totalFrames === 0 || this.count === 0) return 0;
    const fps = 1000 / this.frameIntervalMs;
    const seconds = this.totalFrames / fps;
    return Math.round((this.count / seconds) * 60);
  }

  /** 返回结果值：计数型运动返回次数，测量型运动返回距离/高度 */
  getResultValue(): number {
    return this.count;
  }

  /** 返回结果单位，子类可覆盖 */
  getResultUnit(): string {
    return '次';
  }

  protected getKeyMetrics(): Record<string, number> {
    return {
      count: this.count,
      resultValue: this.getResultValue(),
      totalFrames: this.totalFrames,
      rate: this.getRate(),
    };
  }

  protected getValidCount(): number {
    return this.getResultUnit() === '次' ? this.getResultValue() : this.count;
  }

  protected getInvalidCount(): number {
    return this.invalidCount;
  }

  protected getFoulCount(): number {
    return 0;
  }

  protected getSessionFeedback(): string[] {
    const feedback = this.getFeedback();
    return feedback ? [feedback.message] : [];
  }

  protected getSessionConfidence(): number {
    if (this.totalFrames === 0) return 0;
    if (this.getInvalidCount() === 0 && this.getFoulCount() === 0) return 1;
    const totalEvents = this.getValidCount() + this.getInvalidCount() + this.getFoulCount();
    return totalEvents > 0 ? clampConfidence(this.getValidCount() / totalEvents) : 0;
  }

  protected getPoseConfidence(pose: Pose): number {
    if (typeof pose.score === 'number') {
      return clampConfidence(pose.score);
    }

    const scored = pose.keypoints
      .map((keypoint) => keypoint.score)
      .filter((score): score is number => typeof score === 'number');

    if (scored.length === 0) return 0;
    return clampConfidence(scored.reduce((sum, score) => sum + score, 0) / scored.length);
  }

  protected getDurationMs(): number {
    return Math.round(this.totalFrames * this.frameIntervalMs);
  }

  private recordAlgorithmLog(frameResult: ExerciseFrameResult): void {
    const entry: ExerciseLogEntry = {
      ...frameResult,
      frameIndex: this.totalFrames,
      timestampMs: this.getDurationMs(),
      keyMetrics: { ...frameResult.keyMetrics },
    };

    this.algorithmLog.push(entry);
    if (this.algorithmLog.length > ExerciseCounter.MAX_ALGORITHM_LOG_ENTRIES) {
      this.algorithmLog.splice(
        0,
        this.algorithmLog.length - ExerciseCounter.MAX_ALGORITHM_LOG_ENTRIES,
      );
    }
  }
}
