# 测试文档

本目录包含 Tale Draw 客户端应用的单元测试。

## 📁 测试结构

```
test/
├── setup.js                           # 测试环境配置
├── README.md                          # 测试文档
├── stateManager.test.js               # 状态管理测试
├── api.test.js                        # API 模块测试
├── components/
│   ├── ImagenModelSelector.test.js    # AI模型选择器测试
│   └── PageItem.test.js               # 页面项组件测试
├── utils/
│   └── logger.test.js                 # 日志工具测试
└── services/
    └── StripeService.test.js          # Stripe支付服务测试
```

## 🧪 测试覆盖范围

### 核心业务逻辑测试 (高优先级)
- **StateManager**: 状态持久化、恢复、清理、数据安全
- **API模块**: 图像生成、错误处理、参数验证
- **组件核心功能**: 图像查看、编辑功能、状态管理

### 工具函数测试 (中优先级)  
- **Logger**: 开发/生产环境日志、敏感数据过滤
- **组件交互**: 用户交互、事件处理、可访问性

### 集成服务测试 (低优先级)
- **支付服务**: Stripe集成、错误处理、安全性

## 🚀 运行测试

### 运行所有测试
```bash
cd client
npm test
```

### 运行特定测试文件
```bash
npm test -- stateManager.test.js
npm test -- components/PageItem.test.js
```

### 运行测试并查看覆盖率
```bash
npm test -- --coverage
```

### 运行测试并监听文件变化
```bash
npm test -- --watchAll
```

## 📊 测试覆盖的功能点

### StateManager 测试
- ✅ 状态保存和恢复
- ✅ 版本兼容性检查
- ✅ 数据过期处理 (24小时)
- ✅ 敏感数据清理
- ✅ 错误处理和容错
- ✅ UI状态管理
- ✅ 边缘情况处理

### API 模块测试
- ✅ 图像生成成功/失败场景
- ✅ 不同场景类型处理
- ✅ 多种宽高比支持
- ✅ 进度回调处理
- ✅ 错误类型解析
- ✅ 模型参数传递
- ✅ 角色描述构建

### 组件测试
- ✅ 渲染状态 (成功/失败/生成中)
- ✅ 用户交互 (点击/编辑/保存)
- ✅ 图像查看器功能
- ✅ 键盘快捷键
- ✅ 错误显示和处理
- ✅ 可访问性属性

### 工具函数测试
- ✅ 开发/生产环境行为
- ✅ 敏感数据检测和过滤
- ✅ 日志级别控制
- ✅ 性能和安全性
- ✅ 边缘情况处理

## 🛡️ 测试最佳实践

### 1. Mock 策略
- **外部服务**: Firebase、Stripe 等外部依赖被完全 mock
- **浏览器 API**: localStorage、window.open、Canvas 等被 mock
- **环境变量**: 开发/生产环境切换测试

### 2. 数据安全
- 测试敏感数据过滤机制
- 验证生产环境不泄露调试信息
- 确保错误信息不包含敏感内容

### 3. 错误处理
- 网络错误、API 失败场景
- 无效输入和边缘情况
- 用户取消操作

### 4. 性能考虑
- 大数据量处理测试
- 频繁操作性能测试
- 内存泄漏预防

## 🔧 测试配置

### setup.js 配置内容
- Jest DOM 扩展
- localStorage mock
- Firebase mock
- Canvas/Image API mock
- 控制台输出mock

### Mock 说明
```javascript
// 示例：localStorage mock
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;
```

## 📈 持续改进

### 已实现
- ✅ 核心业务逻辑完整测试覆盖
- ✅ 错误场景和边缘情况测试
- ✅ 安全性和性能测试
- ✅ 可访问性测试

### 待扩展
- 🔄 端到端测试 (E2E)
- 🔄 视觉回归测试
- 🔄 性能基准测试
- 🔄 多浏览器兼容性测试

## 🐛 测试失败排查

### 常见问题
1. **Mock 未生效**: 确保 mock 在 `beforeEach` 中正确设置
2. **异步测试失败**: 使用 `async/await` 或 `waitFor`
3. **DOM 测试问题**: 检查 `@testing-library/jest-dom` 配置

### 调试技巧
```bash
# 运行单个测试并显示详细输出
npm test -- --verbose stateManager.test.js

# 运行测试并保持进程活跃以便调试
npm test -- --runInBand --no-cache
```

## 📝 编写新测试

### 文件命名
- 测试文件: `*.test.js`
- 放置位置: 对应 `src/` 结构的 `test/` 目录

### 测试结构
```javascript
describe('功能模块名', () => {
  beforeEach(() => {
    // 测试前准备
  });

  describe('子功能', () => {
    it('should 具体行为描述', () => {
      // 测试代码
    });
  });
});
```

### 断言示例
```javascript
// 基本断言
expect(result).toBe(expected);
expect(result).toEqual(expectedObject);

// DOM 断言
expect(element).toBeInTheDocument();
expect(element).toHaveClass('className');

// 函数调用断言
expect(mockFunction).toHaveBeenCalledWith(param);
expect(mockFunction).toHaveBeenCalledTimes(1);
```

---

**维护者**: Tale Draw 开发团队  
**最后更新**: 2025-07-11