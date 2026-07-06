import { Pose } from '../types';

/** WebView → React Native 消息类型 */
export const WEBVIEW_MESSAGE_TYPES = {
  BLOB_ACK: 'blobAck',
  POSE: 'pose',
  PERF: 'perf',
  READY: 'ready',
  ERROR: 'error',
  CDN_STATUS: 'cdnStatus',
  LOG: 'log',
} as const;

/** React Native → WebView（window.postMessage）控制类型 */
export const RUNTIME_CONTROL_TYPES = {
  SET_MODEL_CONFIG: 'setModelConfig',
  SET_THROTTLE: 'setThrottle',
  SET_PREVIEW_THROTTLE: 'setPreviewThrottle',
  SET_SMOOTH_LANDMARKS: 'setSmoothLandmarks',
  SET_ACTIVE: 'setActive',
} as const;

export type WebViewMessageType = (typeof WEBVIEW_MESSAGE_TYPES)[keyof typeof WEBVIEW_MESSAGE_TYPES];

export const BLOB_ACK_TIMEOUT_MS = 30_000;
export const MEDIAPIPE_INIT_TIMEOUT_MS = 30_000;

export interface BlobAckPayload {
  filename: string;
  ok: boolean;
  error?: string;
}

export interface PerfPayload {
  inferenceMs?: number;
  isActive?: boolean;
}

export type WebViewToNativeMessage =
  | { type: typeof WEBVIEW_MESSAGE_TYPES.BLOB_ACK; data: BlobAckPayload }
  | { type: typeof WEBVIEW_MESSAGE_TYPES.POSE; data: Pose }
  | { type: typeof WEBVIEW_MESSAGE_TYPES.PERF; data: PerfPayload }
  | { type: typeof WEBVIEW_MESSAGE_TYPES.READY; data?: unknown }
  | { type: typeof WEBVIEW_MESSAGE_TYPES.ERROR; data?: string }
  | { type: typeof WEBVIEW_MESSAGE_TYPES.CDN_STATUS; data?: string }
  | { type: typeof WEBVIEW_MESSAGE_TYPES.LOG; data?: string };

export interface RuntimeControlConfig {
  isActive: boolean;
  modelComplexity: number;
  throttleMs: number;
  previewThrottleMs: number;
  enablePreviewPose: boolean;
}

const WEBVIEW_MESSAGE_TYPE_SET = new Set<string>(Object.values(WEBVIEW_MESSAGE_TYPES));

/** 解析 WebView postMessage 载荷；无效 JSON 或非协议消息返回 null */
export function parseWebViewMessage(raw: string): WebViewToNativeMessage | null {
  try {
    const parsed = JSON.parse(raw) as { type?: string; data?: unknown };
    if (!parsed?.type || !WEBVIEW_MESSAGE_TYPE_SET.has(parsed.type)) {
      return null;
    }
    return parsed as WebViewToNativeMessage;
  } catch {
    return null;
  }
}

/** 生成注入 WebView 的运行时控制脚本 */
export function buildRuntimeControlScript(config: RuntimeControlConfig): string {
  const parts = [
    JSON.stringify({
      type: RUNTIME_CONTROL_TYPES.SET_MODEL_CONFIG,
      modelComplexity: config.modelComplexity,
    }),
    JSON.stringify({
      type: RUNTIME_CONTROL_TYPES.SET_THROTTLE,
      interval: config.throttleMs,
    }),
    JSON.stringify({
      type: RUNTIME_CONTROL_TYPES.SET_PREVIEW_THROTTLE,
      interval: config.previewThrottleMs,
    }),
    JSON.stringify({
      type: RUNTIME_CONTROL_TYPES.SET_SMOOTH_LANDMARKS,
      enabled: false,
    }),
    JSON.stringify({
      type: RUNTIME_CONTROL_TYPES.SET_ACTIVE,
      active: config.isActive,
      preview: config.enablePreviewPose,
    }),
  ];
  return parts.map((payload) => `window.postMessage(${payload}, "*");`).join('') + 'true;';
}
