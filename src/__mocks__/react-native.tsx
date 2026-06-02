/**
 * react-native mock for Jest component tests.
 *
 * Provides minimal implementations of commonly used RN modules.
 */
import React from 'react';

// ── 基础组件 ──
const createView = (props: any) => {
  const { children, ...rest } = props;
  return React.createElement('View', rest, children);
};

const createText = (props: any) => {
  const { children, ...rest } = props;
  return React.createElement('Text', rest, children);
};

const createTouchableOpacity = (props: any) => {
  const { children, ...rest } = props;
  return React.createElement(
    'TouchableOpacity',
    {
      ...rest,
      onClick: rest.onPress,
    },
    children,
  );
};

const createTextInput = (props: any) => {
  const { children, ...rest } = props;
  return React.createElement('TextInput', rest, children);
};

const createScrollView = (props: any) => {
  const { children, ...rest } = props;
  return React.createElement('ScrollView', rest, children);
};

const createKeyboardAvoidingView = (props: any) => {
  const { children, ...rest } = props;
  return React.createElement('KeyboardAvoidingView', rest, children);
};

const createStatusBar = (_props: any) => null;

const createActivityIndicator = (_props: any) => React.createElement('ActivityIndicator', null);

const createImage = (props: any) => {
  const { children, ...rest } = props;
  return React.createElement('Image', rest, children);
};

// ── StyleSheet ──
const StyleSheet: any = {
  create: (styles: any) => styles,
  hairlineWidth: 0.5,
  absoluteFill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  absoluteFillObject: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  flatten: (style: any) => style,
};

// ── Platform ──
const Platform: any = {
  OS: 'web',
  Version: 0,
  select: (obj: any) => obj.default ?? obj.web ?? obj.ios ?? obj.android ?? null,
};

// ── Dimensions ──
const Dimensions: any = {
  get: (_dim: string) => ({ width: 390, height: 844 }),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
};

// ── Animated ──
// Animated.Value 需要是可 new 的构造函数
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

const Animated: any = {
  Value: AnimatedValue,
  View: createView,
  Text: createText,
  Image: createImage,
  ScrollView: createScrollView,
  timing: jest.fn(() => ({ start: jest.fn((cb?: any) => cb?.({ finished: true })) })),
  spring: jest.fn(() => ({ start: jest.fn((cb?: any) => cb?.({ finished: true })) })),
  decay: jest.fn(() => ({ start: jest.fn((cb?: any) => cb?.({ finished: true })) })),
  sequence: jest.fn(() => ({ start: jest.fn((cb?: any) => cb?.({ finished: true })) })),
  parallel: jest.fn(() => ({ start: jest.fn((cb?: any) => cb?.({ finished: true })) })),
  delay: jest.fn(() => ({ start: jest.fn((cb?: any) => cb?.({ finished: true })) })),
  event: jest.fn(),
  createAnimatedComponent: (component: any) => component,
};

// ── FlatList ──
const createFlatList = (props: any) => {
  const { data, renderItem, ListEmptyComponent, keyExtractor, ...rest } = props;
  const children: any[] = [];

  if (data && data.length > 0) {
    data.forEach((item: any, index: number) => {
      children.push(renderItem?.({ item, index }));
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

// ── Modal ──
const createModal = (props: any) => {
  const { children, visible, ...rest } = props;
  if (!visible) return null;
  return React.createElement('Modal', rest, children);
};

// ── Alert ──
const Alert: any = { alert: jest.fn() };

const rnMock: any = {};
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
