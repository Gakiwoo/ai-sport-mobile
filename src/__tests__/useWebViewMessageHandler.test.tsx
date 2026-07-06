import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { WebViewMessageEvent } from 'react-native-webview';
import { useWebViewMessageHandler } from '../hooks/useWebViewMessageHandler';
import { WEBVIEW_MESSAGE_TYPES } from '../mediapipe/mediapipeBridge';
import { Pose } from '../types';
import { standingPose } from './testHelpers';

jest.mock('../services/MediaPipeAssetService', () => ({
  mediaPipeAssetService: {
    getFiles: jest.fn(() => ['pose_landmark_lite.tflite']),
    getFileBase64: jest.fn().mockResolvedValue('YQ=='),
    getMimeType: jest.fn(() => 'application/octet-stream'),
    clearMemoryCache: jest.fn(),
  },
}));

jest.mock('../services/PerformanceMonitor', () => ({
  performanceMonitor: {
    recordFrame: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    isRunning: false,
    getCurrentFps: jest.fn(() => 0),
    getAverageInferenceMs: jest.fn(() => 0),
  },
}));

function makeMessageEvent(type: string, data?: unknown): WebViewMessageEvent {
  return {
    nativeEvent: { data: JSON.stringify({ type, data }) },
  } as WebViewMessageEvent;
}

function mountHandler(options: Parameters<typeof useWebViewMessageHandler>[0]) {
  let api!: ReturnType<typeof useWebViewMessageHandler>;
  let rerender!: () => void;

  function Probe() {
    const [, setTick] = React.useState(0);
    api = useWebViewMessageHandler(options);
    rerender = () => setTick((n) => n + 1);
    return null;
  }

  act(() => {
    TestRenderer.create(<Probe />);
  });

  return {
    get api() {
      return api;
    },
    rerender: () => {
      act(() => {
        rerender();
      });
    },
  };
}

describe('useWebViewMessageHandler', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('forwards pose messages to onPoseDetected', () => {
    const onPoseDetected = jest.fn();
    const pose: Pose = standingPose();
    const harness = mountHandler({ onPoseDetected });

    act(() => {
      harness.api.handleMessage(makeMessageEvent(WEBVIEW_MESSAGE_TYPES.POSE, pose));
    });

    expect(onPoseDetected).toHaveBeenCalledWith(pose);
  });

  it('transitions to ready on ready message', () => {
    const onReady = jest.fn();
    const harness = mountHandler({ onPoseDetected: jest.fn(), onReady });

    act(() => {
      harness.api.handleMessage(makeMessageEvent(WEBVIEW_MESSAGE_TYPES.READY, null));
    });
    harness.rerender();

    expect(harness.api.cameraState).toBe('ready');
    expect(onReady).toHaveBeenCalled();
  });

  it('resolves blob ack waiters on successful blobAck', async () => {
    const harness = mountHandler({ onPoseDetected: jest.fn() });
    const webView = { injectJavaScript: jest.fn() };

    let injectPromise!: Promise<void>;
    await act(async () => {
      injectPromise = harness.api.injectBlobFile(webView);
      await Promise.resolve();
    });

    await act(async () => {
      harness.api.handleMessage(
        makeMessageEvent(WEBVIEW_MESSAGE_TYPES.BLOB_ACK, {
          filename: 'pose_landmark_lite.tflite',
          ok: true,
        }),
      );
    });

    await expect(injectPromise).resolves.toBeUndefined();
  });

  it('falls back to CDN init when blobAck reports failure', async () => {
    const harness = mountHandler({ onPoseDetected: jest.fn() });
    const webView = { injectJavaScript: jest.fn() };

    let injectPromise!: Promise<void>;
    await act(async () => {
      injectPromise = harness.api.injectBlobFile(webView);
      await Promise.resolve();
    });

    await act(async () => {
      harness.api.handleMessage(
        makeMessageEvent(WEBVIEW_MESSAGE_TYPES.BLOB_ACK, {
          filename: 'pose_landmark_lite.tflite',
          ok: false,
          error: 'checksum mismatch',
        }),
      );
    });

    await expect(injectPromise).resolves.toBeUndefined();
    expect(webView.injectJavaScript).toHaveBeenCalledWith('init();true;');
  });

  it('sets error state on error message from WebView', () => {
    const onError = jest.fn();
    const harness = mountHandler({ onPoseDetected: jest.fn(), onError });

    act(() => {
      harness.api.handleMessage(makeMessageEvent(WEBVIEW_MESSAGE_TYPES.ERROR, 'camera denied'));
    });
    harness.rerender();

    expect(harness.api.cameraState).toBe('error');
    expect(harness.api.errorMessage).toContain('camera denied');
    expect(onError).toHaveBeenCalledWith('camera denied');
  });

  it('ignores malformed postMessage payloads', () => {
    const onPoseDetected = jest.fn();
    const harness = mountHandler({ onPoseDetected });

    act(() => {
      harness.api.handleMessage({
        nativeEvent: { data: 'not-json' },
      } as WebViewMessageEvent);
      harness.api.handleMessage(makeMessageEvent('unknown_protocol', { foo: 1 }));
    });

    expect(onPoseDetected).not.toHaveBeenCalled();
  });
});
