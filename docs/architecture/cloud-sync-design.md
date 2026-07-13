# AI Sport 训练记录云端同步方案

> 状态：部分实现，当前试点不依赖云同步
>
> 更新日期：2026-07-11

## 1. 当前事实

- Mobile 以 `WorkoutRepository` 本地存储为权威数据源，离线训练可用。
- `SyncService` 默认关闭；只有 `EXPO_PUBLIC_ENABLE_CLOUD_SYNC=true` 时才尝试同步。
- 当前客户端只实现 pending 记录的 POST push、成功标记和指数退避。
- 当前客户端没有 GET pull、跨设备合并、删除同步或真实冲突解决。
- 仓库 `deploy/` 中存在 workout sync、Pilot 路由和 SQLite 迁移源码。
- 2026-07-11 线上只读复查：`GET /api/workouts/sync` 和 `GET /api/pilot/schools` 均返回 404。
- Auth 路由在线，MediaPipe 模型 CDN 在线；这两项不能证明 Sync/Pilot 路由已部署。

因此，“双向同步已完成”“换机恢复已验收”“Pilot API 已上线”均不是当前有效结论。校园试点主路径使用 `pilot-v1` 文件包。

## 2. 目标

若产品决定继续云端路线，目标是：

1. 多设备增量同步。
2. 离线优先，联网后自动补传。
3. 明确的冲突与删除语义。
4. Mobile、Desktop 和服务端共享版本化契约。
5. 可观测、可回滚、可审计。

## 3. 当前本地模型

```typescript
interface LocalWorkoutRecord extends WorkoutSession {
  id: string;
  _syncStatus: 'local' | 'synced' | 'conflict';
  _serverId?: string;
}
```

训练保存后记录保持本地可读。云同步关闭或失败时，记录不得被错误标记为 synced。

## 4. 当前已实现的 push

```text
WorkoutRepository.getPendingSync()
  -> 检查 EXPO_PUBLIC_ENABLE_CLOUD_SYNC
  -> POST /api/workouts/sync { workouts }
  -> 读取 { synced: [{ localId, serverId }] }
  -> batchMarkSynced()
  -> 失败时保留 pending，并执行有限次数指数退避
```

触发入口包括启动延迟、训练保存后以及 App 回到前台时。NetInfo 实时网络监听仍是注释中的可选增强，不是当前已启用能力。

## 5. 目标 API 契约

以下是待实现并联调的目标，不代表线上可用。

### 5.1 Push

```http
POST /api/workouts/sync
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "workouts": []
}
```

```json
{
  "synced": [{ "localId": "...", "serverId": "..." }],
  "conflicts": []
}
```

### 5.2 Pull

```http
GET /api/workouts/sync?since=<ISO-8601>
Authorization: Bearer <access-token>
```

客户端需要保存同步游标，并按稳定 ID、更新时间和删除标记合并记录。

### 5.3 Pilot

目标路由包括 schools、classrooms、students、tasks 和 assignments。正式接入前必须统一 `pilot-v1` 文件模型与 API 模型，避免同一实体出现两套字段语义。

## 6. 服务端源码状态

仓库内当前包含：

```text
deploy/api/routes/workouts.js
deploy/api/routes/pilot.js
deploy/api/db/workoutRepo.js
deploy/api/db/pilotRepo.js
deploy/api/migrate-v9.js
deploy/api/migrate-v10.js
```

这些文件说明服务端方案已经编码，但仍缺少当前线上挂载、鉴权、数据库迁移版本和端到端测试证据。部署状态必须通过线上路由、日志、数据库版本和真实客户端联调共同确认。

## 7. 待完成的客户端能力

- [ ] `pullRemote(since)` 与同步游标持久化。
- [ ] 按 `_serverId` 和更新时间做幂等合并。
- [ ] 冲突状态、人工选择和最终解决策略。
- [ ] 删除墓碑与跨设备删除同步。
- [ ] 批量分页、超限与重试幂等键。
- [ ] Desktop 复用同一同步契约。
- [ ] 登录、训练、同步、换机恢复的真实设备 E2E。

## 8. 部署与验收门禁

| 门禁       | 当前状态       | 完成标准                             |
| ---------- | -------------- | ------------------------------------ |
| 路由挂载   | 未完成         | 未登录请求返回 401/403，而不是 404   |
| 数据库迁移 | 未验证         | 线上 schema 版本、备份与回滚记录     |
| Push       | 客户端代码存在 | 真实账号上传并在服务端读取到同一记录 |
| Pull       | 未实现         | 新设备可拉取并幂等合并               |
| 冲突       | 未实现         | 自动与人工策略都有测试               |
| Desktop    | 未接入         | 教师端可读取同一学校/任务/成绩数据   |
| 可观测性   | 未验证         | 失败率、延迟、重试和告警可追踪       |

只有以上门禁通过后，路线图才能把云同步从“部分实现”改为“已验收”。

## 9. 当前试点策略

第一轮校园试点继续使用本地文件闭环：

```text
Desktop 基础包 -> Mobile 导入与训练 -> Mobile 成绩包 -> Desktop 复核与导出
```

该策略与云端同步并不冲突，并且能在服务端契约尚未稳定时降低试点风险。云端路线是否继续，应由数据合规、部署方式、试点学校网络条件和运维成本共同决定。
