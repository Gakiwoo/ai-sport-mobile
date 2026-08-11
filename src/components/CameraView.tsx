import React, { useCallback, useEffect, useRef } from 'react';
import ErrorReporter from '../services/ErrorReporter';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
  ScrollView,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Camera } from 'expo-camera';
import { Pose } from '../types';
import { useWebViewMessageHandler } from '../hooks/useWebViewMessageHandler';
import { createAdaptivePoseRuntime } from '../utils/adaptivePoseRuntime';
import { performanceMonitor } from '../services/PerformanceMonitor';
import { MEDIAPIPE_POSE_HTML } from '../mediapipe/loadPoseHtml';

interface CameraViewProps {
  onPoseDetected: (pose: Pose) => void;
  isActive: boolean;
  throttleMs?: number;
  previewThrottleMs?: number;
  enablePreviewPose?: boolean;
  maxAdaptiveIntervalMs?: number;
  modelComplexity?: 0 | 1;
  onActivePoseIntervalChange?: (intervalMs: number) => void;
}

export default function CameraView({
  onPoseDetected,
  isActive,
  throttleMs = 100,
  previewThrottleMs = 250,
  enablePreviewPose = true,
  maxAdaptiveIntervalMs = 220,
  modelComplexity = 1,
  onActivePoseIntervalChange,
}: CameraViewProps) {
  const adaptiveRuntimeRef = useRef(
    createAdaptivePoseRuntime({
      baseIntervalMs: throttleMs,
      minIntervalMs: Math.min(60, throttleMs),
      maxIntervalMs: maxAdaptiveIntervalMs,
    }),
  );

  // 将运行时配置聚合到 ref，通过版本号驱动注入，减少 useEffect 依赖项
  const runtimeConfigRef = useRef({
    isActive,
    modelComplexity,
    throttleMs,
    previewThrottleMs,
    enablePreviewPose,
  });
  const lastInjectedConfigRef = useRef<{
    isActive: boolean;
    modelComplexity: number;
    throttleMs: number;
    previewThrottleMs: number;
    enablePreviewPose: boolean;
  } | null>(null);
  const runtimeConfigVersionRef = useRef(0);

  // 同步更新 ref 并检测配置变更（render 阶段，确保 ref 始终为最新）
  runtimeConfigRef.current = {
    isActive,
    modelComplexity,
    throttleMs,
    previewThrottleMs,
    enablePreviewPose,
  };

  const lastInjected = lastInjectedConfigRef.current;
  if (
    !lastInjected ||
    lastInjected.isActive !== isActive ||
    lastInjected.modelComplexity !== modelComplexity ||
    lastInjected.throttleMs !== throttleMs ||
    lastInjected.previewThrottleMs !== previewThrottleMs ||
    lastInjected.enablePreviewPose !== enablePreviewPose
  ) {
    runtimeConfigVersionRef.current += 1;
  }

  const runtimeConfigVersion = runtimeConfigVersionRef.current;

  const {
    cameraState,
    errorMessage,
    loadingDetail,
    injectionDoneRef,
    handleMessage,
    handleReload,
    injectBlobFile,
    injectRuntimeControls,
    webViewRef,
  } = useWebViewMessageHandler({
    onPoseDetected,
    onAdaptiveIntervalChange: onActivePoseIntervalChange,
    adaptiveRuntimeRef,
  });

  useEffect(() => {
    adaptiveRuntimeRef.current.reset({
      baseIntervalMs: throttleMs,
      minIntervalMs: Math.min(60, throttleMs),
      maxIntervalMs: maxAdaptiveIntervalMs,
    });
    onActivePoseIntervalChange?.(throttleMs);
  }, [maxAdaptiveIntervalMs, onActivePoseIntervalChange, throttleMs]);

  useEffect(() => {
    async function requestPermissionAndStart() {
      if (Platform.OS === 'android') {
        try {
          const { status } = await Camera.requestCameraPermissionsAsync();
          if (status !== 'granted') {
            return;
          }
        } catch (err) {
          ErrorReporter.captureWarning('摄像头权限请求失败', {
            source: 'CameraView',
            error: String(err),
          });
        }
      }
    }

    requestPermissionAndStart();
  }, []);

  // 仅在 cameraState 或配置实际变化时才重新注入运行时控制
  // 配置值通过 runtimeConfigRef 读取，避免将 5 个配置项全部列为依赖
  useEffect(() => {
    if (webViewRef.current && cameraState === 'ready') {
      const config = runtimeConfigRef.current;
      injectRuntimeControls(webViewRef.current, config);
      lastInjectedConfigRef.current = { ...config };
    }
  }, [cameraState, injectRuntimeControls, runtimeConfigVersion]);

  const handleLoadEnd = useCallback(() => {
    if (!webViewRef.current) return;

    const webView = webViewRef.current;

    const injectLocalFiles = async () => {
      await injectBlobFile(webView);
    };

    setTimeout(async () => {
      if (injectionDoneRef.current) return;
      injectionDoneRef.current = true;

      try {
        await injectLocalFiles();
      } catch (err) {
        ErrorReporter.captureWarning('本地注入 MediaPipe 失败', {
          source: 'CameraView',
          error: String(err),
        });
      }
    }, 100);
  }, [injectBlobFile, injectionDoneRef, webViewRef]);

  const handleOpenSettings = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
  };

  const canShowWebView = cameraState !== 'idle';

  return (
    <View style={styles.container}>
      {canShowWebView && (
        <WebView
          ref={webViewRef}
          source={{ html: MEDIAPIPE_POSE_HTML, baseUrl: 'https://localhost' }}
          style={styles.webview}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          allowFileAccess={false}
          startInLoadingState={false}
          onMessage={handleMessage}
          onLoadEnd={handleLoadEnd}
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          sharedCookiesEnabled={false}
          originWhitelist={[
            'https://localhost',
            'https://gakiwoo.com',
            'https://cdn.jsdelivr.net',
            'https://unpkg.com',
          ]}
          cacheEnabled={true}
          androidLayerType="hardware"
          onError={(syntheticEvent) => {
            console.error('[CameraView] WebView error:', syntheticEvent.nativeEvent);
          }}
          onHttpError={(syntheticEvent) => {
            console.warn('[CameraView] HTTP error:', syntheticEvent.nativeEvent);
          }}
          renderError={() => (
            <View style={styles.overlay}>
              <Text style={styles.errorTitle}>加载失败</Text>
              <Text style={styles.errorText}>请检查网络连接后重试</Text>
            </View>
          )}
        />
      )}

      {cameraState === 'loading' && (
        <View style={styles.overlay} pointerEvents="none">
          <Text style={styles.loadingTitle}>正在初始化相机</Text>
          <Text style={styles.loadingSub}>{loadingDetail}</Text>
          <Text style={styles.loadingHint}>首次使用需下载 AI 模型，请耐心等待...</Text>
        </View>
      )}

      {cameraState === 'error' && (
        <View style={styles.overlay}>
          <Text style={styles.errorTitle}>无法启动相机</Text>
          <ScrollView style={styles.errorScroll} contentContainerStyle={styles.errorScrollContent}>
            <Text style={styles.errorDetail}>{errorMessage || '请确认已授予相机权限'}</Text>
          </ScrollView>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={handleOpenSettings}
            accessibilityLabel="打开系统设置"
            accessibilityRole="button"
          >
            <Text style={styles.settingsButtonText}>打开设置</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={handleReload}
            accessibilityLabel="重试"
            accessibilityRole="button"
          >
            <Text style={styles.retryButtonText}>重试</Text>
          </TouchableOpacity>
        </View>
      )}

      {cameraState === 'ready' && !isActive && (
        <View style={[styles.overlay, styles.idleOverlay]} pointerEvents="none">
          <Text style={styles.idleText}>相机就绪，点击「开始」进行训练</Text>
        </View>
      )}

      {/* ── 调试信息：FPS / 推理耗时 ── */}
      {__DEV__ && cameraState === 'ready' && performanceMonitor.isRunning && (
        <View style={styles.fpsBadge} pointerEvents="none">
          <Text style={styles.fpsText}>{performanceMonitor.getCurrentFps().toFixed(1)} FPS</Text>
          <Text style={styles.fpsSubText}>
            {performanceMonitor.getAverageInferenceMs().toFixed(0)} ms
          </Text>
          <Text style={styles.fpsSubText}>{performanceMonitor.getCurrentTier()}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  webview: {
    flex: 1,
    backgroundColor: '#000',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.85)',
    zIndex: 1,
  },
  idleOverlay: {
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  loadingTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  loadingSub: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 40,
    marginBottom: 6,
  },
  loadingHint: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  errorTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  errorText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 15,
    marginBottom: 20,
    textAlign: 'center',
  },
  errorScroll: {
    maxHeight: 80,
    marginBottom: 16,
  },
  errorScrollContent: {
    paddingHorizontal: 24,
  },
  errorDetail: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  settingsButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  settingsButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  retryButton: {
    paddingHorizontal: 30,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  retryButtonText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 15,
    fontWeight: '500',
  },
  idleText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 40,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  fpsBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
    zIndex: 100,
  },
  fpsText: {
    color: '#4CD964',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  fpsSubText: {
    color: '#8E8E93',
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 2,
  },
});
