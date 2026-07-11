# Mobile 项目文档索引

> 更新日期：2026-07-10

## 当前入口

- [开发路线图](./ROADMAP.md)：当前阶段、已完成代码和待验收门禁。
- [500 段视频数据集](./testing/video-dataset.md)：真实媒体、标注、审批和严格校验规则。
- [低端 Android 稳定性](./testing/device-stability.md)：30 分钟真机报告格式与严格门禁。
- [云同步设计](./architecture/cloud-sync-design.md)：当前 push-only 状态和待完成的双向同步。
- [E2E 测试](./e2e/README.md)：Maestro 流程与真机前置条件。

## 架构决策

- [ADR-001：WebView + Blob URL](./adr/001-webview-blob-url-architecture.md)
- [ADR-002：ExerciseCounter 策略模式](./adr/002-strategy-pattern-exercise-counter.md)
- [ADR-003：CDN 多源回退](./adr/003-cdn-multi-source-fallback.md)
- [架构评估](./architecture_evaluation.md)

## 部署

- [Sentry 配置](./deployment/sentry-config.md)
- [MediaPipe CDN 部署](./deployment/mediapipe-deploy.md)
- [Git 推送指南](./deployment/git-push.md)
- 部署脚本见 `scripts/deployment/`。

## 历史快照

- [评估报告 v1](./PROJECT_EVALUATION_REPORT.md)
- [评估报告 v2](./PROJECT_EVALUATION_REPORT_v2.md)
- [历史修复计划](./FIX_PLAN.md)

历史报告保留当时的测试数量、评分和风险判断，不作为当前发布状态。当前状态以仓库根目录的 `AI-Sport-System-当前实现与验收状态-2026-07-10.md` 和本目录的路线图为准。
