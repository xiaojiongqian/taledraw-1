// 配置和逻辑测试 - 不依赖Firebase Admin初始化
const { expect } = require('chai');
const { describe, it, before, after } = require('mocha');

describe('Functions配置和逻辑测试', function() {
  this.timeout(10000);

  let config;

  before(() => {
    console.log('🔧 开始配置测试');
    try {
      config = require('../../config');
      console.log('✅ 配置文件加载成功');
    } catch (error) {
      console.log('❌ 配置文件加载失败:', error.message);
    }
  });

  after(() => {
    console.log('✅ 配置测试完成');
  });

  describe('基础配置验证', () => {
    it('应该有正确的项目配置', () => {
      expect(config).to.be.an('object');
      
      // 基础项目信息
      expect(config.PROJECT_ID).to.be.a('string');
      expect(config.PROJECT_ID).to.equal('ai-app-taskforce');
      
      expect(config.LOCATION).to.be.a('string');
      expect(config.LOCATION).to.equal('us-central1');
      
      expect(config.STORAGE_MODE).to.be.a('string');
      expect(config.STORAGE_MODE).to.be.oneOf(['cloud_storage', 'firestore']);
      
      console.log(`✅ 项目ID: ${config.PROJECT_ID}`);
      console.log(`✅ 区域: ${config.LOCATION}`);
      console.log(`✅ 存储模式: ${config.STORAGE_MODE}`);
    });

    it('应该有正确的API配置', () => {
      expect(config.API_CONFIG).to.be.an('object');
      
      // 模型配置
      expect(config.API_CONFIG.GEMINI_MODEL).to.equal('gemini-2.5-flash');
      expect(config.API_CONFIG.IMAGEN3_MODEL).to.equal('imagen-3.0-generate-002');
      expect(config.API_CONFIG.IMAGEN4_MODEL).to.equal('imagen-4.0-generate-preview-06-06');
      
      // 性能配置
      expect(config.API_CONFIG.MAX_OUTPUT_TOKENS).to.be.a('number');
      expect(config.API_CONFIG.MAX_OUTPUT_TOKENS).to.be.at.least(1000);
      
      expect(config.API_CONFIG.DEFAULT_TIMEOUT).to.be.a('number');
      expect(config.API_CONFIG.DEFAULT_TIMEOUT).to.be.at.least(60);
      
      expect(config.API_CONFIG.DEFAULT_MEMORY).to.be.a('string');
      
      console.log(`✅ Gemini模型: ${config.API_CONFIG.GEMINI_MODEL}`);
      console.log(`✅ Imagen3模型: ${config.API_CONFIG.IMAGEN3_MODEL}`);
      console.log(`✅ Imagen4模型: ${config.API_CONFIG.IMAGEN4_MODEL}`);
      console.log(`✅ 最大输出令牌: ${config.API_CONFIG.MAX_OUTPUT_TOKENS}`);
    });

    it('应该有正确的存储配置', () => {
      expect(config.STORAGE_CONFIG).to.be.an('object');
      
      expect(config.STORAGE_CONFIG.DEFAULT_BUCKET).to.be.a('string');
      expect(config.STORAGE_CONFIG.DEFAULT_BUCKET).to.include(config.PROJECT_ID);
      
      expect(config.STORAGE_CONFIG.STREAM_PATH).to.be.a('string');
      expect(config.STORAGE_CONFIG.REGULAR_PATH).to.be.a('string');
      
      console.log(`✅ 默认存储桶: ${config.STORAGE_CONFIG.DEFAULT_BUCKET}`);
      console.log(`✅ 流式路径: ${config.STORAGE_CONFIG.STREAM_PATH}`);
      console.log(`✅ 常规路径: ${config.STORAGE_CONFIG.REGULAR_PATH}`);
    });

    it('应该有正确的CORS配置', () => {
      expect(config.CORS_CONFIG).to.be.an('object');
      
      expect(config.CORS_CONFIG.origin).to.be.an('array');
      expect(config.CORS_CONFIG.origin).to.include('http://localhost:3000');
      expect(config.CORS_CONFIG.origin).to.include('https://ai-app-taskforce.web.app');
      
      expect(config.CORS_CONFIG.methods).to.be.an('array');
      expect(config.CORS_CONFIG.methods).to.include('GET');
      expect(config.CORS_CONFIG.methods).to.include('POST');
      
      console.log(`✅ CORS域名数量: ${config.CORS_CONFIG.origin.length}`);
      console.log(`✅ 支持的HTTP方法: ${config.CORS_CONFIG.methods.join(', ')}`);
    });
  });

  describe('工具函数测试', () => {
    it('应该正确构建API URL', () => {
      const model = 'test-model';
      const endpoint = 'testEndpoint';
      
      const url = config.UTILS.buildApiUrl(model, endpoint);
      
      expect(url).to.be.a('string');
      expect(url).to.include(config.PROJECT_ID);
      expect(url).to.include(config.LOCATION);
      expect(url).to.include(model);
      expect(url).to.include(endpoint);
      
      const expectedUrl = `https://${config.LOCATION}-aiplatform.googleapis.com/v1/projects/${config.PROJECT_ID}/locations/${config.LOCATION}/publishers/google/models/${model}:${endpoint}`;
      expect(url).to.equal(expectedUrl);
      
      console.log(`✅ API URL构建正确: ${url}`);
    });

    it('应该正确获取存储桶名称', () => {
      const bucketName = config.UTILS.getBucketName();
      
      expect(bucketName).to.be.a('string');
      expect(bucketName).to.equal(config.STORAGE_CONFIG.DEFAULT_BUCKET);
      
      console.log(`✅ 存储桶名称: ${bucketName}`);
    });

    it('应该正确构建文件路径', () => {
      const userId = 'test-user-123';
      const taleId = 'test-tale-456';
      
      // 常规路径
      const regularPath = config.UTILS.buildFilePath(userId, taleId, false);
      expect(regularPath).to.include(config.STORAGE_CONFIG.REGULAR_PATH);
      expect(regularPath).to.include(userId);
      expect(regularPath).to.include(taleId);
      expect(regularPath).to.match(/\.json\.gz$/);
      
      // 流式路径
      const streamPath = config.UTILS.buildFilePath(userId, taleId, true);
      expect(streamPath).to.include(config.STORAGE_CONFIG.STREAM_PATH);
      expect(streamPath).to.include(userId);
      expect(streamPath).to.include(taleId);
      
      console.log(`✅ 常规文件路径: ${regularPath}`);
      console.log(`✅ 流式文件路径: ${streamPath}`);
    });

    it('应该正确构建Gemini请求配置', () => {
      const story = 'Test story content';
      const systemPrompt = 'Test system prompt';
      
      const requestConfig = config.UTILS.buildGeminiRequest(story, systemPrompt);
      
      expect(requestConfig).to.be.an('object');
      expect(requestConfig).to.have.property('contents');
      expect(requestConfig).to.have.property('systemInstruction');
      expect(requestConfig).to.have.property('generationConfig');
      
      // 验证内容结构
      expect(requestConfig.contents).to.be.an('array');
      expect(requestConfig.contents[0]).to.have.property('role', 'user');
      expect(requestConfig.contents[0].parts[0].text).to.equal(story);
      
      // 验证系统指令
      expect(requestConfig.systemInstruction.parts[0].text).to.equal(systemPrompt);
      
      // 验证生成配置
      const genConfig = requestConfig.generationConfig;
      expect(genConfig.temperature).to.be.a('number');
      expect(genConfig.topP).to.be.a('number');
      expect(genConfig.maxOutputTokens).to.equal(config.API_CONFIG.MAX_OUTPUT_TOKENS);
      expect(genConfig.responseMimeType).to.equal('application/json');
      
      console.log('✅ Gemini请求配置构建正确');
    });

    it('应该正确构建函数配置', () => {
      // 默认配置
      const defaultConfig = config.UTILS.buildFunctionConfig();
      expect(defaultConfig).to.have.property('region', config.LOCATION);
      expect(defaultConfig).to.have.property('timeoutSeconds', config.API_CONFIG.DEFAULT_TIMEOUT);
      expect(defaultConfig).to.have.property('memory', config.API_CONFIG.DEFAULT_MEMORY);
      
      // 自定义配置
      const customConfig = config.UTILS.buildFunctionConfig('2GB', 600);
      expect(customConfig.memory).to.equal('2GB');
      expect(customConfig.timeoutSeconds).to.equal(600);
      
      console.log('✅ 函数配置构建正确');
    });

    it('应该正确构建流式函数配置', () => {
      const streamConfig = config.UTILS.buildStreamFunctionConfig();
      
      expect(streamConfig).to.have.property('region', config.LOCATION);
      expect(streamConfig).to.have.property('timeoutSeconds', config.API_CONFIG.DEFAULT_TIMEOUT);
      expect(streamConfig).to.have.property('memory', config.API_CONFIG.DEFAULT_MEMORY);
      expect(streamConfig).to.have.property('cors');
      expect(streamConfig).to.have.property('invoker', 'public');
      
      console.log('✅ 流式函数配置构建正确');
    });
  });

  describe('配置一致性验证', () => {
    it('存储桶名称应该与项目ID一致', () => {
      expect(config.STORAGE_CONFIG.DEFAULT_BUCKET).to.include(config.PROJECT_ID);
    });

    it('所有路径应该以斜杠结尾', () => {
      expect(config.STORAGE_CONFIG.STREAM_PATH).to.match(/\/$/);
      expect(config.STORAGE_CONFIG.REGULAR_PATH).to.match(/\/$/);
    });

    it('超时时间应该在合理范围内', () => {
      expect(config.API_CONFIG.DEFAULT_TIMEOUT).to.be.at.least(60);
      expect(config.API_CONFIG.DEFAULT_TIMEOUT).to.be.at.most(900);
    });

    it('内存配置应该是有效值', () => {
      const validMemoryValues = [
        '256MB', '512MB', '1GB', '1GiB', '2GB', '2GiB', 
        '4GB', '4GiB', '8GB', '8GiB'
      ];
      expect(validMemoryValues).to.include(config.API_CONFIG.DEFAULT_MEMORY);
    });

    it('模型名称应该符合预期格式', () => {
      expect(config.API_CONFIG.GEMINI_MODEL).to.match(/^gemini-/);
      expect(config.API_CONFIG.IMAGEN3_MODEL).to.match(/^imagen-3/);
      expect(config.API_CONFIG.IMAGEN4_MODEL).to.match(/^imagen-4/);
    });

    console.log('✅ 所有配置一致性验证通过');
  });

  describe('环境兼容性测试', () => {
    it('配置应该适用于开发环境', () => {
      // 检查本地开发相关配置
      expect(config.CORS_CONFIG.origin).to.include('http://localhost:3000');
      console.log('✅ 开发环境配置正确');
    });

    it('配置应该适用于生产环境', () => {
      // 检查生产环境相关配置
      const productionUrls = config.CORS_CONFIG.origin.filter(url => 
        url.includes('firebaseapp.com') || url.includes('.web.app')
      );
      expect(productionUrls.length).to.be.greaterThan(0);
      console.log('✅ 生产环境配置正确');
    });

    it('区域配置应该支持所需的API', () => {
      // us-central1应该支持Vertex AI
      expect(config.LOCATION).to.equal('us-central1');
      console.log('✅ 区域配置支持AI服务');
    });
  });
}); 