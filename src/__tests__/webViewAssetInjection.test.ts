import {
  DEFAULT_BLOB_CHUNK_SIZE,
  buildBlobAppendScript,
  buildBlobBeginScript,
  buildBlobCommitScript,
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

  it('builds escaped begin, append and commit scripts', () => {
    expect(buildBlobBeginScript('pose"file.wasm', 'application/wasm')).toBe(
      'window.__beginBlob("pose\\"file.wasm","application/wasm");true;'
    );
    expect(buildBlobAppendScript('pose.js', 'abc/+=')).toBe(
      'window.__appendBlobChunk("pose.js","abc/+=");true;'
    );
    expect(buildBlobCommitScript('pose.js')).toBe('window.__commitBlob("pose.js");true;');
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
