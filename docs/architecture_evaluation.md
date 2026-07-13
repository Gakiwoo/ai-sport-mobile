# AI Sport（AI运动助手）架构与技术评估报告

> 文档状态：2025-05-14 历史架构评估。当前工程状态与风险见[系统工程基线](../../AI-Sport-System-当前工程基线-2026-07-13.md)；稳定架构决策以 `docs/adr/` 为准。

> 评估人：Bob (Architect) | 日期：2025-05-14 | 代码基线：~8,267 行 TS/TSX，63 源文件，21 测试文件

---

## 总体评分

| 维度 | 评分 | 权重 | 加权 |
|------|------|------|------|
| 1. 项目结构 | ⭐⭐⭐⭐ (4/5) | 10% | 0.40 |
| 2. 架构模式 | ⭐⭐⭐⭐½ (4.5/5) | 15% | 0.68 |
| 3. 技术选型 | ⭐⭐⭐½ (3.5/5) | 15% | 0.53 |
| 4. 状态管理 | ⭐⭐⭐½ (3.5/5) | 10% | 0.35 |
| 5. 代码质量 | ⭐⭐⭐⭐ (4/5) | 15% | 0.60 |
| 6. 性能架构 | ⭐⭐⭐⭐ (4/5) | 15% | 0.60 |
| 7. 安全隐私 | ⭐⭐⭐½ (3.5/5) | 10% | 0.35 |
| 8. 可扩展性 | ⭐⭐⭐⭐ (4/5) | 10% | 0.40 |
| **整体评分** | **⭐⭐⭐⭐ (3.91/5)** | 100% | **3.91** |

---

## 1. 项目结构 ⭐⭐⭐⭐ (4/5)

### 现状分析

```
src/
├── __tests__/           # 21 测试文件，与源码同构
├── components/          # 5 个组件
├── constants/           # exerciseConfig
├── contexts/            # AuthContext
├── hooks/               # 4 个 hooks
├── screens/             # 7 个屏幕
├── services/            # 核心服务层
│   └── counters/        # 6 个计数器（策略模式子类）
├── types/               # 类型定义
└── utils/               # 10 个工具模块
```

### 优点
- **清晰的关注点分离**：components / hooks / screens / services / types / utils 分层合理
- **Counters 子目录**：6 个计数器独立文件，符合开闭原则
- **类型集中管理**：`types/index.ts` + `types/auth.ts` + `types/navigation.ts`，类型定义不散落
- **命名规范统一**：PascalCase 组件、camelCase 工具、kebab_case 运动类型

### 待改进
- `CameraView.tsx` (756行) 内嵌了约 400 行 HTML/JS 字符串 — 建议提取到独立 `.html` 文件或 `mediapipeBridge.ts`
- `WorkoutScreen.tsx` (25,536 字节) 偏大，部分 UI 逻辑可抽离为子组件
- `constants/exerciseConfig.ts` 与 `utils/exerciseRuntime.ts` 职责有重叠（都定义运动参数），建议合并

---

## 2. 架构模式 ⭐⭐⭐⭐½ (4.5/5)

### 核心模式识别

#### ✅ 策略模式（Strategy Pattern）— 设计亮点
```
ExerciseCounter (abstract)
  ├── JumpRopeCounter    — 双信号融合（手腕旋转 + 髋部弹跳）
  ├── JumpingJacksCounter
  ├── SquatsCounter
  ├── StandingLongJumpCounter
  ├── VerticalJumpCounter
  └── SitUpCounter
```
- **基类职责清晰**：`processFrame()` 抽象、`getCount()`/`reset()`/`getPhase()`/`getFeedback()` 统一接口
- **帧间隔自适应**：`setFrameInterval()` + `framesForMs()` + `framesAt30Fps()` 将时间概念归一化为帧数，解耦算法与帧率
- **子类内聚度极高**：JumpRopeCounter 内部包含 Kalman 滤波、状态机、双信号融合，完全自包含

#### ✅ 工厂模式
```typescript
function createCounter(type: ExerciseType): ExerciseCounter {
  switch (type) { case 'jump_rope': return new JumpRopeCounter(); ... }
}
```
简洁有效，新增运动类型只需加一个 case。

#### ✅ Provider 模式 + Context
```
AuthProvider → AuthContext → useAuth() hook
```
认证状态全局共享，登录/游客双模式。

