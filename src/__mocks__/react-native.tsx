/**
 * react-native mock for Jest component tests.
 *
 * Provides minimal implementations of commonly used RN modules.
 */
import React from 'react';

type MockProps = Record<string, unknown> & {
  children?: React.ReactNode;
};

type AnimatedCallback = (result: { finished: boolean }) => void;

const createView = ({ children, ...rest }: MockProps = {}) =>
  React.createElement('View', rest, children);

const createText = ({ children, ...rest }: MockProps = {}) =>
  React.createElement('Text', rest, children);

const createTouchableOpacity = ({ children, ...rest }: MockProps = {}) =>
  React.createElement(
    'TouchableOpacity',
    {
      ...rest,
      onClick: rest.onPress as (() => void) | undefined,
    },
    children,
  );

const createTextInput = ({ children, ...rest }: MockProps = {}) =>
  React.createElement('TextInput', rest, children);

const createScrollView = ({ children, ...rest }: MockProps = {}) =>
  React.createElement('ScrollView', rest, children);

const createKeyboardAvoidingView = ({ children, ...rest }: MockProps = {}) =>
  React.createElement('KeyboardAvoidingView', rest, children);

const createStatusBar = (_props: MockProps = {}) => null;

const createActivityIndicator = (_props: MockProps = {}) =>
  React.createElement('ActivityIndicator', null);

const createImage = ({ children, ...rest }: MockProps = {}) =>
  React.createElement('Image', rest, children);

const StyleSheet = {
  create: <T extends Record<string, unknown>>(styles: T) => styles,
  hairlineWidth: 0.5,
  absoluteFill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  absoluteFillObject: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  flatten: (style: unknown) => style,
};

const Platform = {
  OS: 'web',
  Version: 0,
  select: (obj: Record<string, unknown>) => obj.default ?? obj.web ?? obj.ios ?? obj.android ?? null,
};

const Dimensions = {
  get: (_dim: string) => ({ width: 390, height: 844 }),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
};

class AnimatedValue {
  _value: number;

  constructor(initialValue: number) {
    this._value = initialValue;
  }

  setValue = jest.fn();
  interpolate = jest.fn(() => ({ interpolate: jest.fn() }));
  addListener = jest.fn();
  removeListener = jest.fn();
  removeAllListeners = jest.fn();
}

const runAnimatedCallback = (cb?: AnimatedCallback) => cb?.({ finished: true });

const Animated = {
  Value: AnimatedValue,
  View: createView,
  Text: createText,
  Image: createImage,
  ScrollView: createScrollView,
  timing: jest.fn(() => ({ start: jest.fn(runAnimatedCallback) })),
  spring: jest.fn(() => ({ start: jest.fn(runAnimatedCallback) })),
  decay: jest.fn(() => ({ start: jest.fn(runAnimatedCallback) })),
  sequence: jest.fn(() => ({ start: jest.fn(runAnimatedCallback) })),
  parallel: jest.fn(() => ({ start: jest.fn(runAnimatedCallback) })),
  delay: jest.fn(() => ({ start: jest.fn(runAnimatedCallback) })),
  event: jest.fn(),
  createAnimatedComponent: (component: unknown) => component,
};

const createFlatList = ({
  data,
  renderItem,
  ListEmptyComponent,
  keyExtractor: _keyExtractor,
  ...rest
}: MockProps & {
  data?: unknown[];
  renderItem?: (args: { item: unknown; index: number }) => React.ReactNode;
  ListEmptyComponent?: React.ComponentType | React.ReactNode;
  keyExtractor?: (item: unknown, index: number) => string;
} = {}) => {
  const children: React.ReactNode[] = [];

  if (data && data.length > 0) {
    data.forEach((item, index) => {
      children.push(renderItem?.({ item, index }) ?? null);
    });
  } else if (ListEmptyComponent) {
    if (typeof ListEmptyComponent === 'function') {
      children.push(React.createElement(ListEmptyComponent));
    } else {
      children.push(ListEmptyComponent);
    }
  }

  return React.createElement('FlatList', rest, ...children);
};

const createModal = ({ children, visible, ...rest }: MockProps & { visible?: boolean } = {}) => {
  if (!visible) return null;
  return React.createElement('Modal', rest, children);
};

const Alert = { alert: jest.fn() };

const rnMock: Record<string, unknown> = {};
rnMock.View = createView;
rnMock.Text = createText;
rnMock.TouchableOpacity = createTouchableOpacity;
rnMock.TextInput = createTextInput;
rnMock.ScrollView = createScrollView;
rnMock.KeyboardAvoidingView = createKeyboardAvoidingView;
rnMock.StatusBar = createStatusBar;
rnMock.ActivityIndicator = createActivityIndicator;
rnMock.Image = createImage;
rnMock.FlatList = createFlatList;
rnMock.Modal = createModal;
rnMock.StyleSheet = StyleSheet;
rnMock.Platform = Platform;
rnMock.Dimensions = Dimensions;
rnMock.Animated = Animated;
rnMock.Alert = Alert;
rnMock.default = rnMock;
rnMock.__esModule = true;

export default rnMock;
export const View = createView;
export const Text = createText;
export const TouchableOpacity = createTouchableOpacity;
export const TextInput = createTextInput;
export const ScrollView = createScrollView;
export const KeyboardAvoidingView = createKeyboardAvoidingView;
export const StatusBar = createStatusBar;
export const ActivityIndicator = createActivityIndicator;
export const Image = createImage;
export const FlatList = createFlatList;
export const Modal = createModal;
export { StyleSheet, Platform, Dimensions, Animated, Alert };
