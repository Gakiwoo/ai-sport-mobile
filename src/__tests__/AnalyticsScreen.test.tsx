/**
 * AnalyticsScreen 组件测试
 *
 * 覆盖：渲染不崩溃、统计卡片展示
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
    getAnalytics: jest.fn(() =>
      Promise.resolve({
        totalWorkouts: 5,
        totalReps: 100,
        avgReps: 20,
        totalDuration: 300,
        recentWorkouts: [],
      }),
    ),
  },
}));

import AnalyticsScreen from '../screens/AnalyticsScreen';

describe('AnalyticsScreen', () => {
  it('渲染不崩溃', async () => {
    const tree = await renderToJSON(
      <AnalyticsScreen navigation={{ navigate: jest.fn() } as any} route={{ params: {} } as any} />,
    );
    expect(tree).toBeDefined();
  });

  it('包含统计信息', async () => {
    const tree = await renderToJSON(
      <AnalyticsScreen navigation={{ navigate: jest.fn() } as any} route={{ params: {} } as any} />,
    );
    const jsonStr = JSON.stringify(tree);
    // 验证统计标题存在
    expect(jsonStr).toContain('总体统计');
  });
});
