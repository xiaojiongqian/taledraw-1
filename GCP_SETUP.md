# GCP Imagen API 配置指南

## 方案A: Google OAuth2 配置

### 1. 创建OAuth2 Client ID

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 选择项目 `ai-app-taskforce`
3. 导航至 **APIs & Services** > **Credentials**
4. 点击 **Create Credentials** > **OAuth 2.0 Client IDs**
5. 选择 **Web application**
6. 配置：
   - **Name**: Tale Draw Web App
   - **Authorized JavaScript origins**: 
     - `http://localhost:3000`
     - `https://your-domain.com`
   - **Authorized redirect URIs**:
     - `http://localhost:3000`

### 2. 启用必要的API

在 **APIs & Services** > **Library** 中启用：
- ✅ **AI Platform API**
- ✅ **Vertex AI API**
- ✅ **Cloud Resource Manager API**

### 3. 配置环境变量

在 `client/.env` 中添加：
```env
REACT_APP_GEMINI_API_KEY=AIzaSyBX66q8mwaoDoTJ7yGU55X22fQZM0vKfgE
REACT_APP_GOOGLE_CLIENT_ID=your-oauth-client-id-here
REACT_APP_GCP_PROJECT_ID=ai-app-taskforce
```

## 方案B: Firebase Functions代理（更安全）

### 1. 创建Service Account

1. 在GCP Console中，导航至 **IAM & Admin** > **Service Accounts**
2. 点击 **Create Service Account**
3. 配置：
   - **Name**: tale-draw-service
   - **Role**: 
     - `AI Platform Developer`
     - `Vertex AI User`
4. 创建并下载JSON密钥文件

### 2. 部署Firebase Functions

```bash
npm install -g firebase-tools
firebase login
firebase init functions
```

### 3. Functions代码示例

```javascript
// functions/index.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { GoogleAuth } = require('google-auth-library');

admin.initializeApp();

exports.generateImage = functions.https.onCall(async (data, context) => {
  // 验证用户认证
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { prompt, pageIndex } = data;
  
  // 使用Service Account调用Imagen API
  const auth = new GoogleAuth({
    keyFile: './path-to-service-account.json',
    scopes: ['https://www.googleapis.com/auth/cloud-platform']
  });
  
  // ... Imagen API调用逻辑
});
```

## 方案C: 替代图像API

### 使用OpenAI DALL-E

```env
REACT_APP_OPENAI_API_KEY=your-openai-api-key
```

```javascript
async function generateImageWithDALLE(prompt) {
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.REACT_APP_OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: prompt,
      n: 1,
      size: "512x512"
    })
  });
  
  const data = await response.json();
  return data.data[0].url;
}
```

### 使用Stability AI

```env
REACT_APP_STABILITY_API_KEY=your-stability-api-key
```

## 推荐方案

对于你的项目，我推荐：
1. **开发阶段**: 使用占位符图像（当前实现）
2. **生产环境**: 方案B（Firebase Functions代理）最安全
3. **快速原型**: 方案C（DALL-E或Stability AI）最简单 