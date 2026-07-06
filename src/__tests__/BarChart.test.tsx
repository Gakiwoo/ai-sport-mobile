/**
 * BarChart 组件测试
 *
 * 使用 toJSON() 快照，避免 root 遍历与 SVG mock 冲突。
 */
import React from 'react';
import BarChart from '../components/BarChart';
import { renderToJSON } from './testRenderer';

describe('BarChart', () => {
  it('有数据时渲染柱状图快照', async () => {
    const data = [
      { label: '一', value: 10 },
      { label: '二', value: 20 },
      { label: '三', value: 15 },
    ];
    const tree = await renderToJSON(<BarChart data={data} title="测试图表" />);
    expect(tree).toMatchSnapshot();
  });

  it('空数据渲染快照', async () => {
    const tree = await renderToJSON(<BarChart data={[]} title="空图表" />);
    expect(tree).toMatchSnapshot();
  });

  it('无标题时渲染快照', async () => {
    const tree = await renderToJSON(<BarChart data={[]} />);
    expect(tree).toMatchSnapshot();
  });

  it('单条数据渲染快照', async () => {
    const tree = await renderToJSON(
      <BarChart data={[{ label: '单', value: 42, color: '#FF0000' }]} />,
    );
    expect(tree).toMatchSnapshot();
  });

  it('不崩溃', async () => {
    const tree = await renderToJSON(
      <BarChart data={[{ label: 'A', value: 5 }]} title="我的图表" />,
    );
    expect(tree).toBeDefined();
  });
});
