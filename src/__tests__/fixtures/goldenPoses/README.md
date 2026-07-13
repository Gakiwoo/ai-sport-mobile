# Golden Pose fixtures

> 2026-07-11 复核：fixture 仅用于确定性回归，不计入 500 段真实视频数据集，也不能作为算法准确率证据。

JSON 描述「帧序列 → 期望计数/阶段」，供 `goldenPoseRegression.test.ts` 回归。

## 格式

```json
{
  "id": "squats-one-rep",
  "exerciseType": "squats",
  "frameIntervalMs": 100,
  "steps": [{ "preset": "standing", "frames": 35 }],
  "expect": { "minCount": 1, "maxCount": 2, "finalPhaseOneOf": ["standing"] }
}
```

`preset` 对应 `testHelpers.ts` 中的姿态工厂（`standing`、`squat_bottom`、`lying` 等）。

注意：立定跳远 / 纵跳摸高的 `count` 表示 **距离或高度（cm）**，不是次数。

## 新增样本

1. 在 `testHelpers.ts` 增加或复用 preset
2. 在此目录添加 JSON
3. 在 `goldenPoseRegression.test.ts` 的 `FIXTURES` 数组中注册
