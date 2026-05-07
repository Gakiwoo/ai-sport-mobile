import { useState, useCallback, useEffect, useRef } from 'react';
import { WebViewMessageEvent } from 'react-native-webview';
import {
  buildBlobAppendScript,
  buildBlobBeginScript,
  buildBlobCommitScript,
  buildWebViewCleanupScript,
  splitBase64IntoChunks,
} from '../utils/webViewAssetInjection';
import { mediaPipeAssetService } from '../services/MediaPipeAssetService';

type CameraState = 'idle' | 'loading' | 'ready' | 'error';
type BlobAckWaiter = {
  resolve: () => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

interface UseWebViewMessageHandlerOptions {
  onPoseDetected: (pose: any) => void;
  onAdaptiveIntervalChange?: (intervalMs: number) => void;
  onReady?: () => void;
  onError?: (message: string) => void;
  onCdnStatus?: (message: string) => void;
  adaptiveRuntimeRef?: React.MutableRefObject<any>;
}

interface UseWebViewMessageHandlerReturn {
  cameraState: CameraState;
  errorMessage: string;
  loadingDetail: string;
  handleLoadEnd: (injectionDoneRef: React.MutableRefObject<boolean>, injectLocalFiles: () => Promise<void>) => void;
  handleMessage: (event: WebViewMessageEvent) => void;
  handleReload: () => void;
  injectBlobFile: (webView: any) => Promise<void>;
  injectRuntimeControls: (webView: any, options: { isActive: boolean; modelComplexity: number; throttleMs: number; previewThrottleMs: number; enablePreviewPose: boolean }) => void;
  rejectPendingBlobAcks: (reason: string) => void;
  webViewRef: React.RefObject<any>;
}

const BLOB_ACK_TIMEOUT_MS = 15000;

export function useWebViewMessageHandler(
  options: UseWebViewMessageHandlerOptions
): UseWebViewMessageHandlerReturn {
  const [cameraState, setCameraState] = useState<CameraState>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [loadingDetail, setLoadingDetail] = useState<string>('准备中...');
  
  const webViewRef = useRef<any>(null);
  const isMountedRef = useRef(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cameraStateRef = useRef<CameraState>('idle');
  const injectionDoneRef = useRef(false);
  const blobAckWaitersRef = useRef<Map<string, BlobAckWaiter>>(new Map());

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

  const injectBlobFile = useCallback(async (webView: any): Promise<void> => {
    try {
      const files = mediaPipeAssetService.getFiles();

      for (const filename of files) {
        if (filename === 'pose.js') continue;
        const base64 = await mediaPipeAssetService.getFileBase64(filename);
        const mimeType = mediaPipeAssetService.getMimeType(filename);
        
        const ackPromise = waitForBlobAck(filename);
        webView.injectJavaScript(buildBlobBeginScript(filename, mimeType));
        for (const chunk of splitBase64IntoChunks(base64)) {
          webView.injectJavaScript(buildBlobAppendScript(filename, chunk));
        }
        webView.injectJavaScript(buildBlobCommitScript(filename));
        await ackPromise;
      }

      try {
        const poseJsBase64 = await mediaPipeAssetService.getFileBase64('pose.js');
        webView.injectJavaScript(
          'window.__evalPoseJs(' + JSON.stringify(poseJsBase64) + ');true;'
        );
      } catch (err) {
        console.warn('[CameraView] Failed to inject pose.js:', err);
        throw err;
      }

      webView.injectJavaScript('init();true;');
      injectionDoneRef.current = true;
    } catch (err) {
      console.warn('[CameraView] Local injection failed, falling back to CDN:', err);
      rejectPendingBlobAcks('Local MediaPipe injection failed');
      webView.injectJavaScript('init();true;');
      injectionDoneRef.current = true;
    } finally {
      mediaPipeAssetService.clearMemoryCache();
    }
  }, [waitForBlobAck]);

  const rejectPendingBlobAcks = useCallback((reason: string) => {
    blobAckWaitersRef.current.forEach((waiter) => {
      clearTimeout(waiter.timer);
      waiter.reject(new Error(reason));
    });
    blobAckWaitersRef.current.clear();
  }, []);

  const startTimeout = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        console.warn('[CameraView] Initialization timeout (30s)');
        setErrorMessage('初始化超时，请检查网络连接后重试。可能原因：模型文件未正确缓存或WebView初始化失败。');
        setCameraState('error');
      }
    }, 30000);
  }, []);

  const applyAdaptiveInterval = useCallback((nextInterval: number) => {
    if (options.onAdaptiveIntervalChange) {
      options.onAdaptiveIntervalChange(nextInterval);
    }
  }, [options]);

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      switch (message.type) {
        case 'blobAck': {
          const filename = String(message.data?.filename || '');
          const waiter = blobAckWaitersRef.current.get(filename);
          if (waiter) {
            blobAckWaitersRef.current.delete(filename);
            clearTimeout(waiter.timer);
            if (message.data?.ok) {
              waiter.resolve();
            } else {
              waiter.reject(new Error(String(message.data?.error || `Blob transfer failed: ${filename}`)));
            }
          }
          break;
        }
        case 'pose':
          if (message.data) {
            options.onPoseDetected?.(message.data);
          }
          break;
        case 'perf': {
          const inferenceMs = Number(message.data?.inferenceMs);
          const sampleIsActive = Boolean(message.data?.isActive);
          if (Number.isFinite(inferenceMs) && options.adaptiveRuntimeRef?.current) {
            const nextInterval = options.adaptiveRuntimeRef.current.recordSample({
              inferenceMs,
              isActive: sampleIsActive,
            });
            applyAdaptiveInterval(nextInterval);
          }
          break;
        }
        case 'ready':
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
          mediaPipeAssetService.clearMemoryCache();
          if (isMountedRef.current) setCameraState('ready');
          options.onReady?.();
          break;
        case 'error':
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
          mediaPipeAssetService.clearMemoryCache();
          console.warn('[CameraView] MediaPipe error:', message.data);
          if (isMountedRef.current) {
            setErrorMessage(String(message.data || '未知错误'));
            setCameraState('error');
            options.onError?.(String(message.data || '未知错误'));
          }
          break;
        case 'cdnStatus':
          if (isMountedRef.current && cameraStateRef.current === 'loading') {
            setLoadingDetail(String(message.data || ''));
            options.onCdnStatus?.(String(message.data || ''));
          }
          break;
        case 'log':
          console.log('[CameraView]', message.data);
          break;
      }
    } catch (err) {
      // 忽略非 JSON 消息
    }
  }, [options, applyAdaptiveInterval]);

  const handleLoadEnd = useCallback((
    injectionDone: React.MutableRefObject<boolean>,
    injectLocalFiles: () => Promise<void>
  ) => {
    if (injectionDone.current) return;

    startTimeout();
    injectLocalFiles();
  }, [startTimeout]);

  const handleReload = useCallback(() => {
    setErrorMessage('');
    setLoadingDetail('重新加载中...');
    setCameraState('loading');
    injectionDoneRef.current = false;
    startTimeout();
    webViewRef.current?.reload();
  }, [startTimeout]);

  const injectRuntimeControls = useCallback((
    webView: any,
    config: {
      isActive: boolean;
      modelComplexity: number;
      throttleMs: number;
      previewThrottleMs: number;
      enablePreviewPose: boolean;
    }
  ) => {
    webView?.injectJavaScript(
      'window.postMessage(JSON.stringify({type:"setModelConfig",modelComplexity:' + config.modelComplexity + '}), "*");' +
      'window.postMessage(JSON.stringify({type:"setThrottle",interval:' + config.throttleMs + '}), "*");' +
      'window.postMessage(JSON.stringify({type:"setPreviewThrottle",interval:' + config.previewThrottleMs + '}), "*");' +
      'window.postMessage(JSON.stringify({type:"setActive",active:' + (config.isActive ? 'true' : 'false') + ',preview:' + (config.enablePreviewPose ? 'true' : 'false') + '}), "*");'
    );
  }, []);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (webViewRef.current) {
        webViewRef.current.injectJavaScript(buildWebViewCleanupScript());
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
    handleLoadEnd,
    handleMessage,
    handleReload,
    injectBlobFile,
    injectRuntimeControls,
    rejectPendingBlobAcks,
    webViewRef,
  };
}
