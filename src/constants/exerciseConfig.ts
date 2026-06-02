/** 关键点置信度最低阈值，低于此值的关键点不参与计算 */
export const POSE_MIN_SCORE = 0.3;

/** @deprecated 请从 exerciseRegistry 导入；此文件仅为兼容保留 */
export {
  EXERCISE_CONFIGS,
  EXERCISE_NAMES,
  DEFAULT_TARGETS,
  DEFAULT_DURATIONS,
  type ExerciseConfig,
} from './exerciseRegistry';
