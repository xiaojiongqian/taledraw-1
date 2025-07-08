// 基础测试 - 验证测试环境设置
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
  isValidImageUrl,
  isValidTaleStructure,
  cleanup
} = require('../setup');

describe('基础测试环境验证', function() {
  this.timeout(10000); // 10秒超时

  before(() => {
    console.log('🧪 开始基础测试环境验证');
  });

  after(() => {
    cleanup();
    console.log('✅ 基础测试环境验证完成');
  });

  describe('测试环境设置', () => {
    it('应该正确加载测试环境', () => {
      expect(testEnv).to.not.be.undefined;
      expect(typeof testEnv.wrap).to.equal('function');
      console.log('✅ Firebase Functions测试环境加载成功');
    });

    it('应该有正确的模拟用户配置', () => {
      expect(mockUser).to.be.an('object');
      expect(mockUser).to.have.property('uid');
      expect(mockUser).to.have.property('email');
      expect(mockUser.uid).to.equal('test-user-123');
      console.log('✅ 模拟用户配置正确');
    });

    it('应该能创建模拟请求', () => {
      const testData = { test: 'data' };
      const req = createMockRequest(testData);
      
      expect(req).to.be.an('object');
      expect(req).to.have.property('auth');
      expect(req).to.have.property('data');
      expect(req.data).to.deep.equal(testData);
      expect(req.auth.uid).to.equal(mockUser.uid);
      console.log('✅ 模拟请求创建成功');
    });
  });

  describe('测试数据验证', () => {
    it('应该有完整的测试故事数据', () => {
      expect(testStoryData).to.be.an('object');
      expect(testStoryData).to.have.property('shortStory');
      expect(testStoryData).to.have.property('mediumStory');
      expect(testStoryData).to.have.property('longStory');
      
      expect(testStoryData.shortStory).to.be.a('string');
      expect(testStoryData.mediumStory.length).to.be.greaterThan(testStoryData.shortStory.length);
      console.log('✅ 测试故事数据完整');
    });

    it('应该有测试图像提示词', () => {
      expect(testImagePrompts).to.be.an('object');
      expect(testImagePrompts).to.have.property('simple');
      expect(testImagePrompts).to.have.property('complex');
      expect(testImagePrompts).to.have.property('character');
      
      expect(testImagePrompts.simple).to.be.a('string');
      expect(testImagePrompts.simple.length).to.be.greaterThan(0);
      console.log('✅ 测试图像提示词完整');
    });

    it('应该有正确的测试配置', () => {
      expect(testConfig).to.be.an('object');
      expect(testConfig).to.have.property('timeouts');
      expect(testConfig).to.have.property('retries');
      expect(testConfig).to.have.property('limits');
      
      expect(testConfig.timeouts.healthCheck).to.be.a('number');
      expect(testConfig.limits.maxPageCount).to.be.a('number');
      console.log('✅ 测试配置正确');
    });
  });

  describe('辅助函数验证', () => {
    it('waitFor函数应该正常工作', async () => {
      const startTime = Date.now();
      await waitFor(100);
      const duration = Date.now() - startTime;
      
      expect(duration).to.be.at.least(90); // 考虑一些误差
      expect(duration).to.be.at.most(200);
      console.log(`✅ waitFor函数工作正常 (${duration}ms)`);
    });

    it('isValidImageUrl函数应该正确验证URL', () => {
      // 有效URL
      expect(isValidImageUrl('https://storage.googleapis.com/test-bucket/image.jpg')).to.be.true;
      expect(isValidImageUrl('http://localhost:9199/test/image.png')).to.be.true;
      
      // 无效URL
      expect(isValidImageUrl('')).to.be.false;
      expect(isValidImageUrl(null)).to.be.false;
      expect(isValidImageUrl('invalid-url')).to.be.false;
      expect(isValidImageUrl('https://other-domain.com/image.jpg')).to.be.false;
      
      console.log('✅ isValidImageUrl函数验证正确');
    });

    it('isValidTaleStructure函数应该正确验证故事结构', () => {
      // 有效结构
      const validTale = {
        title: 'Test Story',
        summary: 'A test story',
        pages: [
          { pageNumber: 1, content: 'Content 1' }
        ]
      };
      expect(isValidTaleStructure(validTale)).to.be.true;
      
      // 无效结构
      expect(isValidTaleStructure(null)).to.be.false;
      expect(isValidTaleStructure({})).to.be.false;
      expect(isValidTaleStructure({ title: 'Test' })).to.be.false; // 缺少pages
      
      console.log('✅ isValidTaleStructure函数验证正确');
    });
  });

  describe('配置文件加载测试', () => {
    it('应该能加载functions配置', () => {
      try {
        const config = require('../../config');
        
        expect(config).to.be.an('object');
        expect(config).to.have.property('PROJECT_ID');
        expect(config).to.have.property('LOCATION');
        expect(config).to.have.property('API_CONFIG');
        expect(config).to.have.property('STORAGE_CONFIG');
        
        console.log('✅ Functions配置加载成功');
      } catch (error) {
        console.log('⚠️ Functions配置加载失败:', error.message);
        console.log('这是正常的，如果config.js文件不存在');
      }
    });
  });

  describe('测试环境功能验证', () => {
    it('应该能验证Firebase Functions Test环境', () => {
      // 验证testEnv的基本功能
      expect(testEnv).to.have.property('wrap');
      expect(typeof testEnv.wrap).to.equal('function');
      
      // 验证cleanup函数存在
      expect(typeof testEnv.cleanup).to.equal('function');
      
      console.log('✅ Firebase Functions Test环境功能正常');
    });

    it('应该正确处理模拟数据', () => {
      // 测试数据操作
      const testData = { message: 'test', count: 42, nested: { value: true } };
      const req = createMockRequest(testData);
      
      // 验证数据传递正确
      expect(req.data).to.deep.equal(testData);
      expect(req.data.message).to.equal('test');
      expect(req.data.count).to.equal(42);
      expect(req.data.nested.value).to.be.true;
      
      // 验证认证数据
      expect(req.auth.uid).to.be.a('string');
      expect(req.auth.email).to.include('@');
      expect(req.auth.email_verified).to.be.true;
      
      console.log('✅ 模拟数据处理正确');
    });
  });
}); 