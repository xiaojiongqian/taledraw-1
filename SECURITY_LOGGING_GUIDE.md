# 安全日志系统使用指南

## 概述

Tale Draw 项目实施了全面的安全日志系统，以防止敏感信息（如 `allCharacters` 数据、API 密钥、用户凭据等）在生产环境中泄露，同时保持开发环境的完整调试功能。

## 快速开始

### 前端使用 (client/)

```javascript
// 导入安全日志工具
import { safeLog } from './utils/logger';

// 替换所有 console 调用
// 旧方式 ❌
console.log('allCharacters:', allCharacters);
console.debug('API response:', response);

// 新方式 ✅
safeLog.sensitive('allCharacters:', allCharacters);
safeLog.debug('API response:', response);
```

### 后端使用 (functions/)

```javascript
// 导入安全日志工具
const { functionsLog } = require('./utils/logger');

// 替换所有 console 调用
// 旧方式 ❌
console.log('Gemini response:', geminiData);
console.error('API error:', error);

// 新方式 ✅
functionsLog.sensitive('Gemini response:', geminiData);
functionsLog.error('API error:', error);
```

## 日志级别说明

### 前端 (safeLog)

| 方法 | 开发环境 | 生产环境 | 使用场景 |
|------|----------|----------|----------|
| `safeLog.debug()` | ✅ 完整输出 | ❌ 不输出 | 调试信息 |
| `safeLog.sensitive()` | ✅ 完整输出 | ❌ 不输出 | 敏感数据如 allCharacters |
| `safeLog.log()` | ✅ 完整输出 | 🔒 清理敏感数据 | 常规信息 |
| `safeLog.info()` | ✅ 完整输出 | 🔒 清理敏感数据 | 信息日志 |
| `safeLog.warn()` | ✅ 完整输出 | 🔒 清理敏感数据 | 警告信息 |
| `safeLog.error()` | ✅ 完整输出 | 🔒 清理敏感数据 | 错误信息 |

### 后端 (functionsLog)

| 方法 | 开发环境 | 生产环境 | 使用场景 |
|------|----------|----------|----------|
| `functionsLog.debug()` | ✅ 完整输出 | ❌ 不输出 | Firebase Functions 调试 |
| `functionsLog.sensitive()` | ✅ 完整输出 | ❌ 不输出 | 敏感数据如 allCharacters |
| `functionsLog.log()` | ✅ 完整输出 | 🔒 清理敏感数据 | 常规日志 |
| `functionsLog.info()` | ✅ 完整输出 | 🔒 清理敏感数据 | 信息日志 |
| `functionsLog.warn()` | ✅ 完整输出 | 🔒 清理敏感数据 | 警告日志 |
| `functionsLog.error()` | ✅ 完整输出 | 🔒 清理敏感数据 | 错误日志 |

## 敏感数据识别

### 自动识别的敏感关键词

以下关键词及其包含的数据会在生产环境中被自动隐藏：

```javascript
const SENSITIVE_KEYS = [
  'allCharacters',  // 💡 核心：角色数据
  'password',       // 用户密码
  'token',          // 认证令牌
  'apiKey',         // API 密钥
  'key',            // 密钥
  'secret',         // 秘密信息
  'credential',     // 凭据
  'auth',           // 认证信息
  'authorization',  // 授权信息
  'bearer'          // Bearer 令牌
];
```

### 示例：敏感数据处理

```javascript
// 开发环境输出 (完整信息)
safeLog.sensitive('角色分析完成:', {
  allCharacters: [
    { name: '小红', description: '勇敢的小女孩' },
    { name: '小明', description: '聪明的小男孩' }
  ],
  apiKey: 'sk-1234567890',
  normalData: { pageCount: 10 }
});

// 生产环境输出 (敏感数据隐藏)
// 🔒 SENSITIVE 级别完全不输出

// 如果使用 error/warn/info 级别:
safeLog.error('生成失败:', {
  allCharacters: '[SENSITIVE_DATA_HIDDEN]',
  apiKey: '[SENSITIVE_DATA_HIDDEN]',
  normalData: { pageCount: 10 }  // 非敏感数据保持原样
});
```

## 使用最佳实践

### 1. 选择合适的日志级别

```javascript
// ✅ 推荐：敏感数据使用 sensitive
safeLog.sensitive('allCharacters 数据:', allCharacters);

// ✅ 推荐：调试信息使用 debug
safeLog.debug('API 请求参数:', requestParams);

// ✅ 推荐：错误信息使用 error（会自动清理敏感数据）
safeLog.error('请求失败:', errorResponse);

// ❌ 避免：敏感数据使用普通 log（生产环境会泄露）
safeLog.log('用户密码:', password); // 不推荐
```

### 2. 处理复杂对象

```javascript
// ✅ 推荐：整个对象包含敏感数据时
const requestData = {
  story: '用户故事...',
  allCharacters: [...],
  apiKey: 'sk-xxx',
  userId: 'user123'
};

safeLog.sensitive('完整请求数据:', requestData);

// ✅ 推荐：分离敏感和非敏感数据
safeLog.info('请求基本信息:', {
  story: requestData.story,
  userId: requestData.userId
});
safeLog.sensitive('请求敏感数据:', {
  allCharacters: requestData.allCharacters,
  apiKey: requestData.apiKey
});
```

