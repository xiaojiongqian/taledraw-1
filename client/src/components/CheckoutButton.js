import { useState, useEffect, useRef } from 'react';
import { STRIPE_CONFIG, IS_PRODUCTION } from '../config';
import { auth } from '../firebase';
import CheckoutModal from './CheckoutModal';
import { safeLog } from '../utils/logger';
import './CheckoutButton.css';

// 创建模块专用的日志记录器
const logger = safeLog;

/**
 * Stripe结账按钮组件
 * @param {Object} props - 组件属性
 * @returns {JSX.Element} - 渲染的组件
 */
const CheckoutButton = ({ className, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showCheckout, setShowCheckout] = useState(false);
  
  /**
   * 处理结账按钮点击 - 显示嵌入式结账
   */
  const handleCheckout = () => {
    // 检查用户是否已登录
    if (!auth.currentUser) {
      setError('请先登录后再进行支付操作');
      return;
    }
    
    setError(null); // 清除之前的错误
    setShowCheckout(true);
  };
  
  /**
   * 处理结账关闭
   */
  const handleClose = () => {
    setShowCheckout(false);
  };
  
  /**
   * 处理支付成功
   */
  const handleSuccess = () => {
    setShowCheckout(false);
    if (onSuccess) onSuccess();
  };

  return (
    <>
      <div className={`checkout-button-container ${className || ''}`}>
        <button 
          className="checkout-button"
          onClick={handleCheckout}
          disabled={loading}
        >
          {loading ? '处理中...' : '升级账户'}
        </button>
        {error && <div className="checkout-error">{error}</div>}
      </div>
      
      {showCheckout && (
        <CheckoutModal 
          priceId={STRIPE_CONFIG.PRICE_ID}
          onSuccess={handleSuccess}
          onClose={handleClose}
        />
      )}
    </>
  );
};

export default CheckoutButton;
