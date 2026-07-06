import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { E2E_TEST_IDS } from '../../constants/e2eTestIds';
import { workoutStyles as styles } from './workoutStyles';

interface WorkoutControlsProps {
  isActive: boolean;
  startCountdown: number | null;
  isSaving: boolean;
  onStart: () => void;
  onConfirmStop: () => void;
}

export default function WorkoutControls({
  isActive,
  startCountdown,
  isSaving,
  onStart,
  onConfirmStop,
}: WorkoutControlsProps) {
  return (
    <View style={styles.controls}>
      {!isActive ? (
        <TouchableOpacity
          testID={E2E_TEST_IDS.workoutStartButton}
          style={[styles.startButton, startCountdown !== null && styles.disabledButton]}
          onPress={onStart}
          disabled={startCountdown !== null}
          accessibilityLabel={startCountdown !== null ? '准备中' : '开始'}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>{startCountdown !== null ? '准备中...' : '开始'}</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          testID={E2E_TEST_IDS.workoutStopButton}
          style={[styles.stopButton, isSaving && styles.disabledButton]}
          onPress={onConfirmStop}
          disabled={isSaving}
          accessibilityLabel={isSaving ? '保存中' : '停止'}
          accessibilityRole="button"
        >
          <Text style={[styles.buttonText, styles.stopButtonText]}>
            {isSaving ? '保存中...' : '停止'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
