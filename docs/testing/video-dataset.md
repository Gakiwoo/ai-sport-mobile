# 500 段真实视频算法回归数据集

> 更新日期：2026-07-11
>
> 数据清单：`docs/testing/video-dataset-manifest.json`
>
> 当前状态：500 个规划槽位；0 recorded / 0 annotated / 0 approved

第一阶段先完成 100 段可复核真实样本并形成首版算法基线，再扩展到 500 段。规划槽位、合成数据或空文件均不得计入采集数量。

## 目标

该数据集用于商业场景算法验证，不是单元测试夹具。视频必须来自真实设备和真实动作，标注必须由人工完成，代码不得伪造媒体、标签或审批结果。

| 运动项目             | 目标数量 | 主要覆盖场景                                     |
| -------------------- | -------: | ------------------------------------------------ |
| `jump_rope`          |      100 | 正常、快、慢、半身、低光、侧角度                 |
| `squats`             |      100 | 标准深度、浅蹲、快动作、膝内扣、背部前倾、侧角度 |
| `sit_ups`            |       75 | 标准、不完整、手部借力、低光                     |
| `jumping_jacks`      |       75 | 标准、抬臂不足、腿幅不足、快动作                 |
| `standing_long_jump` |       75 | 标准、踩线、落地不稳、侧角度                     |
| `vertical_jump`      |       75 | 标准、摆臂变化、低高度、遮挡                     |
| 合计                 |      500 | 覆盖设备、光线、角度、速度和错误动作             |

立定跳远与纵跳数据用于训练估算和实验验证。完成固定机位标定与误差报告前，不作为考试级正式成绩依据。

## Manifest 规则

`coverage` 只定义规划矩阵，不等于已经创建 500 条视频记录。每个真实样本都必须在 `videos` 中新增一行，并满足：

- `id` 唯一且非空。
- `exerciseType` 必须属于覆盖矩阵。
- `status` 只能是 `planned`、`recorded`、`annotated` 或 `approved`。
- `path` 使用仓库根目录的相对路径，例如 `test-data/videos/jump_rope/jr-001.mp4`。
- 状态达到 `recorded` 后，对应媒体文件必须真实存在。
- 只有完成真实次数/距离/高度和动作事件人工标注后，才能进入 `annotated`。
- `annotated` 样本必须在 `expected` 中填写一个真值字段：`count`、`distanceCm` 或 `heightCm`。
- `approved` 样本必须在 `actual` 中填写与 `expected` 同名的算法结果；可额外填写 `missedDetections` 和 `falseDetections`。
- 只有经过第二人或指定负责人复核后，才能进入 `approved`。

原始视频放在 Git 外的 `test-data/videos/`。涉及未成年人时，采集前必须完成学校/监护授权、用途告知、保存期限和删除流程。

## 建议标注字段

每个样本至少记录：

- 真实次数，或真实距离/高度。
- 动作开始和结束时间。
- 每次有效动作时间点。
- 无效动作与犯规类型。
- 机位方向、距离、分辨率和帧率。
- 设备型号、系统版本、光线与遮挡情况。
- 标注人、复核人和算法版本。

## 校验命令

普通模式检查 manifest 结构、覆盖总数、重复 ID、状态、路径和已录制文件是否存在：

```powershell
npm run test:video-dataset
```

严格模式要求 500 个样本全部达到 recorded、annotated 和 approved；任一数量不足即退出失败：

```powershell
npm run test:video-dataset -- --strict
```

生成当前算法回归摘要：

```powershell
npm run report:algorithm
```

报告会按项目输出 MAE、MAPE、漏检、误检和误差最大的失败样例。严格发布门禁要求 500 个样本全部 approved 且都有匹配算法结果：

```powershell
npm run report:algorithm:strict
```

当前报告指标仍为 `n/a`，因为还没有 annotated/approved 真值。普通报告命令成功不代表算法门禁通过。

## 验收门禁

| 阶段     | 最低证据                                                    |
| -------- | ----------------------------------------------------------- |
| 采集完成 | 500/500 recorded，文件可读且元数据完整                      |
| 标注完成 | 500/500 annotated，真值和犯规字段完整                       |
| 审批完成 | 500/500 approved，有复核责任人                              |
| 算法发布 | approved 样本上输出分项目误差、准确率、漏检、误检与失败样例 |

数据集未达到门禁前，任何准确率或误差百分比只能作为目标，不能写成已验证结果。
