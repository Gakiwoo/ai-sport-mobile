import { EXERCISE_NAMES } from '../constants/exerciseRegistry';
import { LocalWorkoutRecord, WorkoutSession } from '../types';

type ExportableWorkoutRecord = WorkoutSession | LocalWorkoutRecord;

const CSV_HEADERS = [
  '记录ID',
  '运动项目',
  '训练模式',
  '训练时间',
  '用时(秒)',
  '次数',
  '距离(cm)',
  '高度(cm)',
  '有效次数',
  '无效次数',
  '犯规次数',
  '置信度',
  '反馈',
  '同步状态',
  '算法会话ID',
];

function csvCell(value: string | number | undefined): string {
  const normalized = value === undefined ? '' : String(value);
  if (/[",\r\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
}

function formatTimestamp(timestamp: number): string {
  if (!Number.isFinite(timestamp)) return '';
  return new Date(timestamp).toISOString();
}

function formatConfidence(confidence: number | undefined): string {
  return typeof confidence === 'number' ? confidence.toFixed(3) : '';
}

function getSyncStatus(record: ExportableWorkoutRecord): string {
  return '_syncStatus' in record ? record._syncStatus : '';
}

export function exportWorkoutRecordsToCsv(records: ExportableWorkoutRecord[]): string {
  const rows = records.map((record) => {
    const result = record.exerciseResult;

    return [
      record.id,
      EXERCISE_NAMES[record.exerciseType],
      record.mode === 'timed' ? '定时' : '定数',
      formatTimestamp(record.timestamp),
      record.duration,
      result?.reps ?? record.count,
      result?.distanceCm,
      result?.heightCm,
      result?.validCount ?? record.count,
      result?.invalidCount,
      result?.foulCount,
      formatConfidence(result?.confidence),
      result?.feedback.join('; '),
      getSyncStatus(record),
      result?.sessionId,
    ].map(csvCell);
  });

  return [CSV_HEADERS.map(csvCell), ...rows].map((row) => row.join(',')).join('\n');
}

export const workoutExportService = {
  exportWorkoutRecordsToCsv,
};
