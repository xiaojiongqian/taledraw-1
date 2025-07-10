/**
 * Stripe支付服务类
 * 负责处理Stripe支付集成相关功能
 */
import { auth } from '../firebase';
import { loadStripe } from '@stripe/stripe-js';
import { functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import { STRIPE_CONFIG } from '../config';
import { safeLog } from '../utils/logger';

// 存储单个全局实例
let checkoutInstance = null;

class StripeService {
  /**
   * 初始化Stripe服务
   * @param {string} publishableKey - Stripe公钥
   */
  constructor(publishableKey) {
    this.publishableKey = publishableKey;
    this.stripe = null;
  }

  /**
   * 加载Stripe.js脚本
   * @returns {Promise<Object>} - Stripe实例
   */
  async loadStripe() {
    if (!this.stripe) {
      safeLog.debug('加载Stripe.js...');
      // 使用npm包加载Stripe
      this.stripe = await loadStripe(this.publishableKey);
      safeLog.debug('Stripe.js加载完成');
    }
    return this.stripe;
  }

  /**
   * 获取当前用户的认证Token
   * @returns {Promise<string>} - 认证Token
   */
  async getAuthToken() {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('用户未登录');
    }
    return currentUser.getIdToken();
  }

  /**
   * 创建结账会话
   * @param {string} priceId - Stripe价格ID
   * @returns {Promise<Object>} - 包含clientSecret的Promise
   */
  async createCheckoutSession(priceId) {
    try {
      safeLog.debug('创建结账会话...');
      
      // 检查用户是否已登录
      const currentUser = auth.currentUser;
      if (!currentUser) {
        safeLog.error('用户未登录，无法创建结账会话');
        throw new Error('用户未登录');
      }
      
      safeLog.debug('当前用户:', currentUser.uid, currentUser.email);
      
      // 确保用户令牌是最新的
      await currentUser.getIdToken(true);
      
      // 使用Firebase Functions调用
      const createCheckoutSessionFn = httpsCallable(functions, 'createCheckoutSession');
      
      // 准备参数，使用配置中的URL
      const params = {
        priceId,
        embeddedMode: true, // 使用嵌入式模式
        successUrl: STRIPE_CONFIG.SUCCESS_URL,
        cancelUrl: STRIPE_CONFIG.CANCEL_URL
      };
      
      safeLog.debug('调用Firebase Function: createCheckoutSession');
      safeLog.debug('参数:', params);
      
      // 调用Firebase Function
      const response = await createCheckoutSessionFn(params);
      
      // Firebase Functions返回的数据在response.data中
      const session = response.data;
      safeLog.debug('结账会话创建成功:', session);
      return session;
    } catch (error) {
      safeLog.error('创建结账会话失败:', error);
      
      // 处理特定错误类型
      if (error.code === 'unauthenticated' || error.message.includes('unauthenticated') || error.message.includes('登录')) {
        throw new Error('用户认证失败，请重新登录后再试');
      }
      
      throw error;
    }
  }
  
  /**
   * 初始化并挂载嵌入式结账
   * @param {string} elementSelector - 结账表单容器选择器
   * @param {string} priceId - Stripe价格ID
   * @returns {Promise<Object>} - 结账实例
   */
  async initializeCheckout(elementSelector, priceId) {
    try {
      safeLog.debug('初始化嵌入式结账清理...');
      // 清理之前的实例
      this.cleanup();
      
      // 加载Stripe
      await this.loadStripe();
      
      // 确保DOM元素存在
      const element = document.querySelector(elementSelector);
      if (!element) {
        throw new Error(`找不到结账容器元素: ${elementSelector}`);
      }
      
      // 创建结账会话
      const fetchClientSecret = async () => {
        const { clientSecret } = await this.createCheckoutSession(priceId);
        return clientSecret;
      };

      // 处理结账完成事件
      const onComplete = (result) => {
        safeLog.debug('结账完成:', result);
        // 触发自定义事件，通知支付成功
        const event = new CustomEvent('checkout-complete', {
          detail: {
            success: true,
            result,
          }
        });
        window.dispatchEvent(event);
        
        // TODO 结合服务端获取当前最新状态
      };
      
      safeLog.debug('初始化嵌入式结账...');
      
      // 初始化嵌入式结账
      checkoutInstance = await this.stripe.initEmbeddedCheckout({
        fetchClientSecret,
        onComplete
      });
      
      // 挂载到DOM
      safeLog.debug('挂载结账表单到:', elementSelector);
      checkoutInstance.mount(elementSelector);
      
      return checkoutInstance;
    } catch (error) {
      safeLog.error('初始化嵌入式结账失败:', error);
      throw error;
    }
  }
  
  /**
   * 清理结账实例
   */
  cleanup() {
    safeLog.debug('StripeService', 'cleanup');
    try {
      if (checkoutInstance) {
        safeLog.debug('卸载结账表单...');
        checkoutInstance.unmount();
        checkoutInstance.destroy();
        safeLog.debug('结账实例已清理');
        checkoutInstance = null;
      }
      
      // 清理可能存在的iframe元素
      const stripeFrames = document.querySelectorAll('iframe[name^="__privateStripeFrame"]');
      stripeFrames.forEach(frame => {
        if (frame && frame.parentNode) {
          frame.parentNode.removeChild(frame);
        }
      });
    } catch (error) {
      safeLog.warn('清理结账实例时出错:', error);
    }
  }
}

export default StripeService;
