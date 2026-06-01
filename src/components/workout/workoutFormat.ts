import { ViewStyle } from 'react-native';
import { FormFeedback } from '../../hooks/useExerciseFeedback';
import { workoutStyles } from './workoutStyles';

export function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function getElapsedSeconds(startTime: number | null): number {
  if (!startTime) return 0;
  return Math.round((Date.now() - startTime) / 1000);
}

export function getFeedbackBoxStyle(feedback: FormFeedback | null): ViewStyle {
  if (!feedback) return {};
  switch (feedback.type) {
    case 'error':
      return workoutStyles.feedbackError;
    case 'warning':
      return workoutStyles.feedbackWarning;
    case 'success':
      return workoutStyles.feedbackSuccess;
    default:
      return {};
  }
}
