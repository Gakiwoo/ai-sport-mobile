/**
 * @sentry/react-native mock for Jest.
 *
 * 避免测试环境中真正发送 Sentry 事件。
 */
const sentryMock = {
  init: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  addBreadcrumb: jest.fn(),
  setTag: jest.fn(),
  setUser: jest.fn(),
  setExtra: jest.fn(),
  setContext: jest.fn(),
  withScope: jest.fn((callback: (scope: unknown) => void) =>
    callback({ setTag: jest.fn(), setExtra: jest.fn(), setUser: jest.fn() }),
  ),
  wrap: jest.fn((component: unknown) => component),
  startTransaction: jest.fn(() => ({
    finish: jest.fn(),
    startChild: jest.fn(() => ({ finish: jest.fn() })),
  })),
};

module.exports = sentryMock;
