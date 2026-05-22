/**
 * SkeletonOverlay 组件测试
 */
import React from 'react';
import SkeletonOverlay from '../components/SkeletonOverlay';
import { Pose } from '../types';
import { renderToJSON } from './testRenderer';

/** 完整姿态 — 所有关键点 score >= 0.3 */
function fullPose(): Pose {
  const names = [
    'nose',
    'left_eye',
    'right_eye',
    'left_ear',
    'right_ear',
    'left_shoulder',
    'right_shoulder',
    'left_elbow',
    'right_elbow',
    'left_wrist',
    'right_wrist',
    'left_hip',
    'right_hip',
    'left_knee',
    'right_knee',
    'left_ankle',
    'right_ankle',
  ];
  return {
    score: 0.9,
    keypoints: names.map((name, i) => ({
      name,
      x: 100 + i * 5,
      y: 100 + i * 3,
      score: 0.9,
    })),
  };
}

/** 低分姿态 — 所有关键点 score < 0.3 */
function lowScorePose(): Pose {
  const names = [
    'nose',
    'left_eye',
    'right_eye',
    'left_ear',
    'right_ear',
    'left_shoulder',
    'right_shoulder',
    'left_elbow',
    'right_elbow',
    'left_wrist',
    'right_wrist',
    'left_hip',
    'right_hip',
    'left_knee',
    'right_knee',
    'left_ankle',
    'right_ankle',
  ];
  return {
    score: 0.2,
    keypoints: names.map((name, i) => ({
      name,
      x: 100 + i * 5,
      y: 100 + i * 3,
      score: 0.2,
    })),
  };
}

/** 空关键点 */
function emptyPose(): Pose {
  return { score: 0, keypoints: [] };
}

describe('SkeletonOverlay', () => {
  it('完整姿态渲染不崩溃', async () => {
    const tree = await renderToJSON(<SkeletonOverlay pose={fullPose()} />);
    expect(tree).toMatchSnapshot();
  });

  it('低分姿态不渲染骨架线', async () => {
    const tree = await renderToJSON(<SkeletonOverlay pose={lowScorePose()} />);
    expect(tree).toMatchSnapshot();
  });

  it('空关键点不崩溃', async () => {
    const tree = await renderToJSON(<SkeletonOverlay pose={emptyPose()} />);
    expect(tree).toMatchSnapshot();
  });
});
