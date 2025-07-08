// 针对每个函数的专门内存使用分析
const { expect } = require('chai');
const { describe, it, before, after } = require('mocha');

// 导入测试环境
const {
  testEnv,
  mockUser,
  createMockRequest,
  testStoryData,
  testImagePrompts,
  waitFor,
  cleanup
} = require('../setup');

// 导入functions
const functions = require('../../index');

// 重用内存监控工具
class MemoryMonitor {
  constructor() {
    this.snapshots = [];
    this.isMonitoring = false;
    this.interval = null;
  }

  startMonitoring(intervalMs = 50) {
    this.isMonitoring = true;
    this.snapshots = [];
    
    this.interval = setInterval(() => {
      if (this.isMonitoring) {
        const usage = process.memoryUsage();
        this.snapshots.push({
          timestamp: Date.now(),
          rss: usage.rss,
          heapUsed: usage.heapUsed,
          heapTotal: usage.heapTotal,
          external: usage.external,
          arrayBuffers: usage.arrayBuffers
        });
      }
    }, intervalMs);
  }

  stopMonitoring() {
    this.isMonitoring = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  getStats() {
    if (this.snapshots.length === 0) return null;

    const rssValues = this.snapshots.map(s => s.rss);
    const heapValues = this.snapshots.map(s => s.heapUsed);

    return {
      count: this.snapshots.length,
      duration: this.snapshots[this.snapshots.length - 1].timestamp - this.snapshots[0].timestamp,
      rss: {
        min: Math.min(...rssValues),
        max: Math.max(...rssValues),
        avg: rssValues.reduce((a, b) => a + b, 0) / rssValues.length,
        peak: Math.max(...rssValues)
      },
      heap: {
        min: Math.min(...heapValues),
        max: Math.max(...heapValues),
        avg: heapValues.reduce((a, b) => a + b, 0) / heapValues.length,
        peak: Math.max(...heapValues)
      }
    };
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  analyzeForFunction(functionName, currentConfigMB) {
    const stats = this.getStats();
    if (!stats) return null;

    const peakMB = stats.heap.peak / (1024 * 1024);
    const rssPeakMB = stats.rss.peak / (1024 * 1024);
    const avgMB = stats.heap.avg / (1024 * 1024);
    
    console.log(`\n🔍 ${functionName} 内存分析:`);
    console.log(`   当前配置: ${currentConfigMB}MB`);
    console.log(`   实际峰值: ${peakMB.toFixed(2)}MB (堆) / ${rssPeakMB.toFixed(2)}MB (RSS)`);
    console.log(`   平均使用: ${avgMB.toFixed(2)}MB`);
    console.log(`   利用率: ${(rssPeakMB / currentConfigMB * 100).toFixed(2)}%`);
    
    // 安全系数根据函数类型调整
    let safetyMargin = 2.0; // 默认安全系数
    if (functionName.includes('Batch')) {
      safetyMargin = 3.0; // 批量处理需要更高安全系数
    } else if (functionName.includes('Stream')) {
      safetyMargin = 2.5; // 流式处理中等安全系数
    } else if (functionName === 'healthCheck') {
      safetyMargin = 1.5; // 健康检查可以较低
    }
    
    const recommendedMB = Math.ceil(rssPeakMB * safetyMargin);
    
    let recommendation;
    if (currentConfigMB > recommendedMB * 1.5) {
      recommendation = `⬇️ 建议降低到 ${recommendedMB}MB`;
    } else if (currentConfigMB < recommendedMB) {
      recommendation = `⬆️ 建议提高到 ${recommendedMB}MB`;
    } else {
      recommendation = `✅ 当前配置合理 (${currentConfigMB}MB)`;
    }
    
    console.log(`   💡 建议: ${recommendation}`);
    
    return {
      function: functionName,
      currentConfig: currentConfigMB,
      peakRSS: rssPeakMB,
      peakHeap: peakMB,
      utilization: (rssPeakMB / currentConfigMB * 100),
      recommended: recommendedMB,
      recommendation: recommendation
    };
  }
}

describe('各函数专门内存使用分析', function() {
  this.timeout(900000); // 15分钟超时

  let monitor;
  const results = [];

  before(() => {
    console.log('🔍 开始针对各函数的内存使用分析');
    monitor = new MemoryMonitor();
  });

  after(() => {
    if (monitor) {
      monitor.stopMonitoring();
    }
    
    // 输出总结报告
    console.log('\n📊 所有函数内存分析总结:');
    console.log('=' .repeat(80));
    
    results.forEach(result => {
      console.log(`\n${result.function}:`);
      console.log(`  当前配置: ${result.currentConfig}MB`);
      console.log(`  实际峰值: ${result.peakRSS.toFixed(2)}MB (RSS)`);
      console.log(`  利用率: ${result.utilization.toFixed(2)}%`);
      console.log(`  建议: ${result.recommendation}`);
    });
    
    console.log('\n🎯 优化建议总结:');
    const overConfigured = results.filter(r => r.utilization < 50);
    const underConfigured = results.filter(r => r.utilization > 85);
    const wellConfigured = results.filter(r => r.utilization >= 50 && r.utilization <= 85);
    
    console.log(`✅ 配置合理: ${wellConfigured.length}个函数`);
    console.log(`⬇️  配置过高: ${overConfigured.length}个函数`);
    console.log(`⬆️  配置不足: ${underConfigured.length}个函数`);
    
    cleanup();
    console.log('✅ 函数专门内存分析完成');
  });

  describe('轻量级函数内存测试', () => {
    it('healthCheck 函数内存使用分析 (当前: 128MB)', async () => {
      const wrapped = testEnv.wrap(functions.healthCheck);
      
      monitor.startMonitoring(20);
      
      // 高频调用测试
      for (let i = 0; i < 200; i++) {
        const req = createMockRequest({});
        await wrapped(req);
        
        if (i % 50 === 0) await waitFor(10);
      }
      
      monitor.stopMonitoring();
      const result = monitor.analyzeForFunction('healthCheck', 128);
      if (result) results.push(result);
      
      console.log('✅ healthCheck 函数内存分析完成');
    });

    it('extractCharacter 函数内存使用分析 (当前: 256MB)', async () => {
      const wrapped = testEnv.wrap(functions.extractCharacter);
      
      monitor.startMonitoring(30);
      
      // 测试不同大小的故事
      const stories = [
        testStoryData.shortStory,
        testStoryData.mediumStory,
        testStoryData.longStory,
        testStoryData.longStory.repeat(2), // 更长的故事
      ];
      
      for (const story of stories) {
        const req = createMockRequest({ story });
        
        try {
          await wrapped(req);
        } catch (error) {
          // 预期可能有认证错误，主要关注内存使用
          if (!error.message.includes('access token') && !error.code === 'unauthenticated') {
            console.log('Unexpected error in extractCharacter:', error.message);
          }
        }
        
        await waitFor(100);
      }
      
      monitor.stopMonitoring();
      const result = monitor.analyzeForFunction('extractCharacter', 256);
      if (result) results.push(result);
      
      console.log('✅ extractCharacter 函数内存分析完成');
    });
  });

  describe('中等内存函数测试', () => {
    it('getTaleData 函数内存使用分析 (当前: 1GB)', async () => {
      const wrapped = testEnv.wrap(functions.getTaleData);
      
      monitor.startMonitoring(30);
      
      // 测试不同的tale ID请求
      const taleIds = [
        'test-tale-1',
        'test-tale-2', 
        'non-existent-tale',
        'large-tale-data',
        'very-long-tale-id-with-complex-name-structure'
      ];
      
      for (let round = 0; round < 3; round++) {
        for (const taleId of taleIds) {
          const req = createMockRequest({ taleId });
          
          try {
            await wrapped(req);
          } catch (error) {
            // 预期会有not-found错误，主要关注内存使用
          }
          
          await waitFor(50);
        }
      }
      
      // 测试并发请求
      const concurrentPromises = [];
      for (let i = 0; i < 10; i++) {
        const req = createMockRequest({ taleId: `concurrent-tale-${i}` });
        concurrentPromises.push(wrapped(req).catch(() => {})); // 忽略错误
      }
      await Promise.all(concurrentPromises);
      
      monitor.stopMonitoring();
      const result = monitor.analyzeForFunction('getTaleData', 1024);
      if (result) results.push(result);
      
      console.log('✅ getTaleData 函数内存分析完成');
    });
  });

  describe('图片生成函数测试', () => {
    it('generateImage 函数内存使用分析 (当前: 1GB)', async () => {
      const wrapped = testEnv.wrap(functions.generateImage);
      
      monitor.startMonitoring(50);
      
      // 测试不同复杂度的提示词
      const prompts = [
        'A simple red circle',
        'A beautiful sunset over mountains with birds flying',
        testImagePrompts.simple,
        testImagePrompts.complex,
        // 测试长提示词
        'A highly detailed, photorealistic scene of a magical forest with ancient trees, glowing mushrooms, fairy lights, mysterious fog, a crystal clear stream running through the middle, colorful butterflies, singing birds, and a small wooden bridge covered with moss and flowers, rendered in 4K quality with perfect lighting and shadows',
        // 测试空和边界情况
        '',
        '   ',
        null
      ];
      
      for (const prompt of prompts) {
        const req = createMockRequest({
          prompt,
          pageIndex: 0,
          aspectRatio: '1:1'
        });
        
        try {
          await wrapped(req);
        } catch (error) {
          // 预期会有各种错误（认证、API调用等），主要关注内存使用
          if (error.message.includes('prompt is missing') || 
              error.message.includes('access token') ||
              error.message.includes('Imagen API')) {
            // 这些是预期的错误
          } else {
            console.log('Unexpected error in generateImage:', error.message);
          }
        }
        
        await waitFor(100);
      }
      
      monitor.stopMonitoring();
      const result = monitor.analyzeForFunction('generateImage', 1024);
      if (result) results.push(result);
      
      console.log('✅ generateImage 函数内存分析完成');
    });

    it('generateImageV4 函数内存使用分析 (当前: 1GB)', async () => {
      const wrapped = testEnv.wrap(functions.generateImageV4);
      
      monitor.startMonitoring(50);
      
      // 测试V4特有的参数组合
      const testCases = [
        {
          prompt: 'A cute cartoon character',
          pageIndex: 0,
          aspectRatio: '1:1',
          seed: 42
        },
        {
          prompt: 'A landscape painting',
          pageIndex: 1,
          aspectRatio: '16:9',
          seed: 123,
          sampleCount: 1
        },
        {
          prompt: testImagePrompts.complex,
          pageIndex: 2,
          aspectRatio: '9:16',
          safetyFilterLevel: 'block_most'
        }
      ];
      
      for (const testCase of testCases) {
        const req = createMockRequest(testCase);
        
        try {
          await wrapped(req);
        } catch (error) {
          // 预期会有认证或API错误
        }
        
        await waitFor(100);
      }
      
      monitor.stopMonitoring();
      const result = monitor.analyzeForFunction('generateImageV4', 1024);
      if (result) results.push(result);
      
      console.log('✅ generateImageV4 函数内存分析完成');
    });
  });

  describe('批量处理函数测试', () => {
    it('generateImageBatch 函数内存使用分析 (当前: 2GB)', async () => {
      const wrapped = testEnv.wrap(functions.generateImageBatch);
      
      monitor.startMonitoring(100);
      
      // 测试不同大小的批量请求
      const batchSizes = [1, 3, 5, 8];
      
      for (const size of batchSizes) {
        const prompts = [];
        for (let i = 0; i < size; i++) {
          prompts.push(`Test image ${i + 1} for batch of ${size}`);
        }
        
        const req = createMockRequest({ prompts });
        
        try {
          await wrapped(req);
        } catch (error) {
          // 预期会有认证或API错误
        }
        
        await waitFor(200);
      }
      
      // 测试大批量请求的内存峰值
      const largeBatch = [];
      for (let i = 0; i < 15; i++) {
        largeBatch.push(`Large batch image ${i + 1}`);
      }
      
      const req = createMockRequest({ prompts: largeBatch });
      try {
        await wrapped(req);
      } catch (error) {
        // 预期会有错误
      }
      
      monitor.stopMonitoring();
      const result = monitor.analyzeForFunction('generateImageBatch', 2048);
      if (result) results.push(result);
      
      console.log('✅ generateImageBatch 函数内存分析完成');
    });

    it('generateImageBatchV4 函数内存使用分析 (当前: 2GB)', async () => {
      const wrapped = testEnv.wrap(functions.generateImageBatchV4);
      
      monitor.startMonitoring(100);
      
      // 测试V4批量处理
      const prompts = [
        { prompt: 'Batch V4 image 1', aspectRatio: '1:1' },
        { prompt: 'Batch V4 image 2', aspectRatio: '16:9' },
        { prompt: 'Batch V4 image 3', aspectRatio: '9:16' },
        { prompt: 'Batch V4 image 4', seed: 42 }
      ];
      
      const req = createMockRequest({ prompts });
      
      try {
        await wrapped(req);
      } catch (error) {
        // 预期会有认证或API错误
      }
      
      monitor.stopMonitoring();
      const result = monitor.analyzeForFunction('generateImageBatchV4', 2048);
      if (result) results.push(result);
      
      console.log('✅ generateImageBatchV4 函数内存分析完成');
    });
  });

  describe('流式处理函数测试', () => {
    // 注意：generateTaleStream 是 onRequest 函数，测试方式不同
    it('应该分析 generateTaleStream 的内存配置需求 (当前: 1GB)', async () => {
      // 由于 generateTaleStream 是 onRequest 函数，我们无法直接用 testEnv.wrap 测试
      // 但我们可以分析其配置需求
      
      console.log('\n🔍 generateTaleStream 配置分析:');
      console.log('   函数类型: onRequest (流式处理)');
      console.log('   当前配置: 1GB');
      console.log('   功能: 流式故事生成 + Gemini API调用');
      console.log('   预期内存需求: 高 (流式输出缓冲 + AI模型调用)');
      console.log('   💡 建议: 保持1GB配置，流式处理需要足够内存缓冲');
      
      // 添加到结果中
      results.push({
        function: 'generateTaleStream',
        currentConfig: 1024,
        peakRSS: 0, // 无法实际测试
        peakHeap: 0,
        utilization: 0,
        recommended: 1024,
        recommendation: '✅ 建议保持1GB (流式处理需求)'
      });
      
      console.log('✅ generateTaleStream 配置分析完成');
    });
  });
}); 