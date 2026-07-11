/**
 * RegisterScreen 组件测试
 *
 * 覆盖：渲染不崩溃、表单元素、登录链接
 */
import React from 'react';
import { renderToJSON } from './testRenderer';

// ── 导航 mock ──
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
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

// ── Auth mock ──
const mockRegister = jest.fn(() => Promise.resolve());
jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    isLoading: false,
    isAuthenticating: false,
    error: null,
    login: jest.fn(),
    loginAsGuest: jest.fn(),
    register: mockRegister,
    logout: jest.fn(),
    clearError: jest.fn(),
    updateUser: jest.fn(),
    refreshUser: jest.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// ── expo-status-bar mock ──
jest.mock('expo-status-bar', () => ({
  StatusBar: () => null,
}));

// ── i18n mock ──
jest.mock('../i18n', () => ({
  t: (key: string) => key,
  setLocale: jest.fn(),
  getLocale: () => 'zh',
  getDeviceLocale: () => 'zh',
  getSupportedLocales: () => [
    { code: 'zh', name: 'Chinese', localName: '中文' },
    { code: 'en', name: 'English', localName: 'English' },
  ],
}));

import RegisterScreen from '../screens/RegisterScreen';

describe('RegisterScreen', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockRegister.mockClear();
  });

  it('渲染不崩溃', async () => {
    const tree = await renderToJSON(
      <RegisterScreen
        navigation={{ navigate: mockNavigate } as any}
        route={{ params: {} } as any}
      />,
    );
    expect(tree).toBeDefined();
  });

  it('包含标题和副标题', async () => {
    const tree = await renderToJSON(
      <RegisterScreen
        navigation={{ navigate: mockNavigate } as any}
        route={{ params: {} } as any}
      />,
    );
    const jsonStr = JSON.stringify(tree);
    expect(jsonStr).toContain('创建账号');
    expect(jsonStr).toContain('注册');
  });

  it('包含登录链接', async () => {
    const tree = await renderToJSON(
      <RegisterScreen
        navigation={{ navigate: mockNavigate } as any}
        route={{ params: {} } as any}
      />,
    );
    const jsonStr = JSON.stringify(tree);
    expect(jsonStr).toContain('立即登录');
  });

  it('包含登录链接文本', async () => {
    const tree = await renderToJSON(
      <RegisterScreen
        navigation={{ navigate: mockNavigate } as any}
        route={{ params: {} } as any}
      />,
    );
    const jsonStr = JSON.stringify(tree);
    expect(jsonStr).toContain('立即登录');
  });
});
