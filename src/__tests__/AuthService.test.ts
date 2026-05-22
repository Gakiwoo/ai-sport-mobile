import AsyncStorage from '@react-native-async-storage/async-storage';
import AuthService from '../services/AuthService';

jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

// Mock AsyncStorage for user data (non-sensitive) — store is scoped inside factory
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

// Mock SecureStorageService for token data (sensitive) — store scoped inside factory
jest.mock('../services/SecureStorageService', () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    __store: store,
    default: {
      getItem: jest.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
      setItem: jest.fn((key: string, value: string) => {
        store.set(key, value);
        return Promise.resolve();
      }),
      removeItem: jest.fn((key: string) => {
        store.delete(key);
        return Promise.resolve();
      }),
      isAvailable: jest.fn(() => Promise.resolve(true)),
    },
  };
});

const USER_KEY = '@auth_user';
const TOKEN_KEY = '@auth_tokens';

// ── Helpers ──

/** Get references to the in-memory stores for test setup/teardown */
function getAsyncStore(): Map<string, string> {
  return (require('@react-native-async-storage/async-storage') as any).__store;
}

function getSecureStore(): Map<string, string> {
  return (require('../services/SecureStorageService') as any).__store;
}

/** Build a mock fetch Response with optional Set-Cookie header */
function mockResponse(ok: boolean, status: number, body: unknown, setCookie?: string): Response {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
    headers: {
      get: (name: string) => (name === 'set-cookie' ? (setCookie ?? null) : null),
    },
  } as Response;
}

/** Build a mock fetch that returns the given response */
function mockFetch(res: Response) {
  (globalThis as any).fetch = jest.fn(() => Promise.resolve(res));
}

/** Pre-store tokens in secure store for tests that need authFetch */
function storeTokens(access = 'at', refresh = 'rt') {
  getSecureStore().set(TOKEN_KEY, JSON.stringify({ accessToken: access, refreshToken: refresh }));
}

/** Clear both stores */
function clearAllStores() {
  getAsyncStore().clear();
  getSecureStore().clear();
}

// ── restoreSession (existing) ──

describe('AuthService.restoreSession', () => {
  beforeEach(() => {
    (globalThis as any).__DEV__ = true;
    clearAllStores();
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('returns null quickly when session verification does not respond', async () => {
    jest.useFakeTimers();
    getAsyncStore().set(
      USER_KEY,
      JSON.stringify({ id: 'u1', email: 'u@example.com', nickname: 'U' }),
    );
    getSecureStore().set(TOKEN_KEY, JSON.stringify({ accessToken: 'a', refreshToken: 'r' }));
    (globalThis as any).fetch = jest.fn(() => new Promise(() => {}));

    const restore = AuthService.restoreSession();
    await Promise.resolve();
    await Promise.resolve();
    jest.advanceTimersByTime(2500);
    await Promise.resolve();

    await expect(Promise.race([restore, Promise.resolve('pending')])).resolves.toBeNull();
  });

  it('clears stored credentials when the server rejects the session', async () => {
    getAsyncStore().set(
      USER_KEY,
      JSON.stringify({ id: 'u1', email: 'u@example.com', nickname: 'U' }),
    );
    getSecureStore().set(TOKEN_KEY, JSON.stringify({ accessToken: 'a', refreshToken: 'r' }));
    (globalThis as any).fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ message: 'expired' }),
      }),
    );

    await expect(AuthService.restoreSession()).resolves.toBeNull();
    await expect(AsyncStorage.getItem(USER_KEY)).resolves.toBeNull();
    expect(getSecureStore().get(TOKEN_KEY)).toBeUndefined();
  });
});

// ── register ──

