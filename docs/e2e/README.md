# E2E 测试（Maestro）

> 2026-07-11 状态：EAS preview APK 已成功构建，但本文流程尚未在目标真机形成通过记录；E2E 骨架不能替代人工试点验收。

## 前置条件

1. 安装 [Maestro CLI](https://maestro.mobile.dev/getting-started/installing-maestro)
2. 本机已安装 **开发版 APK/IPA**（`com.aimotion.tracker`），非 Expo Go
3. Android 模拟器或 iOS 模拟器 / 真机已连接

```bash
# 构建预览包
npx eas build --platform android --profile preview
```

## 运行

```bash
# 先启动 Metro（若使用 dev client）
npx expo start

# 运行全部 Maestro 流程
npm run e2e:maestro
```

## 流程说明

| 文件 | 说明 |
|------|------|
| `.maestro/flows/smoke-guest-squats.yaml` | 游客 → 深蹲 → 开始训练（需相机权限） |

## testID 约定

定义于 `src/constants/e2eTestIds.ts`：

- `login-guest-button` — 游客登录
- `home-exercise-{type}` — 首页运动卡片（如 `home-exercise-squats`）
- `workout-start-button` / `workout-stop-button` — 训练控制

## CI 说明

Maestro 依赖真机/模拟器与相机，**默认不纳入 GitHub Actions**。可在自托管 runner 或 nightly 任务中执行。
