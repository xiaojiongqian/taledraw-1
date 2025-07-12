# HTML图像查看器设计文档

## 概述

本文档描述了在导出的HTML文件中实现图像全屏查看功能的设计方案。该功能将使用户在查看HTML格式的绘本时，能够通过点击图片进入沉浸式全屏模式，享受与应用内相同的阅读体验。

## 设计目标

1. **功能一致性**：确保HTML中的图像查看器与应用内的功能保持一致
2. **零依赖**：所有功能使用原生JavaScript实现，无需外部库
3. **离线可用**：导出的HTML文件应完全独立，支持离线查看
4. **跨浏览器兼容**：支持主流现代浏览器
5. **响应式设计**：适配桌面和移动设备

## 功能需求

### 核心功能
- 点击图片进入全屏查看模式
- 沉浸式黑色主题背景
- 智能布局（横向/纵向自适应）
- 键盘导航（方向键翻页，ESC退出）
- 触摸手势支持（移动端滑动）
- 图片预加载优化
- 自动隐藏UI元素

### 布局方案

#### 横向图片布局（宽高比 > 1）
```
┌─────────────────────────────────────┐
│    页面标题                          │
├─────────────────────────────────────┤
│         图片展示区域                  │
├─────────────────────────────────────┤
│         页面文本内容                  │
└─────────────────────────────────────┘
```

#### 纵向图片布局（宽高比 ≤ 1）
```
┌─────────────────────────────────────┐
│    页面标题                          │
├──────────────┬──────────────────────┤
│   页面文本    │     图片展示区域       │
└──────────────┴──────────────────────┘
```

## 技术实现方案

### 1. HTML结构生成

在导出HTML时，需要为每个页面的图片添加点击事件和必要的数据属性：

```html
<!-- 页面容器 -->
<div class="page-container" data-page-index="0">
  <img src="data:image/png;base64,..." 
       alt="页面1图片" 
       class="page-image clickable-image"
       data-page-index="0"
       data-aspect-ratio="1.0">
  <div class="page-content">
    <h3>页面标题</h3>
    <p>页面文本内容...</p>
  </div>
</div>
```

### 2. 图像查看器组件

创建一个独立的JavaScript模块，内嵌在HTML中：

```javascript
class ImageViewer {
  constructor(pages, aspectRatio) {
    this.pages = pages;
    this.aspectRatio = aspectRatio;
    this.currentIndex = 0;
    this.isFullscreen = false;
    this.hideUITimer = null;
    this.initViewer();
  }

  initViewer() {
    // 创建查看器DOM结构
    // 绑定事件监听器
    // 初始化键盘和触摸事件
  }

  show(index) {
    // 显示查看器
    // 加载当前页面
    // 预加载相邻页面
  }

  hide() {
    // 关闭查看器
    // 清理资源
  }

  navigate(direction) {
    // 实现翻页逻辑
  }

  // 其他方法...
}
```

### 3. 样式设计

使用内联CSS确保样式不依赖外部文件：

```css
/* 图像查看器样式 */
.image-viewer-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.95);
  z-index: 9999;
  display: flex;
  flex-direction: column;
}

/* 响应式布局 */
@media (max-width: 768px) {
  /* 移动端适配 */
}

/* 动画效果 */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

### 4. 事件处理

#### 图片点击事件
```javascript
document.querySelectorAll('.clickable-image').forEach(img => {
  img.addEventListener('click', (e) => {
    const pageIndex = parseInt(e.target.dataset.pageIndex);
    imageViewer.show(pageIndex);
  });
});
```

#### 键盘导航
```javascript
handleKeyPress(e) {
  switch(e.key) {
    case 'ArrowLeft':
      this.navigate(-1);
      break;
    case 'ArrowRight':
      this.navigate(1);
      break;
    case 'Escape':
      this.hide();
      break;
  }
}
```

#### 触摸手势
```javascript
handleTouchStart(e) {
  this.touchStartX = e.touches[0].clientX;
}

handleTouchEnd(e) {
  const touchEndX = e.changedTouches[0].clientX;
  const diff = this.touchStartX - touchEndX;
  
  if (Math.abs(diff) > 50) {
    this.navigate(diff > 0 ? 1 : -1);
  }
}
```

### 5. 性能优化

#### 图片预加载
```javascript
preloadImage(index) {
  if (index >= 0 && index < this.pages.length) {
    const img = new Image();
    img.src = this.pages[index].imageSrc;
  }
}

// 预加载前后页面
preloadAdjacentPages(currentIndex) {
  this.preloadImage(currentIndex - 1);
  this.preloadImage(currentIndex + 1);
}
```

#### 防抖和节流
```javascript
// 自动隐藏UI的防抖处理
resetHideUITimer() {
  clearTimeout(this.hideUITimer);
  this.showUI();
  
  this.hideUITimer = setTimeout(() => {
    this.hideUI();
  }, 2000);
}
```

## 集成方案

### 1. 修改HTML导出逻辑

在 `src/App.js` 的 `exportToHTML` 函数中：

1. 为图片添加必要的类名和数据属性
2. 将图像查看器的JavaScript代码内嵌到HTML中
3. 添加初始化脚本

### 2. 数据结构

将页面数据以JSON格式嵌入HTML：

```javascript
const pagesData = [
  {
    index: 0,
    title: "页面标题",
    content: "页面文本内容",
    imageSrc: "data:image/png;base64,...",
    aspectRatio: 1.0
  },
  // ...更多页面
];
```

### 3. 初始化脚本

```javascript
// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  // 创建图像查看器实例
  const viewer = new ImageViewer(pagesData, aspectRatio);
  
  // 绑定图片点击事件
  document.querySelectorAll('.clickable-image').forEach((img, index) => {
    img.addEventListener('click', () => viewer.show(index));
  });
});
```

## 测试计划

### 功能测试
1. 点击图片能否正确打开查看器
2. 键盘导航是否正常工作
3. 触摸手势是否响应正确
4. 关闭功能是否正常
5. 自动隐藏UI是否按预期工作

### 兼容性测试
1. Chrome/Edge (最新版本)
2. Firefox (最新版本)
3. Safari (最新版本)
4. 移动端浏览器（iOS Safari, Chrome Android）

### 性能测试
1. 大图片加载性能
2. 翻页流畅度
3. 内存使用情况

## 风险与挑战

1. **浏览器兼容性**：某些旧版浏览器可能不支持某些CSS属性或JavaScript特性
2. **移动端适配**：不同设备的触摸事件处理可能有差异
3. **文件大小**：内嵌JavaScript和CSS会增加HTML文件大小
4. **全屏API限制**：某些浏览器对全屏API有安全限制

## 实施步骤

1. **第一阶段**：实现基础图像查看器功能
   - 创建查看器UI结构
   - 实现显示/隐藏逻辑
   - 添加基本导航功能

2. **第二阶段**：添加交互功能
   - 实现键盘导航
   - 添加触摸手势支持
   - 实现自动隐藏UI

3. **第三阶段**：性能优化
   - 添加图片预加载
   - 优化动画效果
   - 测试和调试

4. **第四阶段**：集成到导出功能
   - 修改HTML导出逻辑
   - 测试导出的HTML文件
   - 修复发现的问题

## 总结

通过在导出的HTML中嵌入一个轻量级的图像查看器，我们可以为用户提供与应用内一致的阅读体验。该方案不依赖外部库，确保了离线可用性和文件的独立性。通过合理的设计和优化，可以在各种设备和浏览器上提供流畅的使用体验。