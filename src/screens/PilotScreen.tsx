import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ErrorReporter from '../services/ErrorReporter';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Sharing from 'expo-sharing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { pilotDataPackageService } from '../services/PilotDataPackageService';
import type { Classroom, PilotSelection, Student, TrainingTask } from '../types/pilot';
import type { PilotScreenProps } from '../types/navigation';

export default function PilotScreen(_props: PilotScreenProps) {
  const insets = useSafeAreaInsets();
  const [classes, setClasses] = useState<Classroom[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [tasks, setTasks] = useState<TrainingTask[]>([]);
  const [selection, setSelection] = useState<PilotSelection>({});
  const [importText, setImportText] = useState('');
  const [exportText, setExportText] = useState('');
  const [exportFileUri, setExportFileUri] = useState('');

  const load = useCallback(async () => {
    const [entities, active] = await Promise.all([
      pilotDataPackageService.getEntities(),
      pilotDataPackageService.getActiveSelection(),
    ]);
    setClasses(entities.classes);
    setStudents(entities.students);
    setTasks(entities.tasks);
    setSelection(active);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selectedClass = classes.find((item) => item.id === selection.classId);
  const selectedStudent = students.find((item) => item.id === selection.studentId);
  const selectedTask = tasks.find((item) => item.id === selection.taskId);

  const classStudents = useMemo(
    () => students.filter((item) => !selection.classId || item.classId === selection.classId),
    [students, selection.classId],
  );
  const classTasks = useMemo(
    () => tasks.filter((item) => !selection.classId || item.classId === selection.classId),
    [tasks, selection.classId],
  );

  const setActiveSelection = async (next: PilotSelection) => {
    const active = await pilotDataPackageService.setActiveSelection(next);
    setSelection(active);
  };

  const chooseClass = async (classroom: Classroom) => {
    const firstStudent = students.find((item) => item.classId === classroom.id);
    const firstTask = tasks.find((item) => item.classId === classroom.id);
    await setActiveSelection({
      schoolId: classroom.schoolId,
      classId: classroom.id,
      studentId: firstStudent?.id,
      taskId: firstTask?.id,
    });
  };

  const chooseStudent = async (student: Student) => {
    const firstTask = tasks.find((item) => item.classId === student.classId);
    await setActiveSelection({
      schoolId: student.schoolId,
      classId: student.classId,
      studentId: student.id,
      taskId: selection.taskId || firstTask?.id,
    });
  };

  const chooseTask = async (task: TrainingTask) => {
    await setActiveSelection({
      schoolId: task.schoolId,
      classId: task.classId,
      taskId: task.id,
    });
  };

  const importPackage = async () => {
    try {
      const result = await pilotDataPackageService.importPackage(importText);
      setImportText('');
      await load();
      Alert.alert(
        '导入成功',
        `学校 ${result.schools}，班级 ${result.classes}，学生 ${result.students}，任务 ${result.tasks}`,
      );
    } catch (err) {
      ErrorReporter.captureWarning('导入成绩包失败', {
        source: 'PilotScreen',
        error: err instanceof Error ? err.message : '数据包格式错误',
      });
      Alert.alert('导入失败', err instanceof Error ? err.message : '数据包格式错误');
    }
  };

  const exportResults = async () => {
    try {
      const result = await pilotDataPackageService.exportLocalResultsFile();
      setExportFileUri(result.uri);
      setExportText(JSON.stringify(result.dataPackage, null, 2));
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(result.uri, {
          mimeType: 'application/json',
          dialogTitle: '分享 AI Sport 成绩包',
        });
      } else {
        Alert.alert('导出成功', `成绩包已保存到：\n${result.uri}`);
      }
    } catch (err) {
      ErrorReporter.captureWarning('导出成绩包失败', {
        source: 'PilotScreen',
        error: err instanceof Error ? err.message : '无法保存成绩包文件',
      });
      Alert.alert('导出失败', err instanceof Error ? err.message : '无法保存成绩包文件');
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
    >
      <Text style={styles.title}>校园试点</Text>
      <View style={styles.currentCard}>
        <Text style={styles.currentLabel}>当前训练对象</Text>
        <Text style={styles.currentTitle}>{selectedStudent?.name || '未选择学生'}</Text>
        <Text style={styles.currentMeta}>
          {selectedClass?.name || '未选择班级'} · {selectedTask?.name || '未选择任务'}
        </Text>
      </View>

      <Selector title="班级">
        {classes.map((item) => (
          <Chip
            key={item.id}
            label={item.name}
            active={selection.classId === item.id}
            onPress={() => chooseClass(item)}
          />
        ))}
      </Selector>

      <Selector title="学生">
        {classStudents.map((item) => (
          <Chip
            key={item.id}
            label={`${item.name}${item.studentNo ? ` #${item.studentNo}` : ''}`}
            active={selection.studentId === item.id}
            onPress={() => chooseStudent(item)}
          />
        ))}
      </Selector>

      <Selector title="训练任务">
        {classTasks.map((item) => (
          <Chip
            key={item.id}
            label={item.name}
            active={selection.taskId === item.id}
            onPress={() => chooseTask(item)}
          />
        ))}
      </Selector>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>导入桌面端基础包</Text>
        <TextInput
          value={importText}
          onChangeText={setImportText}
          multiline
          placeholder='粘贴 {"schemaVersion":"pilot-v1"} JSON'
          style={styles.textArea}
        />
        <TouchableOpacity
          style={[styles.primaryButton, !importText.trim() && styles.disabledButton]}
          disabled={!importText.trim()}
          onPress={importPackage}
        >
          <Text style={styles.primaryButtonText}>导入班级/学生/任务</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>导出移动端成绩包</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={exportResults}>
          <Text style={styles.primaryButtonText}>导出 pilot-v1 成绩包</Text>
        </TouchableOpacity>
        {exportFileUri ? <Text style={styles.fileUriText}>{exportFileUri}</Text> : null}
        {exportText ? (
          <TextInput value={exportText} multiline editable={false} style={styles.exportArea} />
        ) : null}
      </View>
    </ScrollView>
  );
}

function Selector({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.panel}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.chipWrap}>{children}</View>
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#1C1C1E',
    marginBottom: 12,
  },
  currentCard: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  currentLabel: {
    color: '#9CA3AF',
    fontSize: 13,
    fontWeight: '700',
  },
  currentTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    marginTop: 6,
  },
  currentMeta: {
    color: '#D1D5DB',
    fontSize: 14,
    marginTop: 6,
  },
  panel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1C1C1E',
    marginBottom: 10,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: '#FFFFFF',
  },
  chipActive: {
    borderColor: '#007AFF',
    backgroundColor: '#EAF3FF',
  },
  chipText: {
    color: '#374151',
    fontWeight: '700',
  },
  chipTextActive: {
    color: '#0057C2',
  },
  textArea: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 10,
    textAlignVertical: 'top',
    color: '#111827',
  },
  exportArea: {
    minHeight: 220,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    textAlignVertical: 'top',
    color: '#111827',
    backgroundColor: '#F9FAFB',
    fontSize: 12,
  },
  primaryButton: {
    marginTop: 10,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#007AFF',
  },
  disabledButton: {
    opacity: 0.45,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  fileUriText: {
    marginTop: 8,
    color: '#4B5563',
    fontSize: 12,
  },
});
