import { useState, useCallback, useRef, useEffect } from 'react';
import { Platform } from 'react-native';
import { ExerciseType, Pose, WorkoutSession, WorkoutMode } from '../types';
import { ExerciseCounter } from '../services/ExerciseCounter';
import { JumpRopeCounter } from '../services/counters/JumpRopeCounter';
import { JumpingJacksCounter } from '../services/counters/JumpingJacksCounter';
import { SquatsCounter } from '../services/counters/SquatsCounter';
import { StandingLongJumpCounter } from '../services/counters/StandingLongJumpCounter';
import { VerticalJumpCounter } from '../services/counters/VerticalJumpCounter';
import { SitUpCounter } from '../services/counters/SitUpCounter';
import { workoutRepository } from '../services/WorkoutRepository';
import { syncService } from '../services/SyncService';
import { performanceMonitor } from '../services/PerformanceMonitor';
import { pilotDataPackageService } from '../services/PilotDataPackageService';
import { PILOT_ALGORITHM_VERSION } from '../types/pilot';
import {
  DEFAULT_TARGETS,
  DEFAULT_DURATIONS,
  getExerciseRuntimeProfile,
} from '../constants/exerciseRegistry';

export interface WorkoutState {
  isActive: boolean;
  count: number;
  mode: WorkoutMode;
  targetCount: number;
  targetDuration: number;
  isSaving: boolean;
  timeUp: boolean;
}

