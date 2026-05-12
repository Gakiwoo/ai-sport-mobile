import {
  DEFAULT_BLOB_CHUNK_SIZE,
  ONE_SHOT_BLOB_THRESHOLD,
  buildBlobAppendScript,
  buildBlobBeginScript,
  buildBlobCommitScript,
  buildRegisterBlobScript,
  buildWebViewCleanupScript,
  splitBase64IntoChunks,
} from '../utils/webViewAssetInjection';

describe('webViewAssetInjection', () => {
  it('splits base64 payloads into ordered fixed-size chunks', () => {
    expect(splitBase64IntoChunks('abcdefg', 3)).toEqual(['abc', 'def', 'g']);
  });

  it('uses a 64KB default chunk size', () => {
    expect(DEFAULT_BLOB_CHUNK_SIZE).toBe(64 * 1024);
  });

  it('one-shot threshold is 500KB base64', () => {
    expect(ONE_SHOT_BLOB_THRESHOLD).toBe(500 * 1024);
  });

  it('builds escaped begin, append and commit scripts', () => {
    expect(buildBlobBeginScript('pose"file.wasm', 'application/wasm')).toBe(
      'window.__beginBlob("pose\\"file.wasm","application/wasm");true;'
    );
    expect(buildBlobAppendScript('pose.js', 'abc/+=')).toBe(
      'window.__appendBlobChunk("pose.js","abc/+=");true;'
    );
    expect(buildBlobCommitScript('pose.js')).toBe('window.__commitBlob("pose.js");true;');
  });

  it('builds one-shot register blob script with full base64', () => {
    const script = buildRegisterBlobScript('model.wasm', 'aGVsbG8=', 'application/wasm');
    expect(script).toBe(
      'window.__registerBlob("model.wasm","aGVsbG8=","application/wasm");true;'
    );
  });

  it('escapes special characters in register blob script', () => {
    const script = buildRegisterBlobScript('pose"file.js', 'abc/+', 'app/js');
    expect(script).toBe(
      'window.__registerBlob("pose\\"file.js","abc/+","app/js");true;'
    );
  });

  it('builds a cleanup script with safe undefined checks for timers', () => {
    const script = buildWebViewCleanupScript();

    expect(script).toContain('typeof sendIntervalId !== "undefined"');
    expect(script).toContain('clearInterval(sendIntervalId)');
    expect(script).toContain('typeof animFrameId !== "undefined"');
    expect(script).toContain('cancelAnimationFrame(animFrameId)');
    expect(script.endsWith('true;')).toBe(true);
  });
});