#### ✅ 自定义 Hook 模式
- `useWorkout(exerciseType)` — 封装训练生命周期的全部状态与操作
- `useWebViewMessageHandler` — WebView ↔ RN 双向通信桥接
- `useExerciseFeedback` / `useSound` — UI 辅助 hooks

#### ✅ 单例服务
- `StorageService` (default export instance)
- `PoseDetectionService` (default export instance)
- `mediaPipeAssetService` (named export instance)

### 耦合度评估

| 模块间关系 | 耦合度 | 评价 |
|-----------|--------|------|
| Counter ↔ Pose | 低（仅依赖 Pose 类型） | ✅ 良好 |
| useWorkout ↔ Counters | 中（工厂创建具体类） | ✅ 可接受 |
| CameraView ↔ WebView HTML | **高**（HTML 字符串内嵌） | ⚠️ 需改进 |
| AuthContext ↔ AuthService | 中（直接调用静态方法） | ✅ 可接受 |
| WorkoutScreen ↔ CameraView | 中（props 传递） | ✅ 正常 |

---

## 3. 技术选型 ⭐⭐⭐½ (3.5/5)

### 当前选型

| 技术 | 版本 | 用途 | 评价 |
|------|------|------|------|
| React Native | 0.83.6 | 跨平台框架 | ✅ 最新稳定版 |
| Expo SDK | 55 | 开发工具链 | ✅ 简化原生模块接入 |
| TypeScript | 5.5 (strict) | 类型安全 | ✅ 最佳实践 |
| @react-navigation/stack | v6 | 页面导航 | ✅ 成熟方案 |
| expo-camera | ~55 | 相机权限 | ✅ Expo 原生集成 |
| react-native-webview | 13.16 | MediaPipe 宿主 | ⚠️ 有替代方案 |
| react-native-svg | 15.15 | 图表渲染 | ✅ 轻量 |
| expo-av | ~16 | 音效反馈 | ✅ |
| AsyncStorage | 2.2 | 本地持久化 | ✅ |

### MediaPipe via WebView 方案评估

**当前架构**：
```
expo-camera (权限) → WebView (getUserMedia + MediaPipe Pose) → postMessage → RN
```

**优点**：
- 跨平台一致性好（MediaPipe JS 在 WebView 内运行，不依赖原生）
- 资产缓存机制成熟（本地 + CDN 回退）
- 不依赖原生编译（无 C++/Kotlin/Swift 版本碎片问题）

**缺点**：
- **序列化开销**：每帧 Pose 数据需 JSON.stringify → postMessage → JSON.parse
- **WebView 内存占用**：独立 JS 引擎 + 渲染上下文，额外 ~50-150MB
- **启动延迟**：WebView 初始化 + 模型加载约 3-8 秒
- **帧率受限**：受限于 WebView 内 `requestAnimationFrame` 性能

### 替代方案分析

| 方案 | 性能 | 复杂度 | 推荐度 |
|------|------|--------|--------|
| 当前 WebView + MediaPipe JS | ⭐⭐⭐ | ⭐⭐ | 短期维持 |
| react-native-vision-camera Frame Processor | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | **中期迁移目标** |
| expo-camera + MLKit (Android) / Vision (iOS) | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 不推荐（平台分裂） |
| 纯原生模块封装 MediaPipe | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 长期可选 |

**建议**：当前 WebView 方案对 MVP 阶段合理，中期 (v2.0) 应迁移至 `react-native-vision-camera` + frame processor 方案，可降低 50% 延迟 + 40% 内存。

---

## 4. 状态管理 ⭐⭐⭐½ (3.5/5)

### 当前方案：Context + useRef + useState

```
AuthContext (全局认证)
  └── useWorkout hook (局部训练状态)
       ├── useState × 8 (isActive, count, mode, ...)
       ├── useRef  × 3 (startTimeRef, prevCountRef, isActiveRef)
       └── useCallback × 5 (processFrame, start, stop, ...)
```

### 优点
- 当前规模下足够用（~8K 行代码）
- 没有引入额外依赖，bundle 轻量
- `isActiveRef` 解决 `processFrame` 回调中的闭包陈旧问题

### 痛点
- **ref 同步模式**：`isActiveRef.current = isActive` 是绕过闭包陈旧的手动方案，规模增大后易出错
- **WorkoutScreen 持有过多状态**：~25KB 文件包含大量 UI 状态，建议拆分
- **无跨屏幕状态共享**：如果将来需要在 HomeScreen 显示实时训练数据，当前方案需重构

### 建议

