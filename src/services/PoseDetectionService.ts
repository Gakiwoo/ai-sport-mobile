import { Pose, Keypoint } from '../types';

/**
 * PoseDetectionService — 姿态检测辅助函数
 *
 * 注意：实际姿态检测使用 MediaPipe WebView 方案（CameraView.tsx），
 * 此模块提供几何计算辅助函数。
 */

export function getKeypoint(pose: Pose, name: string): Keypoint | undefined {
  return pose.keypoints.find((kp) => kp.name === name);
}

export function calculateAngle(a: Keypoint, b: Keypoint, c: Keypoint): number {
  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs((radians * 180.0) / Math.PI);
  if (angle > 180.0) angle = 360 - angle;
  return angle;
}

export function calculateDistance(a: Keypoint, b: Keypoint): number {
  return Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2));
}

/** 兼容旧版 default import（PoseDetectionService.getKeypoint 等） */
export default { getKeypoint, calculateAngle, calculateDistance };
