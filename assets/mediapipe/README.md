# MediaPipe WebView 资源

> 2026-07-11 复核：该资源仍是 Mobile MediaPipe WebView 的权威入口；修改后必须运行 pose HTML、asset injection 和 Metro Android export 测试。

## `pose.html`

MediaPipe Pose 在 WebView 内运行的完整页面（相机、推理、骨架绘制、与 RN 的 postMessage 桥接）。

- **编辑此文件** 即可修改 WebView 逻辑（支持 HTML/JS 语法高亮）
- 由 `src/mediapipe/loadPoseHtml.ts` 导入并传给 `CameraView`
- 修改后需 **重启 Metro**（`npx expo start -c`）以重新打包

相关 TypeScript 协议见 `src/mediapipe/mediapipeBridge.ts`。
