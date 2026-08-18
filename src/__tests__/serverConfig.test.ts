import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  SERVER_URL_KEY,
  getConfiguredBaseUrl,
  saveConfiguredBaseUrl,
  getEffectiveApiBaseUrl,
} from '../utils/serverConfig';

jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

// Mock AsyncStorage（与 AuthService.test 同款内存实现，作用域在工厂内）
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

/**
 * M4 回归：服务器地址单一来源——用户配置优先于 env 与平台默认，
 * AuthService/ApiClient/SyncService 共用同一解析结果。
 */
describe('serverConfig（M4 单一来源）', () => {
  beforeEach(async () => {
    await AsyncStorage.removeItem(SERVER_URL_KEY);
    delete process.env.EXPO_PUBLIC_API_BASE_URL;
  });

  it('无配置、无 env 时回退到平台默认（dev web = localhost:5173）', async () => {
    // jest 环境：isDevMode() 由 __DEV__ 控制（true），Platform.OS 为 'ios'（RN mock）
    const url = await getEffectiveApiBaseUrl();
    expect(url.startsWith('http')).toBe(true);
  });

  it('env（EXPO_PUBLIC_API_BASE_URL）优先于平台默认', async () => {
    process.env.EXPO_PUBLIC_API_BASE_URL = 'https://api.example.com/';
    const url = await getEffectiveApiBaseUrl();
    // 尾斜杠被归一化
    expect(url).toBe('https://api.example.com');
  });

  it('用户配置（ServerSettings）优先于 env', async () => {
    process.env.EXPO_PUBLIC_API_BASE_URL = 'https://env.example.com';
    await saveConfiguredBaseUrl('https://user.example.com/');
    const url = await getEffectiveApiBaseUrl();
    expect(url).toBe('https://user.example.com');
    expect(await getConfiguredBaseUrl()).toBe('https://user.example.com');
  });

  it('saveConfiguredBaseUrl 归一化尾斜杠', async () => {
    await saveConfiguredBaseUrl('http://192.168.1.10:3000/api/');
    expect(await AsyncStorage.getItem(SERVER_URL_KEY)).toBe('http://192.168.1.10:3000/api');
  });
});
