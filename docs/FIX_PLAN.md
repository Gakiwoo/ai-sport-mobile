# AI Motion Tracker — 修复计划

> 基于高级工程师评估报告，共识别 **14 个问题**，分为 **3 个阶段**执行。
> 预估总工时：**3–4 个工作日**。

---

## 阶段概览

| 阶段 | 目标 | 问题数 | 预估工时 | 前置条件 |
|------|------|--------|----------|----------|
| P0 — 紧急修复 | 消除安全漏洞与数据错乱风险 | 3 | 1 天 | 无 |
| P1 — 质量提升 | 修复逻辑 Bug 与架构改进 | 6 | 1.5 天 | P0 完成 |
| P2 — 工程优化 | 代码整洁度与可维护性提升 | 5 | 1–1.5 天 | P1 完成 |

---

## P0 — 紧急修复（阻塞发版）

### P0-1：Token 刷新竞态条件

**文件：** `src/services/AuthService.ts`  
**位置：** `authFetch()` 函数，第 76–82 行  
**风险：** 多个并发请求同时收到 401 时，会并行触发多次 `refreshToken()`。第一次成功后 token 已更新，后续调用使用闭包捕获的旧 refreshToken，可能导致后端拒绝并清除 session，用户被意外登出。

**当前代码：**
```typescript
// 第 76-82 行
if (res.status === 401 && tokens?.refreshToken && !path.includes('/auth/refresh')) {
  const refreshed = await refreshToken(tokens.refreshToken);
  if (refreshed) {
    return authFetch(path, options);
  }
}
```

**修复方案：** 引入单例 Promise 锁，确保同一时刻只有一次 refresh 在执行。

```typescript
// 在文件顶部增加
let refreshPromise: Promise<boolean> | null = null;

function refreshOnce(token: string): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = refreshToken(token).finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}
```

**修改 authFetch：**
```typescript
if (res.status === 401 && tokens?.refreshToken && !path.includes('/auth/refresh')) {
  const refreshed = await refreshOnce(tokens.refreshToken);
  if (refreshed) {
    return authFetch(path, options);
  }
}
```

**验证：** 编写并发测试，模拟 5 个请求同时收到 401，断言 `refreshToken` 只被调用 1 次。

---

### P0-2：SitUpCounter setTimeout 状态错乱

**文件：** `src/services/counters/SitUpCounter.ts`  
**位置：** 第 301–308 行  
**风险：** `setTimeout(200ms)` 绕过了帧驱动模型，直接修改状态机状态。若在 200ms 内调用 `reset()`，定时器仍会执行导致状态错乱。其他计数器（StandingLongJumpCounter、VerticalJumpCounter）已正确使用帧计数器。

**当前代码：**
```typescript
// 第 301-308 行
setTimeout(() => {
  if (this.phase === 'done') {
    this.phase = 'lying';
    this.lastState = 'lying';
    this.lastPhase = 'lying';
    this.cycleStartFrame = this.totalFrames;
  }
}, 200); // 200ms 冷却
```

**修复方案：** 用帧计数器替代 setTimeout，与 StandingLongJumpCounter 保持一致。

```typescript
// 在 processFrame 的 done 阶段处理中：
// 删除 setTimeout，改为设置冷却帧计数
private doneCooldownRemaining = 0;
private readonly DONE_COOLDOWN_FRAMES_30FPS = 6; // 200ms @ 30fps

// transitionTo('done') 后设置：
this.doneCooldownRemaining = this.framesAt30Fps(this.DONE_COOLDOWN_FRAMES_30FPS);

// 在 processFrame 开头增加 done 阶段的帧递减逻辑：
if (this.phase === 'done') {
  this.doneCooldownRemaining--;
  if (this.doneCooldownRemaining <= 0) {
    this.transitionTo('lying');
    this.cycleStartFrame = this.totalFrames;
  }
  return; // done 阶段不处理其他逻辑
}
```

**同步修改 reset()：**
```typescript
reset(): void {
  super.reset();
  this.doneCooldownRemaining = 0;
  // ... 其他字段重置
}
```