### 3. 错误处理中的敏感数据

```javascript
// ✅ 推荐：错误日志会自动清理敏感数据
try {
  // API 调用
  const result = await geminiAPI.call({
    allCharacters: characters,
    apiKey: apiKey
  });
} catch (error) {
  // 生产环境会自动清理 allCharacters 和 apiKey
  functionsLog.error('Gemini API 调用失败:', {
    error: error.message,
    requestData: { allCharacters: characters, apiKey: apiKey },
    timestamp: new Date().toISOString()
  });
}
```

## 环境检测

### 前端环境检测

```javascript
// 基于 React 的 NODE_ENV
const isProduction = process.env.NODE_ENV === 'production';

// 开发环境：undefined 或 'development'
// 生产环境：'production'
```

### 后端环境检测

```javascript
// 基于 NODE_ENV 和 GCloud 项目
const isProduction = () => 
  process.env.NODE_ENV === 'production' || 
  process.env.GCLOUD_PROJECT !== undefined;

// 开发环境：本地运行，无 GCLOUD_PROJECT
// 生产环境：Firebase Functions，有 GCLOUD_PROJECT
```

## 迁移指南

### 从 console 迁移到安全日志

#### 前端迁移

```javascript
// 旧代码 ❌
console.log('角色数据:', allCharacters);
console.debug('API响应:', response);
console.error('错误:', error);
console.warn('警告:', warning);

// 新代码 ✅
import { safeLog } from './utils/logger';

safeLog.sensitive('角色数据:', allCharacters);
safeLog.debug('API响应:', response);
safeLog.error('错误:', error);
safeLog.warn('警告:', warning);
```

#### 后端迁移

```javascript
// 旧代码 ❌
console.log('Gemini响应:', geminiData);
console.debug('调试信息:', debugInfo);
console.error('错误:', error);

// 新代码 ✅
const { functionsLog } = require('./utils/logger');

functionsLog.sensitive('Gemini响应:', geminiData);
functionsLog.debug('调试信息:', debugInfo);
functionsLog.error('错误:', error);
```

### 批量替换建议

使用编辑器的查找替换功能：

```regex
# 查找：console\.(log|debug|info|warn|error)
# 替换：safeLog.$1  (前端)
# 替换：functionsLog.$1  (后端)
```

## 测试验证

### 开发环境测试

```bash
# 前端测试
cd client
npm start
# 浏览器控制台查看完整日志

# 后端测试
cd functions
node test-security-logger.js
# 查看完整的敏感数据输出
```

### 生产环境模拟

```bash
# 设置生产环境变量
export NODE_ENV=production
export GCLOUD_PROJECT=ai-app-taskforce

# 运行测试
node test-security-logger.js
# 验证敏感数据被隐藏
```

## 常见问题

### Q: 为什么我的敏感数据仍然在生产环境显示？

A: 检查以下几点：
1. 确认环境变量正确设置 (`NODE_ENV=production`)
2. 确认使用了正确的日志方法 (`safeLog.sensitive` 而不是 `safeLog.log`)
3. 确认敏感数据的键名包含识别关键词

### Q: 如何添加新的敏感关键词？

A: 修改日志工具中的 `SENSITIVE_KEYS` 数组：

```javascript
const SENSITIVE_KEYS = [
  'allCharacters',
  'password',
  // 添加新的敏感关键词
  'userEmail',
  'personalInfo',
  'privateData'
];
```

### Q: 生产环境完全看不到日志怎么办？

A: `debug` 和 `sensitive` 级别在生产环境完全不输出，使用 `error`、`warn`、`info` 级别的日志在生产环境会清理敏感数据后输出。

### Q: 如何在生产环境保留部分调试信息？

A: 使用 `info` 级别，但确保不包含敏感数据：

```javascript
// ✅ 可以在生产环境输出
safeLog.info('处理状态:', {
  pageCount: 10,
  progress: '50%',
  timestamp: new Date().toISOString()
});

// ❌ 包含敏感数据，生产环境会被清理
safeLog.info('处理状态:', {
  allCharacters: characters,  // 会被隐藏
  pageCount: 10               // 正常显示
});
```

## 部署检查清单

### 部署前验证

- [ ] 所有 `console` 调用已替换为安全日志
- [ ] 运行测试验证敏感数据在生产环境被隐藏
- [ ] 确认环境变量正确配置
- [ ] 验证日志级别设置正确

### 生产环境配置

```json
{
  "NODE_ENV": "production",
  "GCLOUD_PROJECT": "ai-app-taskforce"
}
```

### 监控和维护

1. **定期审计**: 每月检查生产日志确保无敏感信息泄露
2. **新功能检查**: 添加新功能时确保使用安全日志
3. **团队培训**: 确保团队成员了解安全日志使用规范

---

## 总结

安全日志系统确保了 Tale Draw 项目在生产环境中的数据安全，特别是保护了 `allCharacters` 等核心敏感数据。通过合理使用不同的日志级别和遵循最佳实践，可以在保持开发效率的同时确保生产环境的安全性。 