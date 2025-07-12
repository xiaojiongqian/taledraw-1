/**
 * HTML Image Viewer - 用于生成HTML中的图像查看器
 * 这个模块生成可嵌入到导出HTML中的JavaScript代码
 */

export const generateHTMLImageViewer = (pages, aspectRatio = 1.0) => {
  const viewerJS = `
class HTMLImageViewer {
  constructor(pages, aspectRatio) {
    this.pages = pages || [];
    this.aspectRatio = aspectRatio || 1.0;
    this.currentIndex = 0;
    this.isOpen = false;
    this.isFullscreen = false;
    this.hideUITimer = null;
    this.touchStartX = 0;
    this.touchStartY = 0;
    
    // 图片缓存管理
    this.imageCache = new Map();
    this.maxCacheSize = 20;
    
    // 创建查看器DOM结构
    this.createViewer();
    this.bindEvents();
  }

  createViewer() {
    // 创建主容器
    this.overlay = document.createElement('div');
    this.overlay.className = 'image-viewer-overlay';
    this.overlay.style.cssText = \`
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.95);
      z-index: 9999;
      display: none;
      flex-direction: column;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
      overflow: hidden;
    \`;

    // 关闭按钮
    this.closeButton = document.createElement('button');
    this.closeButton.innerHTML = '×';
    this.closeButton.className = 'viewer-close-button';
    this.closeButton.style.cssText = \`
      position: absolute;
      top: 20px;
      right: 20px;
      background: rgba(255, 255, 255, 0.2);
      border: none;
      color: white;
      font-size: 30px;
      width: 50px;
      height: 50px;
      border-radius: 50%;
      cursor: pointer;
      z-index: 10001;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      justify-content: center;
    \`;

    // 导航按钮样式
    const navButtonStyle = \`
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      background: rgba(255, 255, 255, 0.2);
      border: none;
      color: white;
      font-size: 24px;
      width: 50px;
      height: 50px;
      border-radius: 50%;
      cursor: pointer;
      z-index: 10001;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      justify-content: center;
    \`;

    // 上一页按钮
    this.prevButton = document.createElement('button');
    this.prevButton.innerHTML = '‹';
    this.prevButton.className = 'viewer-nav-button viewer-prev-button';
    this.prevButton.style.cssText = navButtonStyle + 'left: 20px;';

    // 下一页按钮
    this.nextButton = document.createElement('button');
    this.nextButton.innerHTML = '›';
    this.nextButton.className = 'viewer-nav-button viewer-next-button';
    this.nextButton.style.cssText = navButtonStyle + 'right: 20px;';

    // 内容容器
    this.contentContainer = document.createElement('div');
    this.contentContainer.className = 'viewer-content';
    this.contentContainer.style.cssText = \`
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 80px 80px 20px 80px;
      box-sizing: border-box;
    \`;

    // 页面内容
    this.pageContent = document.createElement('div');
    this.pageContent.className = 'viewer-page-content';
    this.pageContent.style.cssText = \`
      max-width: 100%;
      max-height: 100%;
      text-align: center;
      color: white;
    \`;

    // 组装DOM结构
    this.contentContainer.appendChild(this.pageContent);
    this.overlay.appendChild(this.closeButton);
    this.overlay.appendChild(this.prevButton);
    this.overlay.appendChild(this.nextButton);
    this.overlay.appendChild(this.contentContainer);

    // 添加到页面
    document.body.appendChild(this.overlay);

    // 添加CSS样式
    this.addViewerStyles();
  }

  addViewerStyles() {
    const style = document.createElement('style');
    style.textContent = \`
      .image-viewer-overlay {
        animation: fadeIn 0.3s ease-out;
      }

      .viewer-close-button:hover,
      .viewer-nav-button:hover {
        background: rgba(255, 255, 255, 0.4) !important;
        transform: scale(1.1);
      }

      .viewer-close-button:hover {
        transform: scale(1.1);
      }

      .viewer-nav-button:hover {
        transform: translateY(-50%) scale(1.1) !important;
      }

      .viewer-page-content img {
        max-width: 100%;
        max-height: 70vh;
        object-fit: contain;
        border-radius: 8px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        transition: opacity 0.3s ease;
      }

      .viewer-page-title {
        font-size: 2rem;
        font-weight: bold;
        margin-bottom: 1.5rem;
        text-align: left;
      }

      .viewer-page-text {
        font-size: 1.8rem;
        line-height: 1.6;
        margin-top: 1.5rem;
        text-align: left;
      }

      .viewer-horizontal-layout {
        display: flex;
        flex-direction: column;
        align-items: center;
        max-width: 1200px;
        margin: 0 auto;
      }

      .viewer-vertical-layout {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 3rem;
        align-items: center;
        max-width: 1400px;
        margin: 0 auto;
      }

      .viewer-text-content {
        order: 1;
      }

      .viewer-image-content {
        order: 2;
      }

      @media (max-width: 768px) {
        .viewer-content {
          padding: 60px 20px 20px 20px !important;
        }

        .viewer-vertical-layout {
          grid-template-columns: 1fr !important;
          gap: 1.5rem !important;
        }

        .viewer-page-title {
          font-size: 1.5rem !important;
        }

        .viewer-page-text {
          font-size: 1.2rem !important;
        }

        .viewer-nav-button {
          width: 40px !important;
          height: 40px !important;
          font-size: 18px !important;
        }

        .viewer-close-button {
          width: 40px !important;
          height: 40px !important;
          font-size: 24px !important;
        }
      }

      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      .viewer-ui-hidden .viewer-close-button,
      .viewer-ui-hidden .viewer-nav-button {
        opacity: 0;
        pointer-events: none;
      }
    \`;
    document.head.appendChild(style);
  }

  bindEvents() {
    // 关闭按钮
    this.closeButton.addEventListener('click', () => this.hide());

    // 导航按钮
    this.prevButton.addEventListener('click', () => this.navigate(-1));
    this.nextButton.addEventListener('click', () => this.navigate(1));

    // 键盘事件
    this.handleKeyPress = this.handleKeyPress.bind(this);
    
    // 触摸事件
    this.handleTouchStart = this.handleTouchStart.bind(this);
    this.handleTouchEnd = this.handleTouchEnd.bind(this);

    // 鼠标移动事件（用于自动隐藏UI）
    this.handleMouseMove = this.handleMouseMove.bind(this);

    // 点击背景关闭
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay || e.target === this.contentContainer) {
        this.hide();
      }
    });
  }

  show(index = 0) {
    if (this.pages.length === 0) return;
    
    this.currentIndex = Math.max(0, Math.min(index, this.pages.length - 1));
    this.isOpen = true;
    
    this.overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    
    // 尝试进入全屏模式
    this.enterFullscreen();
    
    // 添加事件监听
    document.addEventListener('keydown', this.handleKeyPress);
    this.overlay.addEventListener('touchstart', this.handleTouchStart, { passive: true });
    this.overlay.addEventListener('touchend', this.handleTouchEnd, { passive: true });
    this.overlay.addEventListener('mousemove', this.handleMouseMove);
    
    this.updatePage();
    this.resetHideUITimer();
  }

  hide() {
    this.isOpen = false;
    
    // 先退出全屏，再隐藏overlay
    if (document.fullscreenElement) {
      this.exitFullscreen();
      // 给一个短暂延迟确保全屏退出完成
      setTimeout(() => {
        this.overlay.style.display = 'none';
        document.body.style.overflow = '';
      }, 100);
    } else {
      this.overlay.style.display = 'none';
      document.body.style.overflow = '';
    }
    
    // 移除事件监听
    document.removeEventListener('keydown', this.handleKeyPress);
    this.overlay.removeEventListener('touchstart', this.handleTouchStart);
    this.overlay.removeEventListener('touchend', this.handleTouchEnd);
    this.overlay.removeEventListener('mousemove', this.handleMouseMove);
    
    this.clearHideUITimer();
  }

  navigate(direction) {
    const newIndex = this.currentIndex + direction;
    if (newIndex >= 0 && newIndex < this.pages.length) {
      this.currentIndex = newIndex;
      this.updatePage();
      this.resetHideUITimer();
    }
  }

  updatePage() {
    const page = this.pages[this.currentIndex];
    if (!page) return;

    const imageAspectRatio = page.aspectRatio || this.aspectRatio;
    const isHorizontal = imageAspectRatio > 1;

    // 决定布局
    const layoutClass = isHorizontal ? 'viewer-horizontal-layout' : 'viewer-vertical-layout';
    
    // 构建页面内容
    const title = page.title ? \`\${this.currentIndex + 1}. \${page.title}\` : \`\${this.currentIndex + 1}.\`;
    
    this.pageContent.innerHTML = \`
      <div class="\${layoutClass}">
        \${isHorizontal ? \`
          <div class="viewer-image-content">
            <img src="\${page.imageSrc}" alt="Page \${this.currentIndex + 1}" loading="lazy">
          </div>
          <div class="viewer-text-content">
            <h2 class="viewer-page-title">\${this.escapeHtml(title)}</h2>
            <div class="viewer-page-text">\${this.escapeHtml(page.content || '')}</div>
          </div>
        \` : \`
          <div class="viewer-text-content">
            <h2 class="viewer-page-title">\${this.escapeHtml(title)}</h2>
            <div class="viewer-page-text">\${this.escapeHtml(page.content || '')}</div>
          </div>
          <div class="viewer-image-content">
            <img src="\${page.imageSrc}" alt="Page \${this.currentIndex + 1}" loading="lazy">
          </div>
        \`}
      </div>
    \`;

    // 更新导航按钮状态
    this.prevButton.style.display = this.currentIndex > 0 ? 'flex' : 'none';
    this.nextButton.style.display = this.currentIndex < this.pages.length - 1 ? 'flex' : 'none';

    // 预加载相邻图片
    this.preloadAdjacentImages();
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  preloadAdjacentImages() {
    // 预加载当前页（确保显示快速）
    this.preloadImage(this.currentIndex);
    
    // 预加载前一页
    if (this.currentIndex > 0) {
      this.preloadImage(this.currentIndex - 1);
    }
    // 预加载后一页
    if (this.currentIndex < this.pages.length - 1) {
      this.preloadImage(this.currentIndex + 1);
    }
  }

  preloadImage(index) {
    if (index >= 0 && index < this.pages.length) {
      const url = this.pages[index].imageSrc;
      if (!url || this.imageCache.has(url)) return;
      
      const img = new Image();
      img.onload = () => {
        this.imageCache.set(url, img);
        // 清理过多的缓存
        if (this.imageCache.size > this.maxCacheSize) {
          const firstKey = this.imageCache.keys().next().value;
          this.imageCache.delete(firstKey);
        }
      };
      img.onerror = () => {
        console.warn('HTML图片预加载失败:', url);
      };
      img.src = url;
    }
  }

  // 进入全屏模式
  enterFullscreen() {
    try {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen();
      } else if (document.documentElement.mozRequestFullScreen) {
        document.documentElement.mozRequestFullScreen();
      } else if (document.documentElement.webkitRequestFullscreen) {
        document.documentElement.webkitRequestFullscreen();
      } else if (document.documentElement.msRequestFullscreen) {
        document.documentElement.msRequestFullscreen();
      }
    } catch (err) {
      console.warn('无法进入全屏模式:', err);
    }
  }

  // 退出全屏模式
  exitFullscreen() {
    try {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
    } catch (err) {
      console.warn('无法退出全屏模式:', err);
    }
  }

  handleKeyPress(e) {
    switch(e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        this.navigate(-1);
        break;
      case 'ArrowRight':
        e.preventDefault();
        this.navigate(1);
        break;
      case 'Escape':
        e.preventDefault();
        this.hide();
        break;
    }
  }

  handleTouchStart(e) {
    this.touchStartX = e.touches[0].clientX;
    this.touchStartY = e.touches[0].clientY;
  }

  handleTouchEnd(e) {
    if (!this.touchStartX || !this.touchStartY) return;
    
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    
    const diffX = this.touchStartX - touchEndX;
    const diffY = this.touchStartY - touchEndY;
    
    // 确保是水平滑动且滑动距离足够
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
      if (diffX > 0) {
        this.navigate(1); // 向左滑动，下一页
      } else {
        this.navigate(-1); // 向右滑动，上一页
      }
    }
    
    this.touchStartX = 0;
    this.touchStartY = 0;
  }

  handleMouseMove() {
    this.resetHideUITimer();
  }

  resetHideUITimer() {
    this.clearHideUITimer();
    this.showUI();
    
    this.hideUITimer = setTimeout(() => {
      this.hideUI();
    }, 2000);
  }

  clearHideUITimer() {
    if (this.hideUITimer) {
      clearTimeout(this.hideUITimer);
      this.hideUITimer = null;
    }
  }

  showUI() {
    this.overlay.classList.remove('viewer-ui-hidden');
  }

  hideUI() {
    this.overlay.classList.add('viewer-ui-hidden');
  }
}

// 初始化函数
function initImageViewer() {
  if (typeof window.pagesData === 'undefined') {
    console.warn('Pages data not found');
    return;
  }

  const viewer = new HTMLImageViewer(window.pagesData, window.aspectRatio || 1.0);
  
  // 为所有图片添加点击事件
  document.querySelectorAll('img[data-page-index]').forEach((img) => {
    img.style.cursor = 'pointer';
    
    // 从data-page-index属性获取正确的页面索引
    const pageIndex = parseInt(img.getAttribute('data-page-index'), 10);
    
    img.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('Image clicked, page index:', pageIndex);
      viewer.show(pageIndex);
    });
  });
  
  // 将viewer暴露到全局，便于调试
  window.debugViewer = viewer;
  console.log('Image viewer initialized with', window.pagesData.length, 'pages');
}

// 页面加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initImageViewer);
} else {
  initImageViewer();
}
`;

  return viewerJS;
};

export const generateImageViewerCSS = () => {
  return `
    .page-image {
      transition: transform 0.2s ease;
    }
    
    .page-image:hover {
      transform: scale(1.02);
      cursor: pointer;
    }
    
    .page {
      position: relative;
    }
    
    @media (max-width: 768px) {
      .page-image:hover {
        transform: none;
      }
    }
  `;
};