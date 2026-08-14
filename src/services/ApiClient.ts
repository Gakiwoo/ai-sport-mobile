/**
 * API Client for AI Sport System NestJS backend.
 * React Native compatible — uses fetch API and in-memory token storage.
 */

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
  baseUrl: 'http://localhost:3000/api',
  timeout: 15000,
};

export class ApiClient {
  private config: ApiConfig;
  private tokens: AuthTokens | null = null;
  private refreshPromise: Promise<AuthTokens> | null = null;

  constructor(config?: Partial<ApiConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  setBaseUrl(url: string) {
    this.config.baseUrl = url;
  }

  setTokens(tokens: AuthTokens | null) {
    this.tokens = tokens;
  }

  getTokens(): AuthTokens | null {
    return this.tokens;
  }

  private async request<T>(method: string, path: string, body?: unknown, retry = true): Promise<T> {
    const url = `${this.config.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.tokens?.accessToken) {
      headers['Authorization'] = `Bearer ${this.tokens.accessToken}`;
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

      if (response.status === 401 && retry && this.tokens?.refreshToken) {
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

  private async refreshTokens(): Promise<AuthTokens | null> {
    if (!this.tokens?.refreshToken) return null;

    if (!this.refreshPromise) {
      this.refreshPromise = this.doRefresh();
    }

    try {
      const tokens = await this.refreshPromise;
      this.tokens = tokens;
      return tokens;
    } catch {
      this.tokens = null;
      return null;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async doRefresh(): Promise<AuthTokens> {
    const response = await fetch(`${this.config.baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: this.tokens!.refreshToken }),
    });

    if (!response.ok) {
      throw new Error('Token refresh failed');
    }

    const data = await response.json();
    return {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
    };
  }

  // Auth
  async login(username: string, password: string) {
    const result = await this.request<{
      accessToken: string;
      refreshToken: string;
      user: { id: number; username: string; role: string };
    }>('POST', '/auth/login', { username, password });
    this.tokens = { accessToken: result.accessToken, refreshToken: result.refreshToken };
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
