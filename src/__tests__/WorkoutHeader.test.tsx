/**
 * WorkoutHeader 组件测试
 *
 * 覆盖：渲染不崩溃、运动名称、模式切换、目标按钮
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

import WorkoutHeader from '../components/workout/WorkoutHeader';

describe('WorkoutHeader', () => {
  const defaultProps = {
    exerciseName: '跳绳',
    isActive: false,
    isTimed: false,
    targetCount: 100,
    targetDuration: 60,
    mode: 'count' as const,
    onOpenTargetModal: jest.fn(),
    onSwitchMode: jest.fn(),
  };

  beforeEach(() => {
    defaultProps.onOpenTargetModal.mockClear();
    defaultProps.onSwitchMode.mockClear();
  });

  it('渲染不崩溃', async () => {
    const tree = await renderToJSON(<WorkoutHeader {...defaultProps} />);
    expect(tree).toBeDefined();
  });

  it('显示运动名称', async () => {
    const tree = await renderToJSON(<WorkoutHeader {...defaultProps} />);
    const jsonStr = JSON.stringify(tree);
    expect(jsonStr).toContain('跳绳');
  });

  it('未激活时显示目标按钮和模式切换', async () => {
    const tree = await renderToJSON(<WorkoutHeader {...defaultProps} />);
    const jsonStr = JSON.stringify(tree);
    expect(jsonStr).toContain('定数模式');
    expect(jsonStr).toContain('定时模式');
  });

  it('激活时不显示目标按钮和模式切换', async () => {
    const tree = await renderToJSON(<WorkoutHeader {...defaultProps} isActive={true} />);
    const jsonStr = JSON.stringify(tree);
    expect(jsonStr).not.toContain('定数模式');
    expect(jsonStr).not.toContain('定时模式');
  });

  it('定数模式显示目标次数', async () => {
    const tree = await renderToJSON(<WorkoutHeader {...defaultProps} isTimed={false} />);
    const jsonStr = JSON.stringify(tree);
    expect(jsonStr).toContain('100');
  });

  it('定时模式显示目标时长', async () => {
    const tree = await renderToJSON(<WorkoutHeader {...defaultProps} isTimed={true} />);
    const jsonStr = JSON.stringify(tree);
    expect(jsonStr).toContain('01:00');
  });
});
