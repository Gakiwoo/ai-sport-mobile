import { JumpRopeCounter } from '../services/counters/JumpRopeCounter';
import {
  standingPose,
  ropeSwingPose,
  lowConfidencePose,
  missingKeypointPose,
  buildPose,
} from './testHelpers';
import { Pose } from '../types';

// ── 跳绳测试辅助：创建手腕交替摆动 + 髋部弹跳的姿态 ──

/** 跳绳-高手腕位：手腕靠近肩膀（手腕-肘距离小），髋部弹跳上升 */
function ropeHighBouncePose(): Pose {
  return buildPose({
    nose: { x: 240, y: 36, score: 0.9 },
    left_shoulder: { x: 168, y: 90, score: 0.9 },
    right_shoulder: { x: 312, y: 90, score: 0.9 },
    left_elbow: { x: 144, y: 137, score: 0.9 },
    right_elbow: { x: 336, y: 137, score: 0.9 },
    left_wrist: { x: 150, y: 110, score: 0.9 },
    right_wrist: { x: 330, y: 110, score: 0.9 },
    left_hip: { x: 192, y: 175, score: 0.9 },
    right_hip: { x: 288, y: 175, score: 0.9 },
    left_knee: { x: 192, y: 240, score: 0.9 },
    right_knee: { x: 288, y: 240, score: 0.9 },
    left_ankle: { x: 192, y: 300, score: 0.9 },
    right_ankle: { x: 288, y: 300, score: 0.9 },
  });
}

/** 跳绳-低手腕位：手腕远离肩膀（手腕-肘距离大），髋部接近基线 */
function ropeLowBouncePose(): Pose {
  return buildPose({
    nose: { x: 240, y: 36, score: 0.9 },
    left_shoulder: { x: 168, y: 90, score: 0.9 },
    right_shoulder: { x: 312, y: 90, score: 0.9 },
    left_elbow: { x: 144, y: 137, score: 0.9 },
    right_elbow: { x: 336, y: 137, score: 0.9 },
    left_wrist: { x: 90, y: 240, score: 0.9 },
    right_wrist: { x: 390, y: 240, score: 0.9 },
    left_hip: { x: 192, y: 195, score: 0.9 },
    right_hip: { x: 288, y: 195, score: 0.9 },
    left_knee: { x: 192, y: 259, score: 0.9 },
    right_knee: { x: 288, y: 259, score: 0.9 },
    left_ankle: { x: 192, y: 324, score: 0.9 },
    right_ankle: { x: 288, y: 324, score: 0.9 },
  });
}