| 阶段 | 方案 | 理由 |
|------|------|------|
| 当前 (v1) | Context + hooks + refs | ✅ 维持现状 |
| v1.5 (如有跨屏需求) | 引入 Zustand | 轻量（<1KB），API 简洁，天然解决闭包陈旧 |
| v2.0 (如有离线/同步) | Zustand + persist 中间件 | 替代 AsyncStorage 直调 |

**Zustand 示例（如引入）**：
```typescript
const useWorkoutStore = create<WorkoutState>()((set, get) => ({
  isActive: false, count: 0,
  processFrame: (pose) => { /* 直接读 get().isActive，无陈旧闭包 */ },
}));
```

---

## 5. 代码质量 ⭐⭐⭐⭐ (4/5)

### 类型安全 ⭐⭐⭐⭐⭐
- TypeScript `strict: true` — 最高标准
- 所有类型集中定义：`ExerciseType` 联合类型、`WorkoutMode`、`Pose`、`Keypoint`、`ExerciseFeedback`
- Auth 类型独立文件：`User`、`AuthTokens`、`LoginRequest` 等

### 错误处理 ⭐⭐⭐⭐
- **ErrorBoundary**：全局 React 错误捕获 + 本地日志（最多 50 条）
- **WebView 超时**：30s 初始化超时，blob ack 30s 超时
- **Auth 401 自动刷新**：`authFetch` 拦截 401 → refresh → 重试
- **CDN 回退链**：gakiwoo.com → npmmirror → jsdelivr → unpkg，且记录成功/失败 CDN
- **小瑕疵**：`CameraView` 中 `catch (err)` 多处用 `console.warn` 吞掉错误，未上报

### 边界情况 ⭐⭐⭐½
- `StorageService.getWorkoutHistory()` 向后兼容（`mode` 默认 `'count'`）
- `PoseDetectionService.calculateAngle()` 处理置信度 < 0.3 的关键点
- `poseQuality.ts` 处理 7 种质量状态（unknown/not_visible/too_close/too_far/near_edge/low_confidence/good）
- **缺失**：无水合/加载失败的降级 UI（仅 ActivityIndicator）

### 代码复用度 ⭐⭐⭐⭐
- `ExerciseCounter` 基类复用良好（`getKeypoint`/`calculateAngle`/`getRate`/`framesForMs`）
- `filters.ts` 提供 `KalmanFilter1D` + `SlidingWindow` 被 JumpRopeCounter 等复用
- `webViewAssetInjection.ts` 提供通用的 blob 分块注入脚本构建函数

### 测试覆盖 ⭐⭐⭐⭐
- 21 个测试文件，覆盖所有 Counter、AuthService、StorageService、核心 utils
- `testHelpers.ts` 提供共享的 mock pose 工厂函数
- 测试用例包含边界情况（空数据、异常输入）

---

## 6. 性能架构 ⭐⭐⭐⭐ (4/5)

### 帧率控制 — 设计亮点

```
exerciseRuntime.ts          adaptivePoseRuntime.ts
┌─────────────────┐         ┌──────────────────────┐
│ 运动类型 → 帧间隔  │ ───→   │ 自适应调整             │
│ jump_rope: 80ms  │         │ inference慢 → 加大间隔  │
│ squats:   130ms  │         │ inference快 → 缩小间隔  │
│ sit_ups:  130ms  │         │ 范围: baseInterval~max │
└─────────────────┘         └──────────────────────┘
```

- **每种运动独立 profile**：`activePoseIntervalMs` / `previewPoseIntervalMs` / `maxAdaptiveIntervalMs` / `modelComplexity`
- **自适应算法**：连续 N 帧推理慢 → 加大间隔（防掉帧）；连续 N 帧推理快 → 缩小间隔（提精度）
- **Canvas 绘制跳跃**：训练中 `drawSkipEvery = 1`（隔帧绘制骨骼），预演中每帧绘制

### WebView 性能优化
- **内嵌 HTML**：避免网络加载，首屏即渲染
- **requestAnimationFrame 驱动**：非 setInterval，帧同步更好
- **推理节流**：`inferenceInterval` 动态调整
- **发送节流**：`sendInterval` 独立于推理间隔，pose 数据按需发送

### 内存管理
- **base64 内存缓存**：`MediaPipeAssetService.base64Cache` 避免重复读磁盘
- **blob URL 注册**：WebView 内 Object URL 代替 file:// URL
- **清理机制**：`clearMemoryCache()` 在注入完成后调用，`useEffect` 清理时释放

