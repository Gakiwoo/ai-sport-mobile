import {
  BLOB_ACK_TIMEOUT_MS,
  MEDIAPIPE_INIT_TIMEOUT_MS,
  WEBVIEW_MESSAGE_TYPES,
  buildRuntimeControlScript,
  parseWebViewMessage,
} from '../mediapipe/mediapipeBridge';

describe('mediapipeBridge', () => {
  it('exports stable timeout constants', () => {
    expect(BLOB_ACK_TIMEOUT_MS).toBe(30_000);
    expect(MEDIAPIPE_INIT_TIMEOUT_MS).toBe(30_000);
  });

  it('parseWebViewMessage accepts known protocol messages', () => {
    const pose = parseWebViewMessage(
      JSON.stringify({
        type: WEBVIEW_MESSAGE_TYPES.POSE,
        data: { keypoints: [{ x: 0.5, y: 0.5, name: 'nose' }] },
      }),
    );
    expect(pose?.type).toBe('pose');
    if (pose?.type === WEBVIEW_MESSAGE_TYPES.POSE) {
      expect(pose.data.keypoints).toHaveLength(1);
    }
  });

  it('parseWebViewMessage rejects unknown types', () => {
    expect(parseWebViewMessage(JSON.stringify({ type: 'unknown', data: {} }))).toBeNull();
    expect(parseWebViewMessage('not-json')).toBeNull();
  });

  it('buildRuntimeControlScript includes all control messages', () => {
    const script = buildRuntimeControlScript({
      isActive: true,
      modelComplexity: 1,
      throttleMs: 100,
      previewThrottleMs: 250,
      enablePreviewPose: false,
    });
    expect(script).toContain('setModelConfig');
    expect(script).toContain('setThrottle');
    expect(script).toContain('setPreviewThrottle');
    expect(script).toContain('setSmoothLandmarks');
    expect(script).toContain('setActive');
    expect(script).toContain('"active":true');
    expect(script.endsWith('true;')).toBe(true);
  });
});
