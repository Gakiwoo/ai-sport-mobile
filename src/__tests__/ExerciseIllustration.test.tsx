/**
 * ExerciseIllustration 组件测试
 *
 * 纯渲染组件，根据 ExerciseType 渲染对应的 SVG 插画。
 * SVG 元素已被 mock 为 View，测试验证渲染输出结构和 props。
 */
import React from 'react';
import ExerciseIllustration from '../components/ExerciseIllustration';
import { renderToJSON } from './testRenderer';

describe('ExerciseIllustration', () => {
  it('渲染跳绳插画', async () => {
    const tree = await renderToJSON(<ExerciseIllustration type="jump_rope" />);
    expect(tree).toMatchSnapshot();
  });

  it('渲染开合跳插画', async () => {
    const tree = await renderToJSON(<ExerciseIllustration type="jumping_jacks" />);
    expect(tree).toMatchSnapshot();
  });

  it('渲染深蹲插画', async () => {
    const tree = await renderToJSON(<ExerciseIllustration type="squats" />);
    expect(tree).toMatchSnapshot();
  });

  it('渲染立定跳远插画', async () => {
    const tree = await renderToJSON(<ExerciseIllustration type="standing_long_jump" />);
    expect(tree).toMatchSnapshot();
  });

  it('渲染纵跳插画', async () => {
    const tree = await renderToJSON(<ExerciseIllustration type="vertical_jump" />);
    expect(tree).toMatchSnapshot();
  });

  it('渲染仰卧起坐插画', async () => {
    const tree = await renderToJSON(<ExerciseIllustration type="sit_ups" />);
    expect(tree).toMatchSnapshot();
  });

  it('接收 size prop', async () => {
    const tree = await renderToJSON(<ExerciseIllustration type="squats" size={80} />);
    expect(tree).toMatchSnapshot();
  });

  it('未知类型返回 null', async () => {
    const tree = await renderToJSON(<ExerciseIllustration type={'invalid' as any} />);
    // 当类型不存在于 illustrations 中时返回 null，renderer 会返回 null
    expect(tree).toBeNull();
  });
});
