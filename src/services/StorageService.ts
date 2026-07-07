/**
 * @deprecated 请使用 WorkoutRepository (src/services/WorkoutRepository.ts) 代替。
 *             此类仅保留用于向后兼容，使用独立存储 key 避免与 WorkoutRepository 冲突。
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WorkoutSession } from '../types';
import ErrorReporter from './ErrorReporter';

const STORAGE_KEY = '@workout_history_legacy';
const MAX_RECENT_WORKOUTS = 10;
const MAX_STORED_WORKOUTS = 1000;

class StorageService {
  async saveWorkout(session: WorkoutSession): Promise<boolean> {
    try {
      const history = await this.getWorkoutHistory();
      history.push(session);
      const trimmedHistory = history
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(-MAX_STORED_WORKOUTS);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(trimmedHistory));
      return true;
    } catch (error) {
      ErrorReporter.captureError(error, { source: 'StorageService', action: 'saveSession' });
      return false;
    }
  }

  async getWorkoutHistory(): Promise<WorkoutSession[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      const sessions: WorkoutSession[] = data ? JSON.parse(data) : [];
      // 向后兼容：旧记录无 mode 字段，默认为 'count'
      return sessions.map((s) => ({
        ...s,
        mode: s.mode || 'count',
      }));
    } catch (error) {
      ErrorReporter.captureError(error, { source: 'StorageService', action: 'loadHistory' });
      return [];
    }
  }

  async getAnalytics(): Promise<{
    totalWorkouts: number;
    totalReps: number;
    avgReps: number;
    totalDuration: number;
    recentWorkouts: WorkoutSession[];
  }> {
    const history = await this.getWorkoutHistory();
    const totalWorkouts = history.length;
    const totalReps = history.reduce((sum, session) => sum + session.count, 0);
    const totalDuration = history.reduce((sum, session) => sum + session.duration, 0);
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

export default new StorageService();
