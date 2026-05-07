# AI Motion Tracker

[![Expo](https://img.shields.io/badge/Expo-55-blueviolet?logo=expo)](https://expo.dev)
[![React Native](https://img.shields.io/badge/React_Native-0.83-61DAFB?logo=react)](https://reactnative.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?logo=typescript)](https://www.typescriptlang.org)
[![Test](https://img.shields.io/badge/tests-118_passing-brightgreen)](https://jestjs.io)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

**AI Motion Tracker** — 基于 MediaPipe Pose 的实时运动追踪 App，支持 Android 和 iOS。通过手机摄像头实时检测人体姿态，自动计数跳绳、深蹲、仰卧起坐等 6 种运动项目，并提供动作质量反馈。

---

## Table of Contents

- [Features](#features)
- [Supported Exercises](#supported-exercises)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Usage](#usage)
- [Testing](#testing)
- [Linting & Formatting](#linting--formatting)
- [Building](#building)
- [Project Structure](#project-structure)
- [Configuration](#configuration)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

---

## Features

- **🧠 Real-time AI Pose Detection** — MediaPipe Pose 运行于 WebView 内，通过 Blob URL 注入本地缓存文件，首次下载后零网络依赖
- **🏋️ 6 Exercise Types** — 跳绳、开合跳、深蹲、立定跳远、纵跳摸高、仰卧起坐
- **📊 Intelligent State Machine Counting** — 每种运动基于状态机 + Kalman 滤波算法精确计数
- **🎯 Two Training Modes** — 定数模式（目标次数）和 定时模式（目标时长）
- **💬 Real-time Feedback** — 动作质量实时指导（"背部不要过度前倾"、"下蹲更深一些"）
- **📈 Analytics & History** — 本地存储训练记录，数据统计和趋势分析
- **📱 Offline First** — 模型文件本地缓存，完全离线可用
- **⚡ Adaptive Frame Rate** — 根据设备性能动态调整姿态检测帧率
- **🔐 Guest & Auth Mode** — 支持游客模式快速体验，也支持账号系统完整使用

---

## Supported Exercises

| Exercise | Detection Method | Key Metrics |
|----------|-----------------|-------------|
| 🏃 **Jump Rope** 跳绳 | 手腕旋转周期 + 髋部弹跳双信号融合 | 连续跳跃次数 |
| 🤸 **Jumping Jacks** 开合跳 | 手臂角度 + 腿部张开比例双信号 | 完整开合次数 |
| 🦵 **Squats** 深蹲 | 膝盖角度 + 背部稳定性 | 深蹲次数 + 犯规类型 |
| 🏃‍♂️ **Standing Long Jump** 立定跳远 | 脚踝水平位移 | 跳远距离 (cm) |
| ⬆️ **Vertical Jump** 纵跳摸高 | 多信号融合（膝盖+脚踝+髋部） | 腾空高度 (cm) |
| 🙇 **Sit-ups** 仰卧起坐 | 肩-髋-膝三点躯干角度 | 完整起坐次数 |

---

## Architecture

```
┌──────────────────────────────────────────────────┐
│                   Screens                         │
│  Home → Workout → History → Analytics → Profile  │
└──────────────┬───────────────────────────────────┘
               │ hooks
┌──────────────▼───────────────────────────────────┐
│                Hooks Layer                        │
│  useWorkout  ·  useExerciseFeedback  ·  useSound  │
│  useWebViewMessageHandler                         │
└──────────────┬───────────────────────────────────┘
               │ services
┌──────────────▼───────────────────────────────────┐
│              Services Layer                        │
│  ┌─────────────────┐  ┌──────────────────────┐    │
│  │  ExerciseCounter │  │  PoseDetectionService│    │
│  │  (Abstract)      │  │                      │    │
│  │  ├─JumpRope      │  │  MediaPipeAssetService│   │
│  │  ├─JumpingJacks  │  │                      │    │
│  │  ├─Squats        │  │  StorageService       │   │
│  │  ├─LongJump      │  │                      │    │
│  │  ├─VerticalJump  │  │  AuthService          │   │
│  │  └─SitUp         │  │                      │    │
│  └─────────────────┘  └──────────────────────┘    │
└──────────────┬───────────────────────────────────┘
               │ WebView
┌──────────────▼───────────────────────────────────┐
│              CameraView (WebView)                  │
│  ┌──────────────────────────────────────────┐     │
│  │  HTML5 Canvas + MediaPipe Pose            │     │
│  │  ← Blob URL injected by RN                │     │
│  │  ← getUserMedia @ https://localhost       │     │
│  │  ← postMessage for pose data              │     │
│  └──────────────────────────────────────────┘     │
└──────────────────────────────────────────────────┘
```

### Key Design Decisions

- **WebView + Blob URL** — MediaPipe 在原生 RN 环境中不可直接运行。通过 WebView 内嵌 HTML5 页面运行，模型文件通过 Blob URL 注入（非 CDN 加载），完美解决 CORS 和离线问题
- **Strategy Pattern** — `ExerciseCounter` 抽象基类定义统一接口，6 种运动各自实现具体算法，新增运动类型只需继承基类
- **State Machine** — 每种运动的核心检测算法基于有限状态机，配合 Kalman 滤波降噪和滑动窗口防抖

---

## Prerequisites

- **Node.js** >= 18
- **npm** >= 9 (或 pnpm / yarn)
- **Expo CLI** — `npm install -g expo-cli` (可选)
- **EAS CLI** — `npm install -g eas-cli` (用于构建 APK)
- **Android** — Android Studio (模拟器) 或 真机（安装 Expo Go）
- **iOS** — Xcode (Mac) 或 真机（安装 Expo Go）
- **Camera Permission** — 应用需要相机权限

---

## Installation

```bash
# 1. Clone the repository
git clone https://github.com/gakiwoo1006/ai-motion-tracker.git
cd ai-motion-tracker

# 2. Install dependencies
npm install

# 3. Start the dev server
npx expo start
```

> 💡 **首次启动时**，应用会自动从 `gakiwoo.com` 下载 MediaPipe 模型文件（约 22MB），下载后缓存到本地。后续启动零网络依赖。

---

## Usage

```bash
# Start Expo development server
npx expo start

# Run on Android (需连接设备或模拟器)
npx expo start --android

# Run on iOS (Mac 专属)
npx expo start --ios

# Run in web browser (功能有限)
npx expo start --web
```

### Quick Start Guide

1. 扫描终端 QR 码打开 Expo Go，或预览 Android/iOS 模拟器
2. 在首页选择运动项目
3. 站到镜头前，等待系统自动标定
4. 点击 **"开始"** 按钮，3 秒倒计时后开始训练
5. 运动过程中实时显示次数和动作指导
6. 点击 **"停止"** 保存训练记录
7. 在"历史"和"分析"页面查看训练数据统计

---

## Testing

```bash
# Run all tests (20 suites / 118 tests)
npm test

# Watch mode
npm run test:watch

# Generate coverage report
npx jest --coverage
```

**Test Coverage Areas:**

| Domain | Tests | Description |
|--------|-------|-------------|
| Exercise Counters | 6 suites | 所有 6 种运动计数逻辑 |
| Services | 2 suites | Auth、Storage |
| Hooks | 1 suite | useWorkout |
| Utils | 5 suites | filters、poseQuality、asyncPool、adaptiveRuntime、CDN policy |
| Infrastructure | 6 suites | CDN policy、Manifest、Asset injection、Runtime config |
| **Total** | **20 suites / 118 tests** | |

---

## Linting & Formatting

```bash
# ESLint check
npm run lint

# Auto-fix ESLint issues
npm run lint:fix

# Prettier formatting
npm run format
```

---

## Building

### Android APK (Preview)

```bash
npx eas build --platform android --profile preview
```

### Android App Bundle (Production)

```bash
npx eas build --platform android --profile production
```

### iOS (Production)

```bash
npx eas build --platform ios --profile production
```

---

## Project Structure

```
ai-motion-tracker/
├── App.tsx                    # 应用入口 + 路由 + 懒加载屏幕
├── app.json                   # Expo 配置
├── eas.json                   # EAS Build 配置
├── tsconfig.json              # TypeScript strict mode
├── jest.config.js             # Jest 测试配置
├── eslint.config.js           # ESLint + Prettier
│
├── src/
│   ├── components/            # 可复用 UI 组件
│   │   ├── CameraView.tsx         # WebView + MediaPipe 核心组件
│   │   ├── ErrorBoundary.tsx      # 全局错误边界
│   │   ├── ExerciseIllustration.tsx # 运动 SVG 插画
│   │   ├── BarChart.tsx           # 统计图表
│   │   └── SkeletonOverlay.tsx    # 加载骨架屏
│   │
│   ├── screens/               # 页面组件
│   │   ├── LoginScreen.tsx
│   │   ├── RegisterScreen.tsx
│   │   ├── HomeScreen.tsx         # 运动选择首页
│   │   ├── WorkoutScreen.tsx      # 训练主界面（核心）
│   │   ├── HistoryScreen.tsx
│   │   ├── AnalyticsScreen.tsx
│   │   └── ProfileScreen.tsx
│   │
│   ├── services/              # 业务逻辑服务
│   │   ├── ExerciseCounter.ts     # 抽象基类（策略模式）
│   │   ├── counters/
│   │   │   ├── JumpRopeCounter.ts
│   │   │   ├── JumpingJacksCounter.ts
│   │   │   ├── SquatsCounter.ts
│   │   │   ├── StandingLongJumpCounter.ts
│   │   │   ├── VerticalJumpCounter.ts
│   │   │   └── SitUpCounter.ts
│   │   ├── PoseDetectionService.ts
│   │   ├── MediaPipeAssetService.ts  # 模型缓存管理
│   │   ├── StorageService.ts
│   │   └── AuthService.ts
│   │
│   ├── hooks/                 # 自定义 Hooks
│   │   ├── useWorkout.ts
│   │   ├── useExerciseFeedback.ts
│   │   ├── useSound.ts
│   │   └── useWebViewMessageHandler.ts
│   │
│   ├── contexts/
│   │   └── AuthContext.tsx
│   │
│   ├── utils/                 # 工具函数
│   │   ├── filters.ts             # Kalman 滤波 + 滑动窗口
│   │   ├── poseQuality.ts         # 姿态质量分析
│   │   ├── webViewAssetInjection.ts # Blob URL 注入
│   │   ├── adaptivePoseRuntime.ts # 自适应帧率
│   │   ├── mediaPipeCdnPolicy.ts  # CDN 优先级策略
│   │   ├── mediaPipeManifest.ts   # 缓存清单验证
│   │   ├── asyncPool.ts           # 并发下载控制
│   │   └── exerciseRuntime.ts     # 运动运行时配置
│   │
│   ├── constants/
│   │   ├── exerciseConfig.ts
│   │   └── counterThresholds.ts   # 运动阈值常量
│   │
│   ├── types/                 # TypeScript 类型定义
│   │   └── index.ts
│   │
│   └── __tests__/             # Jest 测试
│       ├── testHelpers.ts
│       ├── *Counter.test.ts (×6)
│       └── ... (×13 more)
│
├── docs/                      # 项目文档
│   ├── architecture/
│   ├── deployment/
│   ├── PROJECT_EVALUATION_REPORT.md
│   └── INSTALLATION.md
│
├── scripts/
│   └── deployment/            # CDN 部署脚本
│
└── assets/                    # 静态资源
    ├── sounds/                # 音效文件
    └── *.png                  # 应用图标
```

---

## Configuration

### MediaPipe CDN Sources

可通过环境变量自定义 CDN 源列表（多源回退）：

```bash
EXPO_PUBLIC_MEDIAPIPE_CDN_BASES=https://your-cdn.com/pose/,https://backup-cdn.com/pose/
```

默认优先级：`gakiwoo.com` → `npmmirror.com` → `jsdelivr` → `unpkg`

### Runtime Profiles

每种运动有不同的帧率配置，可根据设备性能自适应调整：

| Exercise | Active Interval | Preview Interval | Model Complexity |
|----------|----------------|-----------------|-----------------|
| Jump Rope | 80ms | 200ms | 0 (lite) |
| Jumping Jacks | 100ms | 250ms | 1 (full) |
| Squats | 120ms | 250ms | 1 (full) |
| Long Jump | 100ms | 250ms | 1 (full) |
| Vertical Jump | 100ms | 250ms | 1 (full) |
| Sit-ups | 120ms | 250ms | 1 (full) |

---

## Deployment

### CDN Deployment

MediaPipe 模型文件通过 `scripts/deployment/` 中的脚本部署到 `gakiwoo.com` 服务器：

```bash
# 部署 MediaPipe 模型文件到 CDN
bash scripts/deployment/deploy-mediapipe.sh

# 配置 Nginx CDN 缓存
bash scripts/deployment/nginx-mediapipe.sh
```

### EAS Build

```bash
# 登录 EAS
npx eas login

# 构建 Android APK（预览版）
npx eas build --platform android --profile preview

# 构建 Android App Bundle（生产版）
npx eas build --platform android --profile production
```

---

## Contributing

1. Fork 仓库
2. 创建功能分支 (`git checkout -b feat/amazing-feature`)
3. 提交修改 (`git commit -m 'feat: add amazing feature'`)
4. 推送到分支 (`git push origin feat/amazing-feature`)
5. 创建 Pull Request

### Development Guidelines

- **TypeScript**: 启用 strict 模式，类型安全优先
- **Testing**: 核心逻辑必须有测试覆盖（Jest）
- **State Machines**: 新增运动类型请继承 `ExerciseCounter` 基类
- **Performance**: 姿态检测是性能敏感区域，注意帧率和内存
- **Offline First**: 网络资源须有本地缓存降级策略

---

## License

MIT © 2024 gakiwoo1006

---

<p align="center">
  <sub>Built with Expo + React Native + TypeScript + MediaPipe Pose</sub>
</p>
