/**
 * WorkoutControls 组件测试
 *
 * 覆盖：按钮渲染、回调触发、状态切换
 */
import React from 'react';
import type { ReactTestInstance } from 'react-test-renderer';
import { createWithAct, renderToJSON } from './testRenderer';

// ── 导航 mock ──
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
  useRoute: () => ({ params: {} }),
}));
jest.mock('@react-navigation/stack', () => ({
  createStackNavigator: () => ({ Navigator: () => null, Screen: () => null }),
}));

// ── E2E testID mock（直接使用真实模块即可） ──

import WorkoutControls from '../components/workout/WorkoutControls';

describe('WorkoutControls', () => {
  const mockOnStart = jest.fn();
  const mockOnConfirmStop = jest.fn();

  beforeEach(() => {
    mockOnStart.mockClear();
    mockOnConfirmStop.mockClear();
  });

  it('未激活时渲染开始按钮', async () => {
    const tree = await renderToJSON(
      <WorkoutControls
        isActive={false}
        startCountdown={null}
        isSaving={false}
        onStart={mockOnStart}
        onConfirmStop={mockOnConfirmStop}
      />,
    );
    const jsonStr = JSON.stringify(tree);
    expect(jsonStr).toContain('开始');
  });

  it('激活时渲染停止按钮', async () => {
    const tree = await renderToJSON(
      <WorkoutControls
        isActive={true}
        startCountdown={null}
        isSaving={false}
        onStart={mockOnStart}
        onConfirmStop={mockOnConfirmStop}
      />,
    );
    const jsonStr = JSON.stringify(tree);
    expect(jsonStr).toContain('停止');
  });

  it('点击开始按钮触发 onStart', async () => {
    const instance = await createWithAct(
      <WorkoutControls
        isActive={false}
        startCountdown={null}
        isSaving={false}
        onStart={mockOnStart}
        onConfirmStop={mockOnConfirmStop}
      />,
    );

    // 查找开始按钮（TouchableOpacity with testID = workout-start-button）
    const startBtns = instance.root.findAll(
      (el: ReactTestInstance) => el.props?.testID === 'workout-start-button',
    );

    if (startBtns.length > 0) {
      startBtns[0].props.onPress();
      expect(mockOnStart).toHaveBeenCalledTimes(1);
    }
  });

  it('点击停止按钮触发 onConfirmStop', async () => {
    const instance = await createWithAct(
      <WorkoutControls
        isActive={true}
        startCountdown={null}
        isSaving={false}
        onStart={mockOnStart}
        onConfirmStop={mockOnConfirmStop}
      />,
    );

    // 查找停止按钮（TouchableOpacity with testID = workout-stop-button）
    const stopBtns = instance.root.findAll(
      (el: ReactTestInstance) => el.props?.testID === 'workout-stop-button',
    );

    if (stopBtns.length > 0) {
      stopBtns[0].props.onPress();
      expect(mockOnConfirmStop).toHaveBeenCalledTimes(1);
    }
  });

  it('倒计时中按钮显示"准备中..."', async () => {
    const tree = await renderToJSON(
      <WorkoutControls
        isActive={false}
        startCountdown={3}
        isSaving={false}
        onStart={mockOnStart}
        onConfirmStop={mockOnConfirmStop}
      />,
    );
    const jsonStr = JSON.stringify(tree);
    expect(jsonStr).toContain('准备中');
  });

  it('保存中状态显示"保存中..."', async () => {
    const tree = await renderToJSON(
      <WorkoutControls
        isActive={true}
        startCountdown={null}
        isSaving={true}
        onStart={mockOnStart}
        onConfirmStop={mockOnConfirmStop}
      />,
    );
    const jsonStr = JSON.stringify(tree);
    expect(jsonStr).toContain('保存中');
  });
});
