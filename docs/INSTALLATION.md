# 安装说明

## 项目改进依赖安装

由于当前环境中 npm 未在 PATH 中，请按照以下步骤手动安装依赖。

### 步骤 1：安装 npm 依赖

在项目根目录运行以下命令：

```bash
# 进入项目目录
cd "e:\BaiduSyncdisk\Gakiwu\00-Vibeo Coding\AI Sport"

# 安装所有依赖（包括新添加的 zustand）
npm install
```

或者如果你使用 yarn：

```bash
yarn install
```

### 步骤 2：验证安装

安装完成后，验证 package.json 中的 zustand 依赖：

```bash
npm list zustand
```

应该显示类似输出：
```
ai-motion-tracker@1.0.0
└── zustand@5.x.x
```

### 步骤 3：运行测试

安装完成后，运行测试确保代码正常工作：

```bash
# 运行所有测试
npm test

# 运行测试并监听文件变化
npm run test:watch
```

### 步骤 4：运行类型检查

```bash
# 如果项目有 typecheck 脚本
npm run typecheck

# 或者直接使用 tsc
npx tsc --noEmit
```

### 步骤 5：运行 Lint 检查

```bash
# 检查代码规范
npm run lint

# 自动修复可修复的问题
npm run lint:fix
```

### 步骤 6：代码格式化

```bash
# 使用 Prettier 格式化代码
npm run format
```

## 已完成的改进

### 新增依赖
- **zustand**: ^5.0.0 - 轻量级状态管理库

### 新增文件
1. **src/hooks/useWebViewMessageHandler.ts** - WebView 消息处理器 Hook
2. **src/stores/WorkoutStore.ts** - Zustand 状态管理 Store
3. **src/stores/index.ts** - Store 导出文件
4. **docs/improvements-2024.md** - 改进文档

### 修改的文件
1. **src/components/CameraView.tsx** - 重构使用新的 Hook
2. **src/screens/WorkoutScreen.tsx** - 使用 Zustand Store
3. **src/components/ErrorBoundary.tsx** - 增强错误处理
4. **src/services/ExerciseCounter.ts** - 添加 createCounter 工厂函数
5. **package.json** - 添加 zustand 依赖

## 已知问题

如果在安装或运行过程中遇到问题，请检查：

1. **Node.js 版本**: 确保使用 Node.js 18+ 版本
   ```bash
   node --version
   ```

2. **npm 版本**: 确保使用 npm 9+ 版本
   ```bash
   npm --version
   ```

3. **清理缓存**: 如果遇到奇怪的错误，尝试清理缓存
   ```bash
   npm cache clean --force
   rm -rf node_modules
   npm install
   ```

## 技术支持

如果遇到其他问题，请参考：
- [Zustand 文档](https://zustand.docs.pmnd.rs/)
- [Expo 文档](https://docs.expo.dev/)
- [React Native 文档](https://reactnative.dev/)
