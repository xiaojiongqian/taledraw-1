# 存储策略配置说明

## 概述

该项目支持两种存储策略，可以通过环境变量进行配置：

1. **Cloud Storage 模式**（开发环境推荐）
2. **Firestore 模式**（生产环境推荐）

## 配置方法

### 1. 开发环境配置（Cloud Storage）

```bash
# 设置存储模式为 Cloud Storage
firebase functions:config:set storage.mode="cloud_storage"

# 设置存储桶（可选，默认使用项目默认桶）
firebase functions:config:set storage.bucket="ai-app-taskforce.appspot.com"
```

### 2. 生产环境配置（Firestore）

```bash
# 设置存储模式为 Firestore
firebase functions:config:set storage.mode="firestore"
```

### 3. 查看当前配置

```bash
firebase functions:config:get
```

## 环境变量读取

在 `functions/index.js` 中，配置通过以下方式读取：

```javascript
const STORAGE_MODE = functions.config().storage?.mode || 'cloud_storage';
const TEMP_STORAGE_BUCKET = functions.config().storage?.bucket || `${PROJECT_ID}.appspot.com`;
```

## 切换环境

### 从开发环境切换到生产环境

1. 确保生产环境项目支持 Firestore Native Mode
2. 部署前设置配置：
   ```bash
   firebase use production-project-id
   firebase functions:config:set storage.mode="firestore"
   firebase deploy --only functions
   ```

### 从生产环境切换到开发环境

```bash
firebase use development-project-id
firebase functions:config:set storage.mode="cloud_storage"
firebase deploy --only functions
```

## 存储策略对比

| 特性 | Cloud Storage | Firestore |
|------|--------------|-----------|
| 适用环境 | 开发、测试 | 生产 |
| 数据持久性 | 临时（24小时） | 永久 |
| 查询能力 | 无 | 丰富的查询功能 |
| 成本 | 低 | 相对较高 |
| 设置复杂度 | 简单 | 需要正确的数据库模式 |
| 压缩支持 | ✅ | ❌ |

## 故障排除

### Cloud Storage 模式常见问题

1. **权限错误**：确保 Cloud Functions 服务账号有 Storage 权限
2. **桶不存在**：检查 `TEMP_STORAGE_BUCKET` 配置是否正确

### Firestore 模式常见问题

1. **FAILED_PRECONDITION 错误**：确保数据库是 Native Mode
2. **权限错误**：确保 Cloud Functions 服务账号有 Firestore 权限

## 数据清理

### Cloud Storage 自动清理

Cloud Storage 模式下，文件会在 24 小时后自动过期。也可以手动清理：

```bash
gsutil rm -r gs://your-bucket/temp-tales/
```

### Firestore 手动清理

生产环境建议保留数据，如需清理可使用 Firebase 控制台或编写清理脚本。 