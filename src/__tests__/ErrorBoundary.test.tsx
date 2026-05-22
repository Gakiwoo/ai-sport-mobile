/**
 * ErrorBoundary 组件测试
 */
import React from 'react';
import ErrorBoundary from '../components/ErrorBoundary';
import { createWithAct } from './testRenderer';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

const ErrorThrower = () => {
  throw new Error('测试错误');
};

describe('ErrorBoundary', () => {
  beforeEach(() => {
    (globalThis as any).__DEV__ = false;
  });

  it('组件可以被实例化', async () => {
    const instance = await createWithAct(
      React.createElement(ErrorBoundary, null, React.createElement('View')),
    );
    expect(instance).toBeDefined();
  });

  it('捕获错误不崩溃', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const instance = await createWithAct(
        React.createElement(ErrorBoundary, null, React.createElement(ErrorThrower)),
      );
      expect(instance).toBeDefined();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});
