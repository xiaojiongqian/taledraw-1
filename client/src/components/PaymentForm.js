import React, { useState, useEffect, useRef } from 'react';
import StripeService from '../services/StripeService';
import { STRIPE_CONFIG } from '../config';
import { auth } from '../firebase';
import './PaymentForm.css';
import { safeLog } from '../utils/logger';
import { toast } from 'react-toastify';

// 创建模块专用的日志记录器
const logger = safeLog;


// 全局变量，跟踪结账是否已初始化
let isCheckoutInitialized = false;

/**
 * 嵌入式Stripe结账组件
 * @param {Object} props - 组件属性
 * @returns {JSX.Element} - 渲染的组件
 */
const PaymentForm = ({ 
  priceId = STRIPE_CONFIG.PRICE_ID, 
  onSuccess, 
  onCancel, 
  onCloseRef 
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stripeService] = useState(new StripeService(STRIPE_CONFIG.PUBLISHABLE_KEY));
  const isMounted = useRef(true); // 使用 useRef 跟踪组件挂载状态

  // 处理支付成功
  const handleSuccess = () => {
    toast.success('支付成功！您的账户已升级', {
      position: "top-center",
      autoClose: 5000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true
    });
    if (onSuccess) onSuccess();
  };
  
  // 处理取消
  const handleCancel = () => {
    logger.log('handleCancel', '取消结账操作');
    // 清理结账实例
    stripeService.cleanup();
    // 重置初始化状态，允许再次初始化
    isCheckoutInitialized = false;
    if (onCancel) onCancel();
  };

  const handleClose = () => {
    logger.log('handleClose', '关闭结账模态框');
    // 清理结账实例
    stripeService.cleanup();
    // 重置初始化状态，允许再次初始化
    isCheckoutInitialized = false;
  }

  // 将 handleClose 方法暴露给父组件
  useEffect(() => {
    if (onCloseRef) {
      onCloseRef.current = handleClose;
    }
  }, [onCloseRef]);

  // 初始化嵌入式结账
  useEffect(() => {
    safeLog.debug('PaymentForm', 'useEffect...', '初始化状态:', isCheckoutInitialized); 
    
    const initializeCheckout = async () => {
      try {
        // 检查用户是否已登录
        if (!auth.currentUser) {
          throw new Error('请先登录后再进行支付操作');
        }
        
        // 如果组件已卸载，直接返回
        if (!isMounted.current) return;
        
        // 如果已经初始化过，不再重复初始化
        if (isCheckoutInitialized) {
          safeLog.debug('PaymentForm', '已经初始化过，跳过初始化');
          setLoading(false);
          return;
        }
        
        setLoading(true);
        safeLog.debug('PaymentForm', '初始化嵌入式结账...'); 
        
        // 初始化结账
        await stripeService.initializeCheckout('#checkout-element', priceId);
        
        // 标记为已初始化 (全局状态)
        isCheckoutInitialized = true;
        
        // 如果组件已卸载，直接返回
        if (!isMounted.current) return;
        
        // 移除之前的监听器，避免重复添加
        window.removeEventListener('checkout-complete', handleSuccess);
        // 监听支付成功事件
        window.addEventListener('checkout-complete', handleSuccess);
      } catch (error) {
        safeLog.error('初始化结账失败:', error);
        if (isMounted.current) {
          setError(error.message || '结账初始化失败，请稍后再试');
        }
      } finally {
        setLoading(false);
      }
    };
    
    initializeCheckout(); // 启用初始化
    
    // 组件卸载时清理
    return () => {
      safeLog.debug('PaymentForm', '卸载组件...'); 
      isMounted.current = false; // 标记组件已卸载
      window.removeEventListener('checkout-complete', handleSuccess);
      // 注意：不在这里重置 isCheckoutInitialized，因为我们希望保持初始化状态
    };
  }, [priceId]); // 只依赖 priceId

    return (
    <div className="payment-form-container">
      
      {loading && (
      <div className="payment-loading">
        <div className="payment-spinner"></div>
          <p>正在准备结账环境...</p>
      </div>
      )}
  
      {error && (
      <div className="payment-error">
          <p>{error}</p>
        <button 
            className="payment-button payment-button-cancel" 
            onClick={handleCancel}
        >
            关闭
        </button>
      </div>
      )}
      
      <div 
        id="checkout-element" 
        className={`checkout-element-container ${loading ? 'hidden' : ''}`}
      ></div>
    </div>
  );
};

export default PaymentForm; 