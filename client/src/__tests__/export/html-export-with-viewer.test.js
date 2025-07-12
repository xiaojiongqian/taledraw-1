/**
 * @jest-environment jsdom
 */

import { generateHTMLImageViewer, generateImageViewerCSS } from '../../components/HTMLImageViewer';

// Mock数据
const mockPages = [
  {
    title: '小兔子的冒险',
    text: '从前有一只小兔子，它住在森林里。',
    image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    base64Image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    status: 'success',
    isEmbedded: true
  },
  {
    title: '遇见朋友',
    text: '小兔子在路上遇到了一只友善的小松鼠。',
    image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    base64Image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    status: 'success',
    isEmbedded: true
  }
];

const mockStoryTitle = '小兔子的故事';
const mockAspectRatio = 1.0;

describe('HTML Export with Image Viewer', () => {
  let htmlContent;

  beforeAll(() => {
    // 模拟HTML导出过程
    const cleanText = (text) => {
      if (!text) return '';
      return text.replace(/\uFFFD/g, '').replace(/[\x00-\x08\x0E-\x1F\x7F]/g, '').replace(/</g, "&lt;").replace(/>/g, "&gt;");
    };

    // 准备图像查看器数据
    const pagesData = mockPages.map((page, index) => ({
      index,
      title: page.title || '',
      content: page.text || '',
      imageSrc: page.base64Image || '',
      aspectRatio: mockAspectRatio
    }));

    // 生成图像查看器JavaScript代码
    const imageViewerJS = generateHTMLImageViewer(pagesData, mockAspectRatio);
    const imageViewerCSS = generateImageViewerCSS();

    htmlContent = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${cleanText(mockStoryTitle) || 'My Story Book'}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; background-color: #f0f2f5; color: #333; }
    .container { max-width: 800px; margin: auto; background: white; padding: 20px; box-shadow: 0 0 10px rgba(0,0,0,0.1); border-radius: 8px; }
    h1 { text-align: center; color: #444; }
    .page { margin-bottom: 40px; padding: 20px; border: 1px solid #ddd; border-radius: 8px; background: #fafafa; page-break-inside: avoid; }
    .page img { max-width: 100%; height: auto; display: block; margin: 0 auto 15px; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .page p { text-align: justify; font-size: 1.1em; white-space: pre-wrap; }
    .missing-image { text-align: center; color: #999; font-style: italic; background: #f5f5f5; padding: 20px; border-radius: 4px; margin: 0 auto 15px; }
    /* 图像查看器样式 */
    ${imageViewerCSS}
    @media print {
      body { padding: 0; background-color: #fff; }
      .container { box-shadow: none; border: none; padding: 0; }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>${cleanText(mockStoryTitle) || 'My Story Book'}</h1>
    ${mockPages.map((page, index) => `
      <div class="page">
        <h2>${page.title ? `${index + 1}. ${cleanText(page.title)}` : `${index + 1}.`}</h2>
        ${page.base64Image ? 
          `<img src="${page.base64Image}" alt="Page ${index + 1} illustration" loading="lazy" class="page-image" data-page-index="${index}">` : 
          `<div class="missing-image">Image not available</div>`
        }
        <p>${cleanText(page.text)}</p>
      </div>
    `).join('')}
  </div>

  <script>
    // 页面数据
    window.pagesData = ${JSON.stringify(pagesData)};
    window.aspectRatio = ${mockAspectRatio};
    
    // 图像查看器代码
    ${imageViewerJS}
  </script>
</body>
</html>`;
  });

  describe('HTML Structure', () => {
    test('应该生成有效的HTML文档结构', () => {
      expect(htmlContent).toContain('<!DOCTYPE html>');
      expect(htmlContent).toContain('<html lang="zh-CN">');
      expect(htmlContent).toContain('<head>');
      expect(htmlContent).toContain('<body>');
      expect(htmlContent).toContain('</html>');
    });

    test('应该包含正确的meta标签', () => {
      expect(htmlContent).toContain('<meta charset="UTF-8">');
      expect(htmlContent).toContain('<meta name="viewport" content="width=device-width, initial-scale=1.0">');
    });

    test('应该设置正确的标题', () => {
      expect(htmlContent).toContain(`<title>${mockStoryTitle}</title>`);
      expect(htmlContent).toContain(`<h1>${mockStoryTitle}</h1>`);
    });
  });

  describe('Page Content', () => {
    test('应该包含所有页面内容', () => {
      mockPages.forEach((page, index) => {
        expect(htmlContent).toContain(`${index + 1}. ${page.title}`);
        expect(htmlContent).toContain(page.text);
      });
    });

    test('应该为图片添加正确的类名和属性', () => {
      expect(htmlContent).toContain('class="page-image"');
      expect(htmlContent).toContain('data-page-index="0"');
      expect(htmlContent).toContain('data-page-index="1"');
      expect(htmlContent).toContain('loading="lazy"');
    });

    test('应该包含Base64图片数据', () => {
      mockPages.forEach(page => {
        if (page.base64Image) {
          expect(htmlContent).toContain(page.base64Image);
        }
      });
    });
  });

  describe('Image Viewer Integration', () => {
    test('应该包含图像查看器JavaScript代码', () => {
      expect(htmlContent).toContain('class HTMLImageViewer');
      expect(htmlContent).toContain('window.pagesData');
      expect(htmlContent).toContain('window.aspectRatio');
    });

    test('应该包含图像查看器CSS样式', () => {
      expect(htmlContent).toContain('.page-image');
      expect(htmlContent).toContain('cursor: pointer');
    });

    test('应该包含页面数据JSON', () => {
      const expectedData = mockPages.map((page, index) => ({
        index,
        title: page.title || '',
        content: page.text || '',
        imageSrc: page.base64Image || '',
        aspectRatio: mockAspectRatio
      }));
      
      expect(htmlContent).toContain(JSON.stringify(expectedData));
    });
  });

  describe('CSS Styles', () => {
    test('应该包含基本页面样式', () => {
      expect(htmlContent).toContain('font-family: -apple-system');
      expect(htmlContent).toContain('.container');
      expect(htmlContent).toContain('.page');
    });

    test('应该包含响应式设计样式', () => {
      expect(htmlContent).toContain('@media print');
    });

    test('应该包含图像查看器样式', () => {
      expect(htmlContent).toContain('/* 图像查看器样式 */');
    });
  });

  describe('Functionality Tests', () => {
    beforeEach(() => {
      // 创建DOM环境
      document.body.innerHTML = htmlContent;
    });

    afterEach(() => {
      // 清理DOM
      document.body.innerHTML = '';
    });

    test('应该能够在浏览器中解析HTML', () => {
      const container = document.querySelector('.container');
      expect(container).toBeTruthy();
      
      const pages = document.querySelectorAll('.page');
      expect(pages).toHaveLength(mockPages.length);
      
      const images = document.querySelectorAll('.page-image');
      expect(images).toHaveLength(mockPages.length);
    });

    test('图片应该有正确的属性', () => {
      const images = document.querySelectorAll('.page-image');
      
      images.forEach((img, index) => {
        expect(img.getAttribute('data-page-index')).toBe(index.toString());
        expect(img.getAttribute('loading')).toBe('lazy');
        expect(img.getAttribute('src')).toContain('data:image/png;base64');
      });
    });

    test('应该设置全局变量', () => {
      const script = document.querySelector('script');
      expect(script.textContent).toContain('window.pagesData');
      expect(script.textContent).toContain('window.aspectRatio');
    });
  });

  describe('Accessibility', () => {
    test('应该包含正确的alt属性', () => {
      mockPages.forEach((_, index) => {
        expect(htmlContent).toContain(`alt="Page ${index + 1} illustration"`);
      });
    });

    test('应该有正确的语言属性', () => {
      expect(htmlContent).toContain('lang="zh-CN"');
    });
  });

  describe('Performance', () => {
    test('应该使用lazy loading', () => {
      expect(htmlContent).toContain('loading="lazy"');
    });

    test('文件大小应该合理', () => {
      const sizeInBytes = new Blob([htmlContent], { type: 'text/html' }).size;
      const sizeInKB = sizeInBytes / 1024;
      
      // 文件大小应该小于100KB（对于测试数据）
      expect(sizeInKB).toBeLessThan(100);
    });
  });

  describe('Security', () => {
    test('应该对用户输入进行HTML转义', () => {
      const maliciousInput = '<script>alert("xss")</script>';
      const cleanText = (text) => {
        if (!text) return '';
        return text.replace(/\uFFFD/g, '').replace(/[\x00-\x08\x0E-\x1F\x7F]/g, '').replace(/</g, "&lt;").replace(/>/g, "&gt;");
      };
      
      const cleaned = cleanText(maliciousInput);
      expect(cleaned).toBe('&lt;script&gt;alert("xss")&lt;/script&gt;');
    });

    test('HTML内容不应该包含未转义的脚本标签', () => {
      // 检查除了我们自己添加的script标签之外，不应该有其他脚本
      const scriptMatches = htmlContent.match(/<script>/g);
      expect(scriptMatches).toHaveLength(1); // 只有我们添加的那个
    });
  });

  describe('Cross-browser Compatibility', () => {
    test('应该使用标准的HTML5语法', () => {
      expect(htmlContent).toContain('<!DOCTYPE html>');
      expect(htmlContent).not.toContain('<!DOCTYPE HTML PUBLIC');
    });

    test('应该使用CSS3属性', () => {
      expect(htmlContent).toContain('border-radius');
      expect(htmlContent).toContain('box-shadow');
    });

    test('JavaScript应该使用现代但兼容的语法', () => {
      expect(htmlContent).toContain('class HTMLImageViewer');
      expect(htmlContent).toContain('addEventListener');
      expect(htmlContent).not.toContain('attachEvent'); // 避免IE8-特定语法
    });
  });
});