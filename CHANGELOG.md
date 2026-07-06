# Changelog

All notable changes to AI Motion Tracker will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.2.0] — Unreleased

### Added
- **WorkoutRepository** 抽象层：`IWorkoutRepository` 接口 + `LocalWorkoutRepository` 实现
- **LocalWorkoutRecord** 类型：扩展 `WorkoutSession`，添加 `_syncStatus`、`_lastModified`、`_serverId` 字段
- **SyncService**：支持启动/训练后/网络恢复三种触发时机的云端同步骨架
- **SyncService 测试**（6 个测试用例）
- **WorkoutRepository 测试**（17 个测试用例，覆盖 CRUD、分析、数据迁移、边界值）
- **HistoryScreen / AnalyticsScreen / useWorkout** 改为使用 `WorkoutRepository`
- App.tsx 中集成 `SyncService` 生命周期管理
- 测试总数：282 → **346**（+64 个测试）
- 测试套件：46 → **48**（+2 个测试套件）

### Changed
- 整体代码覆盖率：60.46% → **60.96%**
- Counters 覆盖率：77.30% → **78.42%**
- `StorageService` 保留但标记为向后兼容，新代码使用 `WorkoutRepository`

---

## [1.1.0] — 2026-05-07

### Added
- **Sentry 集成**：`sentry-expo` v7 崩溃监控（ErrorBoundary + `__DEV__` 守卫）
- **15 个新测试文件**（7 Screen + 5 Workout 组件 + 3 工具/服务）
- **3 份 ADR** 架构决策记录（WebView/策略模式/CDN 回退）
- **i18n 国际化**：轻量引擎，支持中文/英文
- **LocaleContext**：语言切换上下文
- **PerformanceMonitor**：FPS、丢帧、内存监控
- **workout 组件拆分**：WorkoutActivePanel、WorkoutControls、WorkoutHeader、WorkoutSetupPanel、WorkoutTargetModal
- **Maestro E2E 骨架**（smoke-guest-squats + testID）
- **exerciseRegistry**：合并 exerciseConfig + exerciseRuntime
- **goldenPoseRunner**：黄金样本回归测试工具

### Fixed (P0 — 紧急修复)
- **Token 刷新竞态条件**：引入 `refreshOnce()` 单例锁
- **SitUpCounter setTimeout 状态错乱**：改为帧计数器驱动
- **Cookie 手工管理安全风险**：移除双通道，统一 Bearer Token

### Fixed (P1 — 质量提升)
- VerticalJumpCounter 新纪录反馈文案 Bug
- ExerciseCounter `count` 语义重载（新增 `getResultValue()`/`getResultUnit()`）
- `withTimeout` 提取到 utils
- App.tsx 导航标题接入 i18n
- PerformanceMonitor 帧数组上限
- 6 个 Counter 统一使用 `POSE_MIN_SCORE` 常量

### Fixed (P2 — 工程优化)
- JumpingJacksCounter 死代码移除
- ESLint `no-explicit-any` 和 `ban-ts-comment` 升级为 warn
- AuthContext `useAuth` 空检查生效
- PoseDetectionService 重构为纯函数

### Changed
- 版本号统一至 v1.1.0
- react-native mock 增强（Dimensions/Animated/FlatList/Modal）

---

## [1.0.0] — 2025-12

### Added
- 初始发布
- 6 种运动支持：跳绳、开合跳、深蹲、立定跳远、纵跳摸高、仰卧起坐
- MediaPipe Pose WebView + Blob URL 注入方案
- 策略模式运动计数器（ExerciseCounter 基类 + 6 子类）
- 自适应帧率（AdaptivePoseRuntime）
- CDN 多源回退（4 个 CDN 源）
- 定数模式 + 定时模式
- 实时动作质量反馈
- 训练历史 + 数据分析
- 游客模式 + 登录认证
- CI/CD（GitHub Actions：lint + test:coverage）
- Jest 覆盖率门槛（counters 75%、utils 80%、mediapipe 90%）

---

## Semantic Versioning Policy

- **MAJOR**（X.0.0）：破坏性 API 变更（如 Counter 接口签名变更、存储 schema 不兼容迁移）
- **MINOR**（0.X.0）：新增功能且向后兼容（如新增运动类型、新增 Repository 层）
- **PATCH**（0.0.X）：Bug 修复、性能优化、文档更新（不影响公共 API）
