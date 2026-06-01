import React from 'react';
import { View, Text } from 'react-native';
import { PoseQualityResult } from '../../utils/poseQuality';
import { AutoStartPhase } from '../../hooks/useWorkoutScreen';
import { workoutStyles as styles } from './workoutStyles';

interface WorkoutSetupPanelProps {
  count: number;
  startCountdown: number | null;
  poseQuality: PoseQualityResult | null;
  autoStartPhase: AutoStartPhase;
}

/** 训练前：站位标定 + 3-2-1 倒计时 */
export default function WorkoutSetupPanel({
  count,
  startCountdown,
  poseQuality,
  autoStartPhase,
}: WorkoutSetupPanelProps) {
  return (
    <View style={styles.centerContent}>
      {startCountdown !== null ? (
        <Text style={styles.startCountdown}>{startCountdown}</Text>
      ) : (
        <>
          <Text style={styles.counter}>{count}</Text>
          <View
            style={[
              styles.setupGuide,
              poseQuality?.canStart ? styles.setupGuideReady : styles.setupGuideWarning,
            ]}
          >
            <Text style={styles.setupGuideText}>
              {autoStartPhase === 'ready'
                ? '保持姿势，即将自动开始...'
                : poseQuality?.message || '正在识别站位，请保持全身入镜'}
            </Text>
          </View>
        </>
      )}
    </View>
  );
}
