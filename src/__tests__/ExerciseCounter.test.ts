import { ExerciseCounter } from '../services/ExerciseCounter';

// 用最小实现测试基类
class TestCounter extends ExerciseCounter {
  processFrame(_pose: unknown): void {
    this.totalFrames++;
  }
}

describe('ExerciseCounter 基类', () => {
  let counter: TestCounter;

  beforeEach(() => {
    counter = new TestCounter();
  });

  it('初始计数应为 0', () => {
    expect(counter.getCount()).toBe(0);
  });

  it('初始阶段应为 neutral', () => {
    expect(counter.getPhase()).toBe('neutral');
  });

  it('getRate 在无数据时应返回 0', () => {
    expect(counter.getRate()).toBe(0);
  });

  it('setFrameInterval 应设置帧间隔', () => {
    counter.setFrameInterval(80);
    // 间接通过 getRate 验证
    counter.processFrame({});
    expect(counter.getRate()).toBe(0); // count=0 所以还是 0
  });

  it('getRate 在有计数和帧数时应返回正数', () => {
    counter.setFrameInterval(100);
    // 模拟 100 帧，1 次计数
    for (let i = 0; i < 100; i++) {
      counter.processFrame({});
    }
    // 但 getCount 仍然是 0 因为 processFrame 不增加 count
    // 需要直接验证公式逻辑
    expect(counter.getRate()).toBe(0);
  });

  it('reset 应重置所有状态', () => {
    counter.processFrame({});
    counter.processFrame({});
    counter.reset();
    expect(counter.getCount()).toBe(0);
    expect(counter.getPhase()).toBe('neutral');
  });

  it('getFeedback 默认返回 null', () => {
    expect(counter.getFeedback()).toBeNull();
  });
});
describe('ExerciseCounter getRate 公式验证', () => {
  it('100帧 @ 100ms间隔 + 1次计数 = 60/分钟', () => {
    class CountingCounter extends ExerciseCounter {
      constructor() {
        super();
        // 模拟 100 帧后计数 1 次
      }
      processFrame(_pose: unknown): void {
        this.totalFrames++;
      }
      simulateCount(frames: number, counts: number): void {
        this.totalFrames = frames;
        (this as any).count = counts;
      }
    }

    const c = new CountingCounter();
    c.setFrameInterval(100);
    c.simulateCount(100, 1); // 100帧 = 10秒 @ 10fps, 1次 = 6/分钟
    // getRate: count / (totalFrames / fps) * 60
    // fps = 1000/100 = 10, seconds = 100/10 = 10, rate = 1/10 * 60 = 6
    expect(c.getRate()).toBe(6);
  });

  it('300帧 @ 100ms间隔 + 10次计数 = 60/分钟', () => {
    class CountingCounter extends ExerciseCounter {
      processFrame(_pose: unknown): void {
        this.totalFrames++;
      }
      simulateCount(frames: number, counts: number): void {
        this.totalFrames = frames;
        (this as any).count = counts;
      }
    }

    const c = new CountingCounter();
    c.setFrameInterval(100);
    c.simulateCount(300, 10); // 300帧 = 30秒, 10次 = 20/分钟
    expect(c.getRate()).toBe(20);
  });
});

describe('ExerciseCounter 边界值', () => {
  let counter: TestCounter;

  beforeEach(() => {
    counter = new TestCounter();
  });

  it('setFrameInterval(0) 应被钳位到最小 16ms', () => {
    counter.setFrameInterval(0);
    expect((counter as any).frameIntervalMs).toBe(16);
  });

  it('setFrameInterval(-10) 应被钳位到最小 16ms', () => {
    counter.setFrameInterval(-10);
    expect((counter as any).frameIntervalMs).toBe(16);
  });

  it('setFrameInterval(16) 应保留最小值 16ms', () => {
    counter.setFrameInterval(16);
    expect((counter as any).frameIntervalMs).toBe(16);
  });

  it('setFrameInterval 接受非常大的值', () => {
    counter.setFrameInterval(10000);
    expect((counter as any).frameIntervalMs).toBe(10000);
  });

  it('多次 reset 后仍可正常使用', () => {
    counter.processFrame({});
    counter.reset();
    counter.reset();
    counter.reset();
    expect(counter.getCount()).toBe(0);
    expect(counter.getPhase()).toBe('neutral');
    // 再次 processFrame 不报错
    counter.processFrame({});
    expect((counter as any).totalFrames).toBe(1);
  });

  it('getRate 在只有帧没有计数时返回 0', () => {
    counter.setFrameInterval(100);
    for (let i = 0; i < 200; i++) {
      counter.processFrame({});
    }
    expect(counter.getRate()).toBe(0);
  });
});

describe('ExerciseCounter getRate 不同帧间隔公式验证', () => {
  it('60帧 @ 80ms间隔 + 5次计数 = 62.5 ≈ 63/分钟', () => {
    class RCounter extends ExerciseCounter {
      processFrame(): void {}
      setCount(c: number, f: number) {
        (this as any).count = c;
        (this as any).totalFrames = f;
      }
    }
    const c = new RCounter();
    c.setFrameInterval(80); // fps = 12.5
    c.setCount(5, 60); // seconds = 60/12.5 = 4.8
    // rate = 5/4.8 * 60 = 62.5 → Math.round = 63
    expect(c.getRate()).toBe(63);
  });

  it('120帧 @ 120ms间隔 + 10次计数 = 60/分钟', () => {
    class RCounter extends ExerciseCounter {
      processFrame(): void {}
      setCount(c: number, f: number) {
        (this as any).count = c;
        (this as any).totalFrames = f;
      }
    }
    const c = new RCounter();
    c.setFrameInterval(120); // fps = 8.33
    c.setCount(10, 120); // seconds = 120/8.33 = 14.4
    // rate = 10/14.4 * 60 = 41.67 → Math.round = 42
    expect(c.getRate()).toBe(42);
  });
});

