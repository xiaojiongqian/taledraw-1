# 🚀 故事绘本生成器 - 部署指南

## 📋 前置要求

- Node.js 18+
- Firebase CLI
- Google Cloud Platform账户
- 已创建的Firebase项目

## 🔧 部署步骤

### 1. 环境准备

```bash
# 安装Firebase CLI
npm install -g firebase-tools

# 登录Firebase
firebase login

# 初始化项目（如果还没有）
firebase init
```

### 2. GCP Service Account配置

#### A. 创建Service Account

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 选择项目 `ai-app-taskforce`
3. 导航至 **IAM & Admin** > **Service Accounts**
4. 点击 **Create Service Account**
5. 配置Service Account：
   - **Name**: `tale-draw-service`
   - **Description**: `Service account for Tale Draw app`

#### B. 分配权限

为Service Account分配以下角色：
- `AI Platform Developer`
- `Vertex AI User`
- `Storage Admin`
- `Cloud Functions Developer`

#### C. 生成密钥（可选 - Functions会自动使用默认Service Account）

Firebase Functions在GCP环境中运行时会自动使用默认的Service Account，无需手动配置密钥。

### 3. 启用GCP APIs

在 **APIs & Services** > **Library** 中启用：
- ✅ **AI Platform API**
- ✅ **Vertex AI API** 
- ✅ **Cloud Resource Manager API**
- ✅ **Cloud Functions API**
- ✅ **Firebase Storage API**

### 4. 部署Firebase Functions

```bash
# 进入functions目录
cd functions

# 安装依赖
npm install

# 部署Functions
firebase deploy --only functions

# 查看部署日志
firebase functions:log
```

### 5. 配置前端环境

```bash
# 进入client目录
cd client

# 安装依赖
npm install

# 构建生产版本
npm run build
```

### 6. 部署到Firebase Hosting

```bash
# 部署hosting和storage规则
firebase deploy --only hosting,storage

# 或部署全部
firebase deploy
```

## 🧪 本地测试

### 1. 启动Firebase Emulators

```bash
# 启动模拟器
firebase emulators:start

# 模拟器会运行在：
# Functions: http://localhost:5001
# Hosting: http://localhost:5000
# UI: http://localhost:4000
```

### 2. 本地开发

```bash
# 终端1: 启动Firebase Emulators
firebase emulators:start --only functions

# 终端2: 启动React开发服务器
cd client
npm start
```

## 📊 监控和调试

### 查看Functions日志

```bash
# 实时日志
firebase functions:log --only generateImage

# 特定时间范围
firebase functions:log --since 2023-01-01 --until 2023-01-02
```

### 查看Firebase Console

访问 [Firebase Console](https://console.firebase.google.com/)：
- **Functions**: 查看调用次数、错误率、性能
- **Storage**: 查看生成的图像文件
- **Authentication**: 管理用户

### 性能优化

#### Functions冷启动优化

```javascript
// 在functions/index.js中添加
const { setGlobalOptions } = require('firebase-functions/v2');

setGlobalOptions({
  region: 'us-central1',
  memory: '1GiB',
  timeoutSeconds: 300,
  minInstances: 1  // 保持至少1个实例避免冷启动
});
```

#### 成本控制

```javascript
// 添加并发限制
exports.generateImage = onCall({
  maxInstances: 10,  // 限制最大并发实例
  memory: '1GiB',
  timeoutSeconds: 300
}, async (request) => {
  // ... 函数实现
});
```

## 🛡️ 安全配置

### Storage Rules

当前配置允许：
- ✅ 公开读取生成的图像
- ✅ 用户只能写入自己的图像
- ❌ 拒绝其他所有访问

### Functions安全

- ✅ 验证用户认证
- ✅ 输入参数验证
- ✅ 错误处理和日志记录
- ✅ 超时和资源限制

### 内容安全配置

#### 自动内容过滤
部署后的系统包含多层内容安全机制：

1. **LLM级别安全指导**
   ```javascript
   // functions/index.js 中已配置的安全指导
   // 自动将争议内容转换为儿童友好描述
   ```

2. **前端实时过滤**
   ```javascript
   // 配置了安全词汇映射系统
   // 实时转换用户输入的争议性词汇
   ```

3. **图像生成安全增强**
   ```javascript
   // 自动添加安全友善的氛围描述
   // 确保生成内容符合Imagen内容政策
   ```

#### 部署验证清单

部署完成后，验证以下内容安全功能：

- [ ] 故事分页API正确应用安全转换
- [ ] 角色提取API生成包容性描述
- [ ] 用户界面显示安全提示
- [ ] 提示词编辑器包含安全指导
- [ ] 图像生成自动添加友善氛围描述
- [ ] 系统能正确转换争议性词汇

#### 内容安全监控

```bash
# 查看内容安全相关日志
firebase functions:log | grep "safety\|安全\|转换"

# 监控图像生成成功率
firebase functions:log --only generateImage | grep "success\|failed"
```

#### 配置验证

验证内容安全配置是否正确部署：

```bash
# 测试安全词汇转换
curl -X POST https://your-region-your-project.cloudfunctions.net/generateStoryPages \
  -H "Content-Type: application/json" \
  -d '{"storyText": "测试故事包含争议内容"}'

# 检查响应是否包含安全转换后的内容
```

## 📈 扩展功能

### 批量图像生成

```javascript
// 前端调用批量生成
const generateImageBatch = httpsCallable(functions, 'generateImageBatch');

const result = await generateImageBatch({
  prompts: ['prompt1', 'prompt2', 'prompt3'],
  seed: 42
});
```

### 图像缓存

在Functions中添加图像缓存逻辑：

```javascript
// 检查是否已有相同prompt的图像
const cacheKey = `cache/${btoa(prompt).substring(0, 32)}`;
const cachedFile = bucket.file(cacheKey);
const [exists] = await cachedFile.exists();

if (exists) {
  return { imageUrl: await cachedFile.getSignedUrl() };
}
```

## 🚨 故障排除

### 常见问题

1. **Functions部署失败**
   ```bash
   # 检查Node.js版本
   node --version  # 应该是18+
   
   # 重新安装依赖
   cd functions && rm -rf node_modules && npm install
   ```

2. **Imagen API 401错误**
   - 检查Service Account权限
   - 确认APIs已启用
   - 查看Functions日志

3. **图像上传失败**
   - 检查Storage Rules
   - 确认Storage bucket配置
   - 查看用户认证状态

### 生产环境检查清单

- [ ] GCP APIs已启用
- [ ] Service Account权限正确
- [ ] Firebase Functions已部署
- [ ] Storage Rules已配置
- [ ] 前端已构建并部署
- [ ] 环境变量已设置
- [ ] 监控和日志已配置

## 💰 成本估算

### Firebase Functions
- 调用次数：免费层 125万次/月
- 计算时间：免费层 40万GB-秒/月
- 出站网络：免费层 5GB/月

### GCP Imagen API
- Imagen 4: ~$0.04 每张图像
- 月度估算：100K张图像 ≈ $4000

### Firebase Storage
- 存储：$0.026/GB/月
- 下载：$0.12/GB
- 月度估算：10GB存储 + 100GB下载 ≈ $12.26

**总估算成本**：小规模使用 ~$50-100/月

现在你的应用已经配置完成！🎉 