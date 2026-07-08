import type { ExerciseType, WorkoutSession } from './index';

export const PILOT_SCHEMA_VERSION = 'pilot-v1' as const;
export const PILOT_ALGORITHM_VERSION = 'mobile-pose-v1' as const;

export type PilotSchemaVersion = typeof PILOT_SCHEMA_VERSION;
export type PilotSourceApp = 'mobile' | 'desktop';
export type ReviewStatus = 'normal' | 'suspicious' | 'reviewed';
export type DevicePerformanceTier = 'high' | 'balanced' | 'constrained';

export interface School {
  id: string;
  name: string;
  district?: string;
  metadata?: Record<string, unknown>;
}

export interface Classroom {
  id: string;
  schoolId: string;
  name: string;
  grade?: string;
  teacherName?: string;
  metadata?: Record<string, unknown>;
}

export interface Student {
  id: string;
  schoolId: string;
  classId: string;
  name: string;
  studentNo?: string;
  gender?: 'male' | 'female' | 'unknown';
  metadata?: Record<string, unknown>;
}

export interface Device {
  id: string;
  label: string;
  platform: string;
  model?: string;
  performanceTier?: DevicePerformanceTier;
  metadata?: Record<string, unknown>;
}

export interface TrainingTask {
  id: string;
  schoolId: string;
  classId: string;
  name: string;
  exerciseType: ExerciseType;
  targetCount?: number;
  /** 显式厘米目标（距离类项目）；缺省回退 DISTANCE_REFERENCE */
  targetCm?: number;
  targetDurationSec?: number;
  startsAt?: string;
  endsAt?: string;
  officialScoring: boolean;
  metadata?: Record<string, unknown>;
}

export interface ExerciseSessionRecord {
  id: string;
  schoolId?: string;
  classId?: string;
  studentId?: string;
  taskId?: string;
  exerciseType: ExerciseType;
  startedAt: string;
  endedAt: string;
  durationSec: number;
  score: number;
  scoreUnit: 'reps' | 'cm';
  validCount: number;
  invalidCount: number;
  foulCount: number;
  confidence: number;
  deviceId?: string;
  deviceInfo?: string;
  performanceTier?: DevicePerformanceTier;
  algorithmVersion: string;
  algorithmLogSummary?: string;
  sourceSession: WorkoutSession;
  /** 评分引擎输出（可选，导出时由 PilotDataPackageService 填充，向后兼容） */
  rating?: 'excellent' | 'good' | 'pass' | 'weak';
  ratingLabel?: string;
  passed?: boolean;
  qualityLabel?: string;
  compositeScore?: number;
}

export interface ReviewRecord {
  id: string;
  sessionRecordId: string;
  status: ReviewStatus;
  reviewerName?: string;
  reviewedAt?: string;
  note?: string;
  overrideScore?: number;
}

export interface PilotEntities {
  schools: School[];
  classes: Classroom[];
  students: Student[];
  devices: Device[];
  tasks: TrainingTask[];
  sessions: ExerciseSessionRecord[];
  reviews: ReviewRecord[];
}

export interface PilotDataPackage {
  schemaVersion: PilotSchemaVersion;
  exportedAt: string;
  sourceApp: PilotSourceApp;
  algorithmVersion: string;
  entities: PilotEntities;
}

export interface PilotSelection {
  schoolId?: string;
  classId?: string;
  studentId?: string;
  taskId?: string;
}

export interface PilotHistoryFilter extends PilotSelection {
  exerciseType?: ExerciseType | 'all';
}
