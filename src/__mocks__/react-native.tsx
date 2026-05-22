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

// ── Alert ──
const alertMock: any = { alert: jest.fn() };

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
rnMock.StyleSheet = StyleSheet;
rnMock.Platform = Platform;
rnMock.Alert = alertMock;
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
export { StyleSheet, Platform };
export const Alert = alertMock;
