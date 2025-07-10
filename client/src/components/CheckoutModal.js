import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router-dom';
import PaymentForm from './PaymentForm';
import './CheckoutModal.css';

/**
 * 支付结账模态框组件
 * 使用Portal将模态框渲染到body最上层，确保UI显示在最顶层
 * @param {Object} props - 组件属性
 * @returns {JSX.Element} - 渲染的组件
 */
const CheckoutModal = ({ priceId, onSuccess, onClose }) => {
  // 创建一个引用，用于访问 PaymentForm 的 handleClose 方法
  const paymentFormCloseRef = useRef(null);
  const navigate = useNavigate();

  // 组件挂载时禁用页面滚动
  useEffect(() => {
    // 添加body类禁止滚动
    document.body.classList.add('payment-processing');
    
    // 组件卸载时恢复滚动
    return () => {
      document.body.classList.remove('payment-processing');
    };
  }, []);
  
  // 处理支付成功
  const handleSuccess = () => {
    if (onSuccess) onSuccess();
    onClose();
    // Stripe会自动重定向到配置的成功URL
  };
  
  // 处理关闭模态框
  const handleClose = () => {
    if (onClose) onClose();
    // 导航到支付结果页面，状态为取消
    navigate('/payment-result?status=canceled');
  };

  // 处理背景点击关闭模态框
  const handleBackdropClose = () => {
    // 调用 PaymentForm 的 handleClose 方法
    if (paymentFormCloseRef.current) {
      paymentFormCloseRef.current();
    }
    if (onClose) onClose();
    // 导航到支付结果页面，状态为取消
    navigate('/payment-result?status=canceled');
  };

  // 创建模态框内容
  const modalContent = (
    <div className="checkout-modal">
      <div className="checkout-modal-backdrop" onClick={handleBackdropClose}></div>
      <div className="checkout-modal-content">
        <PaymentForm 
          priceId={priceId}
          onSuccess={handleSuccess}
          onCancel={handleClose}
          onCloseRef={paymentFormCloseRef}
        />
      </div>
    </div>
  );

  // 使用Portal将模态框渲染到body最上层
  return ReactDOM.createPortal(
    modalContent,
    document.body
  );
};

export default CheckoutModal; 