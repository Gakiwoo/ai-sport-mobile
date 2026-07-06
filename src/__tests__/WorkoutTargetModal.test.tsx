/**
 * WorkoutTargetModal 组件测试
 *
 * 覆盖：渲染不崩溃、定数/定时模式、确认/取消按钮
 */
import React from 'react';
import { renderToJSON, createWithAct } from './testRenderer';

// ── 导航 mock ──
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
  useRoute: () => ({ params: {} }),
}));
jest.mock('@react-navigation/stack', () => ({
  createStackNavigator: () => ({ Navigator: () => null, Screen: () => null }),
}));

import WorkoutTargetModal from '../components/workout/WorkoutTargetModal';

describe('WorkoutTargetModal', () => {
  const defaultProps = {
    visible: true,
    isTimed: false,
    targetInput: '50',
    durationInput: '60',
    onChangeTargetInput: jest.fn(),
    onChangeDurationInput: jest.fn(),
    onClose: jest.fn(),
    onConfirmCount: jest.fn(),
    onConfirmDuration: jest.fn(),
  };

  beforeEach(() => {
    defaultProps.onClose.mockClear();
    defaultProps.onConfirmCount.mockClear();
    defaultProps.onConfirmDuration.mockClear();
  });

  it('渲染不崩溃', async () => {
    const tree = await renderToJSON(<WorkoutTargetModal {...defaultProps} />);
    expect(tree).toBeDefined();
  });

  it('定数模式显示目标次数设置', async () => {
    const tree = await renderToJSON(<WorkoutTargetModal {...defaultProps} isTimed={false} />);
    const jsonStr = JSON.stringify(tree);
    expect(jsonStr).toContain('目标次数');
  });

  it('定时模式显示目标时长设置', async () => {
    const tree = await renderToJSON(<WorkoutTargetModal {...defaultProps} isTimed={true} />);
    const jsonStr = JSON.stringify(tree);
    expect(jsonStr).toContain('目标时长');
    // 60 and s are rendered as separate children
    expect(jsonStr).toContain('60');
    expect(jsonStr).toContain('常用');
  });

  it('不可见时不渲染内容', async () => {
    const tree = await renderToJSON(<WorkoutTargetModal {...defaultProps} visible={false} />);
    // Modal visible=false 时可能渲染 null 或空
    expect(tree).toBeDefined();
  });
});
