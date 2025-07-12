# 图像查看器重构设计文档

## 1. 概述

本文档描述Tale Draw图像查看器的重构设计，旨在提供更优雅的查看体验，通过智能布局和键盘导航增强用户交互。

## 2. 设计目标

- **简化界面**：移除冗余按钮，利用系统原生功能
- **智能布局**：根据图片宽高比自动调整布局
- **增强导航**：支持键盘快捷键翻页
- **完整展示**：同时展示图片、标题和文本内容

## 3. 功能设计

### 3.1 界面简化

**移除的元素：**
- Save按钮：用户可通过右键菜单保存图片
- Close按钮：用户可通过ESC键或窗口关闭按钮退出

**保留的交互：**
- ESC键关闭查看器
- 点击背景遮罩关闭查看器

### 3.2 智能布局系统

#### 横向图片布局（宽高比 > 1）
适用于：16:9、4:3等横向图片

```
┌─────────────────────────────────────┐
│          页面标题（居中）              │
├─────────────────────────────────────┤
│                                     │
│         图片展示区域                  │
│        （居中，保持比例）              │
│                                     │
├─────────────────────────────────────┤
│         页面文本内容                  │
│       （底部，居中对齐）               │
└─────────────────────────────────────┘
```

#### 纵向图片布局（宽高比 ≤ 1）
适用于：1:1、9:16、3:4等纵向图片

```
┌─────────────────────────────────────┐
│          页面标题（居中）              │
├──────────────┬──────────────────────┤
│              │                      │
│   页面文本    │                      │
│   （左侧）    │     图片展示区域       │
│              │   （右侧，保持比例）    │
│              │                      │
└──────────────┴──────────────────────┘
```

### 3.3 键盘导航

- **左箭头键 (←)**：查看上一页
- **右箭头键 (→)**：查看下一页
- **ESC键**：关闭查看器
- **空格键**：查看下一页（可选）

### 3.4 边界处理

- 在第一页时按左箭头：无响应或显示提示
- 在最后一页时按右箭头：无响应或显示提示

## 4. 技术实现

### 4.1 组件结构

```jsx
<ImageViewer>
  <Overlay onClick={handleClose} />
  <ViewerContainer>
    <Header>
      <PageTitle>{currentPage.title || `第${pageNumber}页`}</PageTitle>
    </Header>
    
    {isLandscape ? (
      <LandscapeLayout>
        <ImageContainer>
          <StoryImage src={imageUrl} alt={title} />
        </ImageContainer>
        <TextContainer>
          <StoryText>{currentPage.text}</StoryText>
        </TextContainer>
      </LandscapeLayout>
    ) : (
      <PortraitLayout>
        <TextPanel>
          <StoryText>{currentPage.text}</StoryText>
        </TextPanel>
        <ImagePanel>
          <StoryImage src={imageUrl} alt={title} />
        </ImagePanel>
      </PortraitLayout>
    )}
  </ViewerContainer>
</ImageViewer>
```

### 4.2 宽高比判断逻辑

```javascript
const determineLayout = (aspectRatio) => {
  // 解析宽高比字符串，如 "16:9" -> 16/9 = 1.78
  const [width, height] = aspectRatio.split(':').map(Number);
  const ratio = width / height;
  
  // 比例大于1为横向，否则为纵向
  return ratio > 1 ? 'landscape' : 'portrait';
};
```

### 4.3 键盘事件处理

```javascript
useEffect(() => {
  const handleKeyPress = (event) => {
    switch(event.key) {
      case 'ArrowLeft':
        if (currentPageIndex > 0) {
          navigateToPage(currentPageIndex - 1);
        }
        break;
      case 'ArrowRight':
        if (currentPageIndex < totalPages - 1) {
          navigateToPage(currentPageIndex + 1);
        }
        break;
      case 'Escape':
        closeViewer();
        break;
    }
  };

  window.addEventListener('keydown', handleKeyPress);
  return () => window.removeEventListener('keydown', handleKeyPress);
}, [currentPageIndex, totalPages]);
```

## 5. 样式设计

### 5.1 响应式设计原则

- 图片始终保持原始宽高比
- 文本区域自适应剩余空间
- 移动端优先，支持触摸滑动

### 5.2 样式细节

```css
/* 横向布局样式 */
.landscape-layout {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.landscape-layout .image-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.landscape-layout .text-container {
  padding: 20px;
  max-height: 25%;
  overflow-y: auto;
  background: rgba(0, 0, 0, 0.05);
}

/* 纵向布局样式 */
.portrait-layout {
  display: flex;
  height: calc(100% - 60px); /* 减去标题高度 */
}

.portrait-layout .text-panel {
  width: 35%;
  padding: 20px;
  overflow-y: auto;
  background: rgba(0, 0, 0, 0.02);
}

.portrait-layout .image-panel {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
```

## 6. 动画和过渡

### 6.1 页面切换动画

- 淡入淡出效果
- 滑动过渡（可选）
- 加载状态指示

### 6.2 响应动画

```css
.page-transition {
  transition: opacity 0.3s ease-in-out;
}

.page-enter {
  opacity: 0;
}

.page-enter-active {
  opacity: 1;
}
```

## 7. 可访问性

- 支持键盘导航
- ARIA标签支持
- 焦点管理
- 屏幕阅读器友好

## 8. 边缘情况处理

### 8.1 图片加载失败
- 显示占位图或错误提示
- 保持布局稳定

### 8.2 超长文本
- 文本区域可滚动
- 保持良好的阅读体验

### 8.3 极端宽高比
- 设置最大/最小显示尺寸
- 确保内容始终可见

## 9. 性能优化

### 9.1 图片缓存机制
- **浏览器缓存**：利用HTTP缓存头确保图片不重复下载
- **内存缓存**：使用Map或WeakMap存储已加载的图片
- **预加载策略**：预加载当前页的前后各一页图片
- **缓存管理**：合理控制缓存大小，避免内存溢出

### 9.2 缓存实现
```javascript
// 图片缓存管理器
class ImageCache {
  constructor(maxSize = 50) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }
  
  get(url) {
    return this.cache.get(url);
  }
  
  set(url, image) {
    // LRU策略：超过最大缓存时删除最早的
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(url, image);
  }
  
  preload(urls) {
    urls.forEach(url => {
      if (!this.cache.has(url)) {
        const img = new Image();
        img.src = url;
        img.onload = () => this.set(url, img);
      }
    });
  }
}
```

### 9.3 其他优化
- 图片懒加载
- 内存管理（清理不可见页面）
- 使用适当的图片格式和尺寸

## 10. 未来扩展

- 支持手势操作（移动端）
- 图片缩放功能
- 阅读进度指示器
- 分享功能集成

## 11. 实现优先级

1. **P0 - 核心功能**
   - 移除Save/Close按钮
   - 实现智能布局
   - 键盘导航

2. **P1 - 体验优化**
   - 页面切换动画
   - 加载状态
   - 边界提示

3. **P2 - 扩展功能**
   - 触摸手势
   - 图片缩放
   - 进度指示