/**
 * workoutFormat 工具函数测试
 *
 * 覆盖：formatCountdown、getElapsedSeconds、getFeedbackBoxStyle
 */

// ── 先 mock workoutStyles（因为引用 RN StyleSheet） ──
jest.mock('../components/workout/workoutStyles', () => ({
  workoutStyles: {
    feedbackError: { backgroundColor: 'red' },
    feedbackWarning: { backgroundColor: 'orange' },
    feedbackSuccess: { backgroundColor: 'green' },
  },
}));

import {
  formatCountdown,
  getElapsedSeconds,
  getFeedbackBoxStyle,
} from '../components/workout/workoutFormat';

describe('workoutFormat', () => {
  describe('formatCountdown', () => {
    it('格式化秒数为 MM:SS', () => {
      expect(formatCountdown(0)).toBe('00:00');
      expect(formatCountdown(5)).toBe('00:05');
      expect(formatCountdown(60)).toBe('01:00');
      expect(formatCountdown(90)).toBe('01:30');
      expect(formatCountdown(3661)).toBe('61:01');
    });

    it('处理单个数字秒数补零', () => {
      expect(formatCountdown(3)).toBe('00:03');
      expect(formatCountdown(9)).toBe('00:09');
    });
  });

  describe('getElapsedSeconds', () => {
    it('startTime 为 null 时返回 0', () => {
      expect(getElapsedSeconds(null)).toBe(0);
    });

    it('计算已过秒数', () => {
      const now = Date.now();
      const startTime = now - 5000; // 5 秒前
      // 使用 mock 避免 Date.now 不确定
      const result = getElapsedSeconds(startTime);
      expect(result).toBeGreaterThanOrEqual(4);
      expect(result).toBeLessThanOrEqual(6);
    });
  });

  describe('getFeedbackBoxStyle', () => {
    it('null feedback 返回空对象', () => {
      expect(getFeedbackBoxStyle(null)).toEqual({});
    });

    it('error feedback 返回 error 样式', () => {
      const result = getFeedbackBoxStyle({ type: 'error', message: 'err' });
      expect(result).toEqual({ backgroundColor: 'red' });
    });

    it('warning feedback 返回 warning 样式', () => {
      const result = getFeedbackBoxStyle({ type: 'warning', message: 'warn' });
      expect(result).toEqual({ backgroundColor: 'orange' });
    });

    it('success feedback 返回 success 样式', () => {
      const result = getFeedbackBoxStyle({ type: 'success', message: 'ok' });
      expect(result).toEqual({ backgroundColor: 'green' });
    });
  });
});