export function useWorkout(exerciseType: ExerciseType) {
  const [isActive, setIsActive] = useState(false);
  const [count, setCount] = useState(0);
  const [mode, setMode] = useState<WorkoutMode>('count');
  const [targetCount, setTargetCount] = useState(DEFAULT_TARGETS[exerciseType]);
  const [targetDuration, setTargetDuration] = useState(DEFAULT_DURATIONS[exerciseType]);
  const [isSaving, setIsSaving] = useState(false);
  const [timeUp, setTimeUp] = useState(false);
  // counter 必须随 exerciseType 变化重建，否则切换运动后仍用旧算法实例 → 数据错乱
  const [counter, setCounter] = useState<ExerciseCounter>(() => createCounter(exerciseType));
  const startTimeRef = useRef<number | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const prevCountRef = useRef(0);
  const isActiveRef = useRef(false);
  const prevExerciseTypeRef = useRef(exerciseType);

  // 保持 isActiveRef 同步，供 processFrame 使用
  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  // 切换运动类型时重建 counter 并重置相关状态，避免算法实例与 exerciseType 不一致
  // 仅在非活跃状态下重建，防止训练过程中切换导致数据丢失
  useEffect(() => {
    if (isActive) return;
    if (prevExerciseTypeRef.current === exerciseType) return; // 首次挂载或未变化时不重建
    prevExerciseTypeRef.current = exerciseType;
    setCounter(createCounter(exerciseType));
    setCount(0);
    prevCountRef.current = 0;
    startTimeRef.current = null;
    setTimeUp(false);
  }, [exerciseType, isActive]);

  const setFrameInterval = useCallback(
    (intervalMs: number) => {
      counter.setFrameInterval(intervalMs);
    },
    [counter],
  );

  useEffect(() => {
    setFrameInterval(getExerciseRuntimeProfile(exerciseType).activePoseIntervalMs);
  }, [exerciseType, setFrameInterval]);

  // 定时模式：时间到自动停止
  useEffect(() => {
    if (!isActive || mode !== 'timed') return;
    const timer = setInterval(() => {
      if (!startTimeRef.current) return;
      const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000);
      if (elapsed >= targetDuration) {
        setTimeUp(true);
      }
    }, 200);
    return () => clearInterval(timer);
  }, [isActive, mode, targetDuration]);

  const processFrame = useCallback(
    (pose: Pose) => {
      if (isActiveRef.current) {
        counter.processFrameResult(pose);
        const newCount = counter.getCount();
        if (newCount !== prevCountRef.current) {
          prevCountRef.current = newCount;
          setCount(newCount);
        }
      }
    },
    [counter],
  );

  const start = useCallback(() => {
    counter.reset();
    prevCountRef.current = 0;
    const startedAt = Date.now();
    const sessionId = `${startedAt}-${Math.random().toString(36).substr(2, 9)}`;
    sessionIdRef.current = sessionId;
    setCount(0);
    setIsActive(true);
    // 同步设置 isActiveRef，避免 useEffect 异步提交期间到达的首帧被 processFrame 丢弃
    isActiveRef.current = true;
    setTimeUp(false);
    startTimeRef.current = startedAt;
    counter.startSession(exerciseType, {
      sessionId,
      startedAt: new Date(startedAt).toISOString(),
    });
    performanceMonitor.start();
  }, [counter, exerciseType]);

  const stop = useCallback(async (): Promise<{
    session: WorkoutSession | null;
    saved: boolean;
  }> => {
    setIsActive(false);
    // 同步清零，立即阻止后续帧进入 processFrame（与 start 对称）
    isActiveRef.current = false;

    const endedAt = new Date();
    const exerciseResult = counter.getSessionResult(exerciseType, endedAt.toISOString());
    const finalCount = exerciseResult.reps ?? counter.getCount();
    const measuredValue = exerciseResult.distanceCm ?? exerciseResult.heightCm ?? 0;
    if (finalCount === 0 && measuredValue === 0 && mode !== 'timed') {
      return { session: null, saved: false };
    }

    const duration = startTimeRef.current
      ? Math.round((Date.now() - startTimeRef.current) / 1000)
      : targetDuration;
    const performanceTier =
      (
        performanceMonitor as {
          getCurrentTier?: () => WorkoutSession['performanceTier'];
        }
      ).getCurrentTier?.() || 'balanced';
    const pilotSelection = await pilotDataPackageService.getActiveSelection(exerciseType);
    const device = pilotDataPackageService.getCurrentDevice(performanceTier);
    const log = exerciseResult.algorithmLog;
    const algorithmLogSummary = `frames=${log.length};valid=${exerciseResult.validCount};invalid=${exerciseResult.invalidCount};foul=${exerciseResult.foulCount}`;

    const session: WorkoutSession = {
      id: sessionIdRef.current || exerciseResult.sessionId,
      exerciseType,
      mode,
      count: finalCount,
      duration,
      timestamp: endedAt.getTime(),
      exerciseResult,
      schoolId: pilotSelection.schoolId,
      classId: pilotSelection.classId,
      studentId: pilotSelection.studentId,
      taskId: pilotSelection.taskId,
      deviceId: device.id,
      deviceInfo: `${device.label}/${Platform.OS}`,
      performanceTier,
      algorithmVersion: PILOT_ALGORITHM_VERSION,
      algorithmLogSummary,
    };

    setIsSaving(true);
    try {
      const saved = await workoutRepository.save(session);
      // 训练后异步触发同步（fire-and-forget，不阻塞 UI）
      syncService.syncAfterWorkout().catch(() => {});
      return { session, saved };
    } catch (error) {
      console.error('保存训练记录失败:', error);
      return { session, saved: false };
    } finally {
      setIsSaving(false);
      performanceMonitor.stop(); // 保存性能报告
    }
  }, [counter, exerciseType, mode, targetDuration]);

  const switchMode = useCallback(
    (newMode: WorkoutMode) => {
      if (isActive) return;
      setMode(newMode);
    },
    [isActive],
  );

  return {
    isActive,
    count,
    mode,
    targetCount,
    setTargetCount,
    targetDuration,
    setTargetDuration,
    isSaving,
    timeUp,
    processFrame,
    start,
    stop,
    switchMode,
    setFrameInterval,
  };
}

function createCounter(type: ExerciseType): ExerciseCounter {
  switch (type) {
    case 'jump_rope':
      return new JumpRopeCounter();
    case 'jumping_jacks':
      return new JumpingJacksCounter();
    case 'squats':
      return new SquatsCounter();
    case 'standing_long_jump':
      return new StandingLongJumpCounter();
    case 'vertical_jump':
      return new VerticalJumpCounter();
    case 'sit_ups':
      return new SitUpCounter();
  }
}
