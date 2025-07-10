/**
 * 支付验证服务
 * 负责与服务端通信，验证支付状态
 */
import { auth } from '../firebase';
import { functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import { safeLog } from '../utils/logger';

class PaymentVerificationService {
  /**
   * 验证支付会话状态
   * @param {string} sessionId - Stripe会话ID
   * @returns {Promise<Object>} - 支付状态信息
   */
  static async verifyPaymentStatus(sessionId) {
    try {
      safeLog.debug('验证支付状态...', sessionId);
      
      // 检查用户是否已登录
      const currentUser = auth.currentUser;
      if (!currentUser) {
        safeLog.error('用户未登录，无法验证支付状态');
        throw new Error('用户未登录');
      }
      
      // 确保用户令牌是最新的
      await currentUser.getIdToken(true);
      
      // 使用Firebase Functions调用
      const verifyPaymentStatusFn = httpsCallable(functions, 'verifyPaymentStatus');
      
      // 调用Firebase Function
      const response = await verifyPaymentStatusFn({ sessionId });
      
      // Firebase Functions返回的数据在response.data中
      const paymentStatus = response.data;
      safeLog.log('支付状态验证结果:', paymentStatus);
      return paymentStatus;
    } catch (error) {
      safeLog.error('验证支付状态失败:', error);
      
      // 处理特定错误类型
      if (error.code === 'unauthenticated' || error.message.includes('unauthenticated') || error.message.includes('登录')) {
        throw new Error('用户认证失败，请重新登录后再试');
      }
      
      throw error;
    }
  }

  /**
   * 检查用户的订阅状态
   * @returns {Promise<Object>} - 用户订阅状态信息
   */
  static async checkSubscriptionStatus() {
    try {
      safeLog.debug('检查用户订阅状态...');
      
      // 检查用户是否已登录
      const currentUser = auth.currentUser;
      if (!currentUser) {
        safeLog.error('用户未登录，无法检查订阅状态');
        throw new Error('用户未登录');
      }
      
      // 确保用户令牌是最新的
      await currentUser.getIdToken(true);
      
      // 使用Firebase Functions调用
      const checkSubscriptionStatusFn = httpsCallable(functions, 'checkSubscriptionStatus');
      
      // 调用Firebase Function
      const response = await checkSubscriptionStatusFn();
      
      // Firebase Functions返回的数据在response.data中
      const subscriptionStatus = response.data;
      safeLog.debug('订阅状态检查结果:', subscriptionStatus);
      return subscriptionStatus;
    } catch (error) {
      safeLog.error('检查订阅状态失败:', error);
      
      // 处理特定错误类型
      if (error.code === 'unauthenticated' || error.message.includes('unauthenticated') || error.message.includes('登录')) {
        throw new Error('用户认证失败，请重新登录后再试');
      }
      
      throw error;
    }
  }
}

export default PaymentVerificationService; 