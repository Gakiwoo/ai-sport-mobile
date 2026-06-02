/**
 * sentry-expo mock for Jest
 *
 * 避免测试环境中真正发送 Sentry 事件
 * 模拟 sentry-expo v7 的导出结构：init + Native (from @sentry/react-native)
 */
const nativeMock = {
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  addBreadcrumb: jest.fn(),
  setTag: jest.fn(),
  setUser: jest.fn(),
  setExtra: jest.fn(),
  setContext: jest.fn(),
  withScope: jest.fn((callback: any) => callback({ setTag: jest.fn(), setExtra: jest.fn(), setUser: jest.fn() })),
  wrap: jest.fn((fn: any) => fn),
  startTransaction: jest.fn(() => ({
    finish: jest.fn(),
    startChild: jest.fn(() => ({ finish: jest.fn() })),
  })),
};

const sentryMock = {
  init: jest.fn(),
  Native: nativeMock,
  React: nativeMock,
  Browser: nativeMock,
};

module.exports = sentryMock;
