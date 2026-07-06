import { useState, useCallback, useEffect, useRef } from 'react';
import type { WebView, WebViewMessageEvent } from 'react-native-webview';
import {
  buildBlobAppendScript,
  buildBlobBeginScript,
  buildBlobCommitScript,
  buildRegisterBlobScript,
  buildWebViewCleanupScript,
  splitBase64IntoChunks,
  ONE_SHOT_BLOB_THRESHOLD,
} from '../utils/webViewAssetInjection';
import { mediaPipeAssetService } from '../services/MediaPipeAssetService';
import { performanceMonitor } from '../services/PerformanceMonitor';
import {
  BLOB_ACK_TIMEOUT_MS,
  MEDIAPIPE_INIT_TIMEOUT_MS,
  WEBVIEW_MESSAGE_TYPES,
  buildRuntimeControlScript,
  parseWebViewMessage,
} from '../mediapipe/mediapipeBridge';
import { Pose } from '../types';
import { AdaptivePoseRuntime } from '../utils/adaptivePoseRuntime';

type CameraState = 'idle' | 'loading' | 'ready' | 'error';
type WebViewBridge = Pick<WebView, 'injectJavaScript'> & Partial<Pick<WebView, 'reload'>>;
type BlobAckWaiter = {
  resolve: () => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

interface UseWebViewMessageHandlerOptions {
  onPoseDetected: (pose: Pose) => void;
  onAdaptiveIntervalChange?: (intervalMs: number) => void;
  onReady?: () => void;
  onError?: (message: string) => void;
  onCdnStatus?: (message: string) => void;
  adaptiveRuntimeRef?: React.MutableRefObject<AdaptivePoseRuntime>;
}

interface UseWebViewMessageHandlerReturn {
  cameraState: CameraState;
  errorMessage: string;
  loadingDetail: string;
  injectionDoneRef: React.MutableRefObject<boolean>;
  handleLoadEnd: (
    injectionDoneRef: React.MutableRefObject<boolean>,
    injectLocalFiles: () => Promise<void>,
  ) => void;
  handleMessage: (event: WebViewMessageEvent) => void;
  handleReload: () => void;
  injectBlobFile: (webView: WebViewBridge) => Promise<void>;
  injectRuntimeControls: (
    webView: WebViewBridge,
    options: {
      isActive: boolean;
      modelComplexity: number;
      throttleMs: number;
      previewThrottleMs: number;
      enablePreviewPose: boolean;
    },
  ) => void;
  rejectPendingBlobAcks: (reason: string) => void;
  webViewRef: React.RefObject<WebView | null>;
}

export function useWebViewMessageHandler(
  options: UseWebViewMessageHandlerOptions,
): UseWebViewMessageHandlerReturn {
  const [cameraState, setCameraState] = useState<CameraState>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [loadingDetail, setLoadingDetail] = useState<string>('准备中...');

  const webViewRef = useRef<WebView | null>(null);
  const isMountedRef = useRef(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cameraStateRef = useRef<CameraState>('idle');
  const injectionDoneRef = useRef(false);
  const blobAckWaitersRef = useRef<Map<string, BlobAckWaiter>>(new Map());
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    cameraStateRef.current = cameraState;
  }, [cameraState]);

  const waitForBlobAck = useCallback((filename: string): Promise<void> => {
    const previous = blobAckWaitersRef.current.get(filename);
    if (previous) {
      clearTimeout(previous.timer);
      previous.reject(new Error(`Superseded blob transfer: ${filename}`));
    }

    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        blobAckWaitersRef.current.delete(filename);
        reject(new Error(`Timed out waiting for blob ack: ${filename}`));
      }, BLOB_ACK_TIMEOUT_MS);

      blobAckWaitersRef.current.set(filename, { resolve, reject, timer });
    });
  }, []);

  const rejectPendingBlobAcks = useCallback((reason: string) => {
    blobAckWaitersRef.current.forEach((waiter) => {
      clearTimeout(waiter.timer);
      waiter.reject(new Error(reason));
    });
    blobAckWaitersRef.current.clear();
  }, []);

  const injectBlobFile = useCallback(
    async (webView: WebViewBridge): Promise<void> => {
      try {
        const files = mediaPipeAssetService.getFiles();

        for (const filename of files) {
          const base64 = await mediaPipeAssetService.getFileBase64(filename);
          const mimeType = mediaPipeAssetService.getMimeType(filename);

          const ackPromise = waitForBlobAck(filename);

          // 小文件一次性注入，大文件增大分块减少 injectJavaScript 调用次数
          if (base64.length < ONE_SHOT_BLOB_THRESHOLD) {
            // 小于 500KB base64 的 JS/小文件 → 一键注册 blob
            webView.injectJavaScript(buildRegisterBlobScript(filename, base64, mimeType));
          } else {
            // .wasm / .tflite 等大文件 → 512KB 分块（原来是 64KB）
            webView.injectJavaScript(buildBlobBeginScript(filename, mimeType));
            for (const chunk of splitBase64IntoChunks(base64, 512 * 1024)) {
              webView.injectJavaScript(buildBlobAppendScript(filename, chunk));
            }
            webView.injectJavaScript(buildBlobCommitScript(filename));
          }

          await ackPromise;
        }

        webView.injectJavaScript('init();true;');
        injectionDoneRef.current = true;
      } catch (err) {
        console.warn('[CameraView] Local injection failed, falling back to CDN:', err);
        rejectPendingBlobAcks('Local MediaPipe injection failed');
        try {
          webView.injectJavaScript('init();true;');
        } catch {
          // WebView 可能在卸载过程中，忽略 inject 异常
        }
        injectionDoneRef.current = true;
      } finally {
        mediaPipeAssetService.clearMemoryCache();
      }
    },
    [waitForBlobAck, rejectPendingBlobAcks],
  );

  const startTimeout = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        console.warn('[CameraView] Initialization timeout (30s)');
        setErrorMessage(
          '初始化超时，请检查网络连接后重试。可能原因：模型文件未正确缓存或WebView初始化失败。',
        );
        setCameraState('error');
      }
    }, MEDIAPIPE_INIT_TIMEOUT_MS);
  }, []);

  const applyAdaptiveInterval = useCallback((nextInterval: number) => {
    optionsRef.current.onAdaptiveIntervalChange?.(nextInterval);
  }, []);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      const message = parseWebViewMessage(event.nativeEvent.data);
      if (!message) return;

      switch (message.type) {
        case WEBVIEW_MESSAGE_TYPES.BLOB_ACK: {
          const filename = String(message.data?.filename || '');
          const waiter = blobAckWaitersRef.current.get(filename);
          if (waiter) {
            blobAckWaitersRef.current.delete(filename);
            clearTimeout(waiter.timer);
            if (message.data?.ok) {
              waiter.resolve();
            } else {
              waiter.reject(
                new Error(String(message.data?.error || `Blob transfer failed: ${filename}`)),
              );
            }
          }
          break;
        }
        case WEBVIEW_MESSAGE_TYPES.POSE:
          if (message.data) {
            optionsRef.current.onPoseDetected?.(message.data);
          }
          break;
        case WEBVIEW_MESSAGE_TYPES.PERF: {
          const inferenceMs = Number(message.data?.inferenceMs);
          const sampleIsActive = Boolean(message.data?.isActive);
          if (Number.isFinite(inferenceMs)) {
            performanceMonitor.recordFrame(inferenceMs, sampleIsActive);
          }
          if (Number.isFinite(inferenceMs) && optionsRef.current.adaptiveRuntimeRef?.current) {
            const nextInterval = optionsRef.current.adaptiveRuntimeRef.current.recordSample({
              inferenceMs,
              isActive: sampleIsActive,
            });
            applyAdaptiveInterval(nextInterval);
          }
          break;
        }
        case WEBVIEW_MESSAGE_TYPES.READY:
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
          mediaPipeAssetService.clearMemoryCache();
          if (isMountedRef.current) setCameraState('ready');
          optionsRef.current.onReady?.();
          break;
        case WEBVIEW_MESSAGE_TYPES.ERROR:
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
          mediaPipeAssetService.clearMemoryCache();
          console.warn('[CameraView] MediaPipe error:', message.data);
          if (isMountedRef.current) {
            setErrorMessage(String(message.data || '未知错误'));
            setCameraState('error');
            optionsRef.current.onError?.(String(message.data || '未知错误'));
          }
          break;
        case WEBVIEW_MESSAGE_TYPES.CDN_STATUS:
          if (isMountedRef.current && cameraStateRef.current === 'loading') {
            setLoadingDetail(String(message.data || ''));
            optionsRef.current.onCdnStatus?.(String(message.data || ''));
          }
          break;
        case WEBVIEW_MESSAGE_TYPES.LOG:
          if (__DEV__) {
            // eslint-disable-next-line no-console
            console.log('[CameraView]', message.data);
          }
          break;
      }
    },
    [applyAdaptiveInterval],
  );

  const handleLoadEnd = useCallback(
    (injectionDone: React.MutableRefObject<boolean>, injectLocalFiles: () => Promise<void>) => {
      if (injectionDone.current) return;

      startTimeout();
      injectLocalFiles();
    },
    [startTimeout],
  );

  const handleReload = useCallback(() => {
    setErrorMessage('');
    setLoadingDetail('重新加载中...');
    setCameraState('loading');
    injectionDoneRef.current = false;
    startTimeout();
    webViewRef.current?.reload?.();
  }, [startTimeout]);

  const injectRuntimeControls = useCallback(
    (
      webView: WebViewBridge,
      config: {
        isActive: boolean;
        modelComplexity: number;
        throttleMs: number;
        previewThrottleMs: number;
        enablePreviewPose: boolean;
      },
    ) => {
      webView.injectJavaScript(buildRuntimeControlScript(config));
    },
    [],
  );

  useEffect(() => {
    const webView = webViewRef.current;
    return () => {
      isMountedRef.current = false;
      if (webView) {
        try {
          webView.injectJavaScript(buildWebViewCleanupScript());
        } catch {
          // WebView 可能在卸载过程中已销毁，忽略 inject 异常
        }
      }
      rejectPendingBlobAcks('Hook unmounted');
      mediaPipeAssetService.clearMemoryCache();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [rejectPendingBlobAcks]);

  return {
    cameraState,
    errorMessage,
    loadingDetail,
    injectionDoneRef,
    handleLoadEnd,
    handleMessage,
    handleReload,
    injectBlobFile,
    injectRuntimeControls,
    rejectPendingBlobAcks,
    webViewRef,
  };
}
