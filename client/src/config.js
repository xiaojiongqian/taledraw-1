// 前端配置文件 - 管理所有前端常量

// === 项目配置常量 ===
export const PROJECT_ID = 'ai-app-taskforce';
export const LOCATION = 'us-central1';

// === API 配置 ===
export const API_CONFIG = {
  IMAGEN_API_VERSION: process.env.REACT_APP_IMAGEN_API_VERSION || '3',
  IMAGEN3_REGION: 'us-central1',
  IMAGEN4_REGION: 'us-central1'
};

// === 工具函数 ===
export const UTILS = {
  // 获取 Imagen 区域
  getImagenRegion: () => {
    return API_CONFIG.IMAGEN_API_VERSION === '4' 
      ? API_CONFIG.IMAGEN4_REGION 
      : API_CONFIG.IMAGEN3_REGION;
  },

  // 获取图像生成函数名称
  getImageGenerationFunction: () => {
    return API_CONFIG.IMAGEN_API_VERSION === '4' ? 'generateImageV4' : 'generateImage';
  },

  // 构建 Firebase 函数 URL
  buildFunctionUrl: (functionName, region = LOCATION) => {
    // 对于HTTP触发器函数（如generateTaleStream），使用Cloud Run URL格式
    if (functionName === 'generateTaleStream') {
      return `https://generatetalestream-r7425ocbcq-uc.a.run.app`;
    }
    // 对于callable函数，使用传统的Cloud Functions URL格式
    return `https://${region}-${PROJECT_ID}.cloudfunctions.net/${functionName}`;
  },

  // 日志消息格式化
  formatLogMessage: (pageIndex, message) => {
    return `Page ${pageIndex + 1}: ${message}`;
  },

  // 错误消息格式化
  formatErrorMessage: (message, apiVersion = API_CONFIG.IMAGEN_API_VERSION) => {
    return `Image generation API returned error: ${message}`;
  }
};

// === 导出所有配置 ===
const config = {
  PROJECT_ID,
  LOCATION,
  API_CONFIG,
  UTILS
};

export default config; 