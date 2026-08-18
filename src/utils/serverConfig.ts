/**
 * 服务器地址单一来源（M4 修复）
 *
 * 此前 AuthService（resolveApiBaseUrl：dev 5173 / prod gakiwoo.com）、
 * ApiClient（默认 localhost:3000/api）、SyncService（getSyncApiUrl）各自独立
 * 解析服务器地址，ServerSettingsScreen 只修改 ApiClient——同一会话的请求
 * 可能发往不同服务器。统一为：用户配置（AsyncStorage）→ env → 平台默认。
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { resolveApiBaseUrl } from './apiBaseUrl';
import { getEnvVar, isDevMode } from './getEnv';

/** 与 ServerSettingsScreen 共用的存储键 */
export const SERVER_URL_KEY = '@server_settings_url';

function normalize(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

/** 读取用户配置的服务器地址（未配置返回 null） */
export async function getConfiguredBaseUrl(): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(SERVER_URL_KEY);
    return raw && raw.trim() ? normalize(raw) : null;
  } catch {
    return null;
  }
}

/** 保存用户配置的服务器地址（供 ApiClient/AuthService/SyncService 共用） */
export async function saveConfiguredBaseUrl(url: string): Promise<void> {
  await AsyncStorage.setItem(SERVER_URL_KEY, normalize(url));
}

/** 清除用户配置（恢复默认） */
export async function clearConfiguredBaseUrl(): Promise<void> {
  await AsyncStorage.removeItem(SERVER_URL_KEY);
}

/**
 * 解析当前生效的 API 基础地址（不含 /api 前缀的处理由调用方负责）：
 * 1. 用户配置（ServerSettingsScreen）
 * 2. EXPO_PUBLIC_API_BASE_URL 环境变量
 * 3. 平台默认（dev: localhost:5173 / 10.0.2.2:5173；prod: https://gakiwoo.com）
 */
export async function getEffectiveApiBaseUrl(): Promise<string> {
  const configured = await getConfiguredBaseUrl();
  if (configured) return configured;
  const envUrl = getEnvVar('EXPO_PUBLIC_API_BASE_URL');
  if (envUrl && envUrl.trim()) return normalize(envUrl);
  return resolveApiBaseUrl({ isDev: isDevMode(), platformOS: Platform.OS });
}
