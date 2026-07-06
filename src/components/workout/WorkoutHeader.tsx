import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { WorkoutMode } from '../../types';
import { formatCountdown } from './workoutFormat';
import { workoutStyles as styles } from './workoutStyles';

interface WorkoutHeaderProps {
  exerciseName: string;
  isActive: boolean;
  isTimed: boolean;
  targetCount: number;
  targetDuration: number;
  mode: WorkoutMode;
  onOpenTargetModal: () => void;
  onSwitchMode: (mode: WorkoutMode) => void;
}

export default function WorkoutHeader({
  exerciseName,
  isActive,
  isTimed,
  targetCount,
  targetDuration,
  mode,
  onOpenTargetModal,
  onSwitchMode,
}: WorkoutHeaderProps) {
  return (
    <>
      <View style={styles.topRow}>
        <View style={styles.namePill}>
          <Text style={styles.exerciseName}>{exerciseName}</Text>
        </View>
        {!isActive && (
          <TouchableOpacity
            style={styles.targetButton}
            onPress={onOpenTargetModal}
            accessibilityLabel="设置目标"
            accessibilityRole="button"
          >
            <Text style={styles.targetButtonText}>
              {isTimed ? `⏰ ${formatCountdown(targetDuration)}` : `🎯 ${targetCount}`}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {!isActive && (
        <View style={styles.modeSwitcher}>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'count' && styles.modeBtnActive]}
            onPress={() => onSwitchMode('count')}
            accessibilityLabel="定数模式"
            accessibilityRole="button"
            accessibilityState={{ selected: mode === 'count' }}
          >
            <Text style={[styles.modeBtnText, mode === 'count' && styles.modeBtnTextActive]}>
              🎯 定数模式
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'timed' && styles.modeBtnActive]}
            onPress={() => onSwitchMode('timed')}
            accessibilityLabel="定时模式"
            accessibilityRole="button"
            accessibilityState={{ selected: mode === 'timed' }}
          >
            <Text style={[styles.modeBtnText, mode === 'timed' && styles.modeBtnTextActive]}>
              ⏰ 定时模式
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </>
  );
}