**验证：**
- 单元测试：完成一次仰卧起坐后，立即调用 `reset()`，断言状态回到初始值且无残留定时器。
- 单元测试：完成一次仰卧起坐后，验证经过正确的冷却帧数后自动进入 lying 阶段。

---

### P0-3：Cookie 手工管理安全隐患

**文件：** `src/services/AuthService.ts`  
**位置：** 第 58–72 行（Cookie 构造），第 189–192 行（extractCookie）  
**风险：** Token 同时放在 Authorization Header 和 Cookie Header 中，增加攻击面。`as any` 绕过类型检查。`extractCookie` 正则无法正确处理多个 Set-Cookie 头。

**修复方案：**

**Step 1：移除 Cookie 双通道，统一使用 Bearer Token**

```typescript
// 删除第 58-65 行 cookieParts 构造
// 删除第 72 行的 spread cookie
// 简化 authFetch 为：
const res = await fetch(`${BASE_URL}${path}`, {
  ...options,
  headers, // 仅含 Authorization: Bearer xxx
});
```

**Step 2：与后端协商 token 返回方式**

后端应在 response body 中返回 token（而非仅 Set-Cookie），消除 RN fetch 无法读取 Set-Cookie 的问题。若后端短期无法改动，保留 extractCookie 但加强实现：

```typescript
function extractCookie(setCookieHeaders: string | null, name: string): string | null {
  if (!setCookieHeaders) return null;
  // 支持多个 Set-Cookie 头（逗号分隔或数组）
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`${escaped}=([^;\\s]+)`, 'g');
  let match: RegExpExecArray | null;
  let lastValue: string | null = null;
  while ((match = regex.exec(setCookieHeaders)) !== null) {
    lastValue = match[1];
  }
  return lastValue;
}
```

**Step 3：移除 `as any`**

移除 cookie 相关代码后，`as any` 自然消失。若保留 cookie 方案，定义正确的类型扩展：

```typescript
interface FetchOptionsWithCookie extends RequestInit {
  cookie?: string;
}
```

**验证：** 确保所有 API 调用仅通过 Authorization Header 传递 token，登录/刷新/登出流程正常。

---

## P1 — 质量提升

### P1-1：VerticalJumpCounter 反馈信息 Bug

**文件：** `src/services/counters/VerticalJumpCounter.ts`  
**位置：** 第 437 行  
**问题：** 三元表达式两个分支输出完全相同的文案。

**当前代码：**
```typescript
const suffix = h >= best ? ` 最佳: ${best}cm` : ` 最佳: ${best}cm`;
```

**修复：**
```typescript
const suffix = h >= best ? ` 新纪录! ${best}cm` : ` 最佳: ${best}cm`;
```

**验证：** 单元测试覆盖新纪录和普通成绩两种场景。

---

### P1-2：count 语义重载

**文件：** `src/services/counters/StandingLongJumpCounter.ts`（第 345 行）、`src/services/counters/VerticalJumpCounter.ts`（第 373 行）  
**问题：** `count` 字段被赋予距离/高度语义，`getRate()` 对跳远/纵跳产生无意义结果。

**修复方案：** 在基类 `ExerciseCounter` 中引入 `getResultValue()` 方法。

```typescript
// ExerciseCounter.ts 基类增加：
/** 返回结果值：计数型返回次数，测量型返回距离/高度 */
getResultValue(): number {
  return this.count;
}

/** 返回结果单位，子类可覆盖 */
getResultUnit(): string {
  return '次';
}
```

```typescript
// StandingLongJumpCounter.ts 覆盖：
getResultValue(): number {
  return Math.round(this.jumpDistanceCm);
}
getResultUnit(): string {
  return 'cm';
}

// VerticalJumpCounter.ts 同理覆盖
```

**上层调用方修改：** 所有使用 `getCount()` 显示跳远/纵跳结果的地方改用 `getResultValue()` + `getResultUnit()`。

**验证：** 确保 `getRate()` 对跳远/纵跳不再返回无意义的"次/分钟"（可返回 0 或覆盖为无意义标记）。

---

### P1-3：withTimeout 提取为通用工具

**文件：** `src/services/AuthService.ts`，第 129–146 行  
**问题：** 通用工具函数定义在业务服务内部。

