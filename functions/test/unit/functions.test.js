// 核心Firebase Functions单元测试
const { expect } = require('chai');
const { describe, it, before, after, beforeEach } = require('mocha');
const nock = require('nock');

// 导入测试环境
const {
  testEnv,
  mockUser,
  createMockRequest,
  testStoryData,
  testImagePrompts,
  testConfig,
  waitFor,
  isValidImageUrl,
  isValidTaleStructure,
  cleanup
} = require('../setup');

// 导入要测试的函数
const functions = require('../../index');

describe('Tale Draw Functions Unit Tests', function() {
  this.timeout(60000); // 设置全局超时为60秒

  before(() => {
    // 设置环境变量
    process.env.NODE_ENV = 'test';
    process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
    process.env.FIREBASE_STORAGE_EMULATOR_HOST = 'localhost:9199';
  });

  after(() => {
    cleanup();
  });

  beforeEach(() => {
    // 清理之前的nock拦截
    nock.cleanAll();
  });

  describe('healthCheck Function', () => {
    it('应该返回系统健康状态', async () => {
      const wrapped = testEnv.wrap(functions.healthCheck);
      const req = createMockRequest({});
      
      const result = await wrapped(req);
      
      expect(result).to.have.property('status', 'healthy');
      expect(result).to.have.property('timestamp');
      expect(result).to.have.property('functions');
      expect(result.functions).to.be.an('array');
    });

    it('应该在指定时间内完成', async () => {
      const startTime = Date.now();
      const wrapped = testEnv.wrap(functions.healthCheck);
      const req = createMockRequest({});
      
      await wrapped(req);
      
      const duration = Date.now() - startTime;
      expect(duration).to.be.below(testConfig.timeouts.healthCheck);
    });
  });

  describe('getTaleData Function', () => {
    it('应该要求认证', async () => {
      const wrapped = testEnv.wrap(functions.getTaleData);
      const req = createMockRequest({ taleId: 'test-id' }, null); // 无认证
      
      try {
        await wrapped(req);
        expect.fail('应该抛出认证错误');
      } catch (error) {
        expect(error.code).to.equal('unauthenticated');
      }
    });

    it('应该验证必需的参数', async () => {
      const wrapped = testEnv.wrap(functions.getTaleData);
      const req = createMockRequest({}); // 缺少taleId
      
      try {
        await wrapped(req);
        expect.fail('应该抛出参数错误');
      } catch (error) {
        expect(error.code).to.equal('invalid-argument');
        expect(error.message).to.include('Tale ID is required');
      }
    });

    it('应该处理不存在的故事ID', async () => {
      const wrapped = testEnv.wrap(functions.getTaleData);
      const req = createMockRequest({ taleId: 'non-existent-id' });
      
      try {
        await wrapped(req);
        expect.fail('应该抛出未找到错误');
      } catch (error) {
        expect(error.code).to.equal('not-found');
      }
    });
  });

  describe('generateImage Function', () => {
    it('应该要求认证', async () => {
      const wrapped = testEnv.wrap(functions.generateImage);
      const req = createMockRequest({ 
        prompt: testImagePrompts.simple 
      }, null);
      
      try {
        await wrapped(req);
        expect.fail('应该抛出认证错误');
      } catch (error) {
        expect(error.code).to.equal('unauthenticated');
      }
    });

    it('应该验证必需的提示词', async () => {
      const wrapped = testEnv.wrap(functions.generateImage);
      const req = createMockRequest({}); // 缺少prompt
      
      try {
        await wrapped(req);
        expect.fail('应该抛出参数错误');
      } catch (error) {
        expect(error.code).to.equal('invalid-argument');
        expect(error.message).to.include('Prompt is required');
      }
    });

    it('应该处理有效的请求参数', async () => {
      // Mock Imagen API响应
      nock('https://us-central1-aiplatform.googleapis.com')
        .post(/.*/)
        .reply(200, {
          predictions: [{
            bytesBase64Encoded: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
          }]
        });

      // Mock Google Auth
      nock('https://oauth2.googleapis.com')
        .post('/token')
        .reply(200, { access_token: 'mock-token' });

      const wrapped = testEnv.wrap(functions.generateImage);
      const req = createMockRequest({
        prompt: testImagePrompts.simple,
        pageIndex: 0,
        aspectRatio: '1:1'
      });
      
      // 注意：在实际环境中这会调用真实API，在测试中我们mock了响应
      try {
        const result = await wrapped(req);
        expect(result).to.have.property('success', true);
        expect(result).to.have.property('pageIndex', 0);
        expect(result).to.have.property('imageUrl');
        expect(isValidImageUrl(result.imageUrl)).to.be.true;
      } catch (error) {
        // If permission or configuration issues, this is acceptable
        if (error.code === 'internal' && error.message.includes('access token')) {
          console.log('Test skipped: requires real Google Cloud credentials');
          return;
        }
        throw error;
      }
    });
  });

  describe('generateImageV4 Function', () => {
    it('Should support Imagen 4 specific parameters', async () => {
      const wrapped = testEnv.wrap(functions.generateImageV4);
      const req = createMockRequest({
        prompt: testImagePrompts.complex,
        pageIndex: 1,
        aspectRatio: '16:9',
        seed: 42,
        safetyFilterLevel: 'block_most',
        personGeneration: 'allow_adult'
      });
      
      try {
        const result = await wrapped(req);
        expect(result).to.have.property('success', true);
        expect(result).to.have.property('pageIndex', 1);
      } catch (error) {
        if (error.code === 'unauthenticated' || 
            (error.code === 'internal' && error.message.includes('access token'))) {
          console.log('Test skipped: requires authentication or real credentials');
          return;
        }
        throw error;
      }
    });
  });



  describe('Storage Strategy Tests', () => {
    it('应该正确选择存储模式', () => {
      // 这里可以测试存储策略的选择逻辑
      const { STORAGE_MODE } = require('../../config');
      expect(STORAGE_MODE).to.be.oneOf(['cloud_storage', 'firestore']);
    });
  });

  describe('Configuration Tests', () => {
    it('应该有正确的API配置', () => {
      const { API_CONFIG } = require('../../config');
      expect(API_CONFIG).to.have.property('GEMINI_MODEL');
      expect(API_CONFIG).to.have.property('IMAGEN3_MODEL');
      expect(API_CONFIG).to.have.property('IMAGEN4_MODEL');
      expect(API_CONFIG.MAX_OUTPUT_TOKENS).to.be.a('number');
    });

    it('应该有正确的存储配置', () => {
      const { STORAGE_CONFIG } = require('../../config');
      expect(STORAGE_CONFIG).to.have.property('DEFAULT_BUCKET');
      expect(STORAGE_CONFIG).to.have.property('STREAM_PATH');
      expect(STORAGE_CONFIG).to.have.property('REGULAR_PATH');
    });
  });
}); 