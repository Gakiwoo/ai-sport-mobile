import React, { useCallback, useEffect, useRef } from 'react';
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
          console.warn('[CameraView] Permission request error:', err);
        }
      }
    }

    requestPermissionAndStart();
  }, []);

  useEffect(() => {
    if (webViewRef.current && cameraState === 'ready') {
      injectRuntimeControls(webViewRef.current, {
        isActive,
        modelComplexity,
        throttleMs,
        previewThrottleMs,
        enablePreviewPose,
      });
    }
  }, [
    cameraState,
    injectRuntimeControls,
    isActive,
    modelComplexity,
    previewThrottleMs,
    throttleMs,
    enablePreviewPose,
    webViewRef,
  ]);

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
        console.warn('[CameraView] Local injection failed:', err);
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
          allowFileAccess={true}
          startInLoadingState={false}
          onMessage={handleMessage}
          onLoadEnd={handleLoadEnd}
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          sharedCookiesEnabled={false}
          originWhitelist={['*']}
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
          <TouchableOpacity style={styles.settingsButton} onPress={handleOpenSettings}>
            <Text style={styles.settingsButtonText}>打开设置</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.retryButton} onPress={handleReload}>
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
