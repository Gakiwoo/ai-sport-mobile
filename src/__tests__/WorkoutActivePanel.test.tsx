/**
 * WorkoutActivePanel 组件测试
 *
 * 覆盖：渲染不崩溃、计时/定数模式、进度显示、反馈
 */
import React from 'react';
import { renderToJSON } from './testRenderer';
import { ExerciseFeedback } from '../types';

// ── 导航 mock ──
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
  useRoute: () => ({ params: {} }),
}));
jest.mock('@react-navigation/stack', () => ({
  createStackNavigator: () => ({ Navigator: () => null, Screen: () => null }),
}));

import WorkoutActivePanel from '../components/workout/WorkoutActivePanel';

describe('WorkoutActivePanel', () => {
  const mockAnimValue = new (require('react-native').Animated.Value)(1);

  const defaultProps = {
    isTimed: false,
    count: 10,
    targetCount: 50,
    countdown: 30,
    timeUp: false,
    countdownAnim: mockAnimValue,
    currentFeedback: null as ExerciseFeedback | null,
  };

  it('渲染不崩溃', async () => {
    const tree = await renderToJSON(<WorkoutActivePanel {...defaultProps} />);
    expect(tree).toBeDefined();
  });

  it('定数模式显示进度百分比', async () => {
    const tree = await renderToJSON(
      <WorkoutActivePanel {...defaultProps} isTimed={false} count={10} targetCount={50} />,
    );
    const jsonStr = JSON.stringify(tree);
    expect(jsonStr).toContain('20%'); // 10/50 = 20%
  });

  it('定时模式显示倒计时', async () => {
    const tree = await renderToJSON(
      <WorkoutActivePanel {...defaultProps} isTimed={true} countdown={30} />,
    );
    const jsonStr = JSON.stringify(tree);
    expect(jsonStr).toContain('00:30');
  });

  it('显示当前次数', async () => {
    const tree = await renderToJSON(<WorkoutActivePanel {...defaultProps} count={42} />);
    const jsonStr = JSON.stringify(tree);
    expect(jsonStr).toContain('42');
  });

  it('显示反馈消息', async () => {
    const tree = await renderToJSON(
      <WorkoutActivePanel
        {...defaultProps}
        currentFeedback={{ type: 'warning', message: '注意姿势' }}
      />,
    );
    const jsonStr = JSON.stringify(tree);
    expect(jsonStr).toContain('注意姿势');
  });
});
