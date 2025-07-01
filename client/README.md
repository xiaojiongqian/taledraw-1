# 📚 故事绘本生成器

一个基于React的Web应用，使用Google Gemini AI和Imagen 4 API自动为用户输入的故事生成精美的插图绘本。

## ✨ 功能特色

- 🤖 **智能分页**: 使用Gemini AI自动将故事分解为适合绘本的多个页面
- 🎨 **AI绘图**: 使用Imagen 4为每页生成高质量的插图
- 🔄 **风格一致**: 确保所有页面的绘画风格和角色外观保持一致
- 🔐 **用户认证**: 基于Firebase的邮箱/密码认证系统
- ☁️ **云存储**: 图像自动保存到Firebase Storage
- 📱 **响应式设计**: 支持桌面和移动设备

## 🚀 快速开始

### 前置要求

1. Node.js (版本 14 或更高)
2. npm 或 yarn
3. Google Cloud Platform 账户
4. Firebase 项目

### 安装步骤

1. **克隆项目**
   ```bash
   git clone <your-repository-url>
   cd taledraw/client
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **配置环境变量**
   
   在 `client` 目录下创建 `.env` 文件：
   ```env
   # Google Cloud Platform API 密钥
   REACT_APP_GEMINI_API_KEY=your_gemini_api_key_here
   ```

4. **获取API密钥**

   **Gemini API密钥**:
   - 前往 [Google AI Studio](https://makersuite.google.com/app/apikey)
   - 创建新的API密钥
   - 将密钥复制到 `.env` 文件中

   **Firebase配置**:
   - 前往 [Firebase Console](https://console.firebase.google.com/)
   - 创建新项目或使用现有项目
   - 启用Authentication（Email/Password方式）
   - 启用Cloud Storage
   - 复制配置信息到 `src/firebase.js`

5. **配置GCP权限**

   确保您的Firebase项目有以下权限：
   - Vertex AI API（用于Imagen 4）
   - Cloud Storage API
   - Firebase Authentication

6. **启动应用**
   ```bash
   npm start
   ```

   应用将在 `http://localhost:3000` 运行

## 🔧 配置详情

### Firebase配置

更新 `src/firebase.js` 中的配置：

```javascript
const firebaseConfig = {
  apiKey: "your_api_key",
  authDomain: "your_project.firebaseapp.com",
  projectId: "your_project_id",
  storageBucket: "your_project.appspot.com",
  messagingSenderId: "your_sender_id",
  appId: "your_app_id"
};
```

### Imagen 4 API设置

应用使用Firebase Authentication令牌访问GCP Vertex AI API。确保：

1. Firebase项目启用了Vertex AI API
2. 项目有适当的配额和计费设置
3. 用户有访问Imagen 4 API的权限

## 📖 使用方法

1. **注册/登录**: 使用邮箱和密码创建账户或登录
2. **输入故事**: 在文本框中输入您的故事内容
3. **生成绘本**: 点击"生成绘本"按钮
4. **查看结果**: 等待AI处理后查看生成的多页绘本
5. **保存分享**: 图像自动保存到云端，可随时访问

## 🏗️ 技术架构

- **前端**: React 19.1.0
- **认证**: Firebase Authentication
- **存储**: Firebase Cloud Storage
- **AI服务**: 
  - Google Gemini 1.5 Pro (文本分析和提示词生成)
  - Google Imagen 4 (图像生成)
- **样式**: 现代CSS with backdrop-filter
- **部署**: 支持Firebase Hosting

## 🔍 API接口

### 主要函数

- `generateStoryPages(storyText)`: 使用Gemini分析故事并生成分页内容
- `generateImageWithImagen(prompt, pageIndex)`: 使用Imagen 4生成图像
- `generateTale(storyText)`: 主要的故事生成流程

## 🚨 注意事项

1. **API配额**: Imagen 4 API可能有使用限制，请检查GCP配额
2. **成本**: 图像生成会产生费用，请监控使用情况
3. **图像质量**: 生成时间可能较长，请耐心等待
4. **网络依赖**: 需要稳定的网络连接

## 🐛 故障排除

### 常见问题

**认证失败**:
- 检查Firebase配置是否正确
- 确认Email/Password认证已启用

**图像生成失败**:
- 验证Vertex AI API是否启用
- 检查项目配额和计费状态
- 确认用户权限设置

**API密钥错误**:
- 检查`.env`文件中的API密钥
- 确认Gemini API密钥有效且有权限

## 📝 开发说明

### 项目结构
```
src/
├── App.js          # 主应用组件
├── App.css         # 样式文件
├── api.js          # API调用逻辑
├── firebase.js     # Firebase配置
└── index.js        # 应用入口
```

### 添加新功能

1. 在`api.js`中添加新的API调用
2. 在`App.js`中添加UI组件
3. 在`App.css`中添加样式

## 📄 许可证

本项目基于 MIT 许可证开源。

## 🤝 贡献

欢迎提交Issue和Pull Request来改进这个项目！

---

**由 Gemini AI 和 Imagen 4 驱动 | 使用 Firebase 云存储**
