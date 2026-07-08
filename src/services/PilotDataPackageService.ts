import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  documentDirectory,
  EncodingType,
  makeDirectoryAsync,
  writeAsStringAsync,
} from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import type { ExerciseType, WorkoutSession } from '../types';
import {
  PILOT_ALGORITHM_VERSION,
  PILOT_SCHEMA_VERSION,
  type Device,
  type ExerciseSessionRecord,
  type PilotDataPackage,
  type PilotEntities,
  type PilotHistoryFilter,
  type PilotSelection,
  type TrainingTask,
} from '../types/pilot';
import { workoutRepository } from './WorkoutRepository';
import { scoreSession, extractScoringInput, type ScoringResult } from './scoring';

const PILOT_SELECTION_KEY = '@pilot_selection_v1';
const PILOT_ENTITIES_KEY = '@pilot_entities_v1';
const PILOT_EXPORT_DIR = 'pilot/';

const OFFICIAL_EXERCISES: ExerciseType[] = ['jump_rope', 'squats', 'sit_ups', 'jumping_jacks'];

const defaultTasks: TrainingTask[] = OFFICIAL_EXERCISES.map((exerciseType) => ({
  id: `task-${exerciseType}`,
  schoolId: 'school-demo',
  classId: 'class-demo-1',
  name: getExerciseName(exerciseType),
  exerciseType,
  targetCount: exerciseType === 'jump_rope' ? 60 : 30,
  targetDurationSec: 60,
  officialScoring: true,
}));

export const DEFAULT_PILOT_ENTITIES: Omit<PilotEntities, 'sessions' | 'reviews'> = {
  schools: [{ id: 'school-demo', name: '试点学校' }],
  classes: [
    {
      id: 'class-demo-1',
      schoolId: 'school-demo',
      name: '三年级 1 班',
      grade: '三年级',
      teacherName: '试点教师',
    },
  ],
  students: [
    {
      id: 'student-demo-1',
      schoolId: 'school-demo',
      classId: 'class-demo-1',
      name: '学生 A',
      studentNo: '001',
      gender: 'unknown',
    },
    {
      id: 'student-demo-2',
      schoolId: 'school-demo',
      classId: 'class-demo-1',
      name: '学生 B',
      studentNo: '002',
      gender: 'unknown',
    },
  ],
  devices: [],
  tasks: defaultTasks,
};

class PilotDataPackageService {
  getCurrentDevice(performanceTier?: Device['performanceTier']): Device {
    return {
      id: `mobile-${Platform.OS}`,
      label: `Mobile ${Platform.OS}`,
      platform: Platform.OS,
      performanceTier,
    };
  }

  async getEntities(): Promise<Omit<PilotEntities, 'sessions' | 'reviews'>> {
    try {
      const raw = await AsyncStorage.getItem(PILOT_ENTITIES_KEY);
      if (!raw) return DEFAULT_PILOT_ENTITIES;
      const parsed = JSON.parse(raw) as Omit<PilotEntities, 'sessions' | 'reviews'>;
      return {
        schools: Array.isArray(parsed.schools) ? parsed.schools : DEFAULT_PILOT_ENTITIES.schools,
        classes: Array.isArray(parsed.classes) ? parsed.classes : DEFAULT_PILOT_ENTITIES.classes,
        students: Array.isArray(parsed.students)
          ? parsed.students
          : DEFAULT_PILOT_ENTITIES.students,
        devices: Array.isArray(parsed.devices) ? parsed.devices : DEFAULT_PILOT_ENTITIES.devices,
        tasks: Array.isArray(parsed.tasks) ? parsed.tasks : DEFAULT_PILOT_ENTITIES.tasks,
      };
    } catch {
      return DEFAULT_PILOT_ENTITIES;
    }
  }

  async saveEntities(entities: Omit<PilotEntities, 'sessions' | 'reviews'>): Promise<void> {
    await AsyncStorage.setItem(PILOT_ENTITIES_KEY, JSON.stringify(entities));
  }

