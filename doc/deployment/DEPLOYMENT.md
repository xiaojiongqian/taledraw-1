# 🚀 Tale Draw - 部署指南

## 📋 前置要求

- Node.js 18+
- Firebase CLI
- Google Cloud Platform账户
- 已创建的Firebase项目

## 🔧 快速部署

### 1. 环境准备

```bash
# 安装Firebase CLI
npm install -g firebase-tools

# 登录Firebase
firebase login

# 初始化项目（如果还没有）
firebase init
```

### 2. 启用必要的GCP APIs

在 [Google Cloud Console](https://console.cloud.google.com/) 的 **APIs & Services** > **Library** 中启用：

- ✅ **Vertex AI API** 
- ✅ **Cloud Functions API**
- ✅ **Cloud Storage API**
- ✅ **Firebase Storage API**
- ✅ **Cloud Resource Manager API**

### 3. 部署后端函数

#### 🎯 团队协作部署策略

**函数维护责任划分**：

**你维护的函数 (Your Functions)**：
- `generateTaleStream` - 故事生成流
- `getTaleData` - 获取故事数据
- `generateImage` - 图像生成（Imagen 3）
- `generateImageV4` - 图像生成（Imagen 4）
- `healthCheck` - 健康检查

**其他人维护的函数 (Others' Functions)**：
- `stripeWebhook` - Stripe支付回调
- `createCheckoutSession` - 创建结账会话
- `createCheckoutSessionHttp` - HTTP结账会话

**待删除的函数 (To Be Deleted)**：
- `generateImageBatch` - 批量图像生成（已弃用）
- `generateImageBatchV4` - 批量图像生成V4（已弃用）

#### 🚀 部署命令

**安全部署（推荐）**：
```bash
# 进入functions目录
cd functions

# 安装依赖
npm install

# 只部署你维护的函数
npm run deploy:my-functions

# 分模块部署
npm run deploy:core      # 核心功能
npm run deploy:image     # 图像生成
npm run deploy:stream    # 流式生成
npm run deploy:health    # 健康检查
```

**危险操作**：
```bash
# 全量部署（可能影响他人函数）
firebase deploy --only functions
```

#### ⚠️ 注意事项

1. **永远不要使用** `firebase deploy --only functions` 除非你确定要部署所有函数
2. **删除函数时**，先在团队群里确认
3. **部署前**，确保运行了 `npm run lint`
4. **紧急情况**，可以使用 Firebase Console 手动操作

### 4. 部署前端应用

```bash
# 进入client目录
cd client

# 安装依赖
npm install

# 构建生产版本
npm run build

# 部署到Firebase Hosting
npx firebase deploy --only hosting
```

### 5. 配置存储规则

```bash
# 部署Storage安全规则
npx firebase deploy --only storage
```

## 🏗️ 架构配置

### 当前函数列表

| 函数名称 | 类型 | 用途 | 内存配置 | 超时 |
|---------|------|------|----------|------|
| `generateTaleStream` | HTTP | 流式故事生成 | 1GB | 300s |
| `getTaleData` | Callable | 获取故事数据 | 256MB | 60s |
| `generateImage` | Callable | Imagen 3图像生成 | 1GB | 300s |
| `generateImageV4` | Callable | Imagen 4图像生成 | 1GB | 300s |
| `healthCheck` | Callable | 系统健康检查 | 128MB | 60s |

### 存储策略

系统默认使用 **Cloud Storage** 作为主要存储方案：

- **故事数据**: `tales/{userId}/{taleId}.json.gz` (压缩存储)
- **图像文件**: `images/{userId}/{filename}.webp` (WebP格式)
- **临时数据**: 24小时自动过期清理

## 🧪 本地开发

### 启动开发环境

```bash
# 启动Firebase模拟器（后端）
firebase emulators:start --only functions

# 启动React开发服务器（前端）
cd client && npm start
```

### 测试API接口

```bash
# 健康检查
curl -X POST http://localhost:5001/your-project-id/us-central1/healthCheck

# 测试故事生成（需要认证）
curl -X GET "http://localhost:5001/your-project-id/us-central1/generateTaleStream?story=测试故事&pageCount=5"
```

## 📊 监控和调试

### 查看函数日志

```bash
# 实时查看所有函数日志
firebase functions:log

# 查看特定函数日志
firebase functions:log --only generateTaleStream

# 过滤错误日志
firebase functions:log | grep -i error
```

### Firebase Console监控

访问 [Firebase Console](https://console.firebase.google.com/)：

- **Functions**: 查看调用次数、错误率、性能指标
- **Storage**: 查看生成的文件和存储使用情况
- **Authentication**: 管理用户认证

## 🛡️ 安全配置

### 内容安全

系统包含多层内容安全机制：

1. **AI级别**: Gemini和Imagen内置安全过滤
2. **应用级别**: 自动转换争议内容为儿童友好描述
3. **存储级别**: 用户只能访问自己的数据

### Storage安全规则

```javascript
// storage.rules 配置要点
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // 用户只能访问自己的文件
    match /images/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // 临时文件自动过期
    match /temp-tales/{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## 🚨 常见问题

### 部署问题

**1. Functions部署失败**
```bash
# 检查Node.js版本
node --version  # 需要18+

# 重新安装依赖
cd functions && rm -rf node_modules && npm install

# 重新部署
firebase deploy --only functions
```

**2. 前端构建失败**
```bash
# 清理并重新安装
cd client && rm -rf node_modules && npm install

# 重新构建
npm run build
```

**3. API权限错误**
```bash
# 重新登录并设置默认认证
firebase login
gcloud auth application-default login
```

### 运行时问题

**1. 图像生成失败**
- 检查Vertex AI API是否启用
- 确认项目配额是否充足
- 查看函数日志: `firebase functions:log --only generateImageV4`

**2. 存储访问错误**
- 验证Storage规则配置
- 确认用户认证状态
- 检查文件路径权限

**3. 函数超时**
- 检查函数内存配置是否充足
- 监控API响应时间
- 考虑优化批量处理逻辑

## 💰 成本优化

### 关键指标监控

1. **函数调用次数**: 免费层125万次/月
2. **Imagen API使用**: 
   - Imagen 3: ~$0.02/张
   - Imagen 4: ~$0.04/张
3. **Storage使用**: WebP格式减少60-70%存储成本

### 优化建议

- 使用WebP格式减少图像存储成本
- 启用gzip压缩减少数据传输
- 合理配置函数内存避免资源浪费
- 监控API调用频率避免超出配额

## 🚀 生产环境检查清单

部署前确认：

- [ ] GCP APIs已启用
- [ ] Firebase项目配置正确
- [ ] Functions成功部署
- [ ] Hosting正常访问
- [ ] Storage规则已配置
- [ ] 用户认证功能正常
- [ ] 图像生成功能测试通过
- [ ] 日志监控已设置
- [ ] 成本监控已配置

## 📋 删除废弃函数

如果需要删除废弃的函数，使用以下步骤：

1. 在 Firebase Console 中手动删除
2. 或者联系项目管理员
3. 或者在团队会议中统一处理

## 📋 检查清单

部署前请确认：
- [ ] 代码通过lint检查
- [ ] 只部署你维护的函数
- [ ] 没有误删除他人的函数
- [ ] 测试通过

---

*文档版本: v2.0*  
*最后更新: 2025-07-09*  
*维护者: Tale Draw 开发团队* 