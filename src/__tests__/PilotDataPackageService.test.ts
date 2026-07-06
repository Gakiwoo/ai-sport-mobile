import AsyncStorage from '@react-native-async-storage/async-storage';
import PilotDataPackageService from '../services/PilotDataPackageService';
import { PILOT_SCHEMA_VERSION, type PilotHistoryFilter } from '../types/pilot';
import type { WorkoutSession } from '../types';

jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    __store: store,
    getItem: jest.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    setItem: jest.fn((key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve();
    }),
    removeItem: jest.fn((key: string) => {
      store.delete(key);
      return Promise.resolve();
    }),
  };
});

function session(overrides: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    id: 'session-1',
    exerciseType: 'jump_rope',
    mode: 'count',
    count: 60,
    duration: 45,
    timestamp: Date.UTC(2026, 6, 1, 8, 0, 0),
    schoolId: 'school-demo',
    classId: 'class-demo-1',
    studentId: 'student-demo-1',
    taskId: 'task-jump_rope',
    deviceId: 'mobile-ios',
    deviceInfo: 'Mobile iOS',
    performanceTier: 'balanced',
    algorithmVersion: 'mobile-pose-v1',
    exerciseResult: {
      sessionId: 'session-1',
      exerciseType: 'jump_rope',
      reps: 60,
      validCount: 58,
      invalidCount: 2,
      foulCount: 0,
      confidence: 0.91,
      durationMs: 45000,
      feedback: [],
      algorithmLog: [],
      startedAt: '2026-07-01T08:00:00.000Z',
      endedAt: '2026-07-01T08:00:45.000Z',
    },
    ...overrides,
  };
}

describe('PilotDataPackageService', () => {
  beforeEach(() => {
    (AsyncStorage as typeof AsyncStorage & { __store: Map<string, string> }).__store.clear();
    jest.clearAllMocks();
  });

  it('builds a pilot-v1 package from local workout sessions', async () => {
    const service = new PilotDataPackageService();

    const dataPackage = await service.buildPackage([session()], 'mobile');

    expect(dataPackage.schemaVersion).toBe(PILOT_SCHEMA_VERSION);
    expect(dataPackage.sourceApp).toBe('mobile');
    expect(dataPackage.entities.schools).toHaveLength(1);
    expect(dataPackage.entities.sessions[0]).toMatchObject({
      id: 'session-1',
      studentId: 'student-demo-1',
      taskId: 'task-jump_rope',
      score: 60,
      validCount: 58,
      invalidCount: 2,
      confidence: 0.91,
    });
  });

  it('writes local result packages to a JSON file', async () => {
    const service = new PilotDataPackageService();
    const dataPackage = await service.buildPackage([session()], 'mobile');
    const fileSystem = require('expo-file-system/legacy') as {
      makeDirectoryAsync: jest.Mock;
      writeAsStringAsync: jest.Mock;
    };
    jest.spyOn(service, 'exportLocalResults').mockResolvedValue(dataPackage);

    const result = await service.exportLocalResultsFile();

    expect(result.uri).toMatch(/^file:\/\/\/document\/pilot\/ai-sport-results-.+\.json$/);
    expect(fileSystem.makeDirectoryAsync).toHaveBeenCalledWith('file:///document/pilot/', {
      intermediates: true,
    });
    expect(fileSystem.writeAsStringAsync).toHaveBeenCalledTimes(1);
    const [uri, content, options] = fileSystem.writeAsStringAsync.mock.calls[0];
    expect(uri).toBe(result.uri);
    expect(JSON.parse(content)).toMatchObject({
      schemaVersion: PILOT_SCHEMA_VERSION,
      sourceApp: 'mobile',
    });
    expect(options).toEqual({ encoding: 'utf8' });
  });

  it('filters history by student task and exercise', () => {
    const service = new PilotDataPackageService();
    const records = [
      session(),
      session({
        id: 'session-2',
        studentId: 'student-demo-2',
        taskId: 'task-squats',
        exerciseType: 'squats',
      }),
    ];
    const filter: PilotHistoryFilter = {
      studentId: 'student-demo-2',
      taskId: 'task-squats',
      exerciseType: 'squats',
    };

    expect(service.filterSessions(records, filter).map((item) => item.id)).toEqual(['session-2']);
  });

  it('persists the active student and task selection', async () => {
    const service = new PilotDataPackageService();

    await service.setActiveSelection({
      studentId: 'student-demo-2',
      taskId: 'task-squats',
    });

    await expect(service.getActiveSelection('squats')).resolves.toMatchObject({
      schoolId: 'school-demo',
      classId: 'class-demo-1',
      studentId: 'student-demo-2',
      taskId: 'task-squats',
    });
  });

  it('imports a desktop base package and resets active selection', async () => {
    const service = new PilotDataPackageService();
    const desktopPackage = {
      schemaVersion: 'pilot-v1',
      exportedAt: '2026-07-01T08:00:00.000Z',
      sourceApp: 'desktop',
      algorithmVersion: 'desktop-pilot-v1',
      entities: {
        schools: [{ id: 'school-2', name: '第二试点学校' }],
        classes: [{ id: 'class-2', schoolId: 'school-2', name: '四年级 2 班' }],
        students: [
          {
            id: 'student-2',
            schoolId: 'school-2',
            classId: 'class-2',
            name: '学生 C',
          },
        ],
        devices: [],
        tasks: [
          {
            id: 'task-2',
            schoolId: 'school-2',
            classId: 'class-2',
            name: '跳绳测验',
            exerciseType: 'jump_rope',
            officialScoring: true,
          },
        ],
        sessions: [],
        reviews: [],
      },
    };

    await expect(service.importPackage(JSON.stringify(desktopPackage))).resolves.toMatchObject({
      schools: 2,
      classes: 2,
      students: 3,
      tasks: 5,
    });
    await expect(service.getActiveSelection()).resolves.toMatchObject({
      schoolId: 'school-2',
      classId: 'class-2',
      studentId: 'student-2',
      taskId: 'task-2',
    });
  });
});
