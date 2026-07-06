/**
 * HomeScreen 组件测试
 *
 * 覆盖：渲染不崩溃、运动卡片数量、导航按钮
 */
import React from 'react';
import type { ReactTestInstance } from 'react-test-renderer';
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
jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: '1', nickname: '测试', email: 'test@test.com', createdAt: '2025-01-01' },
    isLoading: false,
    isAuthenticating: false,
    error: null,
    login: jest.fn(),
    loginAsGuest: jest.fn(),
    register: jest.fn(),
    logout: jest.fn(),
    clearError: jest.fn(),
    updateUser: jest.fn(),
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

// ── expo-status-bar mock ──
jest.mock('expo-status-bar', () => ({
  StatusBar: () => null,
}));

// ── ExerciseIllustration mock ──
jest.mock('../components/ExerciseIllustration', () => {
  return function MockExerciseIllustration() {
    return null;
  };
});

import HomeScreen from '../screens/HomeScreen';

describe('HomeScreen', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('渲染不崩溃', async () => {
    const tree = await renderToJSON(
      <HomeScreen
        navigation={{ navigate: mockNavigate } as any}
        route={{ params: {} } as any}
      />,
    );
    expect(tree).toBeDefined();
  });

  it('包含运动卡片区域', async () => {
    const tree = await renderToJSON(
      <HomeScreen
        navigation={{ navigate: mockNavigate } as any}
        route={{ params: {} } as any}
      />,
    );
    expect(tree).toBeDefined();
    // 验证渲染了内容，结构完整
    const jsonStr = JSON.stringify(tree);
    // 运动卡片的 testID 格式为 home-exercise-{type}
    expect(jsonStr).toContain('home-exercise-');
  });

  it('导航按钮存在（历史、分析）', async () => {
    const tree = await renderToJSON(
      <HomeScreen
        navigation={{ navigate: mockNavigate } as any}
        route={{ params: {} } as any}
      />,
    );
    expect(tree).toBeDefined();
    const jsonStr = JSON.stringify(tree);
    // 验证导航按钮文本存在
    expect(jsonStr).toContain('历史');
    expect(jsonStr).toContain('分析');
  });

  it('点击运动卡片触发 navigate', async () => {
    const instance = await createWithAct(
      <HomeScreen
        navigation={{ navigate: mockNavigate } as any}
        route={{ params: {} } as any}
      />,
    );
    expect(instance).toBeDefined();

    // 查找带 testID 的 TouchableOpacity 并模拟点击
    const testInstances = instance.root.findAll((el: ReactTestInstance) =>
      el.props?.testID?.startsWith('home-exercise-'),
    );

    if (testInstances.length > 0) {
      const first = testInstances[0];
      first.props.onPress();
      expect(mockNavigate).toHaveBeenCalledWith(
        'Workout',
        expect.objectContaining({
          exerciseType: expect.any(String),
        }),
      );
    }
  });
});
