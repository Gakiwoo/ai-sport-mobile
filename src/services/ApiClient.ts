/**
 * API Client for AI Sport System NestJS backend.
 * React Native compatible — uses fetch API.
 *
 * P1-11 修复：token 与 AuthService（SecureStore）统一——
 * 此前 ApiClient 只持有内存 token，正常登录（AuthService 写 SecureStore）后
 * apiClient 仍无 token，pullWorkouts 必 401。现在内存缺失时回退读取 SecureStore，
 * 刷新走 AuthService.refreshToken 并写回，login 成功也同步持久化。
 */

import AuthService from './AuthService';
import { getEffectiveApiBaseUrl, saveConfiguredBaseUrl } from '../utils/serverConfig';
import type { WorkoutSession } from '../types';

interface ApiConfig {
  baseUrl: string;
  timeout?: number;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface ApiError {
  statusCode: number;
  message: string;
  error?: string;
}

const DEFAULT_CONFIG: ApiConfig = {
  baseUrl: '', // 空 = 使用单一来源（getEffectiveApiBaseUrl：用户配置 → env → 平台默认）
  timeout: 15000,
};

export class ApiClient {
  private config: ApiConfig;
  private tokens: AuthTokens | null = null;
  private refreshPromise: Promise<AuthTokens | null> | null = null;

  constructor(config?: Partial<ApiConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  setBaseUrl(url: string) {
    this.config.baseUrl = url;
    // M4：持久化到单一来源（AuthService/SyncService 同步生效）
    void saveConfiguredBaseUrl(url).catch(() => {});
  }

  setTokens(tokens: AuthTokens | null) {
    this.tokens = tokens;
  }

  getTokens(): AuthTokens | null {
    return this.tokens;
  }

  private async request<T>(method: string, path: string, body?: unknown, retry = true): Promise<T> {
    // M4：请求地址与 AuthService/SyncService 共用单一来源（用户配置 → env → 平台默认）
    const baseUrl =
      this.config.baseUrl && this.config.baseUrl.startsWith('http')
        ? this.config.baseUrl
        : await getEffectiveApiBaseUrl();
    const url = `${baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const tokens = await this.ensureTokens();
    if (tokens?.accessToken) {
      headers['Authorization'] = `Bearer ${tokens.accessToken}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout ?? 15000);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (response.status === 401 && retry && tokens?.refreshToken) {
        const newTokens = await this.refreshTokens();
        if (newTokens) {
          return this.request<T>(method, path, body, false);
        }
      }

      if (!response.ok) {
        const error = (await response.json().catch(() => ({
          statusCode: response.status,
          message: response.statusText,
        }))) as ApiError;
        throw new ApiRequestError(error.statusCode, error.message, error.error);
      }

      if (response.status === 204) {
        return undefined as T;
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * P1-11：内存 token 缺失时从 SecureStore（AuthService）恢复，
   * 使 ApiClient 与主登录链路共享同一会话。
   */
  private async ensureTokens(): Promise<AuthTokens | null> {
    if (this.tokens?.accessToken && this.tokens.refreshToken) return this.tokens;
    const accessToken = await AuthService.getAccessToken();
    const refreshToken = await AuthService.getRefreshToken();
    if (accessToken && refreshToken) {
      this.tokens = { accessToken, refreshToken };
      return this.tokens;
    }
    return this.tokens;
  }

  private async refreshTokens(): Promise<AuthTokens | null> {
    const tokens = await this.ensureTokens();
    if (!tokens?.refreshToken) return null;

    // 与 AuthService 共享刷新链路（旋转后写回 SecureStore），并发去重
    if (!this.refreshPromise) {
      this.refreshPromise = AuthService.refreshSession(tokens.refreshToken).then(
        (result: AuthTokens | null) => {
          if (result) {
            this.tokens = result;
          }
          return result;
        },
      );
    }

    try {
      return await this.refreshPromise;
    } catch {
      this.tokens = null;
      return null;
    } finally {
      this.refreshPromise = null;
    }
  }

  // Auth
  async login(username: string, password: string) {
    const result = await this.request<{
      accessToken: string;
      refreshToken: string;
      user: { id: number; username: string; role: string };
    }>('POST', '/auth/login', { username, password });
    this.tokens = { accessToken: result.accessToken, refreshToken: result.refreshToken };
    // P1-11：登录成功后同步写入 SecureStore，与 AuthService 共享会话
    await AuthService.persistTokens(this.tokens);
    return result;
  }

  async register(username: string, password: string, role?: string, displayName?: string) {
    return this.request<{ id: number; username: string; role: string }>('POST', '/auth/register', {
      username,
      password,
      role,
      displayName,
    });
  }

  async getProfile() {
    return this.request<{
      id: number;
      username: string;
      email: string;
      role: string;
      display_name: string;
    }>('GET', '/auth/me');
  }

  // Workouts
  async syncWorkouts(workouts: Array<Record<string, unknown>>) {
    return this.request<{ synced: string[]; conflicts: string[] }>('POST', '/workouts/sync', {
      workouts,
    });
  }

  async pullWorkouts(since?: string) {
    const query = since ? `?since=${encodeURIComponent(since)}` : '';
    return this.request<{ records: WorkoutSession[]; total: number }>(
      'GET',
      `/workouts/sync${query}`,
    );
  }

  async getWorkoutStats() {
    return this.request<{ total: number; byExercise: Array<Record<string, unknown>> }>(
      'GET',
      '/workouts/stats',
    );
  }

  // Pilot
  async listSchools() {
    return this.request<Array<Record<string, unknown>>>('GET', '/pilot/schools');
  }

  async listClassrooms(schoolId?: string) {
    const query = schoolId ? `?schoolId=${encodeURIComponent(schoolId)}` : '';
    return this.request<Array<Record<string, unknown>>>('GET', `/pilot/classrooms${query}`);
  }

  async listStudents(classId?: string) {
    const query = classId ? `?classId=${encodeURIComponent(classId)}` : '';
    return this.request<Array<Record<string, unknown>>>('GET', `/pilot/students${query}`);
  }

  async listTasks(classId?: string) {
    const query = classId ? `?classId=${encodeURIComponent(classId)}` : '';
    return this.request<Array<Record<string, unknown>>>('GET', `/pilot/tasks${query}`);
  }

  async getTaskResults(taskId: string) {
    return this.request<Record<string, unknown>>('GET', `/pilot/tasks/${taskId}/results`);
  }

  // Reports
  async getClassSummary(classId: string, exerciseType?: string) {
    const params = new URLSearchParams({ classId });
    if (exerciseType) params.set('exerciseType', exerciseType);
    return this.request<Record<string, unknown>>('GET', `/reports/class-summary?${params}`);
  }

  async getStudentProgress(studentId: string, exerciseType?: string) {
    const params = new URLSearchParams({ studentId });
    if (exerciseType) params.set('exerciseType', exerciseType);
    return this.request<Record<string, unknown>>('GET', `/reports/student-progress?${params}`);
  }
}

export class ApiRequestError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public errorType?: string,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

/** Singleton instance */
export const apiClient = new ApiClient();