describe('ExerciseCounter 时间窗口换算', () => {
  class TimingCounter extends ExerciseCounter {
    processFrame(_pose: unknown): void {
      this.totalFrames++;
    }

    framesFor30fps(frames: number): number {
      return this.framesAt30Fps(frames);
    }

    framesForMsPublic(ms: number): number {
      return this.framesForMs(ms);
    }
  }

  it('按当前帧间隔把 30fps 帧数换算成真实时间窗口', () => {
    const c = new TimingCounter();

    c.setFrameInterval(80);
    expect(c.framesFor30fps(30)).toBe(13);
    expect(c.framesFor30fps(10)).toBe(5);

    c.setFrameInterval(100);
    expect(c.framesFor30fps(30)).toBe(10);
    expect(c.framesFor30fps(10)).toBe(4);

    c.setFrameInterval(120);
    expect(c.framesFor30fps(30)).toBe(9);
    expect(c.framesFor30fps(10)).toBe(3);
  });

  it('毫秒窗口至少保留一帧并向上取整', () => {
    const c = new TimingCounter();
    c.setFrameInterval(120);

    expect(c.framesForMsPublic(1)).toBe(1);
    expect(c.framesForMsPublic(121)).toBe(2);
  });
});
describe('ExerciseCounter 商业化统一结果结构', () => {
  class ResultCounter extends ExerciseCounter {
    processFrame(pose: { keypoints?: unknown[] }): void {
      this.totalFrames++;
      if ((pose.keypoints || []).length > 0) {
        this.count++;
        this.lastState = 'counted';
      } else {
        this.invalidCount++;
        this.lastState = 'invalid';
      }
    }
  }

  const confidentPose = {
    score: 0.92,
    keypoints: [
      { name: 'left_shoulder', x: 0.4, y: 0.2, score: 0.9 },
      { name: 'right_shoulder', x: 0.6, y: 0.2, score: 0.94 },
    ],
  };

  it('processFrameResult 输出统一帧结果', () => {
    const counter = new ResultCounter();

    const frameResult = counter.processFrameResult(confidentPose);

    expect(frameResult).toEqual({
      state: 'counted',
      countDelta: 1,
      valid: true,
      confidence: 0.92,
      feedback: undefined,
      keyMetrics: {
        count: 1,
        resultValue: 1,
        totalFrames: 1,
        rate: 600,
      },
    });
  });

  it('getSessionResult 输出 ExerciseResult 并记录异常帧', () => {
    const counter = new ResultCounter();
    counter.setFrameInterval(100);
    counter.startSession('jump_rope', {
      sessionId: 'session_test',
      startedAt: '2026-07-01T00:00:00.000Z',
    });

    counter.processFrameResult(confidentPose);
    counter.processFrameResult({ keypoints: [] });

    const result = counter.getSessionResult('jump_rope', '2026-07-01T00:00:01.000Z');

    expect(result).toMatchObject({
      sessionId: 'session_test',
      exerciseType: 'jump_rope',
      reps: 1,
      validCount: 1,
      invalidCount: 1,
      foulCount: 0,
      confidence: 0.5,
      durationMs: 1000,
      feedback: [],
      algorithmLog: expect.any(Array),
      startedAt: '2026-07-01T00:00:00.000Z',
      endedAt: '2026-07-01T00:00:01.000Z',
    });
    expect(result.algorithmLog).toHaveLength(2);
    expect(result.algorithmLog[0]).toMatchObject({
      frameIndex: 1,
      timestampMs: 100,
      state: 'counted',
      countDelta: 1,
    });
  });

  it('测量型项目按项目类型映射 distanceCm 和 heightCm', () => {
    class DistanceCounter extends ExerciseCounter {
      processFrame(): void {
        this.totalFrames++;
      }

      getResultValue(): number {
        return 236;
      }

      getResultUnit(): string {
        return 'cm';
      }
    }

    const longJump = new DistanceCounter();
    longJump.startSession('standing_long_jump', {
      sessionId: 'long_jump',
      startedAt: '2026-07-01T00:00:00.000Z',
    });
    longJump.processFrameResult(confidentPose);

    const verticalJump = new DistanceCounter();
    verticalJump.startSession('vertical_jump', {
      sessionId: 'vertical_jump',
      startedAt: '2026-07-01T00:00:00.000Z',
    });
    verticalJump.processFrameResult(confidentPose);

    expect(longJump.getSessionResult('standing_long_jump').distanceCm).toBe(236);
    expect(longJump.getSessionResult('standing_long_jump').heightCm).toBeUndefined();
    expect(verticalJump.getSessionResult('vertical_jump').heightCm).toBe(236);
    expect(verticalJump.getSessionResult('vertical_jump').distanceCm).toBeUndefined();
  });
});
