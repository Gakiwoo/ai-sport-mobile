import ErrorReporter from '../services/ErrorReporter';
import * as Sentry from '@sentry/react-native';

describe('ErrorReporter (Mobile)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('captureError 上报到 Sentry.captureException 并打印 console.error', () => {
    const err = new Error('boom');
    ErrorReporter.captureError(err, { source: 'Test', action: 'x' });

    expect(Sentry.captureException).toHaveBeenCalledWith(err, {
      extra: { source: 'Test', action: 'x' },
    });
    expect(console.error).toHaveBeenCalled();
  });

  it('captureError 接受非 Error 值并转为 Error 上报', () => {
    ErrorReporter.captureError('string error', { source: 'Test' });
    expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error), {
      extra: { source: 'Test' },
    });
  });

  it('captureWarning 上报到 Sentry.captureMessage (warning)', () => {
    ErrorReporter.captureWarning('something off', { source: 'Test' });
    expect(Sentry.captureMessage).toHaveBeenCalledWith('something off', 'warning');
    expect(console.warn).toHaveBeenCalled();
  });

  it('captureInfo 上报到 Sentry.captureMessage (info)', () => {
    ErrorReporter.captureInfo('just logging', { source: 'Test' });
    expect(Sentry.captureMessage).toHaveBeenCalledWith('just logging', 'info');
  });
});
