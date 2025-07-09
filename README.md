# 🎨 Tale Draw - AI故事绘本生成器

基于 React 和 Google AI 技术的智能故事绘本生成器，将用户的故事自动转换为精美的插图绘本。

## ✨ 核心特性

- 🤖 **AI驱动**: 使用 Gemini 2.5-flash 进行故事分析，Imagen 3/4 生成精美插图
- 📖 **智能分页**: 自动将故事分解为1-30页的绘本格式
- 🎨 **多种比例**: 支持1:1, 9:16, 16:9, 3:4, 4:3多种图像比例
- ⚡ **实时生成**: 流式处理，实时显示生成进度
- 💾 **状态持久化**: 页面刷新后自动恢复工作状态
- 📤 **多格式导出**: 支持HTML和PPTX格式导出
- 🛡️ **内容安全**: 多层安全过滤，确保儿童友好内容

## 🚀 快速开始

### 在线体验
访问 [https://ai-app-taskforce.web.app](https://ai-app-taskforce.web.app) 立即体验

### 本地开发

1. **克隆项目**
```bash
git clone https://github.com/your-repo/taledraw.git
cd taledraw
```

2. **前端设置**
```bash
cd client
npm install
npm start
```

3. **后端设置**
```bash
cd functions
npm install
firebase emulators:start --only functions
```

详细部署说明请查看 [部署文档](doc/deployment/DEPLOYMENT.md)

## 🛠️ 技术栈

- **前端**: React 19.1.0, Firebase SDK
- **后端**: Firebase Functions (Node.js 22)
- **AI服务**: Google Vertex AI (Gemini & Imagen)
- **存储**: Firebase Storage, Cloud Storage
- **认证**: Firebase Authentication

## 📁 文档结构

```
doc/
├── requirements/           # 需求文档
│   └── PRD.md             # 产品需求文档
├── deployment/            # 部署文档
│   └── DEPLOYMENT.md      # 部署指南
├── design/               # 设计文档
│   └── SYSTEM_DESIGN.md   # 系统设计文档
└── management/           # 项目管理
    └── PROJECT_STATUS.md  # 项目状态文档
```

### 📋 文档说明

- **[产品需求文档](doc/requirements/PRD.md)**: 产品功能需求、技术要求和质量标准
- **[部署指南](doc/deployment/DEPLOYMENT.md)**: 完整的部署流程和团队协作策略
- **[系统设计文档](doc/design/SYSTEM_DESIGN.md)**: 技术架构、API设计和安全系统
- **[项目状态文档](doc/management/PROJECT_STATUS.md)**: 开发进度、技术债务和未来规划

## 🎯 主要功能

### 已实现功能 ✅
- 故事文本输入（最大2000字）
- AI智能分页和图像生成
- 流式处理和实时反馈
- 状态持久化系统
- HTML/PPTX多格式导出
- 内容安全过滤系统
- WebP图像优化

### 规划中功能 📋
- 角色一致性管理系统
- 用户历史记录功能
- 多语言界面支持
- 移动应用开发

## 📊 项目状态

- **当前版本**: v0.3.8.2
- **开发状态**: 生产可用
- **核心功能**: 100% 完成
- **测试覆盖**: 手动测试 + 生产验证

详细状态请查看 [项目状态文档](doc/management/PROJECT_STATUS.md)

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 📞 联系方式

- 项目链接: [https://github.com/your-repo/taledraw](https://github.com/your-repo/taledraw)
- 在线演示: [https://ai-app-taskforce.web.app](https://ai-app-taskforce.web.app)

---

**维护者**: Tale Draw 开发团队  
**最后更新**: 2025-07-09 