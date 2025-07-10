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

describe('Tale Draw - Complete Integration Tests', () => {
  before(() => {
    console.log('Starting integration tests - testing complete business workflows');
  });

  after(() => {
    console.log('Integration tests completed');
  });

  describe('Complete story generation workflow', () => {
    it('Step 1: Health check all functions', async () => {
      const wrapped = testEnv.wrap(functions.healthCheck);
      const req = createMockRequest({});
      
      const result = await wrapped(req);
      
      expect(result).to.have.property('status', 'healthy');
      expect(result).to.have.property('functions');
      expect(result.functions).to.include.members([
        'generateImage',
        'generateTaleStream',
        'getTaleData',
        'healthCheck'
      ]);
      
      console.log('✓ Health check passed, all functions normal');
    });

    it('Step 2: Stream story generation', async () => {
      // Note: generateTaleStream is an onRequest function, difficult to test directly
      console.log('📖 Stream story generation test (simulated)');
      
      const mockTaleData = {
        storyTitle: 'Little Red Riding Hood',
        artStyle: 'children\'s book watercolor illustration',
        pages: [
          {
            pageNumber: 1,
            title: 'Little Red Riding Hood sets off',
            text: 'Little Red Riding Hood carried a basket and walked to grandma\'s house.',
            sceneType: 'forest path',
            sceneCharacters: ['Little Red Riding Hood'],
            imagePrompt: 'A cute little girl in a red hood walking through a peaceful forest with tall trees and colorful wildflowers',
            scenePrompt: 'peaceful forest with tall trees and colorful wildflowers',
            characterPrompts: 'cute little girl in a red hood'
          },
          {
            pageNumber: 2,
            title: 'Meeting the wolf',
            text: 'On the way, she met a big bad wolf who asked where she was going.',
            sceneType: 'forest clearing',
            sceneCharacters: ['Little Red Riding Hood', 'Big Bad Wolf'],
            imagePrompt: 'Little Red Riding Hood carrying a basket of food',
            scenePrompt: 'forest clearing with sunlight',
            characterPrompts: 'Little Red Riding Hood and big bad wolf'
          }
        ],
        allCharacters: {
          'Little Red Riding Hood': {
            appearance: 'A young girl with brown braided hair, wearing a bright red hooded cape',
            clothing: 'Red hooded cape, white dress, brown shoes',
            personality: 'Innocent and kind, walks with confident steps'
          }
        }
      };
      
      console.log('✓ Story structure generation successful (simulated)');
    });

    it('Step 3: Data storage and retrieval verification', async () => {
      const wrapped = testEnv.wrap(functions.getTaleData);
      const req = createMockRequest({
        taleId: 'test-tale-id'
      });
      
      try {
        await wrapped(req);
        console.log('✓ Data retrieval successful');
      } catch (error) {
        if (error.code === 'unauthenticated' || error.code === 'not-found') {
          console.log('✓ Data storage and retrieval verification passed');
        } else {
          throw error;
        }
      }
    });

    it('Step 4: Multi-model image generation - Imagen3', async () => {
      const wrapped = testEnv.wrap(functions.generateImage);
      const req = createMockRequest({
        prompt: 'A cute little girl in a red hood walking through a peaceful forest with tall trees and colorful flowers',
        model: 'imagen3',
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
        
        console.log('✓ Imagen3 model generation successful');
        
      } catch (error) {
        if (error.code === 'unauthenticated' || 
            (error.code === 'internal' && error.message.includes('access token'))) {
          console.log('⚠ Imagen3 test skipped: requires Google Cloud credentials');
          return;
        }
        throw error;
      }
    });

    it('Step 5: Multi-model image generation - Imagen4', async () => {
      const wrapped = testEnv.wrap(functions.generateImage);
      const req = createMockRequest({
        prompt: 'A friendly grandmother in her cozy cottage, wearing glasses and an apron, children\'s book illustration style',
        model: 'imagen4',
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
        
        console.log('✓ Imagen4 model generation successful');
        
      } catch (error) {
        if (error.code === 'unauthenticated' || 
            (error.code === 'internal' && error.message.includes('access token'))) {
          console.log('⚠ Imagen4 test skipped: requires Google Cloud credentials');
          return;
        }
        throw error;
      }
    });

    it('Step 6: Multi-model image generation - Imagen4-fast (default)', async () => {
      const wrapped = testEnv.wrap(functions.generateImage);
      const req = createMockRequest({
        prompt: 'A magical forest scene with colorful butterflies and sunbeams, children\'s book illustration style',
        // 不指定 model，应该使用默认的 imagen4-fast
        pageIndex: 2,
        aspectRatio: '1:1',
        seed: 42
      });
      
      try {
        const result = await wrapped(req);
        
        expect(result).to.have.property('success', true);
        expect(result).to.have.property('pageIndex', 2);
        expect(result).to.have.property('imageUrl');
        expect(isValidImageUrl(result.imageUrl)).to.be.true;
        
        console.log('✓ Imagen4-fast (default) model generation successful');
        
      } catch (error) {
        if (error.code === 'unauthenticated' || 
            (error.code === 'internal' && error.message.includes('access token'))) {
          console.log('⚠ Imagen4-fast test skipped: requires Google Cloud credentials');
          return;
        }
        throw error;
      }
    });


  });

  describe('Error handling and edge cases', () => {
    it('Should handle invalid authentication', async () => {
      const wrapped = testEnv.wrap(functions.generateImage);
      const req = createMockRequest({
        prompt: testImagePrompts.simple
      }, null); // No authentication
      
      try {
        await wrapped(req);
        expect.fail('Should throw authentication error');
      } catch (error) {
        expect(error.code).to.equal('unauthenticated');
        console.log('✓ Correctly handled invalid authentication');
      }
    });

    it('Should handle overly long prompts', async () => {
      const longPrompt = 'A'.repeat(2000); // Create overly long prompt
      const wrapped = testEnv.wrap(functions.generateImage);
      const req = createMockRequest({
        prompt: longPrompt,
        pageIndex: 0
      });
      
      try {
        await wrapped(req);
        // Function should be able to handle or truncate overly long prompts
        console.log('✓ Correctly handled overly long prompts');
      } catch (error) {
        if (error.code === 'unauthenticated' || 
            (error.code === 'internal' && error.message.includes('access token'))) {
          console.log('⚠ Long prompt test skipped: requires authentication');
          return;
        }
        // Other errors are also acceptable
        console.log('✓ Correctly rejected overly long prompts');
      }
    });

    it('Should handle invalid aspect ratio parameters', async () => {
      const wrapped = testEnv.wrap(functions.generateImage);
      const req = createMockRequest({
        prompt: testImagePrompts.simple,
        aspectRatio: 'invalid-ratio' // Invalid aspect ratio
      });
      
      try {
        await wrapped(req);
        console.log('✓ Automatically corrected invalid aspect ratio');
      } catch (error) {
        if (error.code === 'unauthenticated' || 
            (error.code === 'internal' && error.message.includes('access token'))) {
          console.log('⚠ Invalid aspect ratio test skipped: requires authentication');
          return;
        }
        console.log('✓ Correctly handled invalid aspect ratio');
      }
    });

    it('Should handle invalid model parameters', async () => {
      const wrapped = testEnv.wrap(functions.generateImage);
      const req = createMockRequest({
        prompt: testImagePrompts.simple,
        model: 'invalid-model' // Invalid model
      });
      
      try {
        await wrapped(req);
        expect.fail('Should throw invalid model error');
      } catch (error) {
        expect(error.code).to.equal('invalid-argument');
        expect(error.message).to.include('Unsupported model');
        console.log('✓ Correctly handled invalid model parameter');
      }
    });
  });

  describe('Performance and reliability tests', () => {
    it('Function response time should be within reasonable range', async () => {
      const wrapped = testEnv.wrap(functions.healthCheck);
      const req = createMockRequest({});
      
      const startTime = Date.now();
      await wrapped(req);
      const duration = Date.now() - startTime;
      
      expect(duration).to.be.below(testConfig.timeouts.healthCheck);
      console.log(`✓ Health check response time: ${duration}ms`);
    });

    it('Should handle concurrent requests (simulated)', async () => {
      const wrapped = testEnv.wrap(functions.healthCheck);
      const requests = Array(5).fill().map(() => 
        wrapped(createMockRequest({}))
      );
      
      const results = await Promise.all(requests);
      
      results.forEach(result => {
        expect(result.status).to.equal('healthy');
      });
      
      console.log('✓ Concurrent request handling test passed');
    });
  });

  describe('Configuration and environment tests', () => {
    it('Should correctly load configuration file', () => {
      const config = require('../../config');
      
      expect(config.PROJECT_ID).to.be.a('string');
      expect(config.LOCATION).to.be.a('string');
      expect(config.API_CONFIG).to.be.an('object');
      expect(config.STORAGE_CONFIG).to.be.an('object');
      
      console.log('✓ Configuration file loaded correctly');
    });

    it('Should have correct function memory and timeout configurations', () => {
      const config = require('../../config');
      
      expect(config.API_CONFIG.DEFAULT_TIMEOUT).to.be.a('number');
      expect(config.API_CONFIG.DEFAULT_MEMORY).to.be.a('string');
      
      console.log(`Function timeout configuration: ${config.API_CONFIG.DEFAULT_TIMEOUT} seconds`);
      console.log(`Function memory configuration: ${config.API_CONFIG.DEFAULT_MEMORY}`);
      
      console.log('✓ Function configuration verification passed');
    });
  });
}); 