  async importPackage(json: string): Promise<{
    schools: number;
    classes: number;
    students: number;
    tasks: number;
  }> {
    // 输入大小校验：防止恶意/损坏的 JSON 撑爆 AsyncStorage
    const MAX_JSON_SIZE = 10 * 1024 * 1024; // 10 MB
    if (json.length > MAX_JSON_SIZE) {
      throw new Error(`Package too large: ${(json.length / 1024 / 1024).toFixed(1)} MB (max 10 MB)`);
    }

    let data: PilotDataPackage;
    try {
      data = JSON.parse(json) as PilotDataPackage;
    } catch {
      throw new Error('Invalid JSON in pilot package');
    }

    if (data?.schemaVersion !== PILOT_SCHEMA_VERSION || !data.entities) {
      throw new Error('Invalid pilot-v1 package');
    }

    // 实体数组长度校验：防止注入超大数组
    const MAX_ENTITIES = 10_000;
    const entityCounts: Array<[string, unknown[] | undefined]> = [
      ['schools', data.entities.schools],
      ['classes', data.entities.classes],
      ['students', data.entities.students],
      ['tasks', data.entities.tasks],
      ['sessions', data.entities.sessions],
    ];
    for (const [name, arr] of entityCounts) {
      if (arr && !Array.isArray(arr)) {
        throw new Error(`Invalid package: entities.${name} is not an array`);
      }
      if (arr && arr.length > MAX_ENTITIES) {
        throw new Error(
          `Invalid package: entities.${name} has ${arr.length} items (max ${MAX_ENTITIES})`,
        );
      }
    }

    const current = await this.getEntities();
    const next = {
      schools: mergeById(current.schools, data.entities.schools || []),
      classes: mergeById(current.classes, data.entities.classes || []),
      students: mergeById(current.students, data.entities.students || []),
      devices: mergeById(current.devices, data.entities.devices || []),
      tasks: mergeById(current.tasks, data.entities.tasks || []),
    };
    await this.saveEntities(next);
    const student = data.entities.students?.[0] || next.students[0];
    const task =
      data.entities.tasks?.find((item) => item.classId === student?.classId) ||
      next.tasks.find((item) => item.classId === student?.classId) ||
      next.tasks[0];
    await AsyncStorage.setItem(
      PILOT_SELECTION_KEY,
      JSON.stringify({
        schoolId: student?.schoolId || next.schools[0]?.id,
        classId: student?.classId || next.classes[0]?.id,
        studentId: student?.id,
        taskId: task?.id,
      }),
    );

    return {
      schools: next.schools.length,
      classes: next.classes.length,
      students: next.students.length,
      tasks: next.tasks.length,
    };
  }

  async exportEntitiesPackage(sourceApp: PilotDataPackage['sourceApp']): Promise<PilotDataPackage> {
    const entities = await this.getEntities();
    return {
      schemaVersion: PILOT_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      sourceApp,
      algorithmVersion: PILOT_ALGORITHM_VERSION,
      entities: {
        ...entities,
        sessions: [],
        reviews: [],
      },
    };
  }

  async getActiveSelection(exerciseType?: ExerciseType): Promise<PilotSelection> {
    const entities = await this.getEntities();
    let stored: PilotSelection = {};
    try {
      const raw = await AsyncStorage.getItem(PILOT_SELECTION_KEY);
      stored = raw ? (JSON.parse(raw) as PilotSelection) : {};
    } catch {
      stored = {};
    }
    const student =
      entities.students.find((item) => item.id === stored.studentId) || entities.students[0];
    const classId = stored.classId || student?.classId || entities.classes[0]?.id;
    const schoolId = stored.schoolId || student?.schoolId || entities.schools[0]?.id;
    const task =
      entities.tasks.find(
        (item) =>
          item.id === stored.taskId && (!exerciseType || item.exerciseType === exerciseType),
      ) ||
      entities.tasks.find(
        (item) => item.classId === classId && (!exerciseType || item.exerciseType === exerciseType),
      ) ||
      entities.tasks[0];

    return {
      schoolId,
      classId,
      studentId: stored.studentId || student?.id,
      taskId: task?.id,
    };
  }

  async setActiveSelection(selection: PilotSelection): Promise<PilotSelection> {
    const next = {
      ...(await this.getActiveSelection()),
      ...selection,
    };
    await AsyncStorage.setItem(PILOT_SELECTION_KEY, JSON.stringify(next));
    return next;
  }

  createSessionRecord(session: WorkoutSession, task?: TrainingTask): ExerciseSessionRecord {
    const result = session.exerciseResult;
    const score = result?.distanceCm ?? result?.heightCm ?? result?.reps ?? session.count;
    const scoreUnit = result?.distanceCm || result?.heightCm ? 'cm' : 'reps';
    const startedAt =
      result?.startedAt || new Date(session.timestamp - session.duration * 1000).toISOString();
    const endedAt = result?.endedAt || new Date(session.timestamp).toISOString();

    const record: ExerciseSessionRecord = {
      id: session.id,
      schoolId: session.schoolId,
      classId: session.classId,
      studentId: session.studentId,
      taskId: session.taskId,
      exerciseType: session.exerciseType,
      startedAt,
      endedAt,
      durationSec: session.duration,
      score,
      scoreUnit,
      validCount: result?.validCount ?? session.count,
      invalidCount: result?.invalidCount ?? 0,
      foulCount: result?.foulCount ?? 0,
      confidence: result?.confidence ?? session.accuracy ?? 0,
      deviceId: session.deviceId,
      deviceInfo: session.deviceInfo,
      performanceTier: session.performanceTier,
      algorithmVersion: session.algorithmVersion || PILOT_ALGORITHM_VERSION,
      algorithmLogSummary: session.algorithmLogSummary,
      sourceSession: session,
    };

    const scoring = this.scoreSessionRecord(record, task);
    record.rating = scoring.rating;
    record.ratingLabel = scoring.ratingLabel;
    record.passed = scoring.passed;
    record.qualityLabel = scoring.qualityLabel;
    record.compositeScore = scoring.compositeScore;
    return record;
  }

