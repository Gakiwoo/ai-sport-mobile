# Changelog

All notable changes to AI Motion Tracker will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Security (2026-07-20)

- 新增 `plugins/network_security_config.xml`：全局禁止明文 HTTP 流量，仅开发环境允许 10.0.2.2/localhost。
- 新增 `plugins/withNetworkSecurityConfig.js`：Expo config plugin 注入 Android 网络安全配置。
- `eas.json` preview + production 启用 R8 fullMode 代码混淆。
- 根目录部署脚本凭据已移除（改为 `ssh-config.mjs` + 环境变量方案）。
- 根目录 `scripts/{ssh-exec,upload,sftp-upload}.mjs` 硬编码高权限凭据已轮换修复（07-13 发现，07-20 修复）。

### Added (2026-07-11 to 07-20)

- `src/__tests__/AuthContext.test.tsx`：9 个测试覆盖 useAuth 守卫、AuthProvider 导出、游客用户创建、AuthError、渲染。
- `pilot-v1` 跨端规范 fixture 与合同漂移校验。
- 低端 Android 30 分钟稳定性报告门禁。
- 算法回归 MAE/MAPE、漏检、误检与失败样例报告。

### Changed (2026-07-11 to 07-20)

- `app.json` 注册 `withNetworkSecurityConfig` 插件。
- 测试总数：398 → **407**（+9）；测试套件：55 → **56**（+1）。
- PerformanceMonitor 改为短窗口实时数据与全会话聚合并存。
- ESLint 收敛为零 warning 门禁。
- EAS preview APK、Windows EXE/NSIS 与 macOS arm64 DMG 已形成候选产物。

### Fixed (2026-07-11 to 07-20)

- 显式声明 Expo Babel preset，修复干净 EAS 环境 Metro 构建。
- 收窄 `minimatch@3` 的安全 override，修复 React Native Codegen。
- preview 构建在未配置 Sentry 项目时显式禁用 source map 上传。

### Status (2026-07-24 baseline)

- tsc 0 错误，56 suites / 407 tests / 14 snapshots 通过
- ESLint 0 warning
- Expo Doctor 19/19 通过
- 线上复查：MediaPipe CDN 200，Auth 401（预期），Sync/Pilot GET 仍 404
- 2026-07-20 安全加固：HTTPS 强制、R8 fullMode、AuthContext 测试、凭据移除

---

## [1.2.0] — 2026-07-08

### Added
- **WorkoutRepository** 抽象层：`IWorkoutRepository` 接口 + `LocalWorkoutRepository` 分键存储实现
- **LocalWorkoutRecord** 类型：扩展 `WorkoutSession`，添加 `_syncStatus`、`_lastModified`、`_serverId` 字段
- **SyncService**：支持启动/训练后/网络恢复三种触发时机的云端同步，指数退避重试
- **PilotDataPackageService** — 评分引擎集成、校园数据包导出、`importPackage` 安全校验
- **scoring.ts** — `scoreSession()` 纯函数 + `extractScoringInput()` 共享提取器（双端同构）
- **extractScoringInput** — 从 WorkoutSession 提取评分输入的共享函数，消除 useWorkoutScreen 与 PilotDataPackageService 间的重复逻辑
- **服务器后端部署** — `gakiwoo.com` 上线：
  - `POST/GET /api/workouts/sync` — 训练记录双向同步
  - `GET /api/workouts/stats` — 训练统计
  - `/api/pilot/{schools,classrooms,students,tasks,assignments}` — 校园试点 API
  - MediaPipe CDN 补全 lite 模型（`pose_landmark_lite.tflite`）
- **TrainingTask** 新增 `targetCm` 字段
- SyncService 测试、WorkoutRepository 测试、scoring 测试、PilotDataPackageService 测试
- 测试总数：282 → **393**（+111 个测试）
- 测试套件：46 → **53**（+7 个测试套件）

### Fixed (P0 — 正确性)
- **SitUpCounter** 髋部离地检测公式方向：`(baseline-current)` → `(current-baseline)`，犯规检测恢复正常
- **JumpRopeCounter** Kalman 参数对齐 Desktop（0.5,6 → 0.0005,0.006），velocity 阈值同步（-0.4→-0.0005），消除 800x 跨端差异
- **SRI 哈希** 添加验证文档和升级指引

### Fixed (P1 — 持久性与可靠性)
- **WorkoutRepository.save()** trimExcess 新增 `protectedId` 参数，防止刚保存的记录被立即删除
- **WorkoutRepository.delete()** 先更新索引再删数据键，防止部分失败导致数据丢失
- **WorkoutRepository.ensureIndex()** 迁移时先写索引再删旧键，防止中间崩溃
- **WorkoutRepository.batchMarkSynced()** multiGet 并行读取替代串行 getItem
- **PilotDataPackageService.importPackage()** 添加 JSON 大小（10MB）+ 数组长度（10000）+ 类型校验
- **useWorkoutScreen** handleStop 使用训练开始时快照的 targetCount，防止中途修改目标导致评分失真

### Fixed (P1 — 评分一致性)
- **targetCm** 传递链路补全：ScoringInput → scoreSessionRecord → scoreSession → DISTANCE_REFERENCE 降级

### Changed
- `StorageService` 保留但标记为 @deprecated，新代码使用 `WorkoutRepository`
- 测试总数：282 → 393 | 测试套件：46 → 53
- 整体代码覆盖率：60.46% → **60.96%**
- Counters 覆盖率：77.30% → **78.42%**

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
