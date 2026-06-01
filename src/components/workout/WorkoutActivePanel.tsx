import React from 'react';
import { View, Text, Animated } from 'react-native';
import { FormFeedback } from '../../hooks/useExerciseFeedback';
import { formatCountdown, getFeedbackBoxStyle } from './workoutFormat';
import { workoutStyles as styles } from './workoutStyles';

interface WorkoutActivePanelProps {
  isTimed: boolean;
  count: number;
  targetCount: number;
  countdown: number;
  timeUp: boolean;
  countdownAnim: Animated.Value;
  currentFeedback: FormFeedback | null;
}

/** 训练中：计时、次数、进度与动作反馈 */
export default function WorkoutActivePanel({
  isTimed,
  count,
  targetCount,
  countdown,
  timeUp,
  countdownAnim,
  currentFeedback,
}: WorkoutActivePanelProps) {
  const progressPercent =
    targetCount > 0 ? Math.round((count / targetCount) * 100) : 0;

  return (
    <View style={styles.centerContent}>
      {isTimed && (
        <Animated.View style={{ opacity: countdownAnim }}>
          <Text style={[styles.timerValue, timeUp && styles.timerValueExpired]}>
            {formatCountdown(countdown)}
          </Text>
        </Animated.View>
      )}

      <Text style={[styles.counter, isTimed && styles.counterTimed]}>{count}</Text>

      <View style={styles.targetHint}>
        <Text style={styles.targetHintText}>
          {isTimed
            ? `剩余 ${formatCountdown(countdown)}  ·  已做 ${count} 次`
            : `目标 ${targetCount}  ·  ${progressPercent}%`}
        </Text>
      </View>

      {currentFeedback && (
        <View style={[styles.feedbackBox, getFeedbackBoxStyle(currentFeedback)]}>
          <Text style={styles.feedbackText}>{currentFeedback.message}</Text>
        </View>
      )}
    </View>
  );
}