### 启动优化
- **后台预加载**：`App.tsx` 在 AuthGate 渲染后立即 `mediaPipeAssetService.preload()`，不阻塞首屏
- **缓存验证**：`isCachedQuick()` 同步方法快速判断，避免每次都走完整校验
- **并发下载**：`asyncPool.ts` 控制 3 并发下载

### 待改进
- WorkoutScreen 25KB 单文件，初次渲染可能卡顿 → 建议懒加载子组件
- 缺少 Performance 监控埋点（FPS、内存、启动耗时）
- WebView 内 `Pose.send()` 返回 Promise 但未 await，可能积压推理请求

---

## 7. 安全与隐私 ⭐⭐⭐½ (3.5/5)

### 认证与授权 ⭐⭐⭐⭐
- JWT Token 双机制：`accessToken`(15min) + `refreshToken`(7d)
- 自动刷新：`authFetch` 拦截 401 → 静默 refresh → 重试原请求
- 手动 Cookie 管理：RN 不支持浏览器 cookie，AuthService 手动提取 Set-Cookie
- 游客模式：无需注册即可使用基础功能
- 密码修改后自动清除 token（安全最佳实践）

### 数据存储 ⭐⭐⭐
- **运动数据**：全部存储在 AsyncStorage（本地设备），无云端上传
- **认证 token**：AsyncStorage 明文存储（⚠️ React Native 无 Keychain/Keystore 集成）
- **错误日志**：本地存储最多 50 条，不自动上报

### 相机权限 ⭐⭐⭐⭐
- CameraView 在 Android 上主动 `requestCameraPermissionsAsync()`
- 权限拒绝时显示"打开设置"引导
- 非训练状态预览模式可关闭（`enablePreviewPose = false`）

### 网络请求 ⭐⭐⭐
- API 请求通过 `authFetch` 统一携带 Bearer token
- `apiBaseUrl.ts` 区分 dev/release + 平台自动选择 localhost/10.0.2.2
- `mediaPipeCdnPolicy.ts` CDN 优先级策略
- ⚠️ `originWhitelist={['*']}` 过于宽松
- ⚠️ 无 SSL Pinning / 证书校验

### 改进建议
- 生产环境限制 `originWhitelist` 为已知域名
- Token 存储迁移到 `expo-secure-store`（Keychain/Keystore 加密）
- 添加隐私政策页面（GDPR 合规）
- 考虑用户数据导出/删除功能

---

## 8. 可扩展性 ⭐⭐⭐⭐ (4/5)

### 新增第 7 种运动（如俯卧撑）的工作量评估

| 步骤 | 文件 | 工作量 |
|------|------|--------|
| 1. 类型声明 | `types/index.ts` — 加 `'push_ups'` 到 `ExerciseType` | 1 行 |
| 2. 创建 Counter | `services/counters/PushUpCounter.ts` | ~200-400 行 |
| 3. 注册工厂 | `hooks/useWorkout.ts` — factory switch + case | 1 行 |
| 4. 配置参数 | `constants/exerciseConfig.ts` — 图标/名称/默认目标 | 5 行 |
| 5. 运动参数 | `utils/exerciseRuntime.ts` — 帧间隔/profile | 6 行 |
| 6. 测试 | `__tests__/PushUpCounter.test.ts` | ~150 行 |

**结论**：策略模式使新增运动类型极其高效，核心逻辑 95% 复用，仅需实现 `processFrame()` + `getFeedback()`。

### 增加社交功能的架构影响

| 需求 | 影响范围 | 难度 |
|------|----------|------|
| 好友系统 | 新增 `SocialService` + `FriendsScreen` + 后端 API | 中 |
| 排行榜 | 新增 `LeaderboardScreen` + 后端 | 中 |
| 分享训练 | 新增 `ShareService` + 截图/视频导出 | 低-中 |
| 实时对战 | 需 WebSocket + 大幅改造训练流程 | **高** |

**结论**：当前架构对社交功能无预留，需要新增服务层 + 屏幕层，但分层清晰的目录结构使扩展不会破坏现有代码。

### 增加云端同步的架构影响

```
当前: StorageService → AsyncStorage
目标: StorageService → AsyncStorage + CloudSyncService → REST API
```

- `StorageService` 接口已定义好（`saveWorkout`/`getWorkoutHistory`/`getAnalytics`），可透明替换
- 需处理同步冲突（本地 vs 云端 timestamp 合并）
- `WorkoutSession.id` 格式为 `Date.now()-random`，云端存储需改为 UUID 或服务端生成

