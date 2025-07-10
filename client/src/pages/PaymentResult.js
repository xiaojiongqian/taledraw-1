import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import { safeLog } from '../utils/logger';
import { auth } from '../firebase';
import PaymentVerificationService from '../services/PaymentVerificationService';
import './PaymentResult.css';

/**
 * Stripe支付结果页面组件
 * 用于显示支付成功或取消后的结果信息
 * @returns {JSX.Element} - 渲染的组件
 */
const PaymentResult = () => {
  const [status, setStatus] = useState('loading');
  const [verificationError, setVerificationError] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  
  useEffect(() => {
    const verifyPayment = async () => {
      try {
        // 解析URL参数
        const queryParams = new URLSearchParams(location.search);
        const statusParam = queryParams.get('status');
        const sessionId = queryParams.get('session_id');
        
        safeLog.debug('PaymentResult', '支付结果页面加载', '状态参数:', statusParam, '会话ID:', sessionId);
        
        // 如果状态参数为取消，直接显示取消状态
        if (statusParam === 'canceled') {
          setStatus('canceled');
          toast.info('支付已取消', {
            position: "top-center",
            autoClose: 5000,
          });
          return;
        }
        
        // 如果没有会话ID，无法验证支付状态
        if (!sessionId) {
          safeLog.error('PaymentResult', '缺少会话ID，无法验证支付状态');
          setStatus('unknown');
          setVerificationError('无法验证支付状态，缺少必要参数');
          return;
        }
        
        // 检查用户是否已登录
        if (!auth.currentUser) {
          safeLog.error('PaymentResult', '用户未登录，无法验证支付状态');
          setStatus('unknown');
          setVerificationError('请先登录后再验证支付状态');
          return;
        }
        
        // 调用服务端接口验证支付状态
        const paymentStatus = await PaymentVerificationService.verifyPaymentStatus(sessionId);
        
        // 根据服务端返回的状态设置页面状态
        if (paymentStatus.success) {
          setStatus('success');
          toast.success('支付成功！您的账户已升级', {
            position: "top-center",
            autoClose: 5000,
          });
        } else {
          setStatus('failed');
          toast.error('支付验证失败', {
            position: "top-center",
            autoClose: 5000,
          });
          setVerificationError(paymentStatus.message || '支付验证失败，请联系客服');
        }
      } catch (error) {
        safeLog.error('PaymentResult', '验证支付状态失败:', error);
        setStatus('error');
        setVerificationError(error.message || '验证支付状态时出错');
        toast.error('验证支付状态失败', {
          position: "top-center",
          autoClose: 5000,
        });
      }
    };
    
    verifyPayment();
  }, [location]);
  
  // 返回首页
  const handleBackToHome = () => {
    navigate('/');
  };

  return (
    <div className="payment-result-container">
      <div className="payment-result-card">
        {status === 'loading' && (
          <div className="payment-result-loading">
            <div className="payment-result-spinner"></div>
            <h2>正在验证支付状态...</h2>
            <p>请稍候，我们正在确认您的支付结果</p>
          </div>
        )}
        
        {status === 'success' && (
          <div className="payment-result-success">
            <div className="payment-result-icon success">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
            </div>
            <h2>支付成功</h2>
            <p>感谢您的购买！您的账户已成功升级。</p>
            <p className="payment-result-details">您现在可以使用所有高级功能。</p>
            <button className="btn btn-primary" onClick={handleBackToHome}>
              返回首页
            </button>
          </div>
        )}
        
        {status === 'canceled' && (
          <div className="payment-result-canceled">
            <div className="payment-result-icon canceled">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="8" y1="12" x2="16" y2="12"></line>
              </svg>
            </div>
            <h2>支付已取消</h2>
            <p>您的支付过程已被取消。</p>
            <p className="payment-result-details">如果这是一个错误，您可以随时重新尝试支付。</p>
            <button className="btn btn-primary" onClick={handleBackToHome}>
              返回首页
            </button>
          </div>
        )}
        
        {status === 'failed' && (
          <div className="payment-result-failed">
            <div className="payment-result-icon failed">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
              </svg>
            </div>
            <h2>支付失败</h2>
            <p>很抱歉，您的支付未能完成。</p>
            <p className="payment-result-details">{verificationError || '请检查您的支付方式并重试。'}</p>
            <button className="btn btn-primary" onClick={handleBackToHome}>
              返回首页
            </button>
          </div>
        )}
        
        {(status === 'unknown' || status === 'error') && (
          <div className="payment-result-unknown">
            <div className="payment-result-icon unknown">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            </div>
            <h2>支付状态未知</h2>
            <p>我们无法确定您的支付状态。</p>
            <p className="payment-result-details">{verificationError || '请联系客服或检查您的账户状态。'}</p>
            <button className="btn btn-primary" onClick={handleBackToHome}>
              返回首页
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentResult; 