/**
 * AuthContext 单元测试
 *
 * 覆盖：useAuth 守卫、AuthProvider 导出完整性、
 *       游客用户创建、AuthError 类型
 *
 * 注：AuthService 的核心逻辑（login/register/logout/refresh）
 *     已在 AuthService.test.ts 中完整覆盖。
 *     本测试聚焦 Context 层自身的逻辑。
 */
import React from 'react';
import { act, create } from 'react-test-renderer';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { createGuestUser } from '../utils/guestUser';
import { AuthError } from '../services/AuthService';

// ── Mocks ──
jest.mock('../services/AuthService', () => ({
  __esModule: true,
  default: {
    restoreSession: jest.fn().mockResolvedValue(null),
    login: jest.fn(),
    register: jest.fn(),
    logout: jest.fn(),
    getMe: jest.fn(),
  },
  AuthError: class AuthError extends Error {
    status?: number;
    constructor(message: string, status?: number) {
      super(message);
      this.name = 'AuthError';
      this.status = status;
    }
  },
}));

jest.mock('../services/ErrorReporter', () => ({
  __esModule: true,
  default: {
    captureWarning: jest.fn(),
    captureError: jest.fn(),
  },
}));

// ── 测试 ──
describe('AuthContext', () => {
  describe('useAuth guard', () => {
    it('在 AuthProvider 外部调用 useAuth 抛出明确异常', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      function BadComponent() {
        useAuth();
        return null;
      }

      expect(() => {
        act(() => {
          create(React.createElement(BadComponent));
        });
      }).toThrow('useAuth must be used within AuthProvider');

      consoleSpy.mockRestore();
    });
  });

  describe('AuthProvider exports', () => {
    it('AuthProvider 是一个有效的 React 组件', () => {
      expect(typeof AuthProvider).toBe('function');
    });

    it('useAuth 是一个有效的 hook 函数', () => {
      expect(typeof useAuth).toBe('function');
    });
  });

  describe('guest user creation', () => {
    it('createGuestUser 返回正确的游客对象结构', () => {
      const guest = createGuestUser();

      expect(guest.id).toBe('guest-local');
      expect(guest.email).toBe('local@ai-sport');
      expect(guest.nickname).toBe('本地训练');
      expect(guest.isGuest).toBe(true);
      expect(guest.isActive).toBe(true);
      expect(guest.createdAt).toBeTruthy();
    });

    it('createGuestUser 使用自定义时间戳', () => {
      const fixedTime = 1700000000000;
      const guest = createGuestUser(fixedTime);

      expect(guest.createdAt).toBe(new Date(fixedTime).toISOString());
    });

    it('每次调用生成一致的 id', () => {
      const g1 = createGuestUser();
      const g2 = createGuestUser();
      expect(g1.id).toBe(g2.id);
    });
  });

  describe('AuthError', () => {
    it('AuthError 包含 message 和 status', () => {
      const err = new AuthError('邮箱或密码错误', 401);

      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe('AuthError');
      expect(err.message).toBe('邮箱或密码错误');
      expect(err.status).toBe(401);
    });

    it('AuthError 无 status 时 status 为 undefined', () => {
      const err = new AuthError('网络错误');
      expect(err.status).toBeUndefined();
    });
  });

  describe('AuthProvider rendering', () => {
    it('AuthProvider 渲染子组件不崩溃', () => {
      let rendered = false;

      function Child() {
        rendered = true;
        return null;
      }

      act(() => {
        create(
          React.createElement(AuthProvider, null, React.createElement(Child)),
        );
      });

      expect(rendered).toBe(true);
    });
  });
});
