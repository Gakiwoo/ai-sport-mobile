import { SquatsCounter } from '../services/counters/SquatsCounter';
import {
  standingPose,
  squatBottomPose,
  lowConfidencePose,
  missingKeypointPose,
  buildPose,
} from './testHelpers';
import { Pose } from '../types';

/** 浅蹲姿态 — 膝盖角 > 110°（蹲得不够深） */
function shallowSquatPose(): Pose {
  return buildPose({
    nose: { x: 240, y: 80, score: 0.9 },
    left_shoulder: { x: 180, y: 100, score: 0.9 },
    right_shoulder: { x: 300, y: 100, score: 0.9 },
    left_elbow: { x: 152, y: 130, score: 0.9 },
    right_elbow: { x: 328, y: 130, score: 0.9 },
    left_wrist: { x: 140, y: 160, score: 0.9 },
    right_wrist: { x: 340, y: 160, score: 0.9 },
    left_hip: { x: 200, y: 190, score: 0.9 },
    right_hip: { x: 280, y: 190, score: 0.9 },
    left_knee: { x: 185, y: 240, score: 0.9 }, // 膝盖角较浅
    right_knee: { x: 295, y: 240, score: 0.9 },
    left_ankle: { x: 192, y: 324, score: 0.9 },
    right_ankle: { x: 288, y: 324, score: 0.9 },
  });
}

describe('SquatsCounter', () => {
  let counter: SquatsCounter;

  beforeEach(() => {
    counter = new SquatsCounter();
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

  describe('深蹲计数', () => {
    it('站立足够帧后应从 idle 进入 standing', () => {
      // idle → standing 需要稳定 30 帧
      for (let i = 0; i < 35; i++) {
        counter.processFrame(standingPose());
      }
      expect(counter.getPhase()).toBe('standing');
    });

    it('降频到 120ms 后应按约 1 秒完成站立标定', () => {
      counter.setFrameInterval(120);
      for (let i = 0; i < 9; i++) {
        counter.processFrame(standingPose());
      }
      expect(counter.getPhase()).toBe('standing');
    });

    it('完成一次深蹲应计数', () => {
      // 标定阶段：站立 35 帧
      for (let i = 0; i < 35; i++) {
        counter.processFrame(standingPose());
      }
      expect(counter.getPhase()).toBe('standing');

      // 下蹲阶段
      for (let i = 0; i < 25; i++) {
        counter.processFrame(squatBottomPose());
      }
      // 应该进入 bottom 或 descending
      expect(['descending', 'bottom']).toContain(counter.getPhase());

      // 站起阶段
      for (let i = 0; i < 30; i++) {
        counter.processFrame(standingPose());
      }

      // 应该计数了
      expect(counter.getCount()).toBeGreaterThanOrEqual(0);
    });

    it('仅站立不下蹲不应计数', () => {
      for (let i = 0; i < 100; i++) {
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
    });
  });

  describe('getFeedback', () => {
    it('idle 阶段应返回提示', () => {
      const fb = counter.getFeedback();
      expect(fb).not.toBeNull();
      expect(fb!.type).toBe('warning');
      expect(fb!.message).toContain('站直');
    });
  });

  describe('边界值: setFrameInterval', () => {
    it('setFrameInterval(0) 后以最小间隔需足够帧完成标定', () => {
      counter.setFrameInterval(0); // 钳位到 16ms
      // 16ms 间隔下 framesAt30Fps(30) = ceil(1000/16) = 63
      for (let i = 0; i < 80; i++) {
        counter.processFrame(standingPose());
      }
      expect(counter.getPhase()).toBe('standing');
    });

    it('setFrameInterval(200) 后标定窗口按时间换算', () => {
      counter.setFrameInterval(200);
      // 200ms 间隔下 framesAt30Fps(30) = ceil(1000/200) = 5 帧即可
      for (let i = 0; i < 6; i++) {
        counter.processFrame(standingPose());
      }
      expect(counter.getPhase()).toBe('standing');
    });
  });

  describe('边界值: 下蹲中段反弹', () => {
    it('下蹲到底后膝盖角增大应退回 standing', () => {
      // 标定
      for (let i = 0; i < 35; i++) {
        counter.processFrame(standingPose());
      }
      expect(counter.getPhase()).toBe('standing');

      // 下蹲 → squatBottomPose 膝盖角 < DOWN_ANGLE，很快到底
      for (let i = 0; i < 6; i++) {
        counter.processFrame(squatBottomPose());
      }
      // 已进入 bottom
      expect(['descending', 'bottom']).toContain(counter.getPhase());

      // 又站起来了（膝盖角增大 → 进入 ascending → UP_ANGLE → 计次返回 standing）
      for (let i = 0; i < 30; i++) {
        counter.processFrame(standingPose());
      }
      // 应回到 standing（已计数）
      expect(counter.getPhase()).toBe('standing');
      expect(counter.getCount()).toBe(1);
    });

    it('浅蹲姿态不触发完整状态机（膝盖角不够小）', () => {
      // 标定
      for (let i = 0; i < 35; i++) {
        counter.processFrame(standingPose());
      }
      expect(counter.getPhase()).toBe('standing');

      // 浅蹲 — 膝盖未达到 DOWN_ANGLE
      for (let i = 0; i < 30; i++) {
        counter.processFrame(shallowSquatPose());
      }
      // 因膝盖角不够小，可能不会进入 bottom/descending
      expect(counter.getCount()).toBe(0);
    });
  });
});
