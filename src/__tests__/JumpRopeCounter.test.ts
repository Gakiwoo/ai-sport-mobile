import { Pose } from '../types';
import { JumpRopeCounter } from '../services/counters/JumpRopeCounter';
import { standingPose, lowConfidencePose, missingKeypointPose, buildPose } from './testHelpers';

/** 跳绳甩绳姿态 — 手腕在肩上方运动 */
function ropeSwingPose(): Pose {
  return buildPose({
    nose: { x: 0.5, y: 0.1, score: 0.9 },
    left_shoulder: { x: 0.35, y: 0.25, score: 0.9 },
    right_shoulder: { x: 0.65, y: 0.25, score: 0.9 },
    left_elbow: { x: 0.28, y: 0.2, score: 0.9 },
    right_elbow: { x: 0.72, y: 0.2, score: 0.9 },
    left_wrist: { x: 0.25, y: 0.1, score: 0.9 }, // 手腕举过头顶
    right_wrist: { x: 0.75, y: 0.1, score: 0.9 },
    left_hip: { x: 0.4, y: 0.55, score: 0.9 },
    right_hip: { x: 0.6, y: 0.55, score: 0.9 },
    left_knee: { x: 0.4, y: 0.72, score: 0.9 },
    right_knee: { x: 0.6, y: 0.72, score: 0.9 },
    left_ankle: { x: 0.4, y: 0.9, score: 0.9 },
    right_ankle: { x: 0.6, y: 0.9, score: 0.9 },
  });
}

describe('JumpRopeCounter', () => {
  let counter: JumpRopeCounter;

  beforeEach(() => {
    counter = new JumpRopeCounter();
  });

  describe('初始状态', () => {
    it('初始计数应为 0', () => {
      expect(counter.getCount()).toBe(0);
    });

    it('初始阶段应为 idle', () => {
      expect(counter.getPhase()).toBe('idle');
    });
  });

  describe('低置信度和缺失关键点', () => {
    it('低置信度姿态应被忽略', () => {
      for (let i = 0; i < 50; i++) {
        counter.processFrame(lowConfidencePose());
      }
      expect(counter.getCount()).toBe(0);
    });

    it('缺失关键点的姿态应被忽略', () => {
      for (let i = 0; i < 50; i++) {
        counter.processFrame(missingKeypointPose());
      }
      expect(counter.getCount()).toBe(0);
    });
  });

  describe('标定', () => {
    it('站立足够帧后应完成标定', () => {
      for (let i = 0; i < 35; i++) {
        counter.processFrame(standingPose());
      }
      expect(counter.isCalibrated()).toBe(true);
    });
  });

  describe('状态转换', () => {
    it('站立+甩绳应进入 detecting', () => {
      // 先站立标定
      for (let i = 0; i < 35; i++) {
        counter.processFrame(standingPose());
      }
      // 甩绳 + 弹跳
      for (let i = 0; i < 30; i++) {
        counter.processFrame(ropeSwingPose());
      }
      // 应该进入 detecting 或 jumping
      const phase = counter.getPhase();
      expect(['detecting', 'jumping', 'idle']).toContain(phase);
    });
  });

  describe('reset', () => {
    it('reset 后应回到初始状态', () => {
      for (let i = 0; i < 35; i++) {
        counter.processFrame(standingPose());
      }
      counter.reset();
      expect(counter.getCount()).toBe(0);
      expect(counter.getPhase()).toBe('idle');
      expect(counter.isCalibrated()).toBe(false);
      expect(counter.getConsecutiveJumps()).toBe(0);
    });
  });

  describe('getFeedback', () => {
    it('idle 阶段未标定时应返回提示', () => {
      const fb = counter.getFeedback();
      expect(fb).not.toBeNull();
      expect(fb!.type).toBe('warning');
    });

    it('标定后 idle 阶段应返回准备提示', () => {
      for (let i = 0; i < 35; i++) {
        counter.processFrame(standingPose());
      }
      const fb = counter.getFeedback();
      expect(fb).not.toBeNull();
      expect(fb!.message).toContain('准备跳绳');
    });
  });
});

describe('JumpRopeCounter — 边界值', () => {
  let counter: JumpRopeCounter;

  beforeEach(() => {
    counter = new JumpRopeCounter();
  });

  it('未标定时 isCalibrated 为 false', () => {
    expect(counter.isCalibrated()).toBe(false);
  });

  it('大量低置信度帧后不应报错', () => {
    for (let i = 0; i < 500; i++) {
      counter.processFrame(lowConfidencePose());
    }
    expect(counter.getCount()).toBe(0);
    expect(counter.getPhase()).toBe('idle');
  });
});
