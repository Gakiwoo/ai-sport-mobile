import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * 安全存储服务 — 封装 expo-secure-store
 *
 * 用于存储敏感数据（Token、密钥等），替代 AsyncStorage。
 * - Android/iOS: 使用系统 Keychain/Keystore 加密存储
 * - Web: 降级到 sessionStorage（不持久化，仅用于开发）
 */
let fallbackStore: Map<string, string> | null = null;

function getFallback(): Map<string, string> {
  if (!fallbackStore) {
    fallbackStore = new Map();
  }
  return fallbackStore;
}

function isSecureStoreAvailable(): boolean {
  // Web 不支持 SecureStore
  if (Platform.OS === 'web') return false;
  // Expo Go 中 SecureStore 可用
  return true;
}

const SecureStorageService = {
  async getItem(key: string): Promise<string | null> {
    try {
      if (isSecureStoreAvailable()) {
        return await SecureStore.getItemAsync(key);
      }
      return getFallback().get(key) ?? null;
    } catch {
      // 降级到内存
      return getFallback().get(key) ?? null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      if (isSecureStoreAvailable()) {
        await SecureStore.setItemAsync(key, value);
      } else {
        getFallback().set(key, value);
      }
    } catch {
      // 降级到内存
      getFallback().set(key, value);
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      if (isSecureStoreAvailable()) {
        await SecureStore.deleteItemAsync(key);
      }
      getFallback().delete(key);
    } catch {
      getFallback().delete(key);
    }
  },

  /** 检查安全存储是否可用 */
  async isAvailable(): Promise<boolean> {
    try {
      if (Platform.OS === 'web') return false;
      return await SecureStore.isAvailableAsync();
    } catch {
      return false;
    }
  },
};

export default SecureStorageService;
