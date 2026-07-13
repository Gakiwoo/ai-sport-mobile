# Sentry 配置指南

> 2026-07-11 状态：SDK 已接入；preview 构建通过 `SENTRY_DISABLE_AUTO_UPLOAD=true` 禁用未配置的 source map 上传。production 的 organization、project、auth token、DSN 与事件接收尚未验收。

## 快速开始

### 1. 获取 Sentry DSN

1. 注册/登录 [Sentry.io](https://sentry.io)
2. 创建新项目：选择 **React Native** 平台
3. 在项目设置 → **Client Keys (DSN)** 中复制 DSN

### 2. 配置环境变量

创建 `.env` 文件（不要提交到 Git）：

```bash
# .env
EXPO_PUBLIC_SENTRY_DSN=https://xxxxxx@appid.ingest.sentry.io/projectid
```

### 3. 验证

```bash
# 开发环境：Sentry 不会启用（enableInExpoDevelopment: false）
npx expo start

# 生产构建：Sentry 自动启用
npx eas build --platform android --profile production
```

## 环境变量说明

| 变量 | 必填 | 说明 |
|------|------|------|
| `EXPO_PUBLIC_SENTRY_DSN` | 生产环境必填 | Sentry 项目 DSN |
| `SENTRY_ORG` | production 构建必填 | Sentry organization slug |
| `SENTRY_PROJECT` | production 构建必填 | Sentry project slug |
| `SENTRY_AUTH_TOKEN` | production source map 必填 | 仅存 EAS secret，不进入 Git |
| `SENTRY_DISABLE_AUTO_UPLOAD` | preview 可用 | `true` 时跳过 source map 上传，不应用于正式发布 |

> `EXPO_PUBLIC_` 前缀确保变量在客户端代码中可用。

## 配置项

在 `App.tsx` 中可调整 Sentry 行为：

```typescript
Sentry.init({
  dsn: SENTRY_DSN,
  enableInExpoDevelopment: false,  // 开发环境不上报
  debug: __DEV__,                   // 开发环境开启调试日志
  tracesSampleRate: __DEV__ ? 0 : 1.0,  // 生产环境 100% 采样
});
```

## 关联组件

- **ErrorBoundary** (`src/components/ErrorBoundary.tsx`)：全局错误捕获 + Sentry 上报
- **PerformanceMonitor** (`src/services/PerformanceMonitor.ts`)：FPS/丢帧/内存指标（待 Sentry 指标通道）

## 安全注意事项

- ✅ 使用环境变量管理 DSN，不硬编码
- ✅ `.env` 已加入 `.gitignore`
- ✅ DSN 不可用于服务端密钥，仅用于客户端错误上报
- ⚠️ 不要将启用 `enableInExpoDevelopment: true` 以免产生大量开发噪音
