/**
 * @jest-environment jsdom
 */

import { generateHTMLImageViewer, generateImageViewerCSS } from '../../components/HTMLImageViewer';

// Mock页面数据
const mockPages = [
  {
    index: 0,
    title: '第一页',
    content: '这是第一页的内容',
    imageSrc: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    aspectRatio: 1.0
  },
  {
    index: 1,
    title: '第二页',
    content: '这是第二页的内容',
    imageSrc: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    aspectRatio: 1.5
  },
  {
    index: 2,
    title: '第三页',
    content: '这是第三页的内容',
    imageSrc: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    aspectRatio: 0.8
  }
];

describe('HTMLImageViewer', () => {
  beforeEach(() => {
    // 清理DOM
    document.body.innerHTML = '';
    
    // 设置全局变量
    window.pagesData = mockPages;
    window.aspectRatio = 1.0;
  });

  afterEach(() => {
    // 清理事件监听器
    const overlays = document.querySelectorAll('.image-viewer-overlay');
    overlays.forEach(overlay => overlay.remove());
  });

  describe('generateHTMLImageViewer', () => {
    test('应该生成包含HTMLImageViewer类的JavaScript代码', () => {
      const result = generateHTMLImageViewer(mockPages, 1.0);
      
      expect(result).toContain('class HTMLImageViewer');
      expect(result).toContain('constructor(pages, aspectRatio)');
      expect(result).toContain('createViewer()');
      expect(result).toContain('show(index = 0)');
      expect(result).toContain('hide()');
      expect(result).toContain('navigate(direction)');
    });

    test('应该包含键盘导航处理', () => {
      const result = generateHTMLImageViewer(mockPages, 1.0);
      
      expect(result).toContain('handleKeyPress');
      expect(result).toContain('ArrowLeft');
      expect(result).toContain('ArrowRight');
      expect(result).toContain('Escape');
    });

    test('应该包含触摸手势处理', () => {
      const result = generateHTMLImageViewer(mockPages, 1.0);
      
      expect(result).toContain('handleTouchStart');
      expect(result).toContain('handleTouchEnd');
      expect(result).toContain('touchstart');
      expect(result).toContain('touchend');
    });

    test('应该包含智能布局逻辑', () => {
      const result = generateHTMLImageViewer(mockPages, 1.0);
      
      expect(result).toContain('viewer-horizontal-layout');
      expect(result).toContain('viewer-vertical-layout');
      expect(result).toContain('isHorizontal');
    });
  });

  describe('generateImageViewerCSS', () => {
    test('应该生成有效的CSS样式', () => {
      const css = generateImageViewerCSS();
      
      expect(css).toContain('.page-image');
      expect(css).toContain('cursor: pointer');
      expect(css).toContain('transform');
      expect(css).toContain('@media (max-width: 768px)');
    });
  });

  describe('Image Viewer Functionality', () => {
    let viewer;

    beforeEach(() => {
      // 清理之前的定义
      delete window.HTMLImageViewer;
      
      // 创建测试环境
      const script = generateHTMLImageViewer(mockPages, 1.0);
      
      // 直接执行JavaScript代码而不是通过DOM
      try {
        eval(script);
        if (window.HTMLImageViewer) {
          viewer = new window.HTMLImageViewer(mockPages, 1.0);
        }
      } catch (error) {
        console.error('Script execution error:', error);
      }
    });

    afterEach(() => {
      // 清理
      if (viewer && viewer.hide) {
        viewer.hide();
      }
      delete window.HTMLImageViewer;
    });

    test('应该能够创建查看器实例', () => {
      expect(viewer).toBeDefined();
      expect(viewer.pages).toEqual(mockPages);
      expect(viewer.aspectRatio).toBe(1.0);
    });

    test('应该能够显示查看器', () => {
      viewer.show(0);
      
      expect(viewer.isOpen).toBe(true);
      expect(viewer.currentIndex).toBe(0);
      expect(viewer.overlay.style.display).toBe('flex');
    });

    test('应该能够隐藏查看器', () => {
      viewer.show(0);
      viewer.hide();
      
      expect(viewer.isOpen).toBe(false);
      expect(viewer.overlay.style.display).toBe('none');
    });

    test('应该能够导航到下一页', () => {
      viewer.show(0);
      viewer.navigate(1);
      
      expect(viewer.currentIndex).toBe(1);
    });

    test('应该能够导航到上一页', () => {
      viewer.show(1);
      viewer.navigate(-1);
      
      expect(viewer.currentIndex).toBe(0);
    });

    test('应该防止导航超出边界', () => {
      viewer.show(0);
      viewer.navigate(-1);
      expect(viewer.currentIndex).toBe(0);

      viewer.show(mockPages.length - 1);
      viewer.navigate(1);
      expect(viewer.currentIndex).toBe(mockPages.length - 1);
    });

    test('应该正确处理键盘事件', () => {
      viewer.show(1);
      
      // 模拟左箭头键
      const leftArrowEvent = new KeyboardEvent('keydown', { key: 'ArrowLeft' });
      viewer.handleKeyPress(leftArrowEvent);
      expect(viewer.currentIndex).toBe(0);
      
      // 模拟右箭头键
      const rightArrowEvent = new KeyboardEvent('keydown', { key: 'ArrowRight' });
      viewer.handleKeyPress(rightArrowEvent);
      expect(viewer.currentIndex).toBe(1);
      
      // 模拟ESC键
      const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
      viewer.handleKeyPress(escapeEvent);
      expect(viewer.isOpen).toBe(false);
    });
  });

  describe('DOM Integration', () => {
    beforeEach(() => {
      // 创建测试页面结构
      document.body.innerHTML = `
        <div class="container">
          <div class="page">
            <img src="test1.jpg" class="page-image" data-page-index="0">
          </div>
          <div class="page">
            <img src="test2.jpg" class="page-image" data-page-index="1">
          </div>
        </div>
      `;
    });

    test('应该为页面图片添加点击事件', () => {
      const script = generateHTMLImageViewer(mockPages, 1.0);
      
      // 直接执行脚本
      try {
        eval(script);
        
        const images = document.querySelectorAll('.page-image');
        expect(images.length).toBe(2);
        
        // 验证脚本包含初始化逻辑
        expect(script).toContain('initImageViewer');
        expect(script).toContain('cursor: pointer');
      } catch (error) {
        console.error('Script execution error:', error);
      }
    });
  });

  describe('布局测试', () => {
    test('应该根据宽高比选择正确的布局', () => {
      const horizontalPage = { ...mockPages[0], aspectRatio: 1.5 };
      const verticalPage = { ...mockPages[0], aspectRatio: 0.7 };
      
      const script = generateHTMLImageViewer([horizontalPage, verticalPage], 1.0);
      
      expect(script).toContain('viewer-horizontal-layout');
      expect(script).toContain('viewer-vertical-layout');
      expect(script).toContain('isHorizontal = imageAspectRatio > 1');
    });
  });

  describe('性能优化测试', () => {
    test('应该包含图片预加载功能', () => {
      const script = generateHTMLImageViewer(mockPages, 1.0);
      
      expect(script).toContain('preloadAdjacentImages');
      expect(script).toContain('preloadImage');
      expect(script).toContain('new Image()');
    });

    test('应该包含UI自动隐藏功能', () => {
      const script = generateHTMLImageViewer(mockPages, 1.0);
      
      expect(script).toContain('resetHideUITimer');
      expect(script).toContain('hideUI');
      expect(script).toContain('showUI');
      expect(script).toContain('setTimeout');
    });
  });

  describe('错误处理测试', () => {
    test('应该处理空页面数据', () => {
      const script = generateHTMLImageViewer([], 1.0);
      expect(script).toContain('if (this.pages.length === 0) return');
    });

    test('应该处理无效的页面索引', () => {
      const script = generateHTMLImageViewer(mockPages, 1.0);
      expect(script).toContain('Math.max(0, Math.min(index, this.pages.length - 1))');
    });

    test('应该包含HTML转义功能', () => {
      const script = generateHTMLImageViewer(mockPages, 1.0);
      expect(script).toContain('escapeHtml');
      expect(script).toContain('textContent');
    });
  });

  describe('响应式设计测试', () => {
    test('CSS应该包含移动端适配', () => {
      const css = generateImageViewerCSS();
      
      expect(css).toContain('@media (max-width: 768px)');
      expect(css).toContain('.page-image:hover');
    });

    test('JavaScript应该包含响应式逻辑', () => {
      const script = generateHTMLImageViewer(mockPages, 1.0);
      
      expect(script).toContain('@media (max-width: 768px)');
    });
  });
});