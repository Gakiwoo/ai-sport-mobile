# AI Motion Tracker 开发路线图

> 与 [架构评估](./architecture_evaluation.md)、[云端同步设计](./architecture/cloud-sync-design.md) 配套使用。

## 进度总览

| 阶段 | 状态 | 说明 |
|------|------|------|
| Phase 0 工程地基 | ✅ 已完成 | CI、覆盖率门槛、文档、mediapipeBridge |
| Phase 1 核心链路加固 | ✅ 已完成 | pose.html、Workout 拆分、registry、hooks |
| Phase 2 测试金字塔 | ✅ 已完成 | 黄金样本、Hook 集成测试、393 tests / 53 suites |
| Phase 3 数据与同步 | ✅ **已完成** | WorkoutRepository + SyncService + 后端 API 部署 |
| Phase 4 可观测与发布 | 🚧 进行中 | Sentry 集成、EAS 内测 |
| Phase 5 体验与增长 | ⏳ 待开始 | 深色模式、报告分享等 |

---

## Phase 0：工程地基（第 1～2 周）

- [x] GitHub Actions：`lint` + `test:coverage`
- [x] Jest 覆盖率阈值（global + counters）
- [x] `docs/ROADMAP.md`
- [x] README 测试数与 CI 说明同步
- [x] `src/mediapipe/mediapipeBridge.ts` 通信协议类型
- [ ] `npm run format` 纳入 CI（可选）
- [ ] `npx expo-doctor` 定期执行记录

**验收**：PR 合并前 CI 全绿；`npm run test:coverage` 本地通过。

---

## Phase 1：核心链路加固（第 3～6 周）

- [x] 将 `CameraView` 内嵌 HTML 提取到 `assets/mediapipe/pose.html`（`metro.config.js` + `loadPoseHtml.ts`）
- [x] 拆分 `WorkoutScreen`：`useWorkoutScreen` + Setup / Active / Header / Controls / TargetModal
- [x] 修复 `CameraView`、`useWebViewMessageHandler` 的 hooks 警告
- [x] 合并 `exerciseConfig` + `exerciseRuntime` → `exerciseRegistry`

**验收**：`CameraView.tsx` < 350 行；`WorkoutScreen` < 100 行；无新增 lint error。✅

---

## Phase 2：测试金字塔（第 4～6 周，可与 Phase 1 并行）

- [x] `useWebViewMessageHandler` 消息序列集成测试
- [x] `useWorkout` 状态流转测试（start / processFrame / stop）
- [x] 黄金 pose JSON 样本 + `goldenPoseRunner`（7 条，覆盖 6 种运动）
- [x] Maestro E2E 骨架（`smoke-guest-squats` + testID）
- [ ] 每种运动 10+ 段标注 pose JSON
- [ ] E2E：完整训练保存链路（需 dev build + 相机）

**验收**：counter 目录覆盖率 ≥ 85%。

---

## Phase 3：数据与同步（✅ 已完成 — 2026-07-08）

- [x] `LocalWorkoutRecord` + `_syncStatus` 字段
- [x] `WorkoutRepository` 抽象（分键存储 + 旧数据迁移 + FIFO 裁剪）
- [x] 后端 API 部署到 `gakiwoo.com`：
  - `POST /api/auth/{register,login,refresh,logout}` — 用户认证
  - `POST /api/workouts/sync` — 推送训练记录
  - `GET /api/workouts/sync?since=` — 增量拉取（双向同步）
  - `GET /api/workouts/stats` — 训练统计
  - `/api/pilot/*` — 校园任务/班级/学生 CRUD
- [x] `SyncService`：启动 / 训练后 / 网络恢复自动同步
- [x] History / Analytics 改读 Repository
- [x] 后端 DB：SQLite `workout_sessions` 表（24 字段）
- [x] Pilot 校园：`pilot_schools/classrooms/students/tasks/assignments` 5 表
- [x] MediaPipe CDN：`gakiwoo.com/static/mediapipe/pose/` 提供 lite + full 模型

**验收**：登录用户换机后训练记录可恢复。✅

---

## Phase 4：可观测与发布（持续）

- [ ] Sentry 集成
- [ ] `PerformanceMonitor` 关键指标上报
- [ ] EAS preview 渠道自动构建
- [ ] CHANGELOG + 语义化版本

---

## Phase 5：体验与增长（按需）

- [ ] 深色模式（训练页优先）
- [ ] 训练报告分享图
- [ ] 新运动类型模板（Counter + 测试 + registry）
- [ ] 教练/班级模式（依赖 Phase 3）

---

## 里程碑

| 里程碑 | 目标日期 | 交付物 |
|--------|------------------|--------|
| M1 可协作 | ✅ +2 周 | CI 绿、覆盖率报告 |
| M2 可维护 | ✅ +6 周 | CameraView/Workout 拆分 |
| M3 可留存 | ✅ **2026-07-08** | 训练同步 MVP + Pilot API |
| M4 可运营 | 待定 | 内测包 + 崩溃监控 |

---

## Issue 标签建议

- `phase-0` … `phase-5`
- `priority:high` / `priority:low`
- `area:mediapipe` / `area:counter` / `area:sync` / `area:ci`
