import React, { useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Platform, ScrollView } from 'react-native';
import { WebView } from 'react-native-webview';
import { Camera } from 'expo-camera';
import { Pose } from '../types';
import { useWebViewMessageHandler } from '../hooks/useWebViewMessageHandler';
import { createAdaptivePoseRuntime } from '../utils/adaptivePoseRuntime';

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

const MEDIAPIPE_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #000; }
    #video { display: none; }
    #canvas { width: 100%; height: 100%; display: block; }
  </style>
</head>
<body>
  <video id="video" playsinline autoplay muted></video>
  <canvas id="canvas"></canvas>
  <script>
    var video = document.getElementById('video');
    var canvas = document.getElementById('canvas');
    var ctx = canvas.getContext('2d');

    var KEYPOINT_NAMES = [
      'nose','left_eye','right_eye','left_ear','right_ear',
      'left_shoulder','right_shoulder','left_elbow','right_elbow',
      'left_wrist','right_wrist','left_hip','right_hip',
      'left_knee','right_knee','left_ankle','right_ankle'
    ];

    var SKELETON_CONNECTIONS = [
      [11,12],[11,13],[13,15],[12,14],[14,16],
      [11,23],[12,24],[23,24],
      [23,25],[25,27],[24,26],[26,28]
    ];

    var poseInstance = null;
    var lastPoseData = null;
    var activeSendInterval = 100;
    var previewSendInterval = 250;
    var sendInterval = 100;
    var inferenceInterval = 100;
    var modelComplexity = 1;
    var lastInferenceTime = 0;
    var lastSendTime = 0;
    var perfSamples = 0;
    var perfTotalMs = 0;
    var isReady = false;
    var animFrameId = null;
    var shouldProcessPose = false;
    var shouldSendPose = false;
    var isWorkoutActive = false;
    var isPreviewEnabled = true;

    var blobRegistry = {};

    function post(type, data) {
      try {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: type, data: data }));
      } catch(e) {}
    }

    var pendingBlobChunks = {};

    function registerBlobFromBase64(filename, base64Data, mimeType) {
      var binary = atob(base64Data);
      var bytes = new Uint8Array(binary.length);
      for (var i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      if (blobRegistry[filename]) {
        URL.revokeObjectURL(blobRegistry[filename]);
      }
      var blob = new Blob([bytes], { type: mimeType || 'application/octet-stream' });
      var url = URL.createObjectURL(blob);
      blobRegistry[filename] = url;
      post('log', 'Registered blob: ' + filename + ' (' + bytes.length + ' bytes)');
    }

    window.__beginBlob = function(filename, mimeType) {
      pendingBlobChunks[filename] = {
        mimeType: mimeType || 'application/octet-stream',
        chunks: []
      };
      return true;
    };

    window.__appendBlobChunk = function(filename, chunk) {
      var pending = pendingBlobChunks[filename];
      if (!pending) {
        throw new Error('Blob transfer was not started: ' + filename);
      }
      pending.chunks.push(chunk);
      return true;
    };

    window.__commitBlob = function(filename) {
      try {
        var pending = pendingBlobChunks[filename];
        if (!pending) {
          throw new Error('Blob transfer was not started: ' + filename);
        }
        var base64Data = pending.chunks.join('');
        pending.chunks = [];
        delete pendingBlobChunks[filename];
        registerBlobFromBase64(filename, base64Data, pending.mimeType);
        post('blobAck', { filename: filename, ok: true });
      } catch(e) {
        delete pendingBlobChunks[filename];
        post('blobAck', { filename: filename, ok: false, error: e.message });
        throw e;
      }
      return true;
    };

    window.__registerBlob = function(filename, base64Data, mimeType) {
      try {
        registerBlobFromBase64(filename, base64Data, mimeType);
        post('blobAck', { filename: filename, ok: true });
      } catch(e) {
        post('blobAck', { filename: filename, ok: false, error: e.message });
        throw e;
      }
      return true;
    };

    window.__evalPoseJs = function(base64Data) {
      try {
        var jsCode = atob(base64Data);
        post('log', 'Evaluating pose.js (' + jsCode.length + ' chars)');
        eval(jsCode);
        post('log', 'pose.js evaluated successfully');
      } catch(e) {
        post('log', 'Failed to eval pose.js: ' + e.message);
        throw e;
      }
    };

    function drawResults(results) {
      var W = canvas.width;
      var H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      ctx.save();
      ctx.scale(-1, 1);
      ctx.translate(-W, 0);
      ctx.drawImage(results.image, 0, 0, W, H);
      ctx.restore();

      if (!results.poseLandmarks) {
        lastPoseData = null;
        return;
      }

      var lm = results.poseLandmarks;
      var pts = [];
      for (var i = 0; i < lm.length; i++) {
        pts.push({ x: (1 - lm[i].x) * W, y: lm[i].y * H, v: lm[i].visibility, n: KEYPOINT_NAMES[i] || ('kp_' + i) });
      }

      ctx.strokeStyle = '#00FF88';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      for (var k = 0; k < SKELETON_CONNECTIONS.length; k++) {
        var pair = SKELETON_CONNECTIONS[k];
        var a = pts[pair[0]], b = pts[pair[1]];
        if (a.v > 0.3 && b.v > 0.3) {
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      for (var i = 0; i < pts.length; i++) {
        if (pts[i].v > 0.3) {
          ctx.beginPath();
          ctx.arc(pts[i].x, pts[i].y, 5, 0, 2 * Math.PI);
          ctx.fillStyle = i <= 10 ? '#FF3B30' : '#FFD60A';
          ctx.fill();
          ctx.strokeStyle = '#FFF';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      var keypoints = [];
      for (var j = 0; j < pts.length; j++) {
        keypoints.push({ x: pts[j].x, y: pts[j].y, score: pts[j].v, name: pts[j].n });
      }
      lastPoseData = { keypoints: keypoints, score: 0.9, frameWidth: W, frameHeight: H };
    }

    function drawVideoOnly() {
      if (!video || video.paused || video.ended) return;
      var W = canvas.width;
      var H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      ctx.save();
      ctx.scale(-1, 1);
      ctx.translate(-W, 0);
      ctx.drawImage(video, 0, 0, W, H);
      ctx.restore();
    }

    async function startCamera() {
      post('log', 'Checking navigator.mediaDevices...');
      if (!navigator.mediaDevices) {
        throw new Error('navigator.mediaDevices is undefined - page is not a secure context');
      }
      post('log', 'Requesting camera via getUserMedia...');
      var stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 360 } },
        audio: false
      });
      video.srcObject = stream;
      await video.play();
      post('log', 'Camera stream obtained, video playing');

      canvas.width = video.videoWidth || 480;
      canvas.height = video.videoHeight || 360;

      function processFrame() {
        if (!video || video.paused || video.ended) {
          animFrameId = requestAnimationFrame(processFrame);
          return;
        }
        if (shouldProcessPose && poseInstance) {
          var now = Date.now();
          if (now - lastInferenceTime < inferenceInterval) {
            animFrameId = requestAnimationFrame(processFrame);
            return;
          }
          lastInferenceTime = now;
          var inferenceStartedAt = Date.now();
          poseInstance.send({ image: video }).then(function() {
            perfSamples++;
            perfTotalMs += Date.now() - inferenceStartedAt;
            if (perfSamples >= 3) {
              post('perf', {
                inferenceMs: Math.round(perfTotalMs / perfSamples),
                intervalMs: inferenceInterval,
                isActive: isWorkoutActive
              });
              perfSamples = 0;
              perfTotalMs = 0;
            }
            animFrameId = requestAnimationFrame(processFrame);
          }).catch(function(err) {
            post('log', 'Pose send error: ' + (err.message || String(err)));
            animFrameId = requestAnimationFrame(processFrame);
          });
        } else {
          drawVideoOnly();
          animFrameId = requestAnimationFrame(processFrame);
        }
      }
      animFrameId = requestAnimationFrame(processFrame);
    }

    var CDN_BASES = [
      'https://gakiwoo.com/static/mediapipe/pose/',
      'https://registry.npmmirror.com/@mediapipe/pose/0.5.1675469404/files/',
      'https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/',
      'https://unpkg.com/@mediapipe/pose@0.5.1675469404/'
    ];

    function loadScript(url, timeoutMs) {
      return new Promise(function(resolve, reject) {
        var s = document.createElement('script');
        s.src = url;
        var timer = setTimeout(function() {
          s.onload = null; s.onerror = null;
          if (s.parentNode) s.parentNode.removeChild(s);
          reject(new Error('Script load timeout: ' + url));
        }, timeoutMs || 10000);
        s.onload = function() { clearTimeout(timer); resolve(); };
        s.onerror = function() { clearTimeout(timer); if (s.parentNode) s.parentNode.removeChild(s); reject(new Error('Script load failed: ' + url)); };
        document.head.appendChild(s);
      });
    }

    async function initFromLocal() {
      if (typeof Pose === 'undefined') {
        throw new Error('Pose class not loaded - pose.js was not injected');
      }

      post('cdnStatus', '初始化 AI 模型（本地）...');
      post('log', 'Creating Pose instance with local blob URLs');

      poseInstance = new Pose({
        locateFile: function(file) {
          if (blobRegistry[file]) {
            return blobRegistry[file];
          }
          post('log', 'WARNING: No blob for ' + file + ', falling back to CDN');
          return CDN_BASES[0] + file;
        }
      });
      poseInstance.setOptions({
        modelComplexity: modelComplexity,
        smoothLandmarks: true,
        enableSegmentation: false,
        smoothSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });
      poseInstance.onResults(drawResults);
      post('log', 'Pose instance created, initializing model...');
      await poseInstance.initialize();
      post('log', 'Pose model initialized from local cache');
    }

    async function initFromCdn() {
      var activeCdnBase = null;
      for (var i = 0; i < CDN_BASES.length; i++) {
        var cdnBase = CDN_BASES[i];
        var scriptUrl = cdnBase + 'pose.js';
        var host = cdnBase.split('/')[2];
        try {
          post('log', 'Loading pose.js from CDN: ' + scriptUrl);
          post('cdnStatus', '尝试 CDN ' + (i + 1) + '/' + CDN_BASES.length + ': ' + host);
          await loadScript(scriptUrl, 10000);
          activeCdnBase = cdnBase;
          post('log', 'pose.js loaded from: ' + host);
          break;
        } catch (e) {
          post('log', 'CDN failed: ' + host + ' - ' + (e.message || String(e)));
        }
      }

      if (!activeCdnBase) {
        throw new Error('All CDN attempts failed. Please check your network connection.');
      }

      if (typeof Pose === 'undefined') {
        throw new Error('Pose class not loaded after CDN script load');
      }

      post('cdnStatus', '初始化 AI 模型（CDN）...');
      poseInstance = new Pose({
        locateFile: function(file) { return activeCdnBase + file; }
      });
      poseInstance.setOptions({
        modelComplexity: modelComplexity,
        smoothLandmarks: true,
        enableSegmentation: false,
        smoothSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });
      poseInstance.onResults(drawResults);
      await poseInstance.initialize();
      post('log', 'Pose model initialized from CDN: ' + activeCdnBase);
    }

    async function init() {
      try {
        post('log', 'Starting MediaPipe initialization...');
        post('log', 'Blob registry has ' + Object.keys(blobRegistry).length + ' files');

        if (Object.keys(blobRegistry).length > 0 && typeof Pose !== 'undefined') {
          post('log', 'Local blobs available, using local cache');
          try {
            await initFromLocal();
          } catch (e) {
            post('log', 'Local init failed: ' + String(e) + ' — falling back to CDN');
            // 本地缓存损坏时回退到 CDN
            await initFromCdn();
          }
        } else {
          post('log', 'Local blobs not available, falling back to CDN');
          await initFromCdn();
        }

        if (!navigator.mediaDevices) {
          throw new Error('navigator.mediaDevices is undefined (not a secure context)');
        }

        post('cdnStatus', '启动相机...');
        await startCamera();

        isReady = true;
        post('ready', null);
        post('log', 'Camera and Pose fully ready');
      } catch (err) {
        var errMsg = err.message || String(err);
        post('log', 'Initialization failed: ' + errMsg);
        post('error', errMsg);
      }
    }

    var sendIntervalId = null;
    function startSendInterval() {
      if (sendIntervalId) clearInterval(sendIntervalId);
      sendIntervalId = setInterval(function() {
        if (!isReady || !lastPoseData || !shouldSendPose) return;
        var now = Date.now();
        if (now - lastSendTime >= sendInterval) {
          lastSendTime = now;
          post('pose', lastPoseData);
        }
      }, 50);
    }
    startSendInterval();

    window.addEventListener('message', function(event) {
      try {
        var msg = JSON.parse(event.data);
        if (msg.type === 'setThrottle' && typeof msg.interval === 'number') {
          activeSendInterval = Math.max(50, Math.min(300, msg.interval));
          if (isWorkoutActive) {
            sendInterval = activeSendInterval;
            inferenceInterval = activeSendInterval;
          }
        }
        if (msg.type === 'setPreviewThrottle' && typeof msg.interval === 'number') {
          previewSendInterval = Math.max(50, Math.min(300, msg.interval));
          if (!isWorkoutActive) {
            sendInterval = previewSendInterval;
            inferenceInterval = previewSendInterval;
          }
        }
        if (msg.type === 'setModelConfig' && typeof msg.modelComplexity === 'number') {
          modelComplexity = msg.modelComplexity === 0 ? 0 : 1;
        }
        if (msg.type === 'setActive') {
          isWorkoutActive = !!msg.active;
          isPreviewEnabled = msg.preview !== false;
          shouldProcessPose = isWorkoutActive || isPreviewEnabled;
          shouldSendPose = shouldProcessPose;
          sendInterval = isWorkoutActive ? activeSendInterval : previewSendInterval;
          inferenceInterval = sendInterval;
          post('log', 'Active state changed: ' + msg.active + ', preview: ' + isPreviewEnabled + ', interval: ' + sendInterval);
        }
      } catch (e) {}
    });

    window.addEventListener('beforeunload', function() {
      if (sendIntervalId) clearInterval(sendIntervalId);
      if (animFrameId) cancelAnimationFrame(animFrameId);
    });
  </script>
</body>
</html>
`;

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
  const adaptiveRuntimeRef = useRef(createAdaptivePoseRuntime({
    baseIntervalMs: throttleMs,
    minIntervalMs: Math.min(60, throttleMs),
    maxIntervalMs: maxAdaptiveIntervalMs,
  }));

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
  }, [cameraState, injectRuntimeControls, isActive, modelComplexity, previewThrottleMs, throttleMs, enablePreviewPose, webViewRef]);

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
  }, [injectBlobFile]);

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
          source={{ html: MEDIAPIPE_HTML, baseUrl: 'https://localhost' }}
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
});