**修复：**

```typescript
// 新建 src/utils/withTimeout.ts
export class TimeoutError extends Error {
  constructor(message = '请求超时') {
    super(message);
    this.name = 'TimeoutError';
  }
}

export function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError()), timeoutMs);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}
```

AuthService 中改为 import，并将 `AuthError('请求超时', 408)` 改为捕获 `TimeoutError` 后包装。

**验证：** 新增 `src/__tests__/withTimeout.test.ts`，覆盖超时、正常完成、promise reject 三种场景。

---

### P1-4：导航标题接入 i18n

**文件：** `App.tsx`，第 71–86 行  
**问题：** 4 个导航标题硬编码中文（"运动训练"、"训练历史"、"数据分析"、"我的"）。

**修复方案：** 使用 React Navigation 的 `useTranslation` 或在 screenOptions 中动态获取。

由于 `Stack.Screen` 的 `options` 是静态配置，推荐在 App.tsx 中使用 `useLocale()` hook：

```typescript
function AuthGate() {
  const { user, isLoading } = useAuth();
  const { t } = useLocale(); // 新增

  // ...
  <Stack.Screen
    name="Workout"
    component={WorkoutScreen}
    options={{ headerShown: true, title: t('nav.workout'), headerTintColor: '#1C1C1E' }}
  />
  // ... 其他 Screen 同理
}
```

**i18n 文件补充：**

```typescript
// zh.ts 增加
'nav.workout': '运动训练',
'nav.history': '训练历史',
'nav.analytics': '数据分析',
'nav.profile': '我的',

// en.ts 增加
'nav.workout': 'Workout',
'nav.history': 'History',
'nav.analytics': 'Analytics',
'nav.profile': 'Profile',
```

**验证：** 切换语言后导航标题正确显示对应语言文本。

---

### P1-5：PerformanceMonitor 帧数组无上限

**文件：** `src/services/PerformanceMonitor.ts`，第 41 行  
**问题：** `this.frames: PerfFrameRecord[]` 在训练会话期间无限增长。30 分钟 × 10fps = 18,000 条记录。

**修复方案：** 设定合理上限，保留最近 N 帧用于实时统计，完整报告基于聚合数据。

```typescript
private static readonly MAX_FRAMES = 5000; // 约 8 分钟 @ 10fps

recordFrame(inferenceMs: number, isActive: boolean): void {
  if (!this._isRunning) return;
  this.frames.push({ inferenceMs, isActive, timestamp: Date.now() });
  // 超过上限时保留后半段（丢弃旧数据但保留近期统计精度）
  if (this.frames.length > PerformanceMonitor.MAX_FRAMES) {
    this.frames = this.frames.slice(-Math.floor(PerformanceMonitor.MAX_FRAMES * 0.8));
  }
}
```

**验证：** 模拟超过 5000 帧的长会话，断言数组长度不超过上限且 buildReport 正常运行。

---

### P1-6：minScore 阈值提取为配置常量

**文件：** 6 个 Counter 文件 + `src/services/ExerciseCounter.ts`（第 64 行）  
**问题：** `0.3` 置信度阈值在多处重复硬编码。

**修复方案：**

```typescript
// src/constants/exerciseConfig.ts 增加
export const POSE_MIN_SCORE = 0.3;

// ExerciseCounter.ts 基类修改
import { POSE_MIN_SCORE } from '../constants/exerciseConfig';

protected calculateAngle(pose: Pose, a: string, b: string, c: string): number | null {
  // ...
  if ((kpA.score || 0) < POSE_MIN_SCORE || ...) return null;
  // ...
}
```

各 Counter 子类中所有 `0.3` 替换为 `POSE_MIN_SCORE` 引用。

**验证：** 修改常量值后运行测试套件，确认阈值变化影响计数行为。

---

## P2 — 工程优化

### P2-1：JumpingJacksCounter 死代码清理

**文件：** `src/services/counters/JumpingJacksCounter.ts`  
**问题：** `foulCount` 变量声明后仅被重置，从未被读取。

**修复：** 删除 `foulCount` 声明及 reset 中的重置语句。若未来计划实现犯规计数，用 TODO 注释说明。

