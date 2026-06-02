/**
 * HistoryScreen 组件测试
 *
 * 覆盖：渲染不崩溃、空数据状态
 */
import React from 'react';
import { renderToJSON } from './testRenderer';

// ── 导航 mock ──
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
  useRoute: () => ({ params: {} }),
}));
jest.mock('@react-navigation/stack', () => ({
  createStackNavigator: () => ({ Navigator: () => null, Screen: () => null }),
}));

// ── 安全区域 mock ──
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// ── StorageService mock ──
jest.mock('../services/StorageService', () => ({
  __esModule: true,
  default: {
    getWorkoutHistory: jest.fn(() => Promise.resolve([])),
    saveWorkout: jest.fn(() => Promise.resolve(true)),
  },
}));

import HistoryScreen from '../screens/HistoryScreen';

describe('HistoryScreen', () => {
  it('渲染不崩溃', async () => {
    const tree = await renderToJSON(
      <HistoryScreen navigation={{ navigate: jest.fn() } as any} route={{ params: {} } as any} />,
    );
    expect(tree).toBeDefined();
  });

  it('空历史时显示提示文本', async () => {
    const tree = await renderToJSON(
      <HistoryScreen navigation={{ navigate: jest.fn() } as any} route={{ params: {} } as any} />,
    );
    const jsonStr = JSON.stringify(tree);
    expect(jsonStr).toContain('暂无训练记录');
  });
});
