// Firebase Functions测试环境初始化
const functionsTest = require('firebase-functions-test');
const admin = require('firebase-admin');

// 初始化测试环境
const testEnv = functionsTest({
  projectId: 'ai-app-taskforce-test', // 使用测试项目ID
  // 可以使用本地服务账户密钥
  // databaseURL: 'https://ai-app-taskforce-test.firebaseio.com',
  // storageBucket: 'ai-app-taskforce-test.appspot.com'
});

// 模拟认证用户
const mockUser = {
  uid: 'test-user-123',
  email: 'test@example.com',
  email_verified: true
};

// 模拟请求上下文
const createMockRequest = (data, auth = mockUser) => ({
  auth,
  data
});

// 测试用故事数据
const testStoryData = {
  shortStory: '小猫咪找妈妈。它走过森林，遇到了好朋友。最后找到了妈妈，很开心。',
  mediumStory: '从前有一个小女孩叫小红帽，她要去看望生病的奶奶。妈妈给她准备了一篮子好吃的食物。小红帽走在森林里的小路上，遇到了大灰狼。大灰狼问她要去哪里，小红帽说要去奶奶家。大灰狼听了，想出了一个坏主意。它跑到奶奶家，把奶奶关起来，自己装成奶奶的样子。当小红帽到达时，发现了真相，最后猎人救了她们。',
  longStory: '很久很久以前，在一个遥远的王国里，住着一位美丽善良的公主。她有一颗纯洁的心，总是帮助需要帮助的人。有一天，邪恶的巫师对王国施了魔法，让所有的花朵都枯萎了，动物们也变得很伤心。公主决定踏上冒险之旅，寻找传说中的生命之泉来拯救王国。在路上，她遇到了很多困难，但也交到了许多朋友：聪明的猫头鹰、勇敢的小兔子、善良的小鹿。他们一起克服了重重困难，最终找到了生命之泉。公主用泉水拯救了王国，从此大家都过上了幸福的生活。'
};

// 测试用图像提示词
const testImagePrompts = {
  simple: 'A cute cat sitting in a garden with colorful flowers',
  complex: 'A magical princess with long golden hair, wearing a blue dress, standing in an enchanted forest with glowing fireflies and rainbow butterflies',
  character: 'A friendly cartoon rabbit with big eyes, wearing a red scarf, smiling and waving, children\'s book illustration style'
};

// 测试配置
const testConfig = {
  // API延迟容忍度
  timeouts: {
    generateTaleStream: 30000, // 30秒
    generateImage: 15000,      // 15秒
    getTaleData: 5000,         // 5秒
    healthCheck: 2000          // 2秒
  },
  // 重试配置
  retries: {
    max: 2,
    backoff: 1000
  },
  // 测试数据量限制
  limits: {
    maxStoryLength: 2000,
    maxPageCount: 10,
    maxPromptLength: 500
  }
};

// 辅助函数：等待异步操作
const waitFor = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 辅助函数：验证图像URL
const isValidImageUrl = (url) => {
  if (!url || typeof url !== 'string') {
    return false;
  }
  return url.startsWith('https://storage.googleapis.com/') || 
         url.startsWith('http://localhost');
};

// 辅助函数：验证故事结构
const isValidTaleStructure = (tale) => {
  if (!tale || typeof tale !== 'object') {
    return false;
  }
  
  return tale.hasOwnProperty('title') &&
         tale.hasOwnProperty('summary') &&
         tale.hasOwnProperty('pages') &&
         Array.isArray(tale.pages) &&
         tale.pages.length > 0 &&
         typeof tale.title === 'string' &&
         typeof tale.summary === 'string';
};

// 清理函数
const cleanup = () => {
  testEnv.cleanup();
};

module.exports = {
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
}; 