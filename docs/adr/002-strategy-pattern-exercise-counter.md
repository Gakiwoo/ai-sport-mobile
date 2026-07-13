# ADR-002: 策略模式 ExerciseCounter 基类

| 属性 | 值 |
|------|-----|
| 状态 | 已采纳 |
| 日期 | 2024-04 |
| 最近复核 | 2026-07-11，继续有效 |
| 决策者 | Gakiwoo |

## 上下文

项目支持 6 种运动类型（跳绳、开合跳、深蹲、立定跳远、纵跳摸高、仰卧起坐），每种运动的检测算法完全不同，但共享相同的接口（输入姿态数据 → 输出计数/反馈）。需要选择一种组织方式。

## 决策

采用 **策略模式 + 抽象基类** 的 OOP 架构：

- `ExerciseCounter` 抽象基类定义统一接口：`processFrame()`, `getCount()`, `getFeedback()`, `reset()`
- 每种运动继承基类，实现具体的状态机 + 检测算法
- `exerciseRegistry` 作为单一数据源，映射运动类型 → Counter 类 + 元数据

```typescript
abstract class ExerciseCounter {
  abstract processFrame(landmarks: NormalizedLandmark[]): CounterResult;
  abstract get count(): number;
  abstract get feedback(): FeedbackMessage[];
  abstract reset(): void;
}
```

## 可选方案

### 方案 A: 函数式管道

- **优点**: 无 this 绑定问题，天然可组合，易于测试
- **缺点**: 状态管理分散，每种运动需要独立的闭包管理；新增运动时无法通过类型系统强制接口一致性
- **结论**: 否决，状态机需要封装状态

### 方案 B: 单一大 switch/if-else

- **优点**: 简单直接
- **缺点**: 单文件膨胀、圈复杂度爆炸、无法独立测试
- **结论**: 否决，可维护性差

### 方案 C: 策略模式 + 抽象基类（采纳）

- **优点**: 接口统一且可被 TypeScript 强制检查、状态封装在实例内、新增运动只需继承 + 注册、可独立测试
- **缺点**: 需要理解 OOP 继承模式，子类需调用 super()
- **结论**: 采纳

## 影响

- 新增运动类型的标准流程：继承 `ExerciseCounter` → 实现 `processFrame()` → 注册到 `exerciseRegistry` → 编写测试
- 每个 Counter 实例管理自己的状态机，互不干扰
- `exerciseRegistry` 作为运动元数据单一数据源（名称、图标、帧率配置等）

## 修订记录

- 2024-04: 初始决策
- 2024-05: 增加 golden pose 回归测试框架，验证每个 Counter 的准确性
