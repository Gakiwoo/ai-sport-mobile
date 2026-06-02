/**
 * WorkoutSetupPanel 组件测试
 *
 * 覆盖：渲染不崩溃、倒计时、站位引导
 */
import React from 'react';
import { renderToJSON } from './testRenderer';

// ── 导航 mock ──
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
  useRoute: () => ({ params: {} }),
}));
jest.mock('@react-navigation/stack', () => ({
  createStackNavigator: () => ({ Navigator: () => null, Screen: () => null }),
}));

import WorkoutSetupPanel from '../components/workout/WorkoutSetupPanel';
import { AutoStartPhase } from '../hooks/useWorkoutScreen';

describe('WorkoutSetupPanel', () => {
  const mockPoseQuality = {
    status: 'good' as const,
    canStart: true,
    message: '准备就绪',
    visibilityScore: 0.9,
    averageScore: 0.85,
    bodyHeightRatio: 0.5,
  };

  it('渲染不崩溃', async () => {
    const tree = await renderToJSON(
      <WorkoutSetupPanel
        count={0}
        startCountdown={null}
        poseQuality={null}
        autoStartPhase={null}
      />,
    );
    expect(tree).toBeDefined();
  });

  it('倒计时模式显示数字', async () => {
    const tree = await renderToJSON(
      <WorkoutSetupPanel
        count={0}
        startCountdown={3}
        poseQuality={null}
        autoStartPhase={null}
      />,
    );
    const jsonStr = JSON.stringify(tree);
    expect(jsonStr).toContain('3');
  });

  it('站位识别阶段显示提示', async () => {
    const tree = await renderToJSON(
      <WorkoutSetupPanel
        count={0}
        startCountdown={null}
        poseQuality={null}
        autoStartPhase="waiting"
      />,
    );
    const jsonStr = JSON.stringify(tree);
    // 当 poseQuality 为 null 且 autoStartPhase 不是 ready 时显示默认提示
    expect(jsonStr).toContain('识别');
  });

  it('ready 阶段显示自动开始提示', async () => {
    const tree = await renderToJSON(
      <WorkoutSetupPanel
        count={0}
        startCountdown={null}
        poseQuality={mockPoseQuality}
        autoStartPhase="ready"
      />,
    );
    const jsonStr = JSON.stringify(tree);
    expect(jsonStr).toContain('自动开始');
  });
});
