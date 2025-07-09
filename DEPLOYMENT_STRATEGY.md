# Firebase Functions 部署策略

## 🎯 团队协作部署规则

### 函数维护责任划分

#### 你维护的函数 (Your Functions)
- `generateTaleStream` - 故事生成流
- `getTaleData` - 获取故事数据
- `generateImage` - 图像生成（Imagen 3）
- `generateImageV4` - 图像生成（Imagen 4）
- `healthCheck` - 健康检查

#### 其他人维护的函数 (Others' Functions)
- `stripeWebhook` - Stripe支付回调
- `createCheckoutSession` - 创建结账会话
- `createCheckoutSessionHttp` - HTTP结账会话

#### 待删除的函数 (To Be Deleted)
- `extractCharacter` - 角色提取（已弃用）
- `generateImageBatch` - 批量图像生成（已弃用）
- `generateImageBatchV4` - 批量图像生成V4（已弃用）

## 🚀 部署命令

### 安全部署（推荐）
```bash
# 只部署你维护的函数
npm run deploy:my-functions

# 分模块部署
npm run deploy:core      # 核心功能
npm run deploy:image     # 图像生成
npm run deploy:stream    # 流式生成
npm run deploy:health    # 健康检查
```

### 危险操作
```bash
# 全量部署（可能影响他人函数）
npm run deploy
```

## ⚠️ 注意事项

1. **永远不要使用** `firebase deploy --only functions` 除非你确定要部署所有函数
2. **删除函数时**，先在团队群里确认
3. **部署前**，确保运行了 `npm run lint`
4. **紧急情况**，可以使用 Firebase Console 手动操作

## 🔄 删除废弃函数

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
