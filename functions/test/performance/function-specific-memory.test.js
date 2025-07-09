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
  let results = [];

  before(() => {
    console.log('🔍 开始针对各函数的内存使用分析');
    monitor = new MemoryMonitor();
    
    monitor.startMonitoring(50);
    
    console.log('🔍 Starting memory usage analysis for each function');
    
    results = []; // 重置结果数组
  });

  after(() => {
    monitor.stopMonitoring();
    
    console.log('\n📊 Memory analysis summary for all functions:');
    
    if (results.length > 0) {
      console.log('\n📋 Analysis results:');
      results.forEach(result => {
        console.log(`  Function: ${result.function}`);
        console.log(`  Current config: ${result.currentConfig}MB`);
        console.log(`  Actual peak: ${result.peakRSS.toFixed(2)}MB (RSS)`);
        console.log(`  Utilization: ${result.utilization.toFixed(2)}%`);
        console.log(`  Recommendation: ${result.recommendation}`);
      });
      
      console.log('\n🎯 Optimization recommendations summary:');
      const wellConfigured = results.filter(r => r.recommendation.includes('✅'));
      const overConfigured = results.filter(r => r.recommendation.includes('⬇️'));
      const underConfigured = results.filter(r => r.recommendation.includes('⬆️'));
      
      console.log(`✅ Well configured: ${wellConfigured.length} functions`);
      console.log(`⬇️  Over configured: ${overConfigured.length} functions`);
      console.log(`⬆️  Under configured: ${underConfigured.length} functions`);
    }
    
    console.log('✅ Function-specific memory analysis completed');
  });

  describe('Function memory usage analysis', () => {
    it('healthCheck function memory usage analysis (current: 170MB)', async () => {
      const wrapped = testEnv.wrap(functions.healthCheck);
      
      monitor.startMonitoring(50);
      
      for (let i = 0; i < 10; i++) {
        const req = createMockRequest({});
        try {
          await wrapped(req);
        } catch (error) {
          // Expected errors are fine
        }
        
        await waitFor(50);
      }
      
      monitor.stopMonitoring();
      const result = monitor.analyzeForFunction('healthCheck', 170);
      if (result) results.push(result);
      
      console.log('✅ healthCheck function memory analysis completed');
    });

    it('getTaleData function memory usage analysis (current: 258MB)', async () => {
      const wrapped = testEnv.wrap(functions.getTaleData);
      
      monitor.startMonitoring(50);
      
      const testCases = [
        { taleId: 'test-tale-1' },
        { taleId: 'test-tale-2' },
        { taleId: 'non-existent-tale' }
      ];
      
      for (const testCase of testCases) {
        const req = createMockRequest(testCase);
        
        try {
          await wrapped(req);
        } catch (error) {
          // Expected errors for non-existent tales or missing authentication
        }
        
        await waitFor(100);
      }
      
      monitor.stopMonitoring();
      const result = monitor.analyzeForFunction('getTaleData', 258);
      if (result) results.push(result);
      
      console.log('✅ getTaleData function memory analysis completed');
    });

    it('generateImage function memory usage analysis (current: 274MB)', async () => {
      const wrapped = testEnv.wrap(functions.generateImage);
      
      monitor.startMonitoring(50);
      
      const testCases = [
        {
          prompt: testImagePrompts.simple,
          pageIndex: 0,
          aspectRatio: '1:1'
        },
        {
          prompt: testImagePrompts.complex,
          pageIndex: 1,
          aspectRatio: '16:9',
          seed: 42
        }
      ];
      
      for (const testCase of testCases) {
        const req = createMockRequest(testCase);
        
        try {
          await wrapped(req);
        } catch (error) {
          // Check for expected errors
          if (error.message.includes('prompt is missing') || 
              error.message.includes('access token') ||
              error.message.includes('Imagen API')) {
            // These are expected errors
          } else {
            console.log('Unexpected error in generateImage:', error.message);
          }
        }
        
        await waitFor(100);
      }
      
      monitor.stopMonitoring();
      const result = monitor.analyzeForFunction('generateImage', 1024);
      if (result) results.push(result);
      
      console.log('✅ generateImage function memory analysis completed');
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
          // Expected authentication or API errors
        }
        
        await waitFor(100);
      }
      
      monitor.stopMonitoring();
      const result = monitor.analyzeForFunction('generateImageV4', 1024);
      if (result) results.push(result);
      
      console.log('✅ generateImageV4 function memory analysis completed');
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