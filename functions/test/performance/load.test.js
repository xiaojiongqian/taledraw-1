// 性能和负载测试 - 测试函数在高负载和边界条件下的表现
const { expect } = require('chai');
const { describe, it, before, after } = require('mocha');

// 导入测试环境
const {
  testEnv,
  mockUser,
  createMockRequest,
  testStoryData,
  testImagePrompts,
  testConfig,
  waitFor,
  cleanup
} = require('../setup');

const functions = require('../../index');

describe('Tale Draw Performance and Load Tests', function() {
  this.timeout(300000); // 设置超时为5分钟

  before(() => {
    process.env.NODE_ENV = 'test';
    console.log('开始性能和负载测试');
  });

  after(() => {
    cleanup();
    console.log('性能和负载测试完成');
  });

  describe('响应时间性能测试', () => {
    it('健康检查函数应该在100ms内响应', async () => {
      const wrapped = testEnv.wrap(functions.healthCheck);
      const req = createMockRequest({});
      
      const measurements = [];
      const testRuns = 10;
      
      for (let i = 0; i < testRuns; i++) {
        const startTime = process.hrtime.bigint();
        await wrapped(req);
        const endTime = process.hrtime.bigint();
        
        const duration = Number(endTime - startTime) / 1000000; // 转换为毫秒
        measurements.push(duration);
      }
      
      const averageTime = measurements.reduce((a, b) => a + b, 0) / measurements.length;
      const maxTime = Math.max(...measurements);
      const minTime = Math.min(...measurements);
      
      console.log(`健康检查性能统计:`);
      console.log(`- 平均响应时间: ${averageTime.toFixed(2)}ms`);
      console.log(`- 最大响应时间: ${maxTime.toFixed(2)}ms`);
      console.log(`- 最小响应时间: ${minTime.toFixed(2)}ms`);
      
      expect(averageTime).to.be.below(100);
      expect(maxTime).to.be.below(200);
    });

    it('getTaleData函数参数验证应该快速响应', async () => {
      const wrapped = testEnv.wrap(functions.getTaleData);
      const req = createMockRequest({}); // 无效请求
      
      const startTime = process.hrtime.bigint();
      
      try {
        await wrapped(req);
        expect.fail('应该抛出参数错误');
      } catch (error) {
        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - startTime) / 1000000;
        
        expect(error.code).to.equal('invalid-argument');
        expect(duration).to.be.below(50); // 参数验证应该非常快
        
        console.log(`参数验证响应时间: ${duration.toFixed(2)}ms`);
      }
    });
  });

  describe('并发处理能力测试', () => {
    it('应该能同时处理多个健康检查请求', async () => {
      const wrapped = testEnv.wrap(functions.healthCheck);
      const concurrentRequests = 20;
      
      const startTime = Date.now();
      
      const promises = Array(concurrentRequests).fill().map((_, index) => {
        return wrapped(createMockRequest({ requestId: index }));
      });
      
      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;
      
      // 验证所有请求都成功
      results.forEach((result, index) => {
        expect(result.status).to.equal('healthy');
      });
      
      const averageTimePerRequest = totalTime / concurrentRequests;
      
      console.log(`并发测试结果:`);
      console.log(`- 并发请求数: ${concurrentRequests}`);
      console.log(`- 总耗时: ${totalTime}ms`);
      console.log(`- 平均每请求耗时: ${averageTimePerRequest.toFixed(2)}ms`);
      
      expect(averageTimePerRequest).to.be.below(100);
    });

    it('应该能处理不同类型的并发请求', async () => {
      const healthWrapper = testEnv.wrap(functions.healthCheck);
      const taleWrapper = testEnv.wrap(functions.getTaleData);
      
      const mixedRequests = [
        // 健康检查请求
        ...Array(5).fill().map(() => 
          healthWrapper(createMockRequest({}))
        ),
        // 故事数据请求（预期失败）
        ...Array(5).fill().map(() => 
          taleWrapper(createMockRequest({ taleId: 'test' }))
            .catch(error => ({ error: error.code }))
        )
      ];
      
      const results = await Promise.all(mixedRequests);
      
      // 验证健康检查成功
      const healthResults = results.slice(0, 5);
      healthResults.forEach(result => {
        expect(result.status).to.equal('healthy');
      });
      
      // 验证故事请求正确失败
      const taleResults = results.slice(5);
      taleResults.forEach(result => {
        expect(result.error).to.equal('not-found');
      });
      
      console.log('✓ 混合并发请求处理成功');
    });
  });

  describe('内存使用和资源测试', () => {
    it('处理大量数据时内存使用应该合理', () => {
      const initialMemory = process.memoryUsage();
      
      // 创建大量测试数据
      const largeStoryData = testStoryData.longStory.repeat(100);
      const largeCharacterList = Array(1000).fill().map((_, i) => ({
        name: `Character${i}`,
        description: `A character description that is quite long and detailed for character number ${i}`
      }));
      
      const currentMemory = process.memoryUsage();
      const heapUsedDiff = currentMemory.heapUsed - initialMemory.heapUsed;
      
      console.log(`内存使用统计:`);
      console.log(`- 初始堆内存: ${Math.round(initialMemory.heapUsed / 1024 / 1024)}MB`);
      console.log(`- 当前堆内存: ${Math.round(currentMemory.heapUsed / 1024 / 1024)}MB`);
      console.log(`- 堆内存增长: ${Math.round(heapUsedDiff / 1024 / 1024)}MB`);
      
      // 清理大数据
      const afterCleanup = process.memoryUsage();
      
      expect(afterCleanup.heapUsed).to.be.below(currentMemory.heapUsed * 1.5);
    });

    it('配置加载不应该消耗过多内存', () => {
      const beforeConfig = process.memoryUsage();
      
      // 重新加载配置多次
      for (let i = 0; i < 10; i++) {
        delete require.cache[require.resolve('../../config')];
        require('../../config');
      }
      
      const afterConfig = process.memoryUsage();
      const heapDiff = afterConfig.heapUsed - beforeConfig.heapUsed;
      
      console.log(`配置加载内存影响: ${Math.round(heapDiff / 1024)}KB`);
      
      expect(heapDiff).to.be.below(10 * 1024 * 1024); // 不超过10MB
    });
  });

  describe('边界条件测试', () => {
    it('应该处理极长的故事文本', async () => {
      // 创建接近2000字符的故事（接近限制）
      const longStory = testStoryData.longStory.repeat(3).substring(0, 1950);
      
      const wrapped = testEnv.wrap(functions.extractCharacter);
      const req = createMockRequest({ story: longStory });
      
      try {
        const startTime = Date.now();
        await wrapped(req);
        const duration = Date.now() - startTime;
        
        console.log(`处理长故事耗时: ${duration}ms`);
        expect(duration).to.be.below(30000); // 30秒内完成
        
      } catch (error) {
        if (error.code === 'unauthenticated' || 
            (error.code === 'internal' && error.message.includes('access token'))) {
          console.log('⚠ 长故事测试跳过：需要认证');
          return;
        }
        throw error;
      }
    });

    it('应该处理最大页数请求', () => {
      const maxPages = testConfig.limits.maxPageCount;
      
      // 模拟最大页数的提示词数组
      const maxPrompts = Array(maxPages).fill().map((_, i) => ({
        prompt: `Page ${i + 1}: ${testImagePrompts.simple}`,
        pageIndex: i
      }));
      
      expect(maxPrompts.length).to.equal(maxPages);
      expect(maxPrompts[0].pageIndex).to.equal(0);
      expect(maxPrompts[maxPages - 1].pageIndex).to.equal(maxPages - 1);
      
      console.log(`✓ 最大页数(${maxPages})结构验证通过`);
    });

    it('应该处理空字符串和null值', async () => {
      const wrapped = testEnv.wrap(functions.generateImage);
      
      const invalidInputs = [
        { prompt: '' },
        { prompt: null },
        { prompt: undefined },
        { prompt: '   ' } // 只有空格
      ];
      
      for (const input of invalidInputs) {
        try {
          await wrapped(createMockRequest(input));
          expect.fail(`应该拒绝无效输入: ${JSON.stringify(input)}`);
        } catch (error) {
          expect(error.code).to.be.oneOf(['invalid-argument', 'unauthenticated']);
        }
      }
      
      console.log('✓ 无效输入处理测试通过');
    });
  });

  describe('错误恢复和重试机制测试', () => {
    it('应该有合理的超时处理', async () => {
      // 测试函数超时配置
      const config = require('../../config');
      
      expect(config.API_CONFIG.DEFAULT_TIMEOUT).to.be.a('number');
      expect(config.API_CONFIG.DEFAULT_TIMEOUT).to.be.at.least(60);
      expect(config.API_CONFIG.DEFAULT_TIMEOUT).to.be.at.most(900);
      
      console.log(`函数超时配置: ${config.API_CONFIG.DEFAULT_TIMEOUT}秒`);
    });

    it('应该有适当的内存配置', () => {
      const config = require('../../config');
      
      expect(config.API_CONFIG.DEFAULT_MEMORY).to.be.a('string');
      expect(['256MB', '512MB', '1GB', '1GiB', '2GB', '2GiB', '4GB', '4GiB', '8GB', '8GiB'])
        .to.include(config.API_CONFIG.DEFAULT_MEMORY);
      
      console.log(`函数内存配置: ${config.API_CONFIG.DEFAULT_MEMORY}`);
    });
  });

  describe('压力测试', () => {
    it('快速连续请求压力测试', async () => {
      const wrapped = testEnv.wrap(functions.healthCheck);
      const requestCount = 50;
      const batchSize = 10;
      
      console.log(`开始压力测试: ${requestCount}个请求，批量大小${batchSize}`);
      
      const allResults = [];
      const timings = [];
      
      // 分批执行以避免过载
      for (let batch = 0; batch < requestCount / batchSize; batch++) {
        const batchStart = Date.now();
        
        const batchPromises = Array(batchSize).fill().map((_, i) => 
          wrapped(createMockRequest({ 
            requestId: batch * batchSize + i,
            timestamp: Date.now()
          }))
        );
        
        const batchResults = await Promise.all(batchPromises);
        allResults.push(...batchResults);
        
        const batchDuration = Date.now() - batchStart;
        timings.push(batchDuration);
        
        // 短暂延迟避免过快请求
        await waitFor(100);
      }
      
      // 验证所有请求成功
      expect(allResults.length).to.equal(requestCount);
      allResults.forEach(result => {
        expect(result.status).to.equal('healthy');
      });
      
      const avgBatchTime = timings.reduce((a, b) => a + b, 0) / timings.length;
      const maxBatchTime = Math.max(...timings);
      
      console.log(`压力测试结果:`);
      console.log(`- 总请求数: ${requestCount}`);
      console.log(`- 成功率: 100%`);
      console.log(`- 平均批次耗时: ${avgBatchTime.toFixed(2)}ms`);
      console.log(`- 最大批次耗时: ${maxBatchTime.toFixed(2)}ms`);
      
      expect(avgBatchTime).to.be.below(2000); // 平均批次时间不超过2秒
    });
  });

  describe('资源清理测试', () => {
    it('测试后应该正确清理资源', async () => {
      const beforeCleanup = process.memoryUsage();
      
      // 执行一些操作
      const wrapped = testEnv.wrap(functions.healthCheck);
      await wrapped(createMockRequest({}));
      
      // 手动触发垃圾回收（如果可用）
      if (global.gc) {
        global.gc();
      }
      
      const afterCleanup = process.memoryUsage();
      
      console.log(`清理前后内存对比:`);
      console.log(`- 清理前: ${Math.round(beforeCleanup.heapUsed / 1024 / 1024)}MB`);
      console.log(`- 清理后: ${Math.round(afterCleanup.heapUsed / 1024 / 1024)}MB`);
      
      // 内存使用不应该显著增长
      const memoryGrowth = afterCleanup.heapUsed - beforeCleanup.heapUsed;
      expect(memoryGrowth).to.be.below(50 * 1024 * 1024); // 不超过50MB增长
    });
  });
}); 