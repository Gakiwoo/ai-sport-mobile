import React from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal } from 'react-native';
import { workoutStyles as styles } from './workoutStyles';

interface WorkoutTargetModalProps {
  visible: boolean;
  isTimed: boolean;
  targetInput: string;
  durationInput: string;
  onChangeTargetInput: (value: string) => void;
  onChangeDurationInput: (value: string) => void;
  onClose: () => void;
  onConfirmCount: () => void;
  onConfirmDuration: () => void;
}

export default function WorkoutTargetModal({
  visible,
  isTimed,
  targetInput,
  durationInput,
  onChangeTargetInput,
  onChangeDurationInput,
  onClose,
  onConfirmCount,
  onConfirmDuration,
}: WorkoutTargetModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {isTimed ? (
            <>
              <Text style={styles.modalTitle}>⏰ 设置目标时长</Text>
              <TextInput
                style={styles.targetInput}
                value={durationInput}
                onChangeText={onChangeDurationInput}
                keyboardType="number-pad"
                placeholder="输入秒数（如 60）"
                maxLength={4}
                accessibilityLabel="输入目标时长（秒）"
              />
              <Text style={styles.modalHint}>常用：30秒 / 60秒 / 90秒 / 120秒</Text>
              <View style={styles.modalQuickBtns}>
                {[30, 60, 90, 120].map((d) => (
                  <TouchableOpacity
                    key={d}
                    style={[
                      styles.quickBtn,
                      durationInput === d.toString() && styles.quickBtnActive,
                    ]}
                    onPress={() => onChangeDurationInput(d.toString())}
                    accessibilityLabel={`${d}秒`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: durationInput === d.toString() }}
                  >
                    <Text style={styles.quickBtnText}>{d}s</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={onClose}
                  accessibilityLabel="取消"
                  accessibilityRole="button"
                >
                  <Text style={styles.cancelButtonText}>取消</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.confirmButton]}
                  onPress={onConfirmDuration}
                  accessibilityLabel="确定"
                  accessibilityRole="button"
                >
                  <Text style={styles.confirmButtonText}>确定</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.modalTitle}>🎯 设置目标次数</Text>
              <TextInput
                style={styles.targetInput}
                value={targetInput}
                onChangeText={onChangeTargetInput}
                keyboardType="number-pad"
                placeholder="输入目标次数"
                maxLength={5}
                accessibilityLabel="输入目标次数"
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={onClose}
                  accessibilityLabel="取消"
                  accessibilityRole="button"
                >
                  <Text style={styles.cancelButtonText}>取消</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.confirmButton]}
                  onPress={onConfirmCount}
                  accessibilityLabel="确定"
                  accessibilityRole="button"
                >
                  <Text style={styles.confirmButtonText}>确定</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}
