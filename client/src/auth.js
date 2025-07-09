import { GoogleAuth } from 'google-auth-library';

// 导入配置
import { PROJECT_ID, LOCATION } from './config';
import { safeLog } from './utils/logger';

// OAuth2 Client配置
const CLIENT_ID = 'your-oauth-client-id'; // 需要在GCP Console创建
const SCOPES = [
  'https://www.googleapis.com/auth/cloud-platform',
  'https://www.googleapis.com/auth/aiplatform'
];

class GCPAuthService {
  constructor() {
    this.auth = null;
    this.accessToken = null;
  }

  // 初始化Google Auth
  async initialize() {
    try {
      // 方法1: 使用OAuth2 Flow (需要用户授权)
      this.auth = new GoogleAuth({
        scopes: SCOPES,
        projectId: PROJECT_ID
      });
      
      return true;
    } catch (error) {
      safeLog.error('初始化Google Auth失败:', error);
      return false;
    }
  }

  // 获取访问令牌
  async getAccessToken() {
    try {
      if (!this.auth) {
        await this.initialize();
      }

      const client = await this.auth.getClient();
      const token = await client.getAccessToken();
      this.accessToken = token.token;
      
      return this.accessToken;
    } catch (error) {
      safeLog.error('获取访问令牌失败:', error);
      throw error;
    }
  }

  // 检查令牌是否有效
  isTokenValid() {
    return this.accessToken && this.accessToken.length > 0;
  }

  // 刷新令牌
  async refreshToken() {
    this.accessToken = null;
    return await this.getAccessToken();
  }
}

// 单例模式
export const gcpAuthService = new GCPAuthService();

// 便捷函数
export async function getGCPAccessToken() {
  return await gcpAuthService.getAccessToken();
}

export { PROJECT_ID, LOCATION }; 