**结论**：架构对云端同步有一定预留（StorageService 单例 + 统一接口），工作量中等。

---

## 9. 技术债务识别 ⭐⭐⭐ (3/5 技术债务严重度)

### 🔴 高优先级

| # | 问题 | 位置 | 影响 | 改进方案 |
|---|------|------|------|----------|
| 1 | **内嵌 HTML 字符串 400+ 行** | `CameraView.tsx` | 难以维护、无法测试、无语法高亮 | 提取到 `assets/mediapipe-bridge.html`，用 `require()` 或 `asset` 加载 |
| 2 | **WebView postMessage 大量 JSON 序列化** | `CameraView` → `useWebViewMessageHandler` | 每帧序列化 Pose 数据（17 keypoints × 3 字段） | 迁移至 vision-camera frame processor；或压缩为二进制 protocol buffers |
| 3 | **Token 明文存储** | `AuthService.ts` | 安全风险 | 迁移至 `expo-secure-store` |

### 🟡 中优先级

| # | 问题 | 位置 | 影响 | 改进方案 |
|---|------|------|------|----------|
| 4 | **WorkoutScreen 25KB 单文件** | `WorkoutScreen.tsx` | 可读性下降 | 拆分为 `WorkoutControls`/`WorkoutStats`/`WorkoutTimer` 子组件 |
| 5 | **setInterval 轮询 timer (200ms)** | `useWorkout.ts` | 电池消耗 | 使用 `requestAnimationFrame` 或 `setTimeout` 链式调用 |
| 6 | **originWhitelist `['*']`** | `CameraView.tsx` | 安全风险 | 限制为 `['https://localhost']` |
| 7 | **计数器算法缺乏独立可验证性** | `JumpRopeCounter.ts` | 无法单独评估准确率 | 添加离线测试数据集 + 准确率 benchmark |

### 🟢 低优先级

| # | 问题 | 位置 | 改进方案 |
|---|------|------|----------|
| 8 | 魔法字符串 `'jump_rope'` 散落各处 | 多个文件 | 统一为 `enum ExerciseType` |
| 9 | `console.log`/`console.warn` 无分级 | 全局 | 引入 logger 工具（dev 输出，prod 静默/上报） |
| 10 | 缺少 `useMemo`/`React.memo` 优化 | 屏幕组件 | 对 HistoryScreen/AnalyticsScreen 列表加 `React.memo` |

---

## 改进路线图

### Phase 1 — 低风险快速改进（2-3 天）
1. 提取 `CameraView.tsx` 嵌入 HTML 到独立资源文件
2. 拆分 `WorkoutScreen.tsx` 为 3-4 个子组件
3. 将 `originWhitelist` 限制为已知域名
4. 统一 `ExerciseType` 为 enum（向后兼容）

### Phase 2 — 质量与安全强化（1-2 周）
5. Token 存储迁移至 `expo-secure-store`
6. 引入统一 logger 替换 `console.*` 直接调用
7. `useWorkout` 中用 `requestAnimationFrame` 替代 `setInterval`
8. 添加 E2E 测试（Detox 或 Maestro）

### Phase 3 — 架构演进（2-4 周）
9. 评估并迁移至 `react-native-vision-camera` + frame processor
10. 如需跨屏状态共享，引入 Zustand
11. 如启动云端功能，扩展 `StorageService` 为本地+远程双写

---

## 核心优势总结

1. **策略模式实现精湛**：ExerciseCounter 抽象基类 + 6 子类，帧间隔自适应是突出亮点
2. **性能调优细腻**：运动级帧间隔配置 + 自适应 runtime + Canvas 跳帧，体现对移动端性能的深刻理解
3. **测试意识强**：21 个测试文件覆盖核心逻辑，testHelpers 复用良好
4. **错误弹性设计**：CDN 多级回退 + 本地缓存 + 初始化超时 + 401 自动刷新，生产就绪度高
5. **TypeScript strict**：类型安全最高标准，类型文件结构清晰

## 核心风险点

1. **WebView 性能天花板**：postMessage 序列化开销是架构瓶颈，中期必须迁移
2. **Token 明文存储**：生产环境安全风险，需尽快迁移至 SecureStore
3. **CameraView 内嵌 HTML 膨胀**：维护成本随功能增加线性增长

---

*报告完毕。如需对特定维度进行更深入的分析或针对某个改进项出详细技术方案，请告知。*
