# ADR-001: WebView + Blob URL 架构运行 MediaPipe

| 属性 | 值 |
|------|-----|
| 状态 | 已采纳 |
| 日期 | 2024-04 |
| 决策者 | Gakiwoo |

## 上下文

项目需要实时运行 MediaPipe Pose 进行人体姿态检测。React Native 原生环境无法直接运行 MediaPipe（需要 Canvas + WebGL），需要选择一种集成方案。

## 决策

采用 **WebView 内嵌 HTML5 页面 + Blob URL 注入模型文件** 的架构：

- 在 RN 侧通过 `react-native-webview` 加载一个本地 HTML 页面
- HTML 页面内通过 `<canvas>` + MediaPipe Pose API 运行检测
- 模型文件（wasm/tflite）从 CDN 下载后缓存到本地，通过 `Blob URL` 注入到 WebView
- WebView ↔ RN 通过 `postMessage` 传递姿态数据

## 可选方案

### 方案 A: 纯原生集成（react-native-mediapipe）

- **优点**: 性能最优，无 WebView 开销
- **缺点**: 需要维护 native bridge，社区库不稳定，MediaPipe 原生 API 版本迭代快导致维护成本极高
- **结论**: 否决，维护成本不可控

### 方案 B: WebView + CDN 在线加载模型

- **优点**: 实现简单，无需本地缓存
- **缺点**: 必须联网，CORS 问题复杂，首次加载慢，用户体验差
- **结论**: 否决，离线需求优先

### 方案 C: WebView + Blob URL 注入（采纳）

- **优点**: 离线可用、无 CORS 问题、模型版本可控、首次下载后零网络依赖
- **缺点**: WebView 有额外内存开销（约 50MB）、postMessage 通信有 ~10ms 延迟
- **结论**: 采纳，离线优先的需求驱动

## 影响

- WebView 进程约占 50MB 额外内存
- 姿态数据通过 postMessage 传递，存在约 10ms 序列化延迟
- 模型文件需要约 22MB 本地缓存空间
- 首次启动需下载模型，后续启动零网络依赖

## 修订记录

- 2024-04: 初始决策
- 2024-05: 增加 CDN 多源回退策略（见 ADR-003）
