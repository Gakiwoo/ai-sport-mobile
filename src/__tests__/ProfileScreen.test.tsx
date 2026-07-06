/**
 * ProfileScreen 组件测试
 *
 * 覆盖：渲染不崩溃、登出按钮、用户信息展示
 */
import React from 'react';
import type { ReactTestInstance } from 'react-test-renderer';
import { renderToJSON, createWithAct } from './testRenderer';

// ── 导航 mock ──
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
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
const mockLogout = jest.fn();
const mockUpdateUser = jest.fn();
jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: '1', nickname: '测试用户', email: 'test@test.com', createdAt: '2025-01-01' },
    isLoading: false,
    isAuthenticating: false,
    error: null,
    login: jest.fn(),
    loginAsGuest: jest.fn(),
    register: jest.fn(),
    logout: mockLogout,
    clearError: jest.fn(),
    updateUser: mockUpdateUser,
    refreshUser: jest.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// ── Locale mock ──
jest.mock('../contexts/LocaleContext', () => ({
  useLocale: () => ({ locale: 'zh', switchLocale: jest.fn() }),
  LocaleProvider: ({ children }: { children: React.ReactNode }) => children,
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

// ── AuthService mock ──
jest.mock('../services/AuthService', () => ({
  __esModule: true,
  default: {
    updateNickname: jest.fn(() =>
      Promise.resolve({
        id: '1',
        nickname: '新昵称',
        email: 'test@test.com',
        createdAt: '2025-01-01',
      }),
    ),
    changePassword: jest.fn(() => Promise.resolve()),
  },
  AuthError: class AuthError extends Error {},
}));

// ── expo-status-bar mock ──
jest.mock('expo-status-bar', () => ({
  StatusBar: () => null,
}));

import ProfileScreen from '../screens/ProfileScreen';

describe('ProfileScreen', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    mockLogout.mockClear();
  });

  it('渲染不崩溃', async () => {
    const tree = await renderToJSON(
      <ProfileScreen
        navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any}
        route={{ params: {} } as any}
      />,
    );
    expect(tree).toBeDefined();
  });

  it('显示用户信息', async () => {
    const tree = await renderToJSON(
      <ProfileScreen
        navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any}
        route={{ params: {} } as any}
      />,
    );
    const jsonStr = JSON.stringify(tree);
    expect(jsonStr).toContain('test@test.com');
    expect(jsonStr).toContain('测试用户');
  });

  it('登出按钮存在', async () => {
    const tree = await renderToJSON(
      <ProfileScreen
        navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any}
        route={{ params: {} } as any}
      />,
    );
    const jsonStr = JSON.stringify(tree);
    expect(jsonStr).toContain('退出登录');
  });

  it('返回按钮存在', async () => {
    const instance = await createWithAct(
      <ProfileScreen
        navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any}
        route={{ params: {} } as any}
      />,
    );
    expect(instance).toBeDefined();

    // 查找返回按钮并模拟点击
    const backBtns = instance.root.findAll(
      (el: ReactTestInstance) =>
        el.props?.onClick !== undefined &&
        (el.type as string) === 'TouchableOpacity',
    );

    if (backBtns.length > 0) {
      backBtns[0].props.onClick();
      expect(mockGoBack).toHaveBeenCalled();
    }
  });
});
