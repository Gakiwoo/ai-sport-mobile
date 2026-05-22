/**
 * react-native-svg mock
 *
 * Renders plain React Native Views instead of SVG elements.
 * Required for component testing with react-test-renderer in Jest.
 */
import React from 'react';
import { View } from 'react-native';

function createMockComponent(name: string) {
  return ({ children, ...props }: any) =>
    React.createElement(View, { ...props, 'data-svg-mock': name }, children);
}

export const Svg = createMockComponent('Svg');
export const Circle = createMockComponent('Circle');
export const Ellipse = createMockComponent('Ellipse');
export const Rect = createMockComponent('Rect');
export const Path = createMockComponent('Path');
export const Line = createMockComponent('Line');
export const Text = createMockComponent('SvgText');
export const G = createMockComponent('G');
export const Polygon = createMockComponent('Polygon');
export const Polyline = createMockComponent('Polyline');

export default Svg;
