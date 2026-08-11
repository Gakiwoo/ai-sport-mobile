/**
 * Compatibility layer for @ai-sport/core migration.
 * 
 * Migration guide for Mobile:
 * - Old: import { KalmanFilter1D } from '../utils/filters'
 *   New: import { KalmanFilter1D } from '@ai-sport/core'
 *   Note: Constructor changed from positional to options object:
 *     new KalmanFilter1D(0.01, 0.1) → new KalmanFilter1D({ processNoise: 0.01, measurementNoise: 0.1 })
 *   Note: Method renamed: .filter(v) → .update(v)
 * 
 * - Old: import { SlidingWindow } from '../utils/filters'
 *   New: import { SlidingWindow } from '@ai-sport/core'
 *   Note: Methods renamed: .mean() → .getMean(), .stddev() → .getStdDev(), .clear() → .reset()
 * 
 * - Old: PoseDetectionService.getKeypoint(pose, index)
 *   New: import { getKeypoint } from '@ai-sport/core'
 */

export {
  // Types
  type ExerciseType,
  type WorkoutMode,
  type Keypoint,
  type Pose,
  type ExerciseFeedback,
  type ExerciseFrameResult,
  type ExerciseDebugState,
  type ExerciseLogEntry,
  type ExerciseResult,
  type DevicePerformanceTier,
  type WorkoutSession,
  // Pilot types
  PILOT_SCHEMA_VERSION,
  type School,
  type Classroom,
  type Student,
  type Device,
  type TrainingTask,
  type ExerciseSessionRecord,
  type ReviewRecord,
  type PilotEntities,
  type PilotDataPackage,
  type PilotHistoryFilter,
  // Constants
  POSE_MIN_SCORE,
  EXERCISE_NAMES,
  DEFAULT_TARGETS,
  DEFAULT_DURATIONS,
  KEYPOINT_NAMES,
  EXERCISE_TYPES,
  // Filters
  KalmanFilter1D,
  SlidingWindow,
  PeakDetector,
  MultiPointKalman,
  // Pose helpers
  getKeypoint,
  getKeypointByName,
  calculateAngle,
  midpoint,
  distance,
  getBodyHeight,
  hasRequiredKeypoints,
  // Scoring
  type RatingTier,
  type QualityTier,
  type ScoringInput,
  type ScoringResult,
  scoreSession,
  extractScoringInput,
  RATING_THRESHOLDS,
  DISTANCE_REFERENCE,
  QUALITY_THRESHOLDS,
  SCORING_CONFIG,
  RATING_LABELS,
  QUALITY_LABELS,
  // Counters
  ExerciseCounter,
  JumpRopeCounter,
  JumpingJacksCounter,
  SquatsCounter,
  SitUpCounter,
  StandingLongJumpCounter,
  VerticalJumpCounter,
  getLandingFeedback,
} from '@ai-sport/core';