  /** 根据成绩记录与（可选）任务目标计算评分结果 */
  scoreSessionRecord(record: ExerciseSessionRecord, task?: TrainingTask): ScoringResult {
    return scoreSession({
      exerciseType: record.exerciseType,
      score: record.score,
      scoreUnit: record.scoreUnit,
      validCount: record.validCount,
      invalidCount: record.invalidCount,
      foulCount: record.foulCount,
      confidence: record.confidence,
      targetCount: task?.targetCount,
      targetCm: task?.targetCm,
    });
  }

  filterSessions<T extends WorkoutSession | ExerciseSessionRecord>(
    sessions: T[],
    filter: PilotHistoryFilter,
  ): T[] {
    return sessions.filter((session) => {
      if (
        filter.exerciseType &&
        filter.exerciseType !== 'all' &&
        session.exerciseType !== filter.exerciseType
      ) {
        return false;
      }
      if (filter.schoolId && session.schoolId !== filter.schoolId) return false;
      if (filter.classId && session.classId !== filter.classId) return false;
      if (filter.studentId && session.studentId !== filter.studentId) return false;
      if (filter.taskId && session.taskId !== filter.taskId) return false;
      return true;
    });
  }

  async exportLocalResults(): Promise<PilotDataPackage> {
    const sessions = await workoutRepository.getAll();
    return this.buildPackage(sessions, 'mobile');
  }

  async exportLocalResultsFile(): Promise<{ uri: string; dataPackage: PilotDataPackage }> {
    if (!documentDirectory) {
      throw new Error('Document directory is unavailable');
    }
    const dataPackage = await this.exportLocalResults();
    const directoryUri = documentDirectory + PILOT_EXPORT_DIR;
    const fileUri = `${directoryUri}ai-sport-results-${toFileStamp(dataPackage.exportedAt)}.json`;

    await makeDirectoryAsync(directoryUri, { intermediates: true });
    await writeAsStringAsync(fileUri, JSON.stringify(dataPackage, null, 2), {
      encoding: EncodingType.UTF8,
    });

    return { uri: fileUri, dataPackage };
  }

  async buildPackage(
    sessions: WorkoutSession[],
    sourceApp: PilotDataPackage['sourceApp'],
  ): Promise<PilotDataPackage> {
    const entities = await this.getEntities();
    const devicesById = new Map<string, Device>();
    for (const session of sessions) {
      if (session.deviceId) {
        devicesById.set(session.deviceId, {
          id: session.deviceId,
          label: session.deviceInfo || session.deviceId,
          platform: session.deviceInfo || 'unknown',
          performanceTier: session.performanceTier,
        });
      }
    }

    return {
      schemaVersion: PILOT_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      sourceApp,
      algorithmVersion: PILOT_ALGORITHM_VERSION,
      entities: {
        ...entities,
        devices: [...entities.devices, ...Array.from(devicesById.values())],
        sessions: sessions.map((session) =>
          this.createSessionRecord(session, entities.tasks.find((task) => task.id === session.taskId)),
        ),
        reviews: [],
      },
    };
  }
}

function mergeById<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  const byId = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) {
    if (item?.id) {
      byId.set(item.id, item);
    }
  }
  return Array.from(byId.values());
}

function getExerciseName(type: ExerciseType): string {
  switch (type) {
    case 'jump_rope':
      return '跳绳';
    case 'squats':
      return '深蹲';
    case 'sit_ups':
      return '仰卧起坐';
    case 'jumping_jacks':
      return '开合跳';
    case 'standing_long_jump':
      return '立定跳远训练估算';
    case 'vertical_jump':
      return '纵跳训练估算';
    default:
      return type;
  }
}

function toFileStamp(value: string): string {
  return value.replace(/[:.]/g, '-');
}

export const pilotDataPackageService = new PilotDataPackageService();
export default PilotDataPackageService;
