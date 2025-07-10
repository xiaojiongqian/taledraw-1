// 前端配置文件 - 管理所有前端常量

// === 项目配置常量 ===
export const PROJECT_ID = 'ai-app-taskforce';
export const LOCATION = 'us-central1';

// === API 配置 ===
export const API_CONFIG = {
  IMAGEN_REGION: 'us-central1'
};

// 环境配置
export const IS_PRODUCTION = process.env.NODE_ENV === 'production';

export const BASE_URL = IS_PRODUCTION
  ? 'https://ai-app-taskforce.web.app' 
  : 'http://localhost:3000';

// === Stripe支付配置 ===
export const STRIPE_CONFIG = {
  PUBLISHABLE_KEY: process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY || 'pk_test_51RiV0qH1NCrMVCYNVVfKwgQwwBmSZTqtgagTSoG6pXu6diaXUKT1ZzAdGlOonLK3U3XkXHLyuDfdGddmetIzeJ1A00X9R9ciOl',
  PRICE_ID: process.env.REACT_APP_STRIPE_PRICE_ID || 'price_1RiV4lH1NCrMVCYNxZgC4bHN',
  SUCCESS_URL: process.env.REACT_APP_STRIPE_SUCCESS_URL || `${BASE_URL}/success`,
  CANCEL_URL: process.env.REACT_APP_STRIPE_CANCEL_URL || `${BASE_URL}/cancel`
};

// === 工具函数 ===
export const UTILS = {
  // 获取 Imagen 区域
  getImagenRegion: () => {
    return API_CONFIG.IMAGEN_REGION;
  },

  // 构建 Firebase 函数 URL
  buildFunctionUrl: (functionName, region = LOCATION) => {
    // 对于HTTP触发器函数（如generateTaleStream），使用Cloud Run URL格式 (Functions 2nd Gen)
    if (functionName === 'generateTaleStream') {
      // 使用实际的 Cloud Run URL
      return process.env.REACT_APP_GENERATE_TALE_STREAM_URL || 
             'https://generatetalestream-r7425ocbcq-uc.a.run.app';
    }
    // 对于callable函数，使用传统的Cloud Functions URL格式
    return `https://${region}-${PROJECT_ID}.cloudfunctions.net/${functionName}`;
  },

  // 日志消息格式化
  formatLogMessage: (pageIndex, message) => {
    return `Page ${pageIndex + 1}: ${message}`;
  },

  // 错误消息格式化
  formatErrorMessage: (message) => {
    return `Image generation API returned error: ${message}`;
  }
};

// === 导出所有配置 ===
const config = {
  PROJECT_ID,
  LOCATION,
  API_CONFIG,
  STRIPE_CONFIG,
  UTILS
};

export default config; 