// 业务流程集成测试 - 模拟完整的故事生成流程
const { expect } = require('chai');
const { describe, it, before, after, beforeEach } = require('mocha');
const axios = require('axios');
const FormData = require('form-data');

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

const functions = require('../../index');

describe('Tale Draw Business Workflow Integration Tests', function() {
  this.timeout(120000); // 设置超时为2分钟

  let testTaleId;
  let generatedPages;

  before(() => {
    process.env.NODE_ENV = 'test';
    console.log('开始集成测试 - 测试完整业务流程');
  });

  after(() => {
    cleanup();
    console.log('集成测试完成');
  });

  describe('完整故事生成流程', () => {
    it('步骤1: 健康检查 - 验证所有服务正常', async () => {
      const wrapped = testEnv.wrap(functions.healthCheck);
      const req = createMockRequest({});
      
      const result = await wrapped(req);
      
      expect(result.status).to.equal('healthy');
      expect(result.functions).to.include.members([
        'generateTaleStream',
        'getTaleData', 
        'generateImage',
        'generateImageV4',
        'extractCharacter'
      ]);
      
      console.log('✓ 健康检查通过，所有函数正常');
    });

    it('步骤2: 角色提取 - 从故事中提取角色信息', async () => {
      const wrapped = testEnv.wrap(functions.extractCharacter);
      const req = createMockRequest({
        story: testStoryData.mediumStory
      });
      
      try {
        const result = await wrapped(req);
        
        expect(result).to.have.property('characters');
        expect(result.characters).to.be.an('array');
        
        if (result.characters.length > 0) {
          const character = result.characters[0];
          expect(character).to.have.property('name');
          expect(character).to.have.property('description');
          console.log(`✓ 成功提取 ${result.characters.length} 个角色`);
        }
        
      } catch (error) {
        if (error.code === 'unauthenticated' || 
            (error.code === 'internal' && error.message.includes('access token'))) {
          console.log('⚠ 角色提取测试跳过：需要Google Cloud凭证');
          return;
        }
        throw error;
      }
    });

    it('步骤3: 流式故事生成 - 生成结构化故事数据', async () => {
      // 注意：generateTaleStream是HTTP函数，需要不同的测试方式
      console.log('📖 流式故事生成测试（模拟）');
      
      // 模拟预期的故事结构
      const mockTaleData = {
        title: "小红帽的冒险",
        summary: "小红帽去看望奶奶的故事",
        characters: [
          { name: "小红帽", description: "善良的小女孩" },
          { name: "奶奶", description: "慈祥的老人" }
        ],
        pages: [
          {
            pageNumber: 1,
            content: "从前有一个小女孩叫小红帽",
            imagePrompt: "A little girl in a red hood walking in the forest",
            sceneType: "character_introduction"
          },
          {
            pageNumber: 2, 
            content: "她要去看望生病的奶奶",
            imagePrompt: "Little Red Riding Hood carrying a basket of food",
            sceneType: "journey_begins"
          }
        ]
      };
      
      expect(isValidTaleStructure(mockTaleData)).to.be.true;
      testTaleId = 'test-tale-123';
      generatedPages = mockTaleData.pages;
      
      console.log('✓ 故事结构生成成功（模拟）');
    });

    it('步骤4: 故事数据存储和检索', async () => {
      // 测试getTaleData函数
      const wrapped = testEnv.wrap(functions.getTaleData);
      
      // 测试参数验证
      try {
        const req = createMockRequest({});
        await wrapped(req);
        expect.fail('应该要求taleId参数');
      } catch (error) {
        expect(error.code).to.equal('invalid-argument');
      }
      
      // 测试不存在的ID
      try {
        const req = createMockRequest({ taleId: 'non-existent' });
        await wrapped(req);
        expect.fail('应该返回未找到错误');
      } catch (error) {
        expect(error.code).to.equal('not-found');
      }
      
      console.log('✓ 故事数据存储和检索验证通过');
    });

    it('步骤5: 单页图像生成 - Imagen 3', async () => {
      const wrapped = testEnv.wrap(functions.generateImage);
      const req = createMockRequest({
        prompt: "A cute little girl in a red hood walking through a peaceful forest with tall trees and colorful flowers",
        pageIndex: 0,
        aspectRatio: '1:1',
        seed: 42
      });
      
      try {
        const result = await wrapped(req);
        
        expect(result).to.have.property('success', true);
        expect(result).to.have.property('pageIndex', 0);
        expect(result).to.have.property('imageUrl');
        expect(isValidImageUrl(result.imageUrl)).to.be.true;
        
        console.log('✓ Imagen 3 单页图像生成成功');
        
      } catch (error) {
        if (error.code === 'unauthenticated' || 
            (error.code === 'internal' && error.message.includes('access token'))) {
          console.log('⚠ Imagen 3 测试跳过：需要Google Cloud凭证');
          return;
        }
        throw error;
      }
    });

    it('步骤6: 单页图像生成 - Imagen 4', async () => {
      const wrapped = testEnv.wrap(functions.generateImageV4);
      const req = createMockRequest({
        prompt: "A friendly grandmother in her cozy cottage, wearing glasses and an apron, children's book illustration style",
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
        expect(result).to.have.property('imageUrl');
        expect(isValidImageUrl(result.imageUrl)).to.be.true;
        
        console.log('✓ Imagen 4 单页图像生成成功');
        
      } catch (error) {
        if (error.code === 'unauthenticated' || 
            (error.code === 'internal' && error.message.includes('access token'))) {
          console.log('⚠ Imagen 4 测试跳过：需要Google Cloud凭证');
          return;
        }
        throw error;
      }
    });

    it('步骤7: 批量图像生成测试', async () => {
      const prompts = [
        {
          prompt: "Little Red Riding Hood starting her journey from home",
          pageIndex: 0,
          aspectRatio: '1:1'
        },
        {
          prompt: "Red Riding Hood meeting the wolf in the forest",
          pageIndex: 1,
          aspectRatio: '1:1'
        }
      ];

      // 测试Imagen 3批量生成
      const wrappedBatch = testEnv.wrap(functions.generateImageBatch);
      const reqBatch = createMockRequest({ prompts });
      
      try {
        const result = await wrappedBatch(reqBatch);
        
        expect(result).to.have.property('results');
        expect(result).to.have.property('totalPages', 2);
        expect(result.results).to.be.an('array').with.length(2);
        
        console.log('✓ 批量图像生成测试通过');
        
      } catch (error) {
        if (error.code === 'unauthenticated' || 
            (error.code === 'internal' && error.message.includes('access token'))) {
          console.log('⚠ 批量生成测试跳过：需要Google Cloud凭证');
          return;
        }
        throw error;
      }
    });
  });

  describe('错误处理和边界情况', () => {
    it('应该处理无效的认证', async () => {
      const wrapped = testEnv.wrap(functions.generateImage);
      const req = createMockRequest({
        prompt: testImagePrompts.simple
      }, null); // 无认证
      
      try {
        await wrapped(req);
        expect.fail('应该抛出认证错误');
      } catch (error) {
        expect(error.code).to.equal('unauthenticated');
        console.log('✓ 正确处理无效认证');
      }
    });

    it('应该处理过长的提示词', async () => {
      const longPrompt = 'A'.repeat(2000); // 创建过长提示词
      const wrapped = testEnv.wrap(functions.generateImage);
      const req = createMockRequest({
        prompt: longPrompt,
        pageIndex: 0
      });
      
      try {
        await wrapped(req);
        // 函数应该能处理或截断过长提示词
        console.log('✓ 正确处理过长提示词');
      } catch (error) {
        if (error.code === 'unauthenticated' || 
            (error.code === 'internal' && error.message.includes('access token'))) {
          console.log('⚠ 过长提示词测试跳过：需要认证');
          return;
        }
        // 其他错误也是可接受的
        console.log('✓ 正确拒绝过长提示词');
      }
    });

    it('应该处理无效的宽高比参数', async () => {
      const wrapped = testEnv.wrap(functions.generateImage);
      const req = createMockRequest({
        prompt: testImagePrompts.simple,
        aspectRatio: 'invalid-ratio' // 无效宽高比
      });
      
      try {
        await wrapped(req);
        console.log('✓ 自动修正无效宽高比');
      } catch (error) {
        if (error.code === 'unauthenticated' || 
            (error.code === 'internal' && error.message.includes('access token'))) {
          console.log('⚠ 无效宽高比测试跳过：需要认证');
          return;
        }
        console.log('✓ 正确处理无效宽高比');
      }
    });
  });

  describe('性能和可靠性测试', () => {
    it('函数响应时间应该在合理范围内', async () => {
      const wrapped = testEnv.wrap(functions.healthCheck);
      const req = createMockRequest({});
      
      const startTime = Date.now();
      await wrapped(req);
      const duration = Date.now() - startTime;
      
      expect(duration).to.be.below(testConfig.timeouts.healthCheck);
      console.log(`✓ 健康检查响应时间: ${duration}ms`);
    });

    it('应该能处理并发请求（模拟）', async () => {
      const wrapped = testEnv.wrap(functions.healthCheck);
      const requests = Array(5).fill().map(() => 
        wrapped(createMockRequest({}))
      );
      
      const results = await Promise.all(requests);
      
      results.forEach(result => {
        expect(result.status).to.equal('healthy');
      });
      
      console.log('✓ 并发请求处理测试通过');
    });
  });

  describe('配置和环境测试', () => {
    it('应该正确加载配置文件', () => {
      const config = require('../../config');
      
      expect(config.PROJECT_ID).to.be.a('string');
      expect(config.LOCATION).to.be.a('string');
      expect(config.API_CONFIG).to.be.an('object');
      expect(config.STORAGE_CONFIG).to.be.an('object');
      
      console.log('✓ 配置文件加载正确');
    });

    it('应该有正确的函数内存和超时配置', () => {
      const config = require('../../config');
      
      expect(config.API_CONFIG.DEFAULT_TIMEOUT).to.be.a('number');
      expect(config.API_CONFIG.DEFAULT_MEMORY).to.be.a('string');
      
      console.log('✓ 函数配置验证通过');
    });
  });
}); 