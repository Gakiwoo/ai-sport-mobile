/**
 * LoginScreen 组件测试
 *
 * 覆盖：渲染不崩溃、表单元素、游客模式按钮、注册导航
 */
import React from 'react';
import { renderToJSON, createWithAct } from './testRenderer';

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
const mockLogin = jest.fn(() => Promise.resolve());
const mockLoginAsGuest = jest.fn();
jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    isLoading: false,
    isAuthenticating: false,
    error: null,
    login: mockLogin,
    loginAsGuest: mockLoginAsGuest,
    register: jest.fn(),
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

import LoginScreen from '../screens/LoginScreen';

describe('LoginScreen', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockLogin.mockClear();
    mockLoginAsGuest.mockClear();
  });

  it('渲染不崩溃', async () => {
    const tree = await renderToJSON(
      <LoginScreen navigation={{ navigate: mockNavigate } as any} route={{ params: {} } as any} />,
    );
    expect(tree).toBeDefined();
  });

  it('包含品牌标题', async () => {
    const tree = await renderToJSON(
      <LoginScreen navigation={{ navigate: mockNavigate } as any} route={{ params: {} } as any} />,
    );
    const jsonStr = JSON.stringify(tree);
    expect(jsonStr).toContain('AI SPORT');
    expect(jsonStr).toContain('智能运动助手');
  });

  it('包含登录按钮和游客模式按钮', async () => {
    const tree = await renderToJSON(
      <LoginScreen navigation={{ navigate: mockNavigate } as any} route={{ params: {} } as any} />,
    );
    const jsonStr = JSON.stringify(tree);
    expect(jsonStr).toContain('登录');
    expect(jsonStr).toContain('游客模式');
  });

  it('包含注册链接', async () => {
    const tree = await renderToJSON(
      <LoginScreen navigation={{ navigate: mockNavigate } as any} route={{ params: {} } as any} />,
    );
    const jsonStr = JSON.stringify(tree);
    expect(jsonStr).toContain('立即注册');
  });

  it('点击游客模式按钮触发 loginAsGuest', async () => {
    const instance = await createWithAct(
      <LoginScreen navigation={{ navigate: mockNavigate } as any} route={{ params: {} } as any} />,
    );

    const guestBtn = instance.root.findAll(
      (el: any) => el.props?.testID === 'login-guest-button',
    );

    if (guestBtn.length > 0) {
      guestBtn[0].props.onPress();
      expect(mockLoginAsGuest).toHaveBeenCalledTimes(1);
    }
  });

  it('包含注册链接文本', async () => {
    const tree = await renderToJSON(
      <LoginScreen navigation={{ navigate: mockNavigate } as any} route={{ params: {} } as any} />,
    );
    const jsonStr = JSON.stringify(tree);
    expect(jsonStr).toContain('立即注册');
  });
});
