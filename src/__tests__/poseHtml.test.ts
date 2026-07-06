import { MEDIAPIPE_POSE_HTML } from '../mediapipe/loadPoseHtml';

describe('assets/mediapipe/pose.html', () => {
  it('loads as non-empty WebView document', () => {
    expect(MEDIAPIPE_POSE_HTML.length).toBeGreaterThan(1000);
    expect(MEDIAPIPE_POSE_HTML).toMatch(/^<!DOCTYPE html>/);
  });

  it('exposes MediaPipe bridge hooks used by RN injection', () => {
    expect(MEDIAPIPE_POSE_HTML).toContain('window.__registerBlob');
    expect(MEDIAPIPE_POSE_HTML).toContain("blobRegistry['pose.js']");
    expect(MEDIAPIPE_POSE_HTML).toContain('ReactNativeWebView.postMessage');
    expect(MEDIAPIPE_POSE_HTML).toContain('async function init()');
  });

  it('does not require eval for local pose.js injection', () => {
    expect(MEDIAPIPE_POSE_HTML).not.toContain('unsafe-eval');
    expect(MEDIAPIPE_POSE_HTML).not.toContain('window.__evalPoseJs');
    expect(MEDIAPIPE_POSE_HTML).not.toContain('eval(jsCode)');
    expect(MEDIAPIPE_POSE_HTML).toContain("await loadScript(blobRegistry['pose.js'], 10000)");
  });

  it('handles runtime control messages from mediapipeBridge', () => {
    expect(MEDIAPIPE_POSE_HTML).toContain("msg.type === 'setThrottle'");
    expect(MEDIAPIPE_POSE_HTML).toContain("msg.type === 'setActive'");
  });
});
