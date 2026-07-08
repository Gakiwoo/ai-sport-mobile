import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Alert, Animated } from 'react-native';
import { ExerciseType, Pose, WorkoutMode } from '../types';
import { useExerciseFeedback, FormFeedback } from './useExerciseFeedback';
import { useSound } from './useSound';
import { useWorkout } from './useWorkout';
import { scoreSession, extractScoringInput } from '../services/scoring';
import {
  EXERCISE_NAMES,
  DEFAULT_TARGETS,
  DEFAULT_DURATIONS,
  getExerciseRuntimeProfile,
} from '../constants/exerciseRegistry';
import { analyzePoseQuality, PoseQualityResult } from '../utils/poseQuality';

export type AutoStartPhase = 'waiting' | 'ready' | 'counting' | null;

export function useWorkoutScreen(exerciseType: ExerciseType) {
  const {
    isActive,
    count,
    mode,
    targetCount,
    targetDuration,
    isSaving,
    timeUp,
    isPaused,
    processFrame,
    start,
    stop,
    pause,
    resume,
    getElapsedSeconds,
    switchMode,
    setTargetCount,
    setTargetDuration,
    setFrameInterval,
  } = useWorkout(exerciseType);

  const [showTargetModal, setShowTargetModal] = useState(false);
  const [targetInput, setTargetInput] = useState(DEFAULT_TARGETS[exerciseType].toString());
  const [durationInput, setDurationInput] = useState(DEFAULT_DURATIONS[exerciseType].toString());
  const [currentFeedback, setCurrentFeedback] = useState<FormFeedback | null>(null);
  const [poseQuality, setPoseQuality] = useState<PoseQualityResult | null>(null);
  const [startCountdown, setStartCountdown] = useState<number | null>(null);
  const [autoStartPhase, setAutoStartPhase] = useState<AutoStartPhase>(null);
  const [elapsed, setElapsed] = useState(0);

  const hasShownCompletionRef = useRef(false);
  const prevFeedbackMsgRef = useRef<string | null>(null);
  const prevQualityMsgRef = useRef<string | null>(null);
  const handleStopRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const handleStartRef = useRef<() => void>(() => {});
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const countdownAnim = useRef(new Animated.Value(1)).current;
  const poseQualityRef = useRef<PoseQualityResult | null>(null);
  const autoStartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 训练开始时快照的目标次数，防止中途修改目标导致评分失真 */
  const targetCountSnapshotRef = useRef(targetCount);

  const runtimeProfile = useMemo(() => getExerciseRuntimeProfile(exerciseType), [exerciseType]);
  const { getFeedback } = useExerciseFeedback();
  const { playSuccess } = useSound();

  const isTimed = mode === 'timed';
  const countdown = Math.max(0, targetDuration - elapsed);
  const exerciseName = EXERCISE_NAMES[exerciseType];

  useEffect(() => {
    if (!isActive) {
      setElapsed(0);
      return;
    }
    setElapsed(0);
    const timer = setInterval(() => {
      setElapsed(getElapsedSeconds());
    }, 200);
    return () => clearInterval(timer);
  }, [isActive, getElapsedSeconds]);

  useEffect(() => {
    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
      if (countdownLoopRef.current) {
        countdownLoopRef.current.stop();
        countdownLoopRef.current = null;
      }
      if (autoStartTimerRef.current) {
        clearTimeout(autoStartTimerRef.current);
        autoStartTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (countdownLoopRef.current) {
      countdownLoopRef.current.stop();
      countdownLoopRef.current = null;
    }

    if (timeUp) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(countdownAnim, { toValue: 0.6, duration: 500, useNativeDriver: true }),
          Animated.timing(countdownAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ]),
      );
      countdownLoopRef.current = loop;
      loop.start();
      return () => {
        loop.stop();
        if (countdownLoopRef.current === loop) {
          countdownLoopRef.current = null;
        }
      };
    }
    countdownAnim.setValue(1);
  }, [timeUp, countdownAnim]);

  useEffect(() => {
    if (
      isActive &&
      mode === 'count' &&
      count > 0 &&
      count >= targetCount &&
      !hasShownCompletionRef.current
    ) {
      hasShownCompletionRef.current = true;
      playSuccess();
      const stopFn = handleStopRef.current;
      Alert.alert('🎉 恭喜完成！', `已达成目标 ${targetCount} 次！`, [
        { text: '继续', style: 'cancel' },
        { text: '停止', onPress: () => stopFn() },
      ]);
    }
  }, [count, targetCount, isActive, mode, playSuccess]);

  useEffect(() => {
    if (timeUp && isActive) {
      handleStopRef.current();
    }
  }, [timeUp, isActive]);

  useEffect(() => {
    if (isActive || startCountdown !== null) {
      if (autoStartTimerRef.current) {
        clearTimeout(autoStartTimerRef.current);
        autoStartTimerRef.current = null;
      }
      if (autoStartPhase !== 'counting') {
        setAutoStartPhase(null);
      }
      return;
    }

    if (poseQuality?.canStart) {
      if (!autoStartTimerRef.current) {
        setAutoStartPhase('ready');
        autoStartTimerRef.current = setTimeout(() => {
          autoStartTimerRef.current = null;
          handleStartRef.current();
        }, 2000);
      }
    } else {
      if (autoStartTimerRef.current) {
        clearTimeout(autoStartTimerRef.current);
        autoStartTimerRef.current = null;
      }
      setAutoStartPhase('waiting');
    }

    return () => {
      if (autoStartTimerRef.current) {
        clearTimeout(autoStartTimerRef.current);
        autoStartTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poseQuality?.canStart, isActive, startCountdown]);

  const handlePoseDetected = useCallback(
    (pose: Pose) => {
      const quality = analyzePoseQuality(pose);
      poseQualityRef.current = quality;
      if (quality.message !== prevQualityMsgRef.current) {
        prevQualityMsgRef.current = quality.message;
        setPoseQuality(quality);
      }

      processFrame(pose);
      if (!isActive) return;

      const feedback = getFeedback(pose, exerciseType);
      if (feedback) {
        if (feedback.message !== prevFeedbackMsgRef.current) {
          prevFeedbackMsgRef.current = feedback.message;
          setCurrentFeedback(feedback);
        }
      } else if (prevFeedbackMsgRef.current !== null) {
        prevFeedbackMsgRef.current = null;
        setCurrentFeedback(null);
      }
    },
    [processFrame, getFeedback, exerciseType, isActive],
  );

  const handleStart = useCallback(() => {
    if (startCountdown !== null) return;

    const quality = poseQualityRef.current;
    if (!quality?.canStart) {
      Alert.alert('先调整站位', quality?.message || '请站到镜头前，保持全身可见');
      return;
    }

    if (autoStartTimerRef.current) {
      clearTimeout(autoStartTimerRef.current);
      autoStartTimerRef.current = null;
    }
    setAutoStartPhase('counting');
    // 训练开始时快照目标次数，防止中途修改目标导致评分失真
    targetCountSnapshotRef.current = targetCount;

    setCurrentFeedback(null);
    prevFeedbackMsgRef.current = null;
    setStartCountdown(3);

    let next = 3;
    countdownTimerRef.current = setInterval(() => {
      next -= 1;
      if (next <= 0) {
        if (countdownTimerRef.current) {
          clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
        }
        setStartCountdown(null);
        setAutoStartPhase(null);
        start();
      } else {
        setStartCountdown(next);
      }
    }, 1000);
  }, [startCountdown, start, targetCount]);

  const handleStop = useCallback(async () => {
    setCurrentFeedback(null);
    prevFeedbackMsgRef.current = null;
    const { session, saved } = await stop();

    if (saved && session) {
      const modeLabel = session.mode === 'timed' ? '⏰ 定时模式' : '🎯 定数模式';
      const scoring = scoreSession(
        extractScoringInput(session, targetCountSnapshotRef.current),
      );
      Alert.alert(
        `${modeLabel}\n训练记录已保存`,
        `${EXERCISE_NAMES[exerciseType]}：${session.count} 次，耗时 ${session.duration} 秒\n` +
          `评级：${scoring.ratingLabel}（${scoring.passed ? '达标' : '未达标'}）\n` +
          `综合分 ${scoring.compositeScore} · 动作质量 ${scoring.qualityLabel}`,
        [{ text: '确定' }],
      );
    } else if (!saved && session) {
      Alert.alert('保存失败', '训练记录保存失败，请重试', [{ text: '确定' }]);
    }
  }, [exerciseType, stop]);

  handleStopRef.current = handleStop;
  handleStartRef.current = handleStart;

  const handleSetTarget = useCallback(() => {
    const target = parseInt(targetInput, 10);
    if (isNaN(target) || target <= 0) {
      Alert.alert('无效目标', '请输入有效的目标次数');
      return;
    }
    setTargetCount(target);
    setShowTargetModal(false);
  }, [targetInput, setTargetCount]);

  const handleSetDuration = useCallback(() => {
    const dur = parseInt(durationInput, 10);
    if (isNaN(dur) || dur <= 0) {
      Alert.alert('无效时长', '请输入有效的目标时长（秒）');
      return;
    }
    setTargetDuration(dur);
    setShowTargetModal(false);
  }, [durationInput, setTargetDuration]);

  const closeTargetModal = useCallback(() => {
    setTargetInput(targetCount.toString());
    setDurationInput(targetDuration.toString());
    setShowTargetModal(false);
  }, [targetCount, targetDuration]);

  const confirmStop = useCallback(() => {
    Alert.alert(
      '确认停止',
      isTimed
        ? `当前已做 ${count} 次，确定要停止并保存记录吗？`
        : `当前 ${count}/${targetCount} 次，确定要停止并保存记录吗？`,
      [
        { text: '取消', style: 'cancel' },
        { text: '停止并保存', style: 'destructive', onPress: handleStop },
      ],
    );
  }, [isTimed, count, targetCount, handleStop]);

  return {
    exerciseType,
    exerciseName,
    runtimeProfile,
    isActive,
    count,
    mode,
    isTimed,
    targetCount,
    targetDuration,
    countdown,
    isSaving,
    timeUp,
    isPaused,
    elapsed,
    startCountdown,
    autoStartPhase,
    poseQuality,
    currentFeedback,
    countdownAnim,
    showTargetModal,
    targetInput,
    durationInput,
    setShowTargetModal,
    setTargetInput,
    setDurationInput,
    handlePoseDetected,
    handleStart,
    handleStop,
    handleSetTarget,
    handleSetDuration,
    closeTargetModal,
    confirmStop,
    pause,
    resume,
    switchMode: (next: WorkoutMode) => switchMode(next),
    setFrameInterval,
  };
}

export type WorkoutScreenViewModel = ReturnType<typeof useWorkoutScreen>;
