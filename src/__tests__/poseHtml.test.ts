import { MEDIAPIPE_POSE_HTML } from '../mediapipe/loadPoseHtml';

describe('assets/mediapipe/pose.html', () => {
  it('loads as non-empty WebView document', () => {
    expect(MEDIAPIPE_POSE_HTML.length).toBeGreaterThan(1000);
    expect(MEDIAPIPE_POSE_HTML).toMatch(/^<!DOCTYPE html>/);
  });

  it('exposes MediaPipe bridge hooks used by RN injection', () => {
    expect(MEDIAPIPE_POSE_HTML).toContain('window.__registerBlob');
    expect(MEDIAPIPE_POSE_HTML).toContain('window.__evalPoseJs');
    expect(MEDIAPIPE_POSE_HTML).toContain('ReactNativeWebView.postMessage');
    expect(MEDIAPIPE_POSE_HTML).toContain('async function init()');
  });

  it('handles runtime control messages from mediapipeBridge', () => {
    expect(MEDIAPIPE_POSE_HTML).toContain("msg.type === 'setThrottle'");
    expect(MEDIAPIPE_POSE_HTML).toContain("msg.type === 'setActive'");
  });
});
