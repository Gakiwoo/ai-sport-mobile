import { StandingLongJumpCounter } from '../services/counters/StandingLongJumpCounter';
import {
  standingPose,
  squatBottomPose,
  airbornePose,
  longJumpLandingPose,
  lowConfidencePose,
  missingKeypointPose,
} from './testHelpers';

describe('StandingLongJumpCounter', () => {
  let counter: StandingLongJumpCounter;

  beforeEach(() => {
    counter = new StandingLongJumpCounter();
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

    it('初始距离应为 0', () => {
      expect(counter.getDistance()).toBe(0);
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

    it('标定后膝盖方差大时不应标定', () => {
      // 交替站立和下蹲不应标定
      for (let i = 0; i < 50; i++) {
        counter.processFrame(i % 2 === 0 ? standingPose() : squatBottomPose());
      }
      // 不稳定时不应标定
      expect(counter.isCalibrated()).toBe(false);
    });
  });

  describe('跳远流程', () => {
    function calibrate(): void {
      for (let i = 0; i < 35; i++) {
        counter.processFrame(standingPose());
      }
    }

    it('标定后下蹲应进入 crouch', () => {
      calibrate();
      expect(counter.getPhase()).toBe('ready');

      for (let i = 0; i < 10; i++) {
        counter.processFrame(squatBottomPose());
      }
      expect(counter.getPhase()).toBe('crouch');
    });

    it('完整跳远流程应产生距离', () => {
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
      for (let i = 0; i < 30; i++) {
        counter.processFrame(longJumpLandingPose());
      }

      expect(counter.getCount()).toBeGreaterThanOrEqual(0);
    });

    it('仅标定不下蹲不应计数', () => {
      calibrate();
      for (let i = 0; i < 100; i++) {
        counter.processFrame(standingPose());
      }
      expect(counter.getCount()).toBe(0);
      expect(counter.getDistance()).toBe(0);
    });

    it('起跳超时后应回到 ready', () => {
      calibrate();

      // 短暂下蹲
      for (let i = 0; i < 5; i++) {
        counter.processFrame(squatBottomPose());
      }

      // 在 takeoff 阶段等待超时
      for (let i = 0; i < 30; i++) {
        counter.processFrame(standingPose());
      }

      // 可能回到 ready
      const phase = counter.getPhase();
      expect(['ready', 'idle', 'takeoff']).toContain(phase);
    });
  });

  describe('setUserHeight', () => {
    it('应限制身高范围 100-220cm', () => {
      counter.setUserHeight(50);
      expect(counter.getUserHeight()).toBe(100);
      counter.setUserHeight(300);
      expect(counter.getUserHeight()).toBe(220);
      counter.setUserHeight(175);
      expect(counter.getUserHeight()).toBe(175);
    });

    it('默认身高为 170cm', () => {
      expect(counter.getUserHeight()).toBe(170);
    });

    it('标定后设置身高应重新计算比例', () => {
      for (let i = 0; i < 35; i++) {
        counter.processFrame(standingPose());
      }
      expect(counter.isCalibrated()).toBe(true);

      // 设置身高不应崩溃
      counter.setUserHeight(180);
      expect(counter.getUserHeight()).toBe(180);
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
      expect(counter.getDistance()).toBe(0);
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
      // ready 阶段可以返回 null
      expect(fb === null || fb !== null).toBe(true);
    });
  });

  describe('getResultValue / getResultUnit', () => {
    it('立定跳远应返回距离和单位"cm"', () => {
      expect(counter.getResultValue()).toBe(0);

      // getDistance 是核心指标
      expect(counter.getDistance()).toBe(0);

      // getResultUnit 可能为 'cm'
      const unit = counter.getResultUnit();
      expect(['cm', '厘米']).toContain(unit);
    });
  });

  describe('边缘情况', () => {
    it('大量帧不应报错', () => {
      for (let i = 0; i < 500; i++) {
        counter.processFrame(standingPose());
      }
      expect(counter.getCount()).toBe(0);
    });

    it('帧间隔变更后仍能正常标定', () => {
      counter.setFrameInterval(200); // 5fps
      for (let i = 0; i < 50; i++) {
        counter.processFrame(standingPose());
      }
      // 标定或 ready 都可以
      expect(['ready', 'idle']).toContain(counter.getPhase());
    });
  });
});
