import { performanceMonitor, FPS_LOW_THRESHOLD } from '../services/PerformanceMonitor';

// Mock AsyncStorage — store defined inside factory for Jest hoisting compliance
jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    __store: store,
    getItem: jest.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    setItem: jest.fn((key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve();
    }),
    removeItem: jest.fn((key: string) => {
      store.delete(key);
      return Promise.resolve();
    }),
  };
});

/** Access the in-memory store from the mock */
function getStore(): Map<string, string> {
  return (require('@react-native-async-storage/async-storage') as any).__store;
}

describe('PerformanceMonitor', () => {
  beforeEach(() => {
    performanceMonitor.reset();
    getStore().clear();
  });

  it('初始状态未运行', () => {
    expect(performanceMonitor.isRunning).toBe(false);
    expect(performanceMonitor.frameCount).toBe(0);
  });

  it('start 后 isRunning 为 true', () => {
    performanceMonitor.start();
    expect(performanceMonitor.isRunning).toBe(true);
  });

  it('stop 后 isRunning 为 false', async () => {
    performanceMonitor.start();
    await performanceMonitor.stop();
    expect(performanceMonitor.isRunning).toBe(false);
  });

  it('recordFrame 增加帧计数', () => {
    performanceMonitor.start();
    performanceMonitor.recordFrame(30, true);
    performanceMonitor.recordFrame(25, true);
    performanceMonitor.recordFrame(35, true);
    expect(performanceMonitor.frameCount).toBe(3);
  });

  it('未启动时 recordFrame 被忽略', () => {
    performanceMonitor.recordFrame(30, true);
    expect(performanceMonitor.frameCount).toBe(0);
  });

  it('getCurrentFps 在帧数不足时返回 0', () => {
    performanceMonitor.start();
    performanceMonitor.recordFrame(30, true);
    expect(performanceMonitor.getCurrentFps()).toBe(0);
  });

  it('getAverageInferenceMs 返回平均值', () => {
    performanceMonitor.start();
    performanceMonitor.recordFrame(20, true);
    performanceMonitor.recordFrame(30, true);
    performanceMonitor.recordFrame(40, true);
    expect(performanceMonitor.getAverageInferenceMs()).toBe(30);
  });

  it('stop 后报告包含正确的字段', async () => {
    performanceMonitor.start();
    for (let i = 0; i < 10; i++) {
      performanceMonitor.recordFrame(25, true);
    }
    const report = await performanceMonitor.stop();
    expect(report).not.toBeNull();
    expect(report!.totalFrames).toBe(10);
    expect(report!.avgInferenceMs).toBeGreaterThan(0);
    expect(report!.sessionId).toContain('perf_');
    expect(report!.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('重复 stop 第二次返回 null', async () => {
    performanceMonitor.start();
    performanceMonitor.recordFrame(30, true);
    const first = await performanceMonitor.stop();
    expect(first).not.toBeNull();
    const second = await performanceMonitor.stop();
    expect(second).toBeNull();
  });

  it('getHistory 返回已保存的报告', async () => {
    performanceMonitor.start();
    for (let i = 0; i < 5; i++) {
      performanceMonitor.recordFrame(20, true);
    }
    await performanceMonitor.stop();

    const history = await performanceMonitor.getHistory();
    expect(history.length).toBeGreaterThanOrEqual(1);
    expect(history[0].totalFrames).toBe(5);
  });

  it('clearHistory 清空历史', async () => {
    performanceMonitor.start();
    performanceMonitor.recordFrame(10, true);
    await performanceMonitor.stop();

    await performanceMonitor.clearHistory();
    const history = await performanceMonitor.getHistory();
    expect(history.length).toBe(0);
  });

  it('FPS_LOW_THRESHOLD 导出正确', () => {
    expect(FPS_LOW_THRESHOLD).toBe(15);
  });
});
