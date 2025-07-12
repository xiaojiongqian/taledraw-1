import React, { useState, useEffect, useCallback, useRef } from 'react';
import './ImageViewer.css';

function ImageViewer({ isOpen, onClose, pages, initialPageIndex = 0, aspectRatio = '1:1' }) {
  const [currentPageIndex, setCurrentPageIndex] = useState(initialPageIndex);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [imageLoadingStates, setImageLoadingStates] = useState({});
  const [showCloseButton, setShowCloseButton] = useState(false);
  const viewerRef = useRef(null);
  const containerRef = useRef(null);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const mouseHideTimer = useRef(null);

  // 获取当前页面数据
  const currentPage = pages[currentPageIndex] || {};
  const { image, imagePrompt, text, pageNumber, title } = currentPage;

  // 判断是否为横向布局
  const isLandscape = useCallback(() => {
    const [width, height] = aspectRatio.split(':').map(Number);
    return width / height > 1;
  }, [aspectRatio]);

  // 导航到上一页
  const navigateToPreviousPage = useCallback(() => {
    setCurrentPageIndex(prev => prev > 0 ? prev - 1 : prev);
  }, []);

  // 导航到下一页
  const navigateToNextPage = useCallback(() => {
    setCurrentPageIndex(prev => prev < pages.length - 1 ? prev + 1 : prev);
  }, [pages.length]);

  // 预加载相邻页面的图片
  useEffect(() => {
    if (!isOpen || !pages.length) return;

    // 预加载前后页面的图片
    const preloadImage = (url) => {
      if (url) {
        const img = new Image();
        img.src = url;
      }
    };

    // 预加载前一页
    if (currentPageIndex > 0 && pages[currentPageIndex - 1]?.image) {
      preloadImage(pages[currentPageIndex - 1].image);
    }
    // 预加载后一页
    if (currentPageIndex < pages.length - 1 && pages[currentPageIndex + 1]?.image) {
      preloadImage(pages[currentPageIndex + 1].image);
    }
  }, [currentPageIndex, pages, isOpen]);

  // 处理键盘事件
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyPress = (event) => {
      switch(event.key) {
        case 'ArrowLeft':
          navigateToPreviousPage();
          break;
        case 'ArrowRight':
          navigateToNextPage();
          break;
        case 'Escape':
          onClose();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    
    // 设置焦点到查看器，确保键盘事件能被捕获
    if (viewerRef.current) {
      viewerRef.current.focus();
    }

    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [isOpen, navigateToPreviousPage, navigateToNextPage, onClose]);

  // 处理背景点击关闭
  const handleOverlayClick = useCallback((e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  // 更新初始页面索引
  useEffect(() => {
    setCurrentPageIndex(initialPageIndex);
  }, [initialPageIndex]);

  // 处理双击全屏
  const handleDoubleClick = useCallback(() => {
    if (!document.fullscreenElement && containerRef.current) {
      containerRef.current.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(err => {
        console.error('Error attempting to enable fullscreen:', err);
      });
    } else if (document.fullscreenElement) {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      }).catch(err => {
        console.error('Error attempting to exit fullscreen:', err);
      });
    }
  }, []);

  // 监听全屏状态变化
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // 处理鼠标移动和自动隐藏关闭按钮
  useEffect(() => {
    if (!isOpen) return;

    const handleMouseMove = () => {
      setShowCloseButton(true);
      
      // 清除之前的定时器
      if (mouseHideTimer.current) {
        clearTimeout(mouseHideTimer.current);
      }
      
      // 设置新的定时器，2秒后隐藏关闭按钮
      mouseHideTimer.current = setTimeout(() => {
        setShowCloseButton(false);
      }, 2000);
    };

    const handleMouseLeave = () => {
      setShowCloseButton(false);
      if (mouseHideTimer.current) {
        clearTimeout(mouseHideTimer.current);
      }
    };

    // 添加事件监听器
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);

    // 初始显示关闭按钮
    setShowCloseButton(true);
    mouseHideTimer.current = setTimeout(() => {
      setShowCloseButton(false);
    }, 2000);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      if (mouseHideTimer.current) {
        clearTimeout(mouseHideTimer.current);
      }
    };
  }, [isOpen]);

  // 处理滑动
  const handleSwipe = useCallback(() => {
    const swipeThreshold = 50; // 最小滑动距离
    const diff = touchStartX.current - touchEndX.current;

    if (Math.abs(diff) > swipeThreshold) {
      if (diff > 0) {
        // 左滑，下一页
        navigateToNextPage();
      } else {
        // 右滑，上一页
        navigateToPreviousPage();
      }
    }
  }, [navigateToNextPage, navigateToPreviousPage]);

  // 处理触摸开始
  const handleTouchStart = useCallback((e) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  // 处理触摸结束
  const handleTouchEnd = useCallback((e) => {
    touchEndX.current = e.changedTouches[0].clientX;
    handleSwipe();
  }, [handleSwipe]);

  // 处理图片加载状态
  const handleImageLoad = useCallback((pageIndex) => {
    setImageLoadingStates(prev => ({ ...prev, [pageIndex]: 'loaded' }));
  }, []);

  const handleImageError = useCallback((pageIndex) => {
    setImageLoadingStates(prev => ({ ...prev, [pageIndex]: 'error' }));
  }, []);

  const handleImageLoadStart = useCallback((pageIndex) => {
    setImageLoadingStates(prev => ({ ...prev, [pageIndex]: 'loading' }));
  }, []);

  if (!isOpen) return null;

  // 生成页面标题
  const pageTitle = `${pageNumber || currentPageIndex + 1}. ${title || '暂无标题'}`;

  return (
    <div 
      className="image-viewer-overlay" 
      onClick={handleOverlayClick}
      ref={viewerRef}
      tabIndex={-1}
    >
      <div 
        className="image-viewer-container" 
        ref={containerRef} 
        onDoubleClick={handleDoubleClick}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* 头部标题 */}
        <div className="viewer-header">
          <h2 className="page-title">{pageTitle}</h2>
          <button 
            className={`close-button ${showCloseButton ? 'show' : ''}`}
            onClick={onClose}
            title="关闭 (ESC)"
          >
            ×
          </button>
        </div>

        {/* 导航按钮 */}
        {currentPageIndex > 0 && (
          <button 
            className="nav-button nav-button-prev" 
            onClick={navigateToPreviousPage}
            title="上一页 (←)"
          >
            ‹
          </button>
        )}
        {currentPageIndex < pages.length - 1 && (
          <button 
            className="nav-button nav-button-next" 
            onClick={navigateToNextPage}
            title="下一页 (→)"
          >
            ›
          </button>
        )}

        {/* 内容区域 */}
        <div className={`viewer-content ${isLandscape() ? 'landscape' : 'portrait'}`}>
          {isLandscape() ? (
            // 横向布局：上中下结构
            <>
              <div className="image-container">
                {!image ? (
                  <div className="no-image">
                    <p>暂无图片</p>
                    <p className="image-prompt">{imagePrompt || '等待生成图片'}</p>
                  </div>
                ) : (
                  <div className="image-wrapper">
                    {imageLoadingStates[currentPageIndex] === 'loading' && (
                      <div className="image-loading">
                        <div className="loading-spinner"></div>
                        <p>图片加载中...</p>
                      </div>
                    )}
                    <img
                      src={image}
                      alt={pageTitle}
                      loading="lazy"
                      onLoadStart={() => handleImageLoadStart(currentPageIndex)}
                      onLoad={() => handleImageLoad(currentPageIndex)}
                      onError={() => handleImageError(currentPageIndex)}
                      style={{ 
                        opacity: imageLoadingStates[currentPageIndex] === 'loaded' ? 1 : 0.3 
                      }}
                    />
                    {imageLoadingStates[currentPageIndex] === 'error' && (
                      <div className="image-error">
                        <p>图片加载失败</p>
                        <p className="image-prompt">{imagePrompt || '请重试'}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="text-container">
                <p className="story-text">{text || '暂无文本'}</p>
              </div>
            </>
          ) : (
            // 纵向布局：左右结构
            <>
              <div className="text-panel">
                <p className="story-text">{text || '暂无文本'}</p>
              </div>
              <div className="image-panel">
                {!image ? (
                  <div className="no-image">
                    <p>暂无图片</p>
                    <p className="image-prompt">{imagePrompt || '等待生成图片'}</p>
                  </div>
                ) : (
                  <div className="image-wrapper">
                    {imageLoadingStates[currentPageIndex] === 'loading' && (
                      <div className="image-loading">
                        <div className="loading-spinner"></div>
                        <p>图片加载中...</p>
                      </div>
                    )}
                    <img
                      src={image}
                      alt={pageTitle}
                      loading="lazy"
                      onLoadStart={() => handleImageLoadStart(currentPageIndex)}
                      onLoad={() => handleImageLoad(currentPageIndex)}
                      onError={() => handleImageError(currentPageIndex)}
                      style={{ 
                        opacity: imageLoadingStates[currentPageIndex] === 'loaded' ? 1 : 0.3 
                      }}
                    />
                    {imageLoadingStates[currentPageIndex] === 'error' && (
                      <div className="image-error">
                        <p>图片加载失败</p>
                        <p className="image-prompt">{imagePrompt || '请重试'}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
}

export default ImageViewer;