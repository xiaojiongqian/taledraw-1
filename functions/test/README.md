# Tale Draw Functions 测试套件

这是一个为 Tale Draw Firebase Functions 设计的系统化测试包，确保所有云函数在部署前经过充分测试。

## 📋 测试覆盖范围

### 🔧 单元测试 (Unit Tests)
- ✅ 函数参数验证
- ✅ 认证检查
- ✅ 错误处理
- ✅ 配置加载
- ✅ 基础功能逻辑

### 🔗 集成测试 (Integration Tests)  
- ✅ 完整业务流程测试
- ✅ 函数间协作测试
- ✅ 存储策略测试
- ✅ API调用链测试
- ✅ 错误恢复测试

### ⚡ 性能测试 (Performance Tests)
- ✅ 响应时间测试
- ✅ 并发处理能力
- ✅ 内存使用监控
- ✅ 边界条件测试
- ✅ 压力测试

## 🚀 快速开始

### 1. 安装依赖
```bash
cd functions/test
npm install
```

### 2. 启动Firebase模拟器
```bash
# 在functions目录下启动模拟器
cd ..
firebase emulators:start --only functions,firestore,storage
```

### 3. 运行测试

#### 运行所有测试
```bash
npm test
```

#### 分类运行测试
```bash
# 单元测试（快速）
npm run test:unit

# 集成测试（中等速度）  
npm run test:integration

# 性能测试（较慢）
npm run test:performance

# CI测试（单元+集成）
npm run test:ci
```

#### 监视模式
```bash
npm run test:watch
```

#### 覆盖率测试
```bash
npm run test:coverage
```

## 📁 测试结构

```
functions/test/
├── setup.js              # 测试环境初始化
├── unit/
│   └── functions.test.js  # 单元测试
├── integration/
│   └── workflow.test.js   # 业务流程集成测试
├── performance/
│   └── load.test.js       # 性能和负载测试
├── package.json           # 测试依赖配置
└── README.md             # 本文档
```

## 🎯 测试策略

### 测试优先级
1. **P0 - 关键功能**：认证、参数验证、核心业务逻辑
2. **P1 - 重要功能**：图像生成、故事处理、存储操作
3. **P2 - 性能优化**：响应时间、并发处理、资源使用

### 测试环境
- **开发环境**：使用Firebase模拟器，快速迭代
- **测试环境**：模拟真实API调用，但使用测试数据
- **生产环境**：仅运行健康检查和基础验证

## 🔍 测试结果解读

### 成功指标
- ✅ 所有单元测试通过
- ✅ 集成测试覆盖主要业务流程
- ✅ 响应时间在合理范围内
- ✅ 内存使用稳定
- ✅ 错误处理正确

### 注意事项
- ⚠️ **需要凭证的测试**：某些测试需要Google Cloud凭证，没有凭证时会跳过
- ⚠️ **模拟器限制**：部分真实API功能在模拟器中无法完全测试
- ⚠️ **网络依赖**：集成测试可能依赖网络连接

## 🛠️ 故障排除

### 常见问题

**1. 测试超时**
```bash
# 原因：函数响应时间过长
# 解决：检查函数逻辑或增加超时时间
```

**2. 模拟器连接失败**
```bash
# 确保模拟器正在运行
firebase emulators:start --only functions,firestore,storage
```

**3. 依赖问题**
```bash
# 清理并重新安装
rm -rf node_modules package-lock.json
npm install
```

**4. 权限错误**
```bash
# 检查Firebase配置和服务账户密钥
export GOOGLE_APPLICATION_CREDENTIALS="path/to/service-account-key.json"
```

### 调试技巧

**查看详细日志**
```bash
npm test -- --grep "特定测试名称" --timeout 0
```

**运行单个测试文件**
```bash
npx mocha test/unit/functions.test.js --timeout 30000
```

## 📊 测试报告

运行测试后会生成以下报告：

- **控制台输出**：实时测试进度和结果
- **覆盖率报告**：代码覆盖情况（如果运行coverage）
- **性能统计**：响应时间、内存使用等指标

## 🔄 持续集成

### 建议的CI流程
1. **代码提交** → 触发CI
2. **安装依赖** → `npm install`
3. **启动模拟器** → `firebase emulators:start`
4. **运行测试** → `npm run test:ci`
5. **生成报告** → 测试结果和覆盖率
6. **部署决策** → 基于测试结果决定是否部署

### GitHub Actions 示例
```yaml
name: Test Functions
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: cd functions/test && npm install
      - run: cd functions && firebase emulators:exec --only functions 'cd test && npm run test:ci'
```

## 📈 测试指标目标

- **单元测试覆盖率**：> 80%
- **集成测试覆盖率**：> 60%
- **平均响应时间**：< 100ms (健康检查)
- **API调用成功率**：> 95%
- **内存使用稳定性**：无明显泄漏

## 🤝 贡献指南

添加新测试时请遵循：

1. **命名规范**：描述性的测试名称
2. **结构清晰**：arrange -> act -> assert
3. **错误处理**：考虑异常情况
4. **性能考虑**：避免过度复杂的测试
5. **文档更新**：更新相关文档

---

## 📞 支持

如有测试相关问题，请：
1. 检查本文档的故障排除部分
2. 查看控制台错误信息
3. 确认Firebase模拟器状态
4. 检查函数代码变更影响 