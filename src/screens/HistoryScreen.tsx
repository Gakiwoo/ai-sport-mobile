import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { ExerciseType, WorkoutSession, WorkoutMode } from '../types';
import { HistoryScreenProps } from '../types/navigation';
import { workoutRepository } from '../services/WorkoutRepository';
import { EXERCISE_CONFIGS, EXERCISE_NAMES } from '../constants/exerciseConfig';
import { pilotDataPackageService } from '../services/PilotDataPackageService';
import type { PilotHistoryFilter, Student, TrainingTask } from '../types/pilot';

export default function HistoryScreen(_props: HistoryScreenProps) {
  const [history, setHistory] = useState<WorkoutSession[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [tasks, setTasks] = useState<TrainingTask[]>([]);
  const [filter, setFilter] = useState<PilotHistoryFilter>({ exerciseType: 'all' });

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    const [data, entities] = await Promise.all([
      workoutRepository.getAll(),
      pilotDataPackageService.getEntities(),
    ]);
    setHistory([...data].reverse());
    setStudents(entities.students);
    setTasks(entities.tasks);
  };

  const filteredHistory = useMemo(
    () => pilotDataPackageService.filterSessions(history, filter),
    [history, filter],
  );

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    return (
      date.toLocaleDateString('zh-CN') +
      ' ' +
      date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.filterPanel}>
        <Text style={styles.filterTitle}>筛选</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <FilterChip
            label="全部学生"
            active={!filter.studentId}
            onPress={() => setFilter((prev) => ({ ...prev, studentId: undefined }))}
          />
          {students.map((student) => (
            <FilterChip
              key={student.id}
              label={student.name}
              active={filter.studentId === student.id}
              onPress={() =>
                setFilter((prev) => ({
                  ...prev,
                  classId: student.classId,
                  studentId: student.id,
                }))
              }
            />
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <FilterChip
            label="全部任务"
            active={!filter.taskId}
            onPress={() => setFilter((prev) => ({ ...prev, taskId: undefined }))}
          />
          {tasks.map((task) => (
            <FilterChip
              key={task.id}
              label={task.name}
              active={filter.taskId === task.id}
              onPress={() =>
                setFilter((prev) => ({
                  ...prev,
                  classId: task.classId,
                  taskId: task.id,
                  exerciseType: task.exerciseType,
                }))
              }
            />
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <FilterChip
            label="全部项目"
            active={!filter.exerciseType || filter.exerciseType === 'all'}
            onPress={() => setFilter((prev) => ({ ...prev, exerciseType: 'all' }))}
          />
          {EXERCISE_CONFIGS.map((exercise) => (
            <FilterChip
              key={exercise.type}
              label={EXERCISE_NAMES[exercise.type]}
              active={filter.exerciseType === exercise.type}
              onPress={() =>
                setFilter((prev) => ({
                  ...prev,
                  exerciseType: exercise.type as ExerciseType,
                }))
              }
            />
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filteredHistory}
        keyExtractor={(item) => item.id}
        accessibilityLabel="璁粌鍘嗗彶鍒楄〃"
        renderItem={({ item }) => (
          <View
            style={styles.card}
            accessibilityLabel={`${EXERCISE_NAMES[item.exerciseType]}锛?{item.count}娆★紝${formatDate(item.timestamp)}`}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.exerciseName}>{EXERCISE_NAMES[item.exerciseType]}</Text>
              <View
                style={[
                  styles.modeTag,
                  (item.mode as WorkoutMode) === 'timed' && styles.modeTagTimed,
                ]}
              >
                <Text style={styles.modeTagText}>
                  {(item.mode as WorkoutMode) === 'timed' ? '鈴?瀹氭椂' : '馃幆 瀹氭暟'}
                </Text>
              </View>
            </View>
            <Text style={styles.count}>
              娆℃暟: {item.count} 路 鐢ㄦ椂: {item.duration}s
            </Text>
            {item.studentId || item.taskId ? (
              <Text style={styles.pilotMeta}>
                学生: {students.find((student) => student.id === item.studentId)?.name || item.studentId || '-'} ·
                任务: {tasks.find((task) => task.id === item.taskId)?.name || item.taskId || '-'}
              </Text>
            ) : null}
            <Text style={styles.date}>{formatDate(item.timestamp)}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>暂无训练记录</Text>}
      />
    </View>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.filterChip, active && styles.filterChipActive]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 15,
  },
  filterPanel: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  filterTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  filterChipActive: {
    borderColor: '#007AFF',
    backgroundColor: '#EAF3FF',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
  },
  filterChipTextActive: {
    color: '#0057C2',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  exerciseName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  modeTag: {
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  modeTagTimed: {
    backgroundColor: '#FFF3E0',
  },
  modeTagText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
  },
  count: {
    fontSize: 16,
    color: '#666',
    marginBottom: 5,
  },
  pilotMeta: {
    fontSize: 13,
    color: '#4B5563',
    marginBottom: 5,
  },
  date: {
    fontSize: 14,
    color: '#999',
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#999',
    marginTop: 50,
  },
});