---

### P2-2：ESLint 规则加固

**文件：** `eslint.config.js`，第 36–37 行  
**问题：** `no-explicit-any: 'off'` 和 `ban-ts-comment: 'off'` 降低了类型安全防线。

**修复：**

```javascript
'@typescript-eslint/no-explicit-any': ['warn', { fixToUnknown: true }],
'@typescript-eslint/ban-ts-comment': ['warn', {
  'ts-expect-error': 'allow-with-description',
  'ts-ignore': true,
  'ts-nocheck': true,
}],
```

先设为 `warn` 而非 `error`，逐步修复现有违规后再升级。

---

### P2-3：AuthContext useAuth 空检查修正

**文件：** `src/contexts/AuthContext.tsx`  
**问题：** `createContext` 有完整默认值，`useAuth` 中的 `!ctx` 检查永远不会触发。

**修复方案 A（推荐）：** 使用 null 初始值

```typescript
const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
```

---

### P2-4：PoseDetectionService 重构

**文件：** `src/services/PoseDetectionService.ts`  
**问题：** 已退化为纯函数工具类，但保留了 isInitialized 状态和单例导出。

**修复：** 移除类包装，改为纯函数模块导出。

```typescript
// 重构为
export function getKeypoint(pose: Pose, name: string): Keypoint | undefined { ... }
export function calculateAngle(a: Keypoint, b: Keypoint, c: Keypoint): number { ... }
export function calculateDistance(a: Keypoint, b: Keypoint): number { ... }
```

同步修改 `ExerciseCounter.ts` 基类中的 import 和调用方式。

---

### P2-5：E2E 测试扩展

**文件：** `.maestro/flows/`  
**当前状态：** 仅 1 个烟雾测试（游客 → 深蹲）。

**扩展计划：**

| 测试用例 | 文件名 | 覆盖场景 |
|----------|--------|----------|
| 游客 → 开合跳 → 停止 → 保存 | `smoke-guest-jumping-jacks.yaml` | 计数型运动完整流程 |
| 注册 → 登录 → 跳绳 → 查看历史 | `auth-jumprope-history.yaml` | 认证 + 数据持久化 |
| 游客 → 纵跳 → 查看分析 | `smoke-guest-vertical-jump.yaml` | 测量型运动 + 分析页 |
| 语言切换 → 验证 UI 文本 | `i18n-switch.yaml` | 国际化 |

---

## 执行顺序与依赖关系

```
P0-1 (Token竞态) ─────┐
P0-2 (SitUp setTimeout) ──┤──→ P1-1 (纵跳文案) ──→ P2-1 (死代码)
P0-3 (Cookie安全) ─────┘   P1-2 (count语义) ──→ P2-2 (ESLint)
                           P1-3 (withTimeout) ─→ P2-3 (useAuth)
                           P1-4 (导航i18n) ───→ P2-4 (PoseDetection重构)
                           P1-5 (性能监控) ───→ P2-5 (E2E扩展)
                           P1-6 (minScore常量)
```

P0 三个修复互相独立，可并行开发。P1/P2 之间无严格依赖，但建议按编号顺序执行。

---

## 测试策略

每个修复项必须包含以下验证：

| 修复类型 | 最低测试要求 |
|----------|-------------|
| 安全修复（P0-1, P0-3） | 单元测试 + 手动集成测试 |
| 逻辑修复（P0-2, P1-1, P1-2） | 单元测试（含边界用例） |
| 重构（P1-3, P2-4） | 单元测试 + 确保现有测试全绿 |
| 配置变更（P1-6, P2-2） | 全量测试套件回归 |
| 新增功能（P1-4, P2-5） | 手动测试 + E2E（如适用） |

**回归测试：** 每个阶段完成后运行 `npm run test:coverage`，确保覆盖率不低于当前门槛（counters 75%、utils 80%、mediapipe 90%）。

---

## 完成标准

- **P0 全部合并：** 项目达到可安全发布状态
- **P1 全部合并：** 代码质量评分提升至 85+ 分
- **P2 全部合并：** 项目达到生产级工程规范
