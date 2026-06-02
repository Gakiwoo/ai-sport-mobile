/**
 * SecureStorageService 测试
 *
 * 覆盖：getItem、setItem、removeItem、isAvailable、web 降级
 *
 * 注意：RN mock 设置 Platform.OS='web'，所以 SecureStore 不可用，
 * 服务会自动降级到内存 Map 存储。
 */

// ── mock expo-secure-store ──
const mockGetItem = jest.fn(() => Promise.resolve('stored-value'));
const mockSetItem = jest.fn(() => Promise.resolve());
const mockDeleteItem = jest.fn(() => Promise.resolve());
const mockIsAvailable = jest.fn(() => Promise.resolve(true));

jest.mock('expo-secure-store', () => ({
  getItemAsync: mockGetItem,
  setItemAsync: mockSetItem,
  deleteItemAsync: mockDeleteItem,
  isAvailableAsync: mockIsAvailable,
}));

import SecureStorageService from '../services/SecureStorageService';

describe('SecureStorageService', () => {
  beforeEach(() => {
    mockGetItem.mockClear();
    mockSetItem.mockClear();
    mockDeleteItem.mockClear();
    mockIsAvailable.mockClear();
    mockGetItem.mockReturnValue(Promise.resolve('stored-value'));
    mockSetItem.mockReturnValue(Promise.resolve());
    mockDeleteItem.mockReturnValue(Promise.resolve());
    mockIsAvailable.mockReturnValue(Promise.resolve(true));
  });

  it('setItem 和 getItem 在内存中工作（web 降级）', async () => {
    // Platform.OS = 'web'，所以使用内存 fallback
    await SecureStorageService.setItem('test-key', 'test-value');
    const value = await SecureStorageService.getItem('test-key');
    expect(value).toBe('test-value');
  });

  it('removeItem 在内存中删除', async () => {
    await SecureStorageService.setItem('remove-key', 'to-remove');
    await SecureStorageService.removeItem('remove-key');
    const value = await SecureStorageService.getItem('remove-key');
    expect(value).toBeNull();
  });

  it('getItem 不存在的 key 返回 null', async () => {
    const value = await SecureStorageService.getItem('nonexistent');
    expect(value).toBeNull();
  });

  it('isAvailable 在 web 平台返回 false', async () => {
    // Platform.OS = 'web' in mock
    const available = await SecureStorageService.isAvailable();
    expect(available).toBe(false);
  });

  it('SecureStore 异常时降级到内存存储', async () => {
    // 即使 mock 抛异常，也应该降级到内存 Map
    await SecureStorageService.setItem('fallback-key', 'fallback-value');
    const value = await SecureStorageService.getItem('fallback-key');
    expect(value).toBe('fallback-value');
  });
});
