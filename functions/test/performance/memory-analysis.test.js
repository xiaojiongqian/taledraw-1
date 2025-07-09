// 内存使用分析和压力测试
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

// 内存监控工具
class MemoryMonitor {
  constructor() {
    this.snapshots = [];
    this.isMonitoring = false;
    this.interval = null;
  }

  startMonitoring(intervalMs = 100) {
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
    const totalValues = this.snapshots.map(s => s.heapTotal);

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
      },
      heapTotal: {
        min: Math.min(...totalValues),
        max: Math.max(...totalValues),
        avg: totalValues.reduce((a, b) => a + b, 0) / totalValues.length,
        peak: Math.max(...totalValues)
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

  printReport() {
    const stats = this.getStats();
    if (!stats) {
      console.log('❌ 没有内存监控数据');
      return;
    }

    console.log('\n📊 内存使用分析报告:');
    console.log(`⏱️  监控时长: ${stats.duration}ms (${stats.count}个采样点)`);
    console.log('\n🧠 RSS (Resident Set Size):');
    console.log(`   峰值: ${this.formatBytes(stats.rss.peak)}`);
    console.log(`   平均: ${this.formatBytes(stats.rss.avg)}`);
    console.log(`   范围: ${this.formatBytes(stats.rss.min)} - ${this.formatBytes(stats.rss.max)}`);
    
    console.log('\n🏠 堆内存使用:');
    console.log(`   峰值: ${this.formatBytes(stats.heap.peak)}`);
    console.log(`   平均: ${this.formatBytes(stats.heap.avg)}`);
    console.log(`   范围: ${this.formatBytes(stats.heap.min)} - ${this.formatBytes(stats.heap.max)}`);
    
    console.log('\n📈 堆内存总量:');
    console.log(`   峰值: ${this.formatBytes(stats.heapTotal.peak)}`);
    console.log(`   平均: ${this.formatBytes(stats.heapTotal.avg)}`);
    console.log(`   范围: ${this.formatBytes(stats.heapTotal.min)} - ${this.formatBytes(stats.heapTotal.max)}`);

    return stats;
  }
}

describe('内存使用分析和配置优化测试', function() {
  this.timeout(600000); // 10分钟超时

  let monitor;

  before(() => {
    console.log('🔍 开始内存使用分析测试');
    monitor = new MemoryMonitor();
  });

  after(() => {
    if (monitor) {
      monitor.stopMonitoring();
    }
    cleanup();
    console.log('✅ 内存分析测试完成');
  });

  describe('基础内存使用测试', () => {
    it('应该测量空闲状态下的内存基线', async () => {
      monitor.startMonitoring(50);
      
      // 等待5秒收集基线数据
      await waitFor(5000);
      
      monitor.stopMonitoring();
      const stats = monitor.printReport();
      
      expect(stats).to.not.be.null;
      expect(stats.heap.peak).to.be.below(100 * 1024 * 1024); // 应该低于100MB
      
      console.log('✅ 基线内存使用正常');
    });

    it('应该测量单个函数调用的内存开销', async () => {
      const wrapped = testEnv.wrap(functions.healthCheck);
      
      monitor.startMonitoring(10);
      
      // 执行100次健康检查
      for (let i = 0; i < 100; i++) {
        const req = createMockRequest({});
        await wrapped(req);
      }
      
      monitor.stopMonitoring();
      const stats = monitor.printReport();
      
      expect(stats.heap.peak).to.be.below(150 * 1024 * 1024); // 应该低于150MB
      
      console.log('✅ 单函数调用内存开销合理');
    });
  });

  describe('并发压力下的内存使用', () => {
    it('应该测量低并发(10个)的内存使用', async () => {
      const wrapped = testEnv.wrap(functions.healthCheck);
      
      monitor.startMonitoring(20);
      
      // 10个并发请求，重复10轮
      for (let round = 0; round < 10; round++) {
        const promises = [];
        for (let i = 0; i < 10; i++) {
          const req = createMockRequest({});
          promises.push(wrapped(req));
        }
        await Promise.all(promises);
        
        // 短暂停顿让GC有机会运行
        await waitFor(100);
      }
      
      monitor.stopMonitoring();
      const stats = monitor.printReport();
      
      expect(stats.heap.peak).to.be.below(200 * 1024 * 1024); // 应该低于200MB
      
      console.log('✅ 低并发内存使用正常');
    });

    it('应该测量高并发(50个)的内存使用', async () => {
      const wrapped = testEnv.wrap(functions.healthCheck);
      
      monitor.startMonitoring(10);
      
      // 50个并发请求，重复5轮
      for (let round = 0; round < 5; round++) {
        const promises = [];
        for (let i = 0; i < 50; i++) {
          const req = createMockRequest({});
          promises.push(wrapped(req));
        }
        await Promise.all(promises);
        
        // 短暂停顿
        await waitFor(50);
      }
      
      monitor.stopMonitoring();
      const stats = monitor.printReport();
      
      expect(stats.heap.peak).to.be.below(300 * 1024 * 1024); // 应该低于300MB
      
      console.log('✅ 高并发内存使用可控');
    });

    it('应该测量极高并发(100个)的内存峰值', async () => {
      const wrapped = testEnv.wrap(functions.healthCheck);
      
      monitor.startMonitoring(5);
      
      // 100个并发请求，重复3轮
      for (let round = 0; round < 3; round++) {
        const promises = [];
        for (let i = 0; i < 100; i++) {
          const req = createMockRequest({});
          promises.push(wrapped(req));
        }
        await Promise.all(promises);
        
        // 短暂停顿
        await waitFor(30);
      }
      
      monitor.stopMonitoring();
      const stats = monitor.printReport();
      
      expect(stats.heap.peak).to.be.below(500 * 1024 * 1024); // 应该低于500MB
      
      console.log(`🔥 极高并发内存峰值: ${monitor.formatBytes(stats.heap.peak)}`);
    });
  });

  describe('大数据处理内存测试', () => {
    it('应该测量大数据量处理的内存使用', async () => {
      const wrapped = testEnv.wrap(functions.getTaleData);
      
      // 创建大量数据
      const largeDataSets = [];
      for (let i = 0; i < 50; i++) {
        largeDataSets.push({
          taleId: `large-tale-${i}`,
          data: testStoryData.longStory.repeat(10) // 创建更大的数据
        });
      }
      
      monitor.startMonitoring(20);
      
      // 处理大数据集
      for (const dataset of largeDataSets) {
        const req = createMockRequest({
          taleId: dataset.taleId
        });
        
        try {
          await wrapped(req);
        } catch (error) {
          // 预期会有错误，我们主要关注内存使用
        }
        
        // 每10个请求后稍微停顿
        if (parseInt(dataset.taleId.split('-')[2]) % 10 === 0) {
          await waitFor(100);
        }
      }
      
      monitor.stopMonitoring();
      const stats = monitor.printReport();
      
      expect(stats.heap.peak).to.be.below(600 * 1024 * 1024); // 应该低于600MB
      
      console.log('✅ 大数据处理内存使用可控');
    });
  });

  describe('内存泄漏检测', () => {
    it('应该检测是否存在内存泄漏', async () => {
      const wrapped = testEnv.wrap(functions.healthCheck);
      
      monitor.startMonitoring(100);
      
      // 运行长时间测试，观察内存是否持续增长
      const rounds = 20;
      const requestsPerRound = 25;
      
      for (let round = 0; round < rounds; round++) {
        console.log(`内存泄漏检测 - 第${round + 1}/${rounds}轮`);
        
        const promises = [];
        for (let i = 0; i < requestsPerRound; i++) {
          const req = createMockRequest({
            testData: new Array(1000).fill(`test-${round}-${i}`).join(' ')
          });
          promises.push(wrapped(req));
        }
        
        await Promise.all(promises);
        
        // 强制垃圾回收（如果可用）
        if (global.gc) {
          global.gc();
        }
        
        // 等待GC完成
        await waitFor(200);
      }
      
      monitor.stopMonitoring();
      const stats = monitor.printReport();
      
      // 分析内存增长趋势
      const snapshots = monitor.snapshots;
      const firstQuarter = snapshots.slice(0, Math.floor(snapshots.length / 4));
      const lastQuarter = snapshots.slice(-Math.floor(snapshots.length / 4));
      
      const firstAvg = firstQuarter.reduce((sum, s) => sum + s.heapUsed, 0) / firstQuarter.length;
      const lastAvg = lastQuarter.reduce((sum, s) => sum + s.heapUsed, 0) / lastQuarter.length;
      
      const growthRate = (lastAvg - firstAvg) / firstAvg;
      
      console.log('\n🔍 内存泄漏分析:');
      console.log(`   初期平均: ${monitor.formatBytes(firstAvg)}`);
      console.log(`   后期平均: ${monitor.formatBytes(lastAvg)}`);
      console.log(`   增长率: ${(growthRate * 100).toFixed(2)}%`);
      
      // 内存增长率应该小于50%（考虑到正常的内存波动）
      expect(growthRate).to.be.below(0.5);
      
      if (growthRate < 0.1) {
        console.log('✅ 无明显内存泄漏');
      } else if (growthRate < 0.3) {
        console.log('⚠️  有轻微内存增长，需要关注');
      } else {
        console.log('❌ 可能存在内存泄漏');
      }
    });
  });

  describe('内存配置建议分析', () => {
    it('应该分析当前配置是否合理并提供建议', async () => {
      const wrapped = testEnv.wrap(functions.healthCheck);
      
      // 当前配置：1GiB = 1073741824 bytes
      const currentConfigMB = 1024;
      
      monitor.startMonitoring(10);
      
      // 模拟生产环境的混合负载
      console.log('🏭 模拟生产环境负载...');
      
      // 高并发突发
      for (let burst = 0; burst < 3; burst++) {
        const promises = [];
        for (let i = 0; i < 80; i++) {
          const req = createMockRequest({
            data: new Array(500).fill(`burst-${burst}-${i}`).join(' ')
          });
          promises.push(wrapped(req));
        }
        await Promise.all(promises);
        await waitFor(500);
      }
      
      // 持续中等负载
      for (let i = 0; i < 100; i++) {
        const req = createMockRequest({});
        await wrapped(req);
        if (i % 20 === 0) await waitFor(100);
      }
      
      monitor.stopMonitoring();
      const stats = monitor.printReport();
      
      const peakMB = stats.heap.peak / (1024 * 1024);
      const avgMB = stats.heap.avg / (1024 * 1024);
      const rssPeakMB = stats.rss.peak / (1024 * 1024);
      
      console.log('\n📋 内存配置分析:');
      console.log(`   当前配置: ${currentConfigMB}MB`);
      console.log(`   实际峰值: ${peakMB.toFixed(2)}MB (堆内存)`);
      console.log(`   实际峰值: ${rssPeakMB.toFixed(2)}MB (RSS)`);
      console.log(`   平均使用: ${avgMB.toFixed(2)}MB`);
      console.log(`   利用率: ${(peakMB / currentConfigMB * 100).toFixed(2)}%`);
      
      // 内存配置建议
      const safetyMargin = 2.5; // 安全系数
      const recommendedMB = Math.ceil(rssPeakMB * safetyMargin);
      
      console.log('\n💡 配置建议:');
      
      if (currentConfigMB > recommendedMB * 2) {
        console.log(`   ⬇️  建议降低到 ${recommendedMB}MB (当前配置过高)`);
        console.log(`   💰 可节省 ${((currentConfigMB - recommendedMB) / currentConfigMB * 100).toFixed(1)}% 内存成本`);
      } else if (currentConfigMB < recommendedMB) {
        console.log(`   ⬆️  建议提高到 ${recommendedMB}MB (当前配置可能不足)`);
        console.log('   ⚠️  存在内存不足风险');
      } else {
        console.log(`   ✅ 当前配置 ${currentConfigMB}MB 合理`);
        console.log('   📊 在安全范围内，无需调整');
      }
      
      // 不同场景的配置建议
      console.log('\n🎯 场景化配置建议:');
      console.log(`   开发环境: ${Math.ceil(recommendedMB * 0.7)}MB`);
      console.log(`   测试环境: ${recommendedMB}MB`);
      console.log(`   生产环境: ${Math.ceil(recommendedMB * 1.2)}MB`);
      console.log(`   高负载环境: ${Math.ceil(recommendedMB * 1.5)}MB`);
      
      // 验证合理性
      expect(peakMB).to.be.below(currentConfigMB);
      expect(peakMB).to.be.above(0);
    });
  });
}); 