# AI Motion Tracker 开发路线图

> 更新日期：2026-07-24
> 当前工程事实以[系统工程基线](../../AI-Sport-System-当前工程基线-2026-07-24.md)为准。
>
> 与 [项目总览](../README.md)、[云同步设计](./architecture/cloud-sync-design.md) 和 [视频数据集说明](./testing/video-dataset.md) 配套使用。

## 进度总览

| 阶段                       | 状态                 | 当前结论                                                       |
| -------------------------- | -------------------- | -------------------------------------------------------------- |
| Phase 0 工程地基           | 已完成               | CI、覆盖率配置、文档、MediaPipe bridge                         |
| Phase 1 核心链路加固       | 已完成               | Camera/Workout 拆分、registry、错误恢复                        |
| Phase 2 自动化测试         | 已完成               | 56 suites / 407 tests、黄金 pose、Maestro 骨架                 |
| Phase 3 本地数据与校园试点 | 代码完成，待真机验收 | Repository、`pilot-v1` 导入/选择/保存/分享/筛选                |
| Phase 3B 云同步            | 部分实现             | Mobile 仅 push；无 pull/冲突合并；线上 sync/pilot GET 路由 404 |
| Phase 4 可观测与发布       | 进行中               | EAS preview APK 已产出；HTTPS 强制 + R8 已启用；Sentry production、签名与真机稳定性待验收 |
| Phase 5 算法商业验证       | 阻塞                 | 500 段规划已建立，真实数据 0/500                               |
| Phase 6 体验与增长         | 待开始               | 分享报告、深色模式、运营与留存能力                             |

## Phase 0：工程地基

- [x] GitHub Actions：lint、测试与覆盖率流程
- [x] Jest 覆盖率阈值配置
- [x] `src/mediapipe/mediapipeBridge.ts` 通信协议类型
- [x] 核心架构与 ADR 文档
- [x] `expo-doctor` 当前 19/19 通过并记录到工程基线
- [ ] 把格式检查和 `expo-doctor` 固化到 CI 稳定门禁

验收：当前 lint 零 warning、TypeScript、407 项 Jest 测试和 Expo Doctor 19/19 通过。

## Phase 1：核心链路加固

- [x] 将 MediaPipe HTML 提取到 `assets/mediapipe/pose.html`
- [x] 拆分 `WorkoutScreen` 与训练控制组件
- [x] 合并运动配置到 registry/runtime 层
- [x] 增加三档设备性能策略与自适应推理间隔
- [x] 增加站位、全身入镜、边缘和距离提示
- [x] 收敛 WebView `originWhitelist`，禁止 `eval(jsCode)` 路径

验收：代码结构和自动化测试通过。性能档位仍需目标设备实测，不能作为低端平板已达标的证据。

## Phase 2：自动化测试

- [x] `useWebViewMessageHandler` 消息序列测试
- [x] `useWorkout` 状态流转与暂停/恢复测试
- [x] 7 条黄金 pose JSON，覆盖 6 种运动
- [x] Pilot 数据包、导出分享、历史筛选测试
- [x] Maestro E2E 骨架
- [ ] 每种运动至少 10 条标注 pose 序列
- [ ] 真实相机完整训练保存 E2E
- [x] 双端相同 `pilot-v1` 规范样例、导入测试与根目录漂移检查

## Phase 3：本地数据与校园试点

- [x] `WorkoutRepository` 分键存储、旧数据迁移和 FIFO 裁剪
- [x] 本地班级、学生、任务实体与当前选择
- [x] 训练记录写入学生、班级、任务、设备、性能档位和算法摘要
- [x] 历史记录按学生、任务和运动项目筛选
- [x] 导入 Desktop `pilot-v1` 基础包
- [x] 导出本地成绩包到文件，并调用系统分享
- [ ] Android 真机分享文件后由 Desktop 成功导入
- [ ] 完成一次真实学生训练、教师复核和 XLSX 导出验收

验收口径：只有完整的“Desktop 导出 -> Mobile 导入/训练/分享 -> Desktop 导入/复核/导出”人工证据形成后，才标记本阶段验收完成。

## Phase 3B：云同步

- [x] 本地记录 `_syncStatus` 与 pending 查询
- [x] 显式开关 `EXPO_PUBLIC_ENABLE_CLOUD_SYNC`
- [x] pending 记录 POST push 与指数退避
- [ ] GET pull 与按 `_serverId` 合并
- [ ] 冲突解决策略和删除同步
- [ ] 线上 `/api/workouts/sync` 路由挂载与鉴权验收
- [ ] 线上 `/api/pilot/*` 路由挂载与跨端接入
- [ ] 换机恢复真实验收

2026-07-13 只读复查中，线上 sync 和 pilot GET 路由均返回 404。当前试点不依赖本阶段，继续使用本地文件包。

## Phase 4：可观测与发布

- [x] `@sentry/react-native` SDK 和 ErrorBoundary/ErrorReporter 接入
- [ ] 配置生产 `EXPO_PUBLIC_SENTRY_DSN`
- [x] EAS preview APK 构建通过；preview 禁用未配置的 source map 上传
- [ ] 配置 Sentry organization/project/auth token，验证 production source map 上传
- [ ] 验证生产错误事件、脱敏、告警和版本关联
- [x] EAS preview APK 构建产物归档并记录 SHA-256
- [x] Android 网络安全配置：全局禁止明文流量（`network_security_config.xml` + Expo config plugin）
- [x] R8 fullMode 代码混淆（preview + production）
- [x] AuthContext 测试覆盖（9 个测试）
- [ ] EAS production AAB 构建、签名与商店前验收
- [ ] Android 目标设备安装、权限、相机和文件分享验收
- [ ] 低端 Android 30 分钟连续训练测试

## Phase 5：算法商业验证

- [x] 500 段覆盖矩阵
- [x] 数据集结构校验和严格门禁命令
- [x] 算法回归报告命令
- [x] 分项目 MAE/MAPE、漏检、误检、失败样例与严格报告门禁
- [x] 30 分钟真机稳定性报告格式与严格校验命令
- [ ] 500 段真实视频采集
- [ ] 500 段人工标注
- [ ] 500 段审核通过
- [ ] 计数误差、准确率、漏检率、误检率和失败样例报告
- [ ] 第一轮 4 个试点项目达到约定阈值

当前状态：0 recorded / 0 annotated / 0 approved。立定跳远和纵跳保持训练估算，不进入正式成绩宣传。

## 里程碑

| 里程碑              | 状态   | 完成证据                      |
| ------------------- | ------ | ----------------------------- |
| M1 可协作           | 已完成 | CI 与测试框架                 |
| M2 可维护           | 已完成 | 核心模块拆分与自动化测试      |
| M3 本地试点代码闭环 | 已完成 | `pilot-v1` 双端服务与界面代码 |
| M4 本地试点验收     | 待完成 | 真机跨端往返、复核、XLSX      |
| M5 可发布           | 进行中 | preview APK 已产出；Sentry、签名、30 分钟稳定性待完成 |
| M6 算法可承诺       | 阻塞   | approved 数据集与准确率报告   |

## 最近优先级

1. 轮换系统根目录部署脚本中暴露的高权限凭据，并移出源码。
2. 运行真实设备 Pilot 往返验收。
3. 完成低端 Android 30 分钟稳定性测试。
4. 先采集和审批 100 段真实视频，再扩展到 500 段。
5. 配置 production Sentry 和发布签名；云同步未决策前不扩展客户端复杂度。
