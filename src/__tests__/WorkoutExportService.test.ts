import { exportWorkoutRecordsToCsv } from '../services/WorkoutExportService';
import { LocalWorkoutRecord, WorkoutSession } from '../types';

describe('WorkoutExportService', () => {
  it('exports legacy workout records with stable CSV headers', () => {
    const record: WorkoutSession = {
      id: 'legacy-1',
      exerciseType: 'jump_rope',
      mode: 'count',
      count: 80,
      duration: 60,
      timestamp: Date.parse('2026-07-01T00:00:00.000Z'),
    };

    const csv = exportWorkoutRecordsToCsv([record]);

    expect(csv.split('\n')[0]).toBe(
      '记录ID,运动项目,训练模式,训练时间,用时(秒),次数,距离(cm),高度(cm),有效次数,无效次数,犯规次数,置信度,反馈,同步状态,算法会话ID',
    );
    expect(csv.split('\n')[1]).toBe('legacy-1,跳绳,定数,2026-07-01T00:00:00.000Z,60,80,,,80,,,,,,');
  });

  it('exports commercial ExerciseResult fields for review and export', () => {
    const record: LocalWorkoutRecord = {
      id: 'result-1',
      exerciseType: 'squats',
      mode: 'timed',
      count: 12,
      duration: 45,
      timestamp: Date.parse('2026-07-01T01:02:03.000Z'),
      _syncStatus: 'local',
      _lastModified: Date.parse('2026-07-01T01:02:04.000Z'),
      exerciseResult: {
        sessionId: 'session-1',
        exerciseType: 'squats',
        reps: 10,
        validCount: 10,
        invalidCount: 2,
        foulCount: 1,
        confidence: 0.7692,
        durationMs: 45000,
        feedback: ['膝盖内扣, 注意控制', '下蹲深度不足'],
        algorithmLog: [],
        startedAt: '2026-07-01T01:01:18.000Z',
        endedAt: '2026-07-01T01:02:03.000Z',
      },
    };

    const csv = exportWorkoutRecordsToCsv([record]);

    expect(csv.split('\n')[1]).toBe(
      'result-1,深蹲,定时,2026-07-01T01:02:03.000Z,45,10,,,10,2,1,0.769,"膝盖内扣, 注意控制; 下蹲深度不足",local,session-1',
    );
  });

  it('exports distance and height measurements separately', () => {
    const records: WorkoutSession[] = [
      {
        id: 'long-jump',
        exerciseType: 'standing_long_jump',
        mode: 'count',
        count: 0,
        duration: 5,
        timestamp: Date.parse('2026-07-01T02:00:00.000Z'),
        exerciseResult: {
          sessionId: 'distance-session',
          exerciseType: 'standing_long_jump',
          distanceCm: 236,
          validCount: 1,
          invalidCount: 0,
          foulCount: 0,
          confidence: 0.92,
          durationMs: 5000,
          feedback: [],
          algorithmLog: [],
          startedAt: '2026-07-01T01:59:55.000Z',
          endedAt: '2026-07-01T02:00:00.000Z',
        },
      },
      {
        id: 'vertical-jump',
        exerciseType: 'vertical_jump',
        mode: 'count',
        count: 0,
        duration: 5,
        timestamp: Date.parse('2026-07-01T02:01:00.000Z'),
        exerciseResult: {
          sessionId: 'height-session',
          exerciseType: 'vertical_jump',
          heightCm: 42,
          validCount: 1,
          invalidCount: 0,
          foulCount: 0,
          confidence: 0.88,
          durationMs: 5000,
          feedback: [],
          algorithmLog: [],
          startedAt: '2026-07-01T02:00:55.000Z',
          endedAt: '2026-07-01T02:01:00.000Z',
        },
      },
    ];

    const [, longJump, verticalJump] = exportWorkoutRecordsToCsv(records).split('\n');

    expect(longJump).toContain('long-jump,立定跳远,定数,2026-07-01T02:00:00.000Z,5,0,236,');
    expect(verticalJump).toContain('vertical-jump,纵跳摸高,定数,2026-07-01T02:01:00.000Z,5,0,,42,');
  });
});
