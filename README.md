# 🎨 Tale Draw - AI绘本生成器

[![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=flat&logo=firebase&logoColor=black)](https://firebase.google.com/)
[![React](https://img.shields.io/badge/React-61DAFB?style=flat&logo=react&logoColor=black)](https://reactjs.org/)
[![Gemini](https://img.shields.io/badge/Gemini-4285F4?style=flat&logo=google&logoColor=white)](https://ai.google.dev/)
[![Imagen](https://img.shields.io/badge/Imagen_4-0F9D58?style=flat&logo=google&logoColor=white)](https://cloud.google.com/vertex-ai/docs/generative-ai/image/overview)

一个基于AI的智能绘本生成器，使用Google Gemini和Imagen 4 API，将文字故事自动转换为精美的插图绘本。

## ✨ 核心功能

- 🤖 **智能故事分页**：Gemini AI自动将故事分解为适合绘本的多个页面
- 🎨 **高质量AI插图**：Imagen 4生成专业级儿童绘本插图  
- 🔄 **角色一致性**：确保所有页面中角色外观保持一致
- 🛡️ **内容安全优化**：多层级安全保护，确保内容适合儿童
- 💾 **状态持久化**：页面刷新后自动恢复绘本状态，图片智能重新下载
- 📱 **响应式设计**：支持桌面和移动设备
- ☁️ **云端存储**：Firebase自动保存，随时访问

## 🛡️ 内容安全亮点

### 多层安全保护机制
1. **LLM级别安全指导** - Gemini自动转换争议内容
2. **前端实时过滤** - 用户输入词汇智能转换  
3. **图像生成增强** - 自动添加友善氛围描述
4. **用户界面指导** - 安全使用提示和最佳实践

### 自动内容优化
| 原始内容 | 自动转换 |
|---------|----------|
| 暴力场景 → | 友好竞赛或讨论 |
| 恐怖元素 → | 神秘探险或有趣挑战 |
| 负面情绪 → | 困惑或需要帮助 |
| 危险行为 → | 安全探索活动 |

## 🚀 项目结构

```
taledraw/
├── 📁 client/                    # React前端应用
├── 📁 functions/                 # Firebase Cloud Functions  
├── 📄 CONTENT_SAFETY.md          # 内容安全详细说明
├── 📄 USER_GUIDE.md              # 用户使用指南
├── 📄 DEPLOYMENT.md              # 部署指南
└── 📄 PRD.md                     # 产品需求文档
```

## 🔧 技术架构

### 前端技术栈
- **React 18+** - 现代化用户界面
- **Firebase SDK** - 认证和存储
- **现代CSS** - 响应式设计和动画

### 后端技术栈  
- **Firebase Functions** - 无服务器后端
- **Google Vertex AI** - Gemini和Imagen API调用
- **Firebase Storage** - 图像文件存储
- **Firebase Authentication** - 用户认证

### AI服务集成
- **Gemini 2.0 Flash** - 故事分析和提示词生成
- **Imagen 4** - 高质量图像生成
- **内容安全优化** - 多层级安全检查

## 🎯 快速开始

### 1. 环境要求
- Node.js 18+
- Firebase CLI
- Google Cloud Platform账户

### 2. 安装和配置
```bash
# 克隆项目
git clone https://github.com/your-username/taledraw.git
cd taledraw

# 安装依赖
cd client && npm install
cd ../functions && npm install

# 配置和部署
# 详细步骤请参考 DEPLOYMENT.md
```

### 3. 本地开发
```bash
# 启动Firebase模拟器
firebase emulators:start

# 启动前端开发服务器
cd client && npm start
```

## 📖 使用流程

1. **注册登录** - 创建账户或使用现有账户登录
2. **输入故事** - 在文本框中输入您的故事内容  
3. **调整设置** - 选择页数(6-15页)和长宽比(16:9/9:16)
4. **生成绘本** - 点击生成按钮，等待AI处理
5. **查看编辑** - 查看结果，可编辑提示词重新生成

详细使用方法请参考 **[用户指南](USER_GUIDE.md)**。

## 📖 前端开发指南

### 环境配置
在 `client` 目录下创建 `.env` 文件：
```env
# 如果需要直接调用Gemini API（可选）
REACT_APP_GEMINI_API_KEY=your_gemini_api_key_here
```

### 目录结构
```
src/
├── App.js                      # 主应用组件
├── App.css                     # 全局样式
├── api.js                      # API调用逻辑
├── auth.js                     # 认证相关逻辑
├── firebase.js                 # Firebase配置
├── components/                 # UI组件
│   ├── AspectRatioSelector.js  # 长宽比选择器
│   ├── CharacterManager.js     # 角色管理
│   ├── PageItem.js             # 单页展示组件
│   └── PageSelector.js         # 页数选择器
└── index.js                    # 应用入口
```

### 常用开发命令
```bash
# 安装依赖
npm install
# 启动开发服务器
npm start
# 构建生产版本
npm run build
# 运行测试
npm test
# 测试覆盖率
npm test -- --coverage
```

### 主要功能组件
- **App.js**：认证状态管理、故事生成流程、页面状态、错误处理
- **api.js**：`generateTale`、`regeneratePageImage`、`generateCharacterAvatar`等API接口
- **PageItem.js**：图像显示、提示词编辑、安全提示、重新生成功能

### 内容安全前端实现
- `api.js`中实现安全词汇映射（如"打架"→"玩耍"）
- 用户输入实时转换争议性词汇，自动添加儿童友好描述
- 编辑器中显示安全提示

### 样式与响应式
- 采用CSS变量和现代CSS特性
- 移动优先设计，灵活网格布局
- 触摸友好交互

### 开发调试建议
- 检查Firebase配置和认证状态
- 检查API调用和网络请求
- 检查Storage权限和图像URL
- 使用React.memo优化渲染，图像懒加载

### 代码规范
- 使用ES6+语法，函数式组件优先
- 合理注释，统一命名
- 提交信息规范：`feat: 新功能`、`fix: 修复bug`、`style: 样式`、`refactor: 重构`

## 📚 文档导航

| 文档 | 描述 |
|------|------|
| [📖 用户指南](USER_GUIDE.md) | 详细使用说明和最佳实践 |
| [🚀 部署指南](DEPLOYMENT.md) | 生产环境部署步骤 |
| [🛡️ 内容安全](CONTENT_SAFETY.md) | 安全机制详细说明 |
| [💾 状态持久化指南](STATE_PERSISTENCE_GUIDE.md) | 状态持久化功能说明 |
| [📱 前端开发指南](README.md#前端开发指南) | React应用开发说明 |
| [📊 开发进度](progress.md) | 项目开发状态追踪 |
| [📋 产品文档](PRD.md) | 产品需求和功能规格 |

## 🤝 贡献指南

我们欢迎任何形式的贡献！

### 贡献方式
- 🐛 **Bug报告**：发现问题请提交Issue
- 💡 **功能建议**：提出新功能想法
- 🔧 **代码贡献**：提交Pull Request
- 📝 **文档改进**：完善项目文档

### 开发规范
- 遵循现有代码风格
- 提交前运行测试
- 更新相关文档
- 编写清晰的提交信息

## 🆘 获得帮助

### 技术支持
- 📧 **邮箱支持**：project-support@example.com
- 🐛 **Bug报告**：[GitHub Issues](https://github.com/your-username/taledraw/issues)
- 💬 **功能讨论**：[GitHub Discussions](https://github.com/your-username/taledraw/discussions)

### 常见问题
- **部署问题**：参考 [DEPLOYMENT.md](DEPLOYMENT.md)
- **使用问题**：参考 [USER_GUIDE.md](USER_GUIDE.md)
- **安全相关**：参考 [CONTENT_SAFETY.md](CONTENT_SAFETY.md)

## 📄 许可证

本项目基于 [MIT License](LICENSE) 开源。

## 🌟 致谢

感谢以下技术和服务：
- **Google Gemini AI** - 强大的语言理解能力
- **Google Imagen 4** - 高质量图像生成
- **Firebase** - 完整的应用开发平台
- **React** - 优秀的前端框架

---

**由 ❤️ 和 AI 驱动 | 为创造更美好的儿童内容而生**

<p align="center">
  <a href="USER_GUIDE.md">📖 使用指南</a> •
  <a href="DEPLOYMENT.md">🚀 部署指南</a> •
  <a href="CONTENT_SAFETY.md">🛡️ 安全说明</a> •
  <a href="progress.md">📊 开发进度</a>
</p> 

## 🖼️ Imagen 多模型支持方案

### 1. 方案目标
- 同时支持Imagen 3和Imagen 4两套模型，便于平滑切换和A/B测试。
- 通过.env配置决定当前使用哪一组API，无需重启后端。

### 2. 技术实现
- **Firebase Functions后端**：
  - 保持现有Imagen 3相关函数（如`generateImage`）不变，继续服务Imagen 3。
- 新增Imagen 4专用函数组（如`generateImageV4`），API路径带`V4`后缀。
  - Imagen 4函数组核心参数：
    - `location` 固定为`us-central1`
    - `model`为`imagen-4.0-generate-preview-06-06`
    - 其他参数与Imagen 3兼容，特殊参数差异做适配
- **前端/后端切换**：
  - 在.env中增加`IMAGEN_API_VERSION=3`或`4`
  - 前端/后端根据该配置决定调用哪一组API

### 3. 参数与兼容性说明
- Imagen 3与Imagen 4的API参数基本兼容，主流程参数（prompt、aspect_ratio、number_of_images等）一致。
- Imagen 4不支持部分Imagen 3的高级定制参数（如few-shot subject/style customization、mask-based编辑等），如有用到需做适配。
- 速率限制、区域、部分返回字段略有不同，详见Google官方文档。

### 4. 典型调用流程
```js
// 伪代码
const apiVersion = process.env.IMAGEN_API_VERSION;
const apiName = apiVersion === '4' ? 'generateImageV4' : 'generateImage';
const result = await callFirebaseFunction(apiName, params);
```

### 5. 扩展性
- 支持未来更多模型版本的平滑接入
- 便于灰度发布、A/B测试和回滚

--- 