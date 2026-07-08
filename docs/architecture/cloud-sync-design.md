# AI Sport 训练记录云端同步方案

> **状态：✅ 已实现（2026-07-08）** — 后端 API 已部署到 `gakiwoo.com`，移动端 SyncService 已对接。

## 1. 当前状态

- ✅ 训练记录存储在 `AsyncStorage`（移动端本地）+ `gakiwoo.com`（云端 SQLite）
- ✅ 换设备 → 登录后自动拉取历史记录
- ✅ 后端认证体系：`gakiwoo.com/api/auth/*`，JWT 双 Token（access 15min / refresh 7d）

## 2. 目标

- 多设备数据同步（手机 + 桌面）
- 离线优先，联网后自动同步
- 历史数据不丢失

## 3. 数据模型

```typescript
// 服务端 WorkoutRecord
interface WorkoutRecord {
  id: string;              // UUID v4
  userId: string;          // 关联用户
  exerciseType: ExerciseType;
  mode: WorkoutMode;       // 'count' | 'timed'
  count: number;           // 次数或距离(cm)
  duration: number;        // 秒
  accuracy: number;        // 0-1
  timestamp: string;       // ISO 8601
  deviceId: string;        // 来源设备标识
  syncedAt?: string;       // 最后同步时间
}
```

## 4. API 设计

### 4.1 同步接口

```
POST /api/workouts/sync
Body: {
  records: WorkoutRecord[],  // 本地新增/修改的记录
  lastSyncTime: string|null  // 客户端上次同步时间
}
Response: {
  serverRecords: WorkoutRecord[],  // 服务端比客户端新的记录
  conflicts?: Conflict[]           // 冲突记录（同ID不同内容）
}
```

### 4.2 CRUD

```
GET    /api/workouts           ?from=&to=&exerciseType=&page=&limit=
POST   /api/workouts           创建单条记录
PUT    /api/workouts/:id       更新记录
DELETE /api/workouts/:id       删除记录
GET    /api/workouts/stats     统计摘要（总次数、最佳成绩等）
```

## 5. 同步策略：离线优先 + 增量同步

### 5.1 本地存储扩展

```typescript
interface LocalWorkoutRecord extends WorkoutRecord {
  _syncStatus: 'pending' | 'synced' | 'conflict';
  _localUpdatedAt: string;
}
```

### 5.2 同步流程

```
┌─────────────┐    网络可用     ┌─────────────┐
│  本地写入    │ ─────────────→ │  推送到服务端 │
│  status=pending│              │  获取服务端新  │
└─────────────┘                │  记录合并到本地│
                               └─────────────┘

冲突策略：服务端优先（服务端是权威数据源）
```

### 5.3 同步时机

- App 启动时
- 训练结束后
- 用户手动下拉刷新
- 网络状态从离线恢复时（NetInfo 监听）

## 6. 后端实现（已部署）

### 6.1 数据库（SQLite via better-sqlite3）

实施使用 SQLite（轻量、零维护），部署于 `/var/lib/gakiwoo/gakiwoo.db`：

```sql
CREATE TABLE workout_sessions (
  id                     TEXT PRIMARY KEY,
  user_id               INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exercise_type         TEXT NOT NULL DEFAULT 'unknown',
  mode                  TEXT NOT NULL DEFAULT 'count',
  count                 INTEGER NOT NULL DEFAULT 0,
  duration              INTEGER NOT NULL DEFAULT 0,
  timestamp             INTEGER NOT NULL DEFAULT 0,
  score                 REAL NOT NULL DEFAULT 0,
  score_unit            TEXT NOT NULL DEFAULT 'reps',
  valid_count           INTEGER NOT NULL DEFAULT 0,
  invalid_count         INTEGER NOT NULL DEFAULT 0,
  foul_count            INTEGER NOT NULL DEFAULT 0,
  confidence            REAL NOT NULL DEFAULT 0,
  school_id / class_id / student_id / task_id TEXT,  -- Pilot 字段
  device_id / device_info / performance_tier TEXT,
  algorithm_version / algorithm_log_summary TEXT,
  created_at / updated_at TEXT
);

-- 增建 Pilot 校园 5 表：pilot_schools, pilot_classrooms,
--   pilot_students, pilot_tasks, pilot_assignments
```

### 6.2 实际 API 端点

```
POST   /api/auth/register         # 注册（201）
POST   /api/auth/login            # 登录 → {user} + Set-Cookie
POST   /api/auth/refresh          # 刷新 token
POST   /api/auth/logout           # 登出
GET    /api/auth/me               # 用户信息
GET    /api/auth/usage            # 使用日志
POST   /api/workouts/sync         # 推送记录 → {synced: [{localId,serverId}], conflicts: []}
GET    /api/workouts/sync?since=  # 增量拉取 → {records: [], total: N}
GET    /api/workouts/stats        # 统计 → {total, byExercise: [{exercise_type, total_workouts, ...}]}
GET    /api/pilot/schools          # 试点学校
GET    /api/pilot/classrooms       # 班级列表
GET    /api/pilot/students?classId= # 学生列表
POST   /api/pilot/students/batch   # 批量导入学生
GET    /api/pilot/tasks?classId=   # 训练任务
POST   /api/pilot/tasks            # 创建任务（自动分配给全班）
GET    /api/pilot/assignments?studentId= # 学生收到的任务
```

### 6.3 接口鉴权

复用现有 Cookie 双 Token 体系：
- 移动端：`Authorization: Bearer <access_token>` header
- 桌面端：`credentials: 'include'`，浏览器自动带 Cookie
- 401 → 自动 refresh，失败 → 跳登录页

## 7. 前端实现

### 7.1 SyncService

```typescript
class SyncService {
  // 推送本地 pending 记录到服务端
  async pushPending(): Promise<void>;

  // 拉取服务端新记录合并到本地
  async pullRemote(): Promise<void>;

  // 完整同步 = push + pull
  async sync(): Promise<SyncResult>;

  // 监听网络变化自动同步
  startAutoSync(): void;
}
```

### 7.2 StorageService 扩展

- 写入记录时同时标记 `_syncStatus: 'pending'`
- 同步成功后标记 `_syncStatus: 'synced'`

### 7.3 桌面端同步

桌面端（Tauri）当前用 localStorage，需迁移到：
- 方案 A：tauri-plugin-store（Rust 侧 SQLite，更可靠）
- 方案 B：直接复用 localStorage + 同一个 SyncService

推荐方案 B，简单直接。

## 8. 实施步骤

| 阶段 | 内容 | 估时 | 状态 |
|------|------|------|------|
| Phase 1 | 后端 DB + API + 同步接口 | 2天 | ✅ 已完成 |
| Phase 2 | 前端 SyncService + StorageService 扩展 | 1.5天 | ✅ 已完成 |
| Phase 3 | 两端集成测试 + 冲突处理 | 1天 | ✅ 已完成 |
| Phase 4 | 自动同步 + 离线恢复 | 0.5天 | ✅ 已完成 |

## 9. 注意事项

- **向后兼容**：旧版 App 无同步功能不影响本地使用
- **数据迁移**：首次同步时，本地全部记录标记为 pending 推送上去
- **隐私**：训练数据属于用户个人，不做数据分析
- **配额**：单用户上限 10000 条记录，超出后自动归档旧记录
