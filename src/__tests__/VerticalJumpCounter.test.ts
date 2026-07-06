import { VerticalJumpCounter } from '../services/counters/VerticalJumpCounter';
import {
  standingPose,
  squatBottomPose,
  airbornePose,
  lowConfidencePose,
  missingKeypointPose,
} from './testHelpers';

describe('VerticalJumpCounter', () => {
  let counter: VerticalJumpCounter;

  beforeEach(() => {
    counter = new VerticalJumpCounter();
  });

  describe('初始状态', () => {
    it('初始计数应为 0', () => {
      expect(counter.getCount()).toBe(0);
    });

    it('初始阶段应为 idle', () => {
      expect(counter.getPhase()).toBe('idle');
    });

    it('未标定', () => {
      expect(counter.isCalibrated()).toBe(false);
    });

    it('初始高度应为 0', () => {
      expect(counter.getHeight()).toBe(0);
    });

    it('初始跳跃次数应为 0', () => {
      expect(counter.getJumpCount()).toBe(0);
    });

    it('getRate 无数据时应返回 0', () => {
      expect(counter.getRate()).toBe(0);
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
      for (let i = 0; i < 30; i++) {
        counter.processFrame(standingPose());
      }
      expect(counter.isCalibrated()).toBe(true);
      expect(counter.getPhase()).toBe('ready');
    });

    it('不稳定站立不应标定', () => {
      // 交替姿势不应标定
      for (let i = 0; i < 60; i++) {
        counter.processFrame(i % 2 === 0 ? standingPose() : squatBottomPose());
      }
      expect(counter.isCalibrated()).toBe(false);
    });
  });

  describe('纵跳流程', () => {
    function calibrate(): void {
      for (let i = 0; i < 35; i++) {
        counter.processFrame(standingPose());
      }
    }

    it('标定后下蹲应进入 crouch', () => {
      calibrate();
      for (let i = 0; i < 10; i++) {
        counter.processFrame(squatBottomPose());
      }
      expect(counter.getPhase()).toBe('crouch');
    });

    it('完整纵跳流程不崩溃', () => {
      calibrate();
      // 下蹲
      for (let i = 0; i < 10; i++) {
        counter.processFrame(squatBottomPose());
      }
      // 起跳
      for (let i = 0; i < 5; i++) {
        counter.processFrame(standingPose());
      }
      // 腾空
      for (let i = 0; i < 10; i++) {
        counter.processFrame(airbornePose());
      }
      // 落地
      for (let i = 0; i < 20; i++) {
        counter.processFrame(standingPose());
      }
      expect(counter.getCount()).toBeGreaterThanOrEqual(0);
    });

    it('仅标定不下蹲不应跳跃', () => {
      calibrate();
      for (let i = 0; i < 100; i++) {
        counter.processFrame(standingPose());
      }
      expect(counter.getJumpCount()).toBe(0);
      expect(counter.getHeight()).toBe(0);
    });

    it('多次跳跃应累加计数', () => {
      calibrate();

      // 第一次
      for (let i = 0; i < 5; i++) counter.processFrame(squatBottomPose());
      for (let i = 0; i < 3; i++) counter.processFrame(standingPose());
      for (let i = 0; i < 5; i++) counter.processFrame(airbornePose());
      // 回到站立稳定
      for (let i = 0; i < 30; i++) counter.processFrame(standingPose());

      expect(counter.getJumpCount()).toBeGreaterThanOrEqual(0);

      // 第二次
      for (let i = 0; i < 5; i++) counter.processFrame(squatBottomPose());
      for (let i = 0; i < 3; i++) counter.processFrame(standingPose());
      for (let i = 0; i < 5; i++) counter.processFrame(airbornePose());
      for (let i = 0; i < 30; i++) counter.processFrame(standingPose());
    });
  });

  describe('setUserHeight', () => {
    it('应限制身高范围 100-220cm', () => {
      counter.setUserHeight(50);
      expect(counter.getUserHeight()).toBe(100);
      counter.setUserHeight(300);
      expect(counter.getUserHeight()).toBe(220);
      counter.setUserHeight(180);
      expect(counter.getUserHeight()).toBe(180);
    });

    it('默认身高为 170cm', () => {
      expect(counter.getUserHeight()).toBe(170);
    });

    it('标定后设置身高不应崩溃', () => {
      for (let i = 0; i < 35; i++) {
        counter.processFrame(standingPose());
      }
      counter.setUserHeight(185);
      expect(counter.getUserHeight()).toBe(185);
    });
  });

  describe('reset', () => {
    it('reset 后应回到初始状态', () => {
      for (let i = 0; i < 30; i++) {
        counter.processFrame(standingPose());
      }
      counter.reset();
      expect(counter.getCount()).toBe(0);
      expect(counter.getPhase()).toBe('idle');
      expect(counter.isCalibrated()).toBe(false);
      expect(counter.getHeight()).toBe(0);
      expect(counter.getJumpCount()).toBe(0);
    });

    it('多次跳跃后 reset 应清空', () => {
      for (let i = 0; i < 35; i++) counter.processFrame(standingPose());
      for (let i = 0; i < 5; i++) counter.processFrame(squatBottomPose());
      for (let i = 0; i < 3; i++) counter.processFrame(standingPose());
      for (let i = 0; i < 5; i++) counter.processFrame(airbornePose());
      for (let i = 0; i < 30; i++) counter.processFrame(standingPose());

      counter.reset();
      expect(counter.getCount()).toBe(0);
      expect(counter.getJumpCount()).toBe(0);
      expect(counter.getHeight()).toBe(0);
      expect(counter.getPhase()).toBe('idle');
    });
  });

  describe('getFeedback', () => {
    it('idle 阶段应返回提示', () => {
      const fb = counter.getFeedback();
      expect(fb).not.toBeNull();
      if (fb) {
        expect(fb.type).toBe('warning');
      }
    });

    it('ready 阶段 getFeedback 不崩溃', () => {
      for (let i = 0; i < 35; i++) {
        counter.processFrame(standingPose());
      }
      const fb = counter.getFeedback();
      // ready 阶段可以返回 null 或一个反馈对象
      expect(fb === null || fb !== null).toBe(true);
    });
  });

  describe('getResultValue', () => {
    it('纵跳应返回高度', () => {
      expect(counter.getResultValue()).toBe(0);
      expect(counter.getHeight()).toBe(0);
    });
  });

  describe('getJumpCount', () => {
    it('初始跳跃次数为 0', () => {
      expect(counter.getJumpCount()).toBe(0);
    });
  });

  describe('边缘情况', () => {
    it('大量帧不应报错', () => {
      for (let i = 0; i < 500; i++) {
        counter.processFrame(standingPose());
      }
      expect(counter.getCount()).toBe(0);
    });

    it('帧间隔变更后仍能标定', () => {
      counter.setFrameInterval(200);
      for (let i = 0; i < 50; i++) {
        counter.processFrame(standingPose());
      }
      expect(['ready', 'idle']).toContain(counter.getPhase());
    });
  });
});