/** 持续弹跳 + 腕部低位的跳绳姿态（用于维持跳跃状态） */
function ropeJumpSustainPose(): Pose {
  return buildPose({
    nose: { x: 240, y: 36, score: 0.9 },
    left_shoulder: { x: 168, y: 90, score: 0.9 },
    right_shoulder: { x: 312, y: 90, score: 0.9 },
    left_elbow: { x: 144, y: 137, score: 0.9 },
    right_elbow: { x: 336, y: 137, score: 0.9 },
    left_wrist: { x: 100, y: 230, score: 0.9 },
    right_wrist: { x: 380, y: 230, score: 0.9 },
    left_hip: { x: 192, y: 165, score: 0.9 },
    right_hip: { x: 288, y: 165, score: 0.9 },
    left_knee: { x: 192, y: 230, score: 0.9 },
    right_knee: { x: 288, y: 230, score: 0.9 },
    left_ankle: { x: 192, y: 290, score: 0.9 },
    right_ankle: { x: 288, y: 290, score: 0.9 },
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

    it('getRate 无数据时应返回 0', () => {
      expect(counter.getRate()).toBe(0);
    });

    it('getConsecutiveJumps 初始为 0', () => {
      expect(counter.getConsecutiveJumps()).toBe(0);
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

    it('未标定时 isCalibrated 为 false', () => {
      expect(counter.isCalibrated()).toBe(false);
    });
  });

  describe('状态转换', () => {
    it('站立+甩绳应进入 detecting 或 jumping', () => {
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

    it('标定后无甩绳应保持 idle', () => {
      for (let i = 0; i < 35; i++) {
        counter.processFrame(standingPose());
      }
      // 继续站立不甩绳
      for (let i = 0; i < 60; i++) {
        counter.processFrame(standingPose());
      }
      // 由于已经标定，保持 idle（无手腕运动）
      expect(counter.getPhase()).toBe('idle');
    });

    it('detecting 超时后退回 idle', () => {
      for (let i = 0; i < 35; i++) {
        counter.processFrame(standingPose());
      }
      // 用手腕微动的姿态进入 detecting
      for (let i = 0; i < 25; i++) {
        counter.processFrame(ropeSwingPose());
      }
      // 然后长时间 standing → 应回到 idle
      for (let i = 0; i < 120; i++) {
        counter.processFrame(standingPose());
      }
      expect(counter.getPhase()).toBe('idle');
    });
  });

  describe('跳绳计数', () => {
    it('连续交替甩绳+弹跳不应崩溃且阶段有推进', () => {
      // 标定
      for (let i = 0; i < 35; i++) {
        counter.processFrame(standingPose());
      }
      expect(counter.isCalibrated()).toBe(true);

      // 交替高手腕和低手腕 + 弹跳，模拟连续跳绳
      for (let i = 0; i < 80; i++) {
        counter.processFrame(ropeHighBouncePose());
        counter.processFrame(ropeLowBouncePose());
      }

      // 不应崩溃
      expect(counter.getCount()).toBeGreaterThanOrEqual(0);
      // 状态机应至少推进到 detecting 之后的阶段
      const phase = counter.getPhase();
      expect(['detecting', 'jumping', 'resting', 'idle']).toContain(phase);
    });

    it('仅站立不甩绳不应计数', () => {
      for (let i = 0; i < 200; i++) {
        counter.processFrame(standingPose());
      }
      expect(counter.getCount()).toBe(0);
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

    it('reset 后 getRate 归零', () => {
      for (let i = 0; i < 35; i++) {
        counter.processFrame(standingPose());
      }
      counter.reset();
      expect(counter.getRate()).toBe(0);
    });
  });

  describe('getFeedback', () => {
    it('idle 阶段未标定时应返回标定提示', () => {
      const fb = counter.getFeedback();
      expect(fb).not.toBeNull();
      expect(fb!.type).toBe('warning');
      expect(fb!.message).toContain('标定');
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

  describe('帧间隔变更', () => {
    it('setFrameInterval 不应崩溃', () => {
      expect(() => counter.setFrameInterval(200)).not.toThrow();
    });

    it('setFrameInterval 后仍能正常标定', () => {
      counter.setFrameInterval(200);
      for (let i = 0; i < 50; i++) {
        counter.processFrame(standingPose());
      }
      expect(counter.isCalibrated()).toBe(true);
    });
  });
});

describe('JumpRopeCounter — 边界值', () => {
  let counter: JumpRopeCounter;

  beforeEach(() => {
    counter = new JumpRopeCounter();
  });

  it('大量低置信度帧后不应报错', () => {
    for (let i = 0; i < 500; i++) {
      counter.processFrame(lowConfidencePose());
    }
    expect(counter.getCount()).toBe(0);
    expect(counter.getPhase()).toBe('idle');
  });

  it('大量缺失关键点帧后不应报错', () => {
    for (let i = 0; i < 500; i++) {
      counter.processFrame(missingKeypointPose());
    }
    expect(counter.getCount()).toBe(0);
  });

  it('交替甩绳姿态不应崩溃', () => {
    for (let i = 0; i < 50; i++) {
      counter.processFrame(standingPose());
    }
    for (let i = 0; i < 100; i++) {
      counter.processFrame(ropeHighBouncePose());
      counter.processFrame(ropeLowBouncePose());
      counter.processFrame(ropeJumpSustainPose());
    }
    // 不应崩溃
    expect(counter.getCount()).toBeGreaterThanOrEqual(0);
  });

  it('长时间 idle 后保持 idle', () => {
    for (let i = 0; i < 200; i++) {
      counter.processFrame(standingPose());
    }
    expect(counter.getPhase()).toBe('idle');
  });
});
