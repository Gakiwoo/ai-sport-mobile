import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import ErrorReporter from './ErrorReporter';
import {
  User,
  AuthTokens,
  LoginRequest,
  RegisterRequest,
  UpdateNicknameRequest,
  ChangePasswordRequest,
  UsageLog,
} from '../types/auth';
import { resolveApiBaseUrl } from '../utils/apiBaseUrl';
import { withTimeout } from '../utils/withTimeout';
import { getEnvVar, isDevMode } from '../utils/getEnv';
import SecureStorageService from './SecureStorageService';

// ── 常量 ──
const isDev = isDevMode();
const envBaseUrl = getEnvVar('EXPO_PUBLIC_API_BASE_URL');

const BASE_URL = resolveApiBaseUrl({
  isDev,
  platformOS: Platform.OS,
  envUrl: envBaseUrl,
});

const TOKEN_KEY = '@auth_tokens';
const USER_KEY = '@auth_user';

// ── 错误类型 ──
export class AuthError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

// ── Token 刷新锁：确保并发 401 只触发一次 refresh ──
let refreshPromise: Promise<AuthTokens | null> | null = null;

function refreshOnce(token: string): Promise<AuthTokens | null> {
  if (!refreshPromise) {
    refreshPromise = refreshToken(token).finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

// ── 内部：fetch 封装 ──
async function authFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const tokens = await getStoredTokens();
  return authFetchWithTokens(path, options, tokens);
}

/** 带显式 tokens 的 fetch。重试时直接用 refreshOnce 返回的内存 token 对象。 */
async function authFetchWithTokens(
  path: string,
  options: RequestInit = {},
  tokens: AuthTokens | null,
): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };

  // Access Token 通过 Authorization Header 传递（统一通道）
  if (tokens?.accessToken) {
    headers['Authorization'] = `Bearer ${tokens.accessToken}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  // 如果 401，尝试 refresh token（通过锁确保并发安全）
  if (res.status === 401 && tokens?.refreshToken && !path.includes('/auth/refresh')) {
    const newTokens = await refreshOnce(tokens.refreshToken);
    if (newTokens) {
      // 用新 token 重试（内存对象，不依赖存储可见性）
      return authFetchWithTokens(path, options, newTokens);
    }
  }

  return res;
}

// ── 本地存储 ──
// Token：使用安全存储（expo-secure-store）
// User：使用 AsyncStorage（非敏感数据）
async function getStoredTokens(): Promise<AuthTokens | null> {
  try {
    const raw = await SecureStorageService.getItem(TOKEN_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    ErrorReporter.captureWarning('读取 token 存储失败', {
      source: 'AuthService.getStoredTokens',
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

async function storeTokens(tokens: AuthTokens): Promise<void> {
  await SecureStorageService.setItem(TOKEN_KEY, JSON.stringify(tokens));
}

async function clearTokens(): Promise<void> {
  await SecureStorageService.removeItem(TOKEN_KEY);
}

async function storeUser(user: User): Promise<void> {
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
}

async function getStoredUser(): Promise<User | null> {
  try {
    const raw = await AsyncStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    ErrorReporter.captureWarning('读取用户缓存失败', {
      source: 'AuthService.getStoredUser',
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

async function clearUser(): Promise<void> {
  await AsyncStorage.removeItem(USER_KEY);
}

async function clearSession(): Promise<void> {
  await clearTokens();
  await clearUser();
}

// ── Refresh Token ──
async function refreshToken(refreshTokenStr: string): Promise<AuthTokens | null> {
  try {
    const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: refreshTokenStr }),
      credentials: 'include',
    });

    if (!res.ok) {
      // refresh 失败，清除本地登录状态
      await clearSession();
      return null;
    }

    // 优先从 JSON body 提取（NestJS 契约：{ accessToken, refreshToken, user }）
    const data = await res.json().catch(() => null);

    // 同时解析 user（NestJS 返回 { user: { id, username, email, role, display_name } }）
    if (data?.user) {
      await storeUser(mapServerUser(data.user));
    }

    if (data?.accessToken && data?.refreshToken) {
      const tokens: AuthTokens = {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      };
      await storeTokens(tokens);
      return tokens;
    }

    // 回退：兼容旧后端从 Set-Cookie 提取
    const setCookie = res.headers.get('set-cookie') || '';
    const newAccessToken = extractCookie(setCookie, 'access_token');
    const newRefreshToken = extractCookie(setCookie, 'refresh_token');

    if (newAccessToken && newRefreshToken) {
      const tokens = { accessToken: newAccessToken, refreshToken: newRefreshToken };
      await storeTokens(tokens);
      return tokens;
    }

    return null;
  } catch (err) {
    ErrorReporter.captureWarning('Token 刷新请求失败', {
      source: 'AuthService.refreshToken',
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * 将后端 user（NestJS：id/username/email/display_name）映射为
 * Mobile 端 User（id/email/nickname），保持 UI 层契约不变。
 */
function mapServerUser(serverUser: Record<string, unknown>): User {
  return {
    id: String(serverUser.id ?? ''),
    email: (serverUser.email as string) ?? (serverUser.username as string) ?? '',
    nickname: (serverUser.display_name as string) ?? (serverUser.username as string) ?? '',
    isActive: serverUser.is_active !== 0,
    createdAt: (serverUser.created_at as string) ?? new Date().toISOString(),
  };
}

// 从 Set-Cookie 头提取指定 cookie 值（支持多个 Set-Cookie 头拼接；兼容旧后端）
function extractCookie(setCookieHeaders: string | null, name: string): string | null {
  if (!setCookieHeaders) return null;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`${escaped}=([^;\\s]+)`, 'g');
  let match: RegExpExecArray | null;
  let lastValue: string | null = null;
  while ((match = regex.exec(setCookieHeaders)) !== null) {
    lastValue = match[1];
  }
  return lastValue;
}

/** 从响应 body 中提取 tokens：优先 JSON body（NestJS），回退 Set-Cookie */
function extractTokens(body: Record<string, unknown> | null, res: Response): AuthTokens | null {
  if (body?.accessToken && body?.refreshToken) {
    return { accessToken: body.accessToken as string, refreshToken: body.refreshToken as string };
  }
  // 回退 Set-Cookie（兼容旧后端）
  const setCookie = res.headers.get('set-cookie') || '';
  const accessToken = extractCookie(setCookie, 'access_token');
  const refreshTokenVal = extractCookie(setCookie, 'refresh_token');
  if (accessToken && refreshTokenVal) {
    return { accessToken, refreshToken: refreshTokenVal };
  }
  return null;
}

// ── 公共 API ──
const AuthService = {
  /**
   * 注册
   * 后端（NestJS）响应格式: { id, username, role } + JSON body tokens
   * 兼容旧后端: { message, user } + Set-Cookie
   */
  async register(data: RegisterRequest): Promise<{ message: string; user: User }> {
    // 契约对齐：NestJS 以 username 登录，Mobile 以 email 注册 → 映射
    const payload = {
      username: data.email,
      email: data.email,
      password: data.password,
      displayName: data.nickname,
    };
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'include',
    });

    const body = await res.json();

    if (!res.ok) {
      throw new AuthError(body.message || '注册失败', res.status);
    }

    // NestJS：body 为 { id, username, role }，构造 User
    const user: User =
      body.id !== undefined
        ? {
            id: String(body.id),
            email: data.email,
            nickname: data.nickname,
            createdAt: new Date().toISOString(),
          }
        : mapServerUser(body.user ?? body);

    await storeUser(user);

    // 提取 tokens（NestJS JSON body 优先）
    const tokens = extractTokens(body, res);
    if (tokens) {
      await storeTokens(tokens);
    } else {
      // NestJS register 不返回 token：注册成功后自动登录一次，获取会话
      try {
        const loginUser = await AuthService.login({ email: data.email, password: data.password });
        // 保留注册时用户填写的昵称（login 返回的 user 可能只有 username）
        const mergedUser: User = { ...loginUser, nickname: data.nickname || loginUser.nickname };
        await storeUser(mergedUser);
        return { message: '注册成功', user: mergedUser };
      } catch {
        // 自动登录失败不阻塞注册流程（用户可手动登录）
      }
    }

    return { message: '注册成功', user };
  },

  /**
   * 登录
   * 后端（NestJS）响应: { accessToken, refreshToken, user }
   * 兼容旧后端: { user } + Set-Cookie
   */
  async login(data: LoginRequest): Promise<User> {
    // 契约对齐：NestJS 以 username 登录（后端已兼容 username=email 查询）
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: data.email, password: data.password }),
      credentials: 'include',
    });

    const body = await res.json();

    if (!res.ok) {
      throw new AuthError(body.message || '登录失败', res.status);
    }

    // NestJS：body.user 为 { id, username, email, role, display_name }
    const user = body.user ? mapServerUser(body.user) : mapServerUser(body);

    await storeUser(user);

    // 提取 tokens（NestJS JSON body 优先）
    const tokens = extractTokens(body, res);
    if (tokens) {
      await storeTokens(tokens);
    }

    return user;
  },

  /** 登出 */
  async logout(): Promise<void> {
    try {
      const tokens = await getStoredTokens();

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      // 通过 Authorization Header 传递 token 用于后端注销
      if (tokens?.refreshToken) {
        headers['Authorization'] = `Bearer ${tokens.refreshToken}`;
      }

      await fetch(`${BASE_URL}/api/auth/logout`, {
        method: 'POST',
        headers,
        credentials: 'include',
      });
    } finally {
      await clearTokens();
      await clearUser();
    }
  },

  /** 获取当前用户 */
  async getMe(): Promise<User> {
    const res = await authFetch('/api/auth/me');
    const body = await res.json();

    if (!res.ok) {
      throw new AuthError(body.message || '获取用户信息失败', res.status);
    }

    await storeUser(body.user);
    return body.user;
  },

  /** 更新昵称 */
  async updateNickname(data: UpdateNicknameRequest): Promise<User> {
    const res = await authFetch('/api/auth/me', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    const body = await res.json();

    if (!res.ok) {
      throw new AuthError(body.message || '更新失败', res.status);
    }

    await storeUser(body.user);
    return body.user;
  },

  /** 修改密码（成功后自动登出） */
  async changePassword(data: ChangePasswordRequest): Promise<void> {
    const res = await authFetch('/api/auth/me/password', {
      method: 'PUT',
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new AuthError(body.message || '密码修改失败', res.status);
    }

    // 后端清除 cookie → 前端也清除
    await clearTokens();
    await clearUser();
  },

  /** 获取使用记录 */
  async getUsage(): Promise<UsageLog[]> {
    const res = await authFetch('/api/auth/usage');
    const body = await res.json();

    if (!res.ok) {
      throw new AuthError(body.message || '获取使用记录失败', res.status);
    }

    return body.logs || [];
  },

  /** 从本地恢复登录状态 */
  async restoreSession(): Promise<User | null> {
    const user = await getStoredUser();
    if (!user) return null;

    // 尝试用 /me 验证 token 是否仍然有效
    try {
      const freshUser = await withTimeout(this.getMe(), 2500);
      return freshUser;
    } catch (err) {
      if (err instanceof AuthError && (err.status === 401 || err.status === 403)) {
        await clearSession();
      }
      ErrorReporter.captureWarning('认证请求失败', {
        source: 'AuthService',
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  },

  /** 获取当前 access token（供同步等需 Authorization 头的场景使用）；未登录返回 null */
  async getAccessToken(): Promise<string | null> {
    const tokens = await getStoredTokens();
    return tokens?.accessToken ?? null;
  },
};

export default AuthService;
