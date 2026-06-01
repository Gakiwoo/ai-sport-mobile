import React from 'react';
import { View, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WorkoutScreenProps } from '../types/navigation';
import CameraView from '../components/CameraView';
import { useWorkoutScreen } from '../hooks/useWorkoutScreen';
import { workoutStyles as styles } from '../components/workout/workoutStyles';
import WorkoutHeader from '../components/workout/WorkoutHeader';
import WorkoutSetupPanel from '../components/workout/WorkoutSetupPanel';
import WorkoutActivePanel from '../components/workout/WorkoutActivePanel';
import WorkoutControls from '../components/workout/WorkoutControls';
import WorkoutTargetModal from '../components/workout/WorkoutTargetModal';

export default function WorkoutScreen({ route }: WorkoutScreenProps) {
  const { exerciseType } = route.params;
  const insets = useSafeAreaInsets();
  const vm = useWorkoutScreen(exerciseType);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <CameraView
        onPoseDetected={vm.handlePoseDetected}
        isActive={vm.isActive}
        throttleMs={vm.runtimeProfile.activePoseIntervalMs}
        previewThrottleMs={vm.runtimeProfile.previewPoseIntervalMs}
        maxAdaptiveIntervalMs={vm.runtimeProfile.maxAdaptiveIntervalMs}
        modelComplexity={vm.runtimeProfile.modelComplexity}
        onActivePoseIntervalChange={vm.setFrameInterval}
        enablePreviewPose={!vm.isActive}
      />
      <View
        style={[styles.overlay, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }]}
        pointerEvents="box-none"
      >
        <WorkoutHeader
          exerciseName={vm.exerciseName}
          isActive={vm.isActive}
          isTimed={vm.isTimed}
          targetCount={vm.targetCount}
          targetDuration={vm.targetDuration}
          mode={vm.mode}
          onOpenTargetModal={() => vm.setShowTargetModal(true)}
          onSwitchMode={vm.switchMode}
        />

        {vm.isActive ? (
          <WorkoutActivePanel
            isTimed={vm.isTimed}
            count={vm.count}
            targetCount={vm.targetCount}
            countdown={vm.countdown}
            timeUp={vm.timeUp}
            countdownAnim={vm.countdownAnim}
            currentFeedback={vm.currentFeedback}
          />
        ) : (
          <WorkoutSetupPanel
            count={vm.count}
            startCountdown={vm.startCountdown}
            poseQuality={vm.poseQuality}
            autoStartPhase={vm.autoStartPhase}
          />
        )}

        <WorkoutControls
          isActive={vm.isActive}
          startCountdown={vm.startCountdown}
          isSaving={vm.isSaving}
          onStart={vm.handleStart}
          onConfirmStop={vm.confirmStop}
        />
      </View>

      <WorkoutTargetModal
        visible={vm.showTargetModal}
        isTimed={vm.isTimed}
        targetInput={vm.targetInput}
        durationInput={vm.durationInput}
        onChangeTargetInput={vm.setTargetInput}
        onChangeDurationInput={vm.setDurationInput}
        onClose={vm.closeTargetModal}
        onConfirmCount={vm.handleSetTarget}
        onConfirmDuration={vm.handleSetDuration}
      />
    </View>
  );
}
