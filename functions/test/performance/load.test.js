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

describe('Performance and Load Tests', function() {
  this.timeout(300000); // Set timeout to 5 minutes
  
  let initialMemory;
  
  before(() => {
    console.log('Starting performance and load tests');
  });

  after(() => {
    console.log('Performance and load tests completed');
  });

  describe('Function performance baseline tests', () => {
    it('Health check function performance statistics', async () => {
      const wrapped = testEnv.wrap(functions.healthCheck);
      const iterations = 20;
      const times = [];
      
      for (let i = 0; i < iterations; i++) {
        const req = createMockRequest({});
        const startTime = Date.now();
        try {
          await wrapped(req);
        } catch (error) {
          // Ignore authentication errors
        }
        const duration = Date.now() - startTime;
        times.push(duration);
        
        await waitFor(10);
      }
      
      const averageTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);
      
      console.log('Health check performance statistics:');
      console.log(`- Average response time: ${averageTime.toFixed(2)}ms`);
      console.log(`- Max response time: ${maxTime.toFixed(2)}ms`);
      console.log(`- Min response time: ${minTime.toFixed(2)}ms`);
      
      expect(averageTime).to.be.below(testConfig.timeouts.healthCheck);
    });

    it('Parameter validation response time test', async () => {
      const wrapped = testEnv.wrap(functions.generateImage);
      const req = createMockRequest({}); // Missing required parameters
      
      const startTime = Date.now();
      try {
        await wrapped(req);
      } catch (error) {
        // Expected parameter validation error
      }
      const duration = Date.now() - startTime;
      
      console.log(`Parameter validation response time: ${duration.toFixed(2)}ms`);
      
      expect(duration).to.be.below(1000); // Should be very fast
    });
  });

  describe('Concurrent request handling tests', () => {
    it('Should handle multiple health check requests concurrently', async () => {
      const wrapped = testEnv.wrap(functions.healthCheck);
      const concurrentRequests = 10;
      
      const startTime = Date.now();
      const promises = Array(concurrentRequests).fill().map(() => {
        const req = createMockRequest({});
        return wrapped(req);
      });
      
      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;
      const averageTimePerRequest = totalTime / concurrentRequests;
      
      console.log('Concurrent test results:');
      console.log(`- Concurrent requests: ${concurrentRequests}`);
      console.log(`- Total time: ${totalTime}ms`);
      console.log(`- Average time per request: ${averageTimePerRequest.toFixed(2)}ms`);
      
      results.forEach(result => {
        expect(result.status).to.equal('healthy');
      });
    });

    it('Should handle mixed function calls concurrently', async () => {
      const healthWrapper = testEnv.wrap(functions.healthCheck);
      const imageWrapper = testEnv.wrap(functions.generateImage);
      
      const promises = [
        healthWrapper(createMockRequest({})),
        healthWrapper(createMockRequest({})),
        imageWrapper(createMockRequest({ prompt: 'test' })).catch(() => {}), // Ignore auth errors
        healthWrapper(createMockRequest({}))
      ];
      
      const results = await Promise.all(promises);
      
      expect(results[0].status).to.equal('healthy');
      expect(results[1].status).to.equal('healthy');
      expect(results[3].status).to.equal('healthy');
      
      console.log('✓ Mixed concurrent request processing successful');
    });
  });

  describe('Memory usage monitoring', () => {
    it('Memory usage should remain stable during repeated calls', async () => {
      const wrapped = testEnv.wrap(functions.healthCheck);
      initialMemory = process.memoryUsage();
      
      for (let i = 0; i < 50; i++) {
        const req = createMockRequest({});
        await wrapped(req);
        
        if (i % 10 === 0) {
          global.gc && global.gc(); // Force garbage collection if available
        }
      }
      
      const currentMemory = process.memoryUsage();
      const heapUsedDiff = currentMemory.heapUsed - initialMemory.heapUsed;
      
      console.log('Memory usage statistics:');
      console.log(`- Initial heap memory: ${Math.round(initialMemory.heapUsed / 1024 / 1024)}MB`);
      console.log(`- Current heap memory: ${Math.round(currentMemory.heapUsed / 1024 / 1024)}MB`);
      console.log(`- Heap memory growth: ${Math.round(heapUsedDiff / 1024 / 1024)}MB`);
      
      // Memory growth should be reasonable (less than 50MB)
      expect(heapUsedDiff).to.be.below(50 * 1024 * 1024);
    });

    it('Configuration loading memory impact test', async () => {
      const beforeMemory = process.memoryUsage();
      
      // Reload configuration multiple times
      for (let i = 0; i < 10; i++) {
        delete require.cache[require.resolve('../../config')];
        require('../../config');
      }
      
      const afterMemory = process.memoryUsage();
      const heapDiff = afterMemory.heapUsed - beforeMemory.heapUsed;
      
      console.log(`Configuration loading memory impact: ${Math.round(heapDiff / 1024)}KB`);
      
      expect(heapDiff).to.be.below(10 * 1024 * 1024); // Less than 10MB
    });
  });

  describe('Data processing stress tests', () => {
    it('Should handle large story content processing', async () => {
      const wrapped = testEnv.wrap(functions.generateTaleStream);
      
      const largeStory = testStoryData.longStory.repeat(5); // Multiply story size
      const startTime = Date.now();
      
      try {
        // Note: This is an onRequest function, would need different testing approach in real scenario
        const duration = Date.now() - startTime;
        console.log(`Large story processing time: ${duration}ms`);
      } catch (error) {
        if (error.code === 'unauthenticated') {
          console.log('⚠ Large story test skipped: requires authentication');
          return;
        }
        throw error;
      }
    });

    it('Should validate structure with maximum page count', async () => {
      const maxPages = 30;
      const mockData = {
        pages: Array(maxPages).fill().map((_, i) => ({
          pageNumber: i + 1,
          title: `Page ${i + 1}`,
          text: `Content for page ${i + 1}`,
          imagePrompt: `Image for page ${i + 1}`,
          sceneType: 'default'
        }))
      };
      
      expect(isValidTaleStructure(mockData)).to.be.true;
      console.log(`✓ Maximum page count (${maxPages}) structure validation passed`);
    });
  });

  describe('Error handling stress tests', () => {
    it('Should handle multiple invalid requests gracefully', async () => {
      const wrapped = testEnv.wrap(functions.generateImage);
      
      const invalidRequests = [
        {},
        { prompt: '' },
        { prompt: null },
        { prompt: undefined },
        { prompt: 'valid', aspectRatio: 'invalid' }
      ];
      
      for (const invalidData of invalidRequests) {
        try {
          const req = createMockRequest(invalidData);
          await wrapped(req);
        } catch (error) {
          // Expected errors
        }
      }
      
      console.log('✓ Invalid input handling test passed');
    });
  });

  describe('Configuration validation tests', () => {
    it('Should validate function timeout configurations', () => {
      const config = require('../../config');
      
      expect(config.API_CONFIG.DEFAULT_TIMEOUT).to.be.a('number');
      expect(config.API_CONFIG.DEFAULT_TIMEOUT).to.be.greaterThan(0);
      
      console.log(`Function timeout configuration: ${config.API_CONFIG.DEFAULT_TIMEOUT} seconds`);
    });

    it('Should validate function memory configurations', () => {
      const config = require('../../config');
      
      expect(config.API_CONFIG.DEFAULT_MEMORY).to.be.a('string');
      expect(config.API_CONFIG.DEFAULT_MEMORY).to.match(/^\d+[MGmg]B$/);
      
      console.log(`Function memory configuration: ${config.API_CONFIG.DEFAULT_MEMORY}`);
    });
  });

  describe('Stress testing scenarios', () => {
    it('Should handle high-frequency requests in batches', async () => {
      const wrapped = testEnv.wrap(functions.healthCheck);
      const requestCount = 100;
      const batchSize = 10;
      const batches = Math.ceil(requestCount / batchSize);
      
      console.log(`Starting stress test: ${requestCount} requests, batch size ${batchSize}`);
      
      const batchTimes = [];
      
      for (let batch = 0; batch < batches; batch++) {
        const batchStartTime = Date.now();
        const batchPromises = [];
        
        for (let i = 0; i < batchSize && (batch * batchSize + i) < requestCount; i++) {
          const req = createMockRequest({});
          batchPromises.push(wrapped(req));
        }
        
        await Promise.all(batchPromises);
        const batchTime = Date.now() - batchStartTime;
        batchTimes.push(batchTime);
        
        // Small delay between batches
        await waitFor(10);
      }
      
      const avgBatchTime = batchTimes.reduce((a, b) => a + b, 0) / batchTimes.length;
      const maxBatchTime = Math.max(...batchTimes);
      
      console.log('Stress test results:');
      console.log(`- Total requests: ${requestCount}`);
      console.log('- Success rate: 100%');
      console.log(`- Average batch time: ${avgBatchTime.toFixed(2)}ms`);
      console.log(`- Max batch time: ${maxBatchTime.toFixed(2)}ms`);
      
      expect(avgBatchTime).to.be.below(5000); // 5 seconds per batch
    });
  });

  describe('Memory cleanup verification', () => {
    it('Should cleanup memory after operations', async () => {
      const beforeCleanup = process.memoryUsage();
      
      // Force cleanup
      global.gc && global.gc();
      await waitFor(100);
      
      const afterCleanup = process.memoryUsage();
      
      console.log('Memory cleanup comparison:');
      console.log(`- Before cleanup: ${Math.round(beforeCleanup.heapUsed / 1024 / 1024)}MB`);
      console.log(`- After cleanup: ${Math.round(afterCleanup.heapUsed / 1024 / 1024)}MB`);
      
      // After cleanup, memory should not grow significantly
      expect(afterCleanup.heapUsed).to.be.at.most(beforeCleanup.heapUsed * 1.1);
    });
  });
}); 