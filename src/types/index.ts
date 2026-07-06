export type ExerciseType =
  | 'jump_rope'
  | 'jumping_jacks'
  | 'squats'
  | 'standing_long_jump'
  | 'vertical_jump'
  | 'sit_ups';

/** 训练模式：定数（目标次数）或定时（目标时长） */
export type WorkoutMode = 'count' | 'timed';
export type DevicePerformanceTier = 'high' | 'balanced' | 'constrained';

/** 动作反馈（全局统一类型，所有 Counter 共用） */
export interface ExerciseFeedback {
  type: 'warning' | 'error' | 'success';
  message: string;
}

export interface Keypoint {
  x: number;
  y: number;
  score?: number;
  name?: string;
}

export interface Pose {
  keypoints: Keypoint[];
  score?: number;
  frameWidth?: number;
  frameHeight?: number;
}

export interface PoseFrame extends Pose {
  timestampMs?: number;
  frameIndex?: number;
}

export interface ExerciseFrameResult {
  state: string;
  countDelta: number;
  valid: boolean;
  confidence: number;
  feedback?: string;
  keyMetrics: Record<string, number>;
}

export interface ExerciseDebugState {
  state: string;
  totalFrames: number;
  resultValue: number;
  resultUnit: string;
  rate: number;
  keyMetrics: Record<string, number>;
}

export interface ExerciseLogEntry extends ExerciseFrameResult {
  frameIndex: number;
  timestampMs: number;
}

export interface ExerciseResult {
  sessionId: string;
  exerciseType: ExerciseType;
  reps?: number;
  distanceCm?: number;
  heightCm?: number;
  validCount: number;
  invalidCount: number;
  foulCount: number;
  confidence: number;
  durationMs: number;
  feedback: string[];
  algorithmLog: ExerciseLogEntry[];
  startedAt: string;
  endedAt: string;
}

export interface ExerciseAnalyzer {
  reset(): void;
  processFrame(frame: PoseFrame): ExerciseFrameResult;
  getSessionResult(): ExerciseResult;
  getDebugState(): ExerciseDebugState;
}

export interface WorkoutSession {
  id: string;
  exerciseType: ExerciseType;
  mode: WorkoutMode;
  count: number;
  duration: number;
  timestamp: number;
  accuracy?: number;
  exerciseResult?: ExerciseResult;
  schoolId?: string;
  classId?: string;
  studentId?: string;
  taskId?: string;
  deviceId?: string;
  deviceInfo?: string;
  performanceTier?: DevicePerformanceTier;
  algorithmVersion?: string;
  algorithmLogSummary?: string;
}

/** 同步状态 */
export type SyncStatus = 'local' | 'syncing' | 'synced' | 'conflict';

/** 本地持久化的训练记录（含同步元数据） */
export interface LocalWorkoutRecord extends WorkoutSession {
  _syncStatus: SyncStatus;
  _lastModified: number;
  _serverId?: string;
}

/** WorkoutRepository 抽象接口 */
export interface IWorkoutRepository {
  save(session: WorkoutSession): Promise<boolean>;
  getAll(): Promise<LocalWorkoutRecord[]>;
  getById(id: string): Promise<LocalWorkoutRecord | null>;
  getPendingSync(): Promise<LocalWorkoutRecord[]>;
  markSynced(id: string, serverId?: string): Promise<boolean>;
  delete(id: string): Promise<boolean>;
  getAnalytics(): Promise<WorkoutAnalytics>;
}

/** 分析数据 */
export interface WorkoutAnalytics {
  totalWorkouts: number;
  totalReps: number;
  avgReps: number;
  totalDuration: number;
  recentWorkouts: LocalWorkoutRecord[];
}

export interface ExerciseConfig {
  name: string;
  chineseName: string;
  description: string;
  targetReps?: number;
  targetDuration?: number;
}

export * from './pilot';
