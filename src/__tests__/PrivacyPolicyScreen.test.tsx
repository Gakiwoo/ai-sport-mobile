/**
 * PrivacyPolicyScreen 组件测试
 *
 * 覆盖：渲染不崩溃、隐私政策标题
 */
import React from 'react';
import { renderToJSON } from './testRenderer';

// ── 导航 mock ──
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
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

// ── expo-status-bar mock ──
jest.mock('expo-status-bar', () => ({
  StatusBar: () => null,
}));

import PrivacyPolicyScreen from '../screens/PrivacyPolicyScreen';

describe('PrivacyPolicyScreen', () => {
  it('渲染不崩溃', async () => {
    const tree = await renderToJSON(
      <PrivacyPolicyScreen navigation={{ navigate: jest.fn(), goBack: jest.fn() } as any} route={{ params: {} } as any} />,
    );
    expect(tree).toBeDefined();
  });

  it('包含隐私政策标题', async () => {
    const tree = await renderToJSON(
      <PrivacyPolicyScreen navigation={{ navigate: jest.fn(), goBack: jest.fn() } as any} route={{ params: {} } as any} />,
    );
    const jsonStr = JSON.stringify(tree);
    expect(jsonStr).toContain('隐私政策');
  });
});
