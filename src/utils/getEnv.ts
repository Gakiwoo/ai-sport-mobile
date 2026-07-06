/**
 * 安全读取 Expo 环境变量与开发模式标志
 *
 * 统一 globalThis 类型断言，避免在 AuthService / SyncService / MediaPipeAssetService 等多个服务中重复声明。
 */

/**
 * 读取 process.env 中指定 key 的值
 */
export function getEnvVar(key: string): string | undefined {
  const env = (
    globalThis as unknown as {
      process?: { env?: Record<string, string | undefined> };
    }
  ).process?.env;
  return env?.[key];
}

/**
 * 是否处于开发模式（__DEV__ 全局标志）
 */
export function isDevMode(): boolean {
  return (globalThis as unknown as { __DEV__?: boolean }).__DEV__ ?? false;
}