describe('AuthService.register', () => {
  beforeEach(() => {
    (globalThis as any).__DEV__ = true;
    clearAllStores();
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('registers successfully and stores user + tokens', async () => {
    const user = { id: 'u1', email: 'new@test.com', nickname: 'New', createdAt: '2025-01-01' };
    mockFetch(
      mockResponse(true, 201, { message: '注册成功', user }, 'access_token=at; refresh_token=rt'),
    );

    const result = await AuthService.register({
      email: 'new@test.com',
      password: 'pass123',
      nickname: 'New',
    });

    expect(result).toEqual({ message: '注册成功', user });
    await expect(AsyncStorage.getItem(USER_KEY)).resolves.toEqual(JSON.stringify(user));
    expect(getSecureStore().get(TOKEN_KEY)).toEqual(
      JSON.stringify({ accessToken: 'at', refreshToken: 'rt' }),
    );
  });

  it('throws AuthError when email already registered (409)', async () => {
    mockFetch(mockResponse(false, 409, { message: '邮箱已注册' }));

    await expect(
      AuthService.register({ email: 'dup@test.com', password: 'pass123', nickname: 'Dup' }),
    ).rejects.toThrow('邮箱已注册');
    await expect(
      AuthService.register({ email: 'dup@test.com', password: 'pass123', nickname: 'Dup' }),
    ).rejects.toMatchObject({ status: 409 });
  });
});

// ── login ──

describe('AuthService.login', () => {
  beforeEach(() => {
    (globalThis as any).__DEV__ = true;
    clearAllStores();
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('logs in successfully and stores user + tokens', async () => {
    const user = { id: 'u1', email: 'u@test.com', nickname: 'U', createdAt: '2025-01-01' };
    mockFetch(mockResponse(true, 200, { user }, 'access_token=at; refresh_token=rt'));

    const result = await AuthService.login({ email: 'u@test.com', password: 'pass123' });

    expect(result).toEqual(user);
    await expect(AsyncStorage.getItem(USER_KEY)).resolves.toEqual(JSON.stringify(user));
    expect(getSecureStore().get(TOKEN_KEY)).toEqual(
      JSON.stringify({ accessToken: 'at', refreshToken: 'rt' }),
    );
  });

  it('throws AuthError on wrong password (401)', async () => {
    mockFetch(mockResponse(false, 401, { message: '密码错误' }));

    await expect(AuthService.login({ email: 'u@test.com', password: 'wrong' })).rejects.toThrow(
      '密码错误',
    );
    await expect(
      AuthService.login({ email: 'u@test.com', password: 'wrong' }),
    ).rejects.toMatchObject({ status: 401 });
  });
});

// ── logout ──

describe('AuthService.logout', () => {
  beforeEach(() => {
    (globalThis as any).__DEV__ = true;
    clearAllStores();
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('calls logout endpoint and clears stored credentials', async () => {
    storeTokens('at', 'rt');
    getAsyncStore().set(
      USER_KEY,
      JSON.stringify({ id: 'u1', email: 'u@test.com', nickname: 'U', createdAt: '2025-01-01' }),
    );

    mockFetch(mockResponse(true, 200, {}));

    await AuthService.logout();

    const fetchMock = (globalThis as any).fetch as jest.Mock;
    expect(fetchMock).toHaveBeenCalled();
    const fetchUrl = fetchMock.mock.calls[0][0] as string;
    expect(fetchUrl).toContain('/api/auth/logout');

    expect(getSecureStore().get(TOKEN_KEY)).toBeUndefined();
    await expect(AsyncStorage.getItem(USER_KEY)).resolves.toBeNull();
  });

  it('clears credentials even when logout fetch fails', async () => {
    storeTokens('at', 'rt');
    getAsyncStore().set(
      USER_KEY,
      JSON.stringify({ id: 'u1', email: 'u@test.com', nickname: 'U', createdAt: '2025-01-01' }),
    );

    (globalThis as any).fetch = jest.fn(() => Promise.reject(new Error('Network error')));

    await expect(AuthService.logout()).rejects.toThrow('Network error');

    expect(getSecureStore().get(TOKEN_KEY)).toBeUndefined();
    await expect(AsyncStorage.getItem(USER_KEY)).resolves.toBeNull();
  });
});

// ── getMe ──

describe('AuthService.getMe', () => {
  beforeEach(() => {
    (globalThis as any).__DEV__ = true;
    clearAllStores();
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('returns user on successful getMe', async () => {
    storeTokens();
    const user = { id: 'u1', email: 'u@test.com', nickname: 'Updated', createdAt: '2025-01-01' };
    mockFetch(mockResponse(true, 200, { user }));

    const result = await AuthService.getMe();

    expect(result).toEqual(user);
    await expect(AsyncStorage.getItem(USER_KEY)).resolves.toEqual(JSON.stringify(user));
  });

  it('throws AuthError on 401', async () => {
    storeTokens();
    mockFetch(mockResponse(false, 401, { message: 'Token expired' }));

    await expect(AuthService.getMe()).rejects.toThrow('Token expired');
    await expect(AuthService.getMe()).rejects.toMatchObject({ status: 401 });
  });
});

// ── updateNickname ──

describe('AuthService.updateNickname', () => {
  beforeEach(() => {
    (globalThis as any).__DEV__ = true;
    clearAllStores();
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('updates nickname and stores updated user', async () => {
    storeTokens();
    const user = {
      id: 'u1',
      email: 'u@test.com',
      nickname: 'NewName',
      createdAt: '2025-01-01',
    };
    mockFetch(mockResponse(true, 200, { user }));

    const result = await AuthService.updateNickname({ nickname: 'NewName' });

    expect(result).toEqual(user);
    await expect(AsyncStorage.getItem(USER_KEY)).resolves.toEqual(JSON.stringify(user));

    const fetchMock = (globalThis as any).fetch as jest.Mock;
    expect(fetchMock).toHaveBeenCalled();
    const [, options] = fetchMock.mock.calls[0];
    expect(options.method).toBe('PUT');
    expect(options.body).toBe(JSON.stringify({ nickname: 'NewName' }));
  });
});

// ── changePassword ──

describe('AuthService.changePassword', () => {
  beforeEach(() => {
    (globalThis as any).__DEV__ = true;
    clearAllStores();
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('changes password and clears session', async () => {
    storeTokens();
    getAsyncStore().set(
      USER_KEY,
      JSON.stringify({ id: 'u1', email: 'u@test.com', nickname: 'U', createdAt: '2025-01-01' }),
    );
    mockFetch(mockResponse(true, 200, {}));

    await AuthService.changePassword({ currentPassword: 'old', newPassword: 'new' });

    const fetchMock = (globalThis as any).fetch as jest.Mock;
    expect(fetchMock).toHaveBeenCalled();
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/auth/me/password');
    expect(options.method).toBe('PUT');

    expect(getSecureStore().get(TOKEN_KEY)).toBeUndefined();
    await expect(AsyncStorage.getItem(USER_KEY)).resolves.toBeNull();
  });

  it('throws AuthError on failure and does NOT clear session', async () => {
    storeTokens();
    getAsyncStore().set(
      USER_KEY,
      JSON.stringify({ id: 'u1', email: 'u@test.com', nickname: 'U', createdAt: '2025-01-01' }),
    );
    mockFetch(mockResponse(false, 400, { message: '原密码错误' }));

    await expect(
      AuthService.changePassword({ currentPassword: 'wrong', newPassword: 'new' }),
    ).rejects.toThrow('原密码错误');

    expect(getSecureStore().get(TOKEN_KEY)).toEqual(
      JSON.stringify({ accessToken: 'at', refreshToken: 'rt' }),
    );
    await expect(AsyncStorage.getItem(USER_KEY)).resolves.not.toBeNull();
  });
});

// ── getUsage ──

describe('AuthService.getUsage', () => {
  beforeEach(() => {
    (globalThis as any).__DEV__ = true;
    clearAllStores();
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('returns usage logs', async () => {
    storeTokens();
    const logs = [
      { id: '1', mode: 'chat', inputTokens: 100, outputTokens: 50, createdAt: '2025-01-01' },
    ];
    mockFetch(mockResponse(true, 200, { logs }));

    const result = await AuthService.getUsage();
    expect(result).toEqual(logs);
  });

  it('returns empty array when response has no logs field', async () => {
    storeTokens();
    mockFetch(mockResponse(true, 200, {}));

    const result = await AuthService.getUsage();
    expect(result).toEqual([]);
  });

  it('throws AuthError on failure', async () => {
    storeTokens();
    mockFetch(mockResponse(false, 500, { message: '服务器错误' }));

    await expect(AuthService.getUsage()).rejects.toThrow('服务器错误');
    await expect(AuthService.getUsage()).rejects.toMatchObject({ status: 500 });
  });
});
