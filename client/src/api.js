import { GoogleGenerativeAI } from '@google/generative-ai';
import { getFunctions, httpsCallable } from 'firebase/functions';

// GCP项目ID和区域配置
// const PROJECT_ID = 'ai-app-taskforce';
// const LOCATION = 'us-central1';

// 初始化Gemini AI
const genAI = new GoogleGenerativeAI(process.env.REACT_APP_GEMINI_API_KEY);



// 从故事文本生成分页内容和图像提示词
async function generateStoryPages(storyText, pageCount = 10, aspectRatio = '16:9') {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

  // 根据长宽比优化构图提示
  const aspectRatioHints = {
    "16:9": "horizontal composition, landscape orientation, wide scene",
    "9:16": "vertical composition, portrait orientation, tall scene"
  };

  const prompt = `
请将以下故事分成适合儿童绘本的${pageCount}个页面。

要求：
- 总共生成${pageCount}页内容
- 每页包含简洁的文字内容（与输入故事语言保持一致）
- 每页包含详细的英文图像生成提示词
- 保持角色外观一致性
- 确保绘画风格统一（儿童绘本风格）
- 图像提示词应包含角色描述、场景细节、艺术风格
- 图像构图适配${aspectRatio}比例（${aspectRatioHints[aspectRatio]}）
- **重要：生成的文字内容必须与输入故事文本的语言保持完全一致**

故事内容：
${storyText}

请严格按照以下JSON格式返回，不要添加任何解释文字：

{
  "pages": [
    {
      "text": "页面文字内容（与输入故事语言一致）",
      "imagePrompt": "详细的英文图像生成提示词，包含${aspectRatioHints[aspectRatio]}构图要求"
    }
  ]
}
`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    console.log('Gemini原始响应:', text);
    
    // 多种方式提取JSON内容
    let jsonData = null;
    
    // 方法1: 寻找完整的JSON对象（包括嵌套的{}）
    const jsonMatch = text.match(/\{(?:[^{}]|{[^{}]*})*\}/g);
    if (jsonMatch && jsonMatch.length > 0) {
      for (const match of jsonMatch) {
        try {
          const parsed = JSON.parse(match);
          if (parsed.pages && Array.isArray(parsed.pages)) {
            jsonData = parsed;
            break;
          }
        } catch (e) {
          continue;
        }
      }
    }
    
    // 方法2: 寻找```json 代码块
    if (!jsonData) {
      const codeBlockMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/i);
      if (codeBlockMatch) {
        try {
          jsonData = JSON.parse(codeBlockMatch[1]);
        } catch (e) {
          console.warn('JSON代码块解析失败:', e);
        }
      }
    }
    
    // 方法3: 如果找不到有效JSON，尝试手动创建结构
    if (!jsonData || !jsonData.pages) {
      console.log('无法解析JSON，尝试从文本中提取内容...');
      return [
        {
          text: "抱歉，无法正确解析Gemini的响应。请尝试使用更简单的故事文本。",
          imagePrompt: "A simple children's book illustration showing an error message, friendly cartoon style"
        }
      ];
    }
    
    return jsonData.pages || [];
  } catch (error) {
    console.error('生成故事页面时出错:', error);
    throw error;
  }
}

// 生成占位符图像（暂时替代Imagen 4）
async function generatePlaceholderImage(prompt, pageIndex) {
  try {
    console.log(`为第${pageIndex + 1}页生成占位符图像...`);
    
    // 创建一个带有提示词的占位符图像URL
    // 使用picsum.photos服务生成随机图像作为演示
    const seed = prompt.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    
    const imageUrl = `https://picsum.photos/seed/${Math.abs(seed)}/400/300`;
    
    return imageUrl;
  } catch (error) {
    console.error(`生成第${pageIndex + 1}页占位符图像时出错:`, error);
    return `https://via.placeholder.com/400x300/87CEEB/000000?text=Page+${pageIndex + 1}`;
  }
}

// 重试辅助函数 - 指数退避算法
async function retryWithBackoff(asyncFn, maxRetries = 3, baseDelay = 1000) {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await asyncFn();
    } catch (error) {
      lastError = error;
      
      // 如果是最后一次尝试，直接抛出错误
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      // 检查是否应该重试（某些错误不值得重试）
      if (!shouldRetryError(error)) {
        throw lastError;
      }
      
      // 计算延迟时间（指数退避 + 随机抖动）
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
      console.log(`第${attempt + 1}次重试失败，${delay.toFixed(0)}ms后重试...`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

// 判断错误是否值得重试
function shouldRetryError(error) {
  // 不值得重试的错误类型
  const nonRetryableErrors = [
    'functions/unauthenticated',
    'functions/permission-denied',
    'functions/invalid-argument'
  ];
  
  // 如果是这些错误，不要重试
  if (nonRetryableErrors.includes(error.code)) {
    return false;
  }
  
  // 如果错误信息包含某些关键词，不要重试
  const nonRetryableMessages = [
    'quota exceeded',
    'authentication failed',
    'invalid credentials'
  ];
  
  const errorMessage = error.message ? error.message.toLowerCase() : '';
  if (nonRetryableMessages.some(msg => errorMessage.includes(msg))) {
    return false;
  }
  
  // 其他错误可以重试
  return true;
}

// 使用Imagen 4生成图像（通过Firebase Functions）- 增强版本带重试
async function generateImageWithImagen(prompt, pageIndex, aspectRatio = '16:9', maxRetries = 3) {
  const attemptGeneration = async () => {
    console.log(`正在使用Imagen 4生成第${pageIndex + 1}页图像（${aspectRatio}比例）...`);
    
    // 使用Firebase Functions调用Imagen 4
    const functions = getFunctions();
    const generateImage = httpsCallable(functions, 'generateImage');
    
    const enhancedPrompt = `Children's book illustration, cartoon style: ${prompt}. Vibrant colors, friendly characters, suitable for kids aged 3-8. Digital art, clean lines, no text.`;
    
    const result = await generateImage({
      prompt: enhancedPrompt,
      pageIndex: pageIndex,
      aspectRatio: aspectRatio,
      seed: 42 + pageIndex,
      maxRetries: 2 // 服务端也进行重试
    });
    
    if (result.data && result.data.success && result.data.imageUrl) {
      console.log(`第${pageIndex + 1}页图像生成成功`);
      return result.data.imageUrl;
    } else {
      console.error('Imagen 4 API返回错误:', result.data);
      throw new Error(result.data.error || 'Imagen 4 API返回了无效的响应');
    }
  };

  try {
    // 使用重试机制调用图像生成
    return await retryWithBackoff(attemptGeneration, maxRetries, 2000);
  } catch (error) {
    console.error(`生成第${pageIndex + 1}页图像时出错（已尝试${maxRetries + 1}次）:`, error);
    
    // 提供详细的错误信息
    if (error.code === 'functions/unauthenticated') {
      console.error('Firebase认证错误，请确保已登录');
    } else if (error.code === 'functions/permission-denied') {
      console.error('权限被拒绝，请检查Firebase规则');
    } else if (error.code === 'functions/internal') {
      console.error('服务器内部错误，已尝试多次重试');
    }
    
    // 只有在所有重试都失败后才回退到占位符图像
    console.log(`所有重试都失败，回退到占位符图像...`);
    return await generatePlaceholderImage(prompt, pageIndex);
  }
}



// 主要的故事生成函数
export async function generateTale(storyText, pageCount = 10, aspectRatio = '16:9', onProgress = null) {
  try {
    console.log(`开始生成${pageCount}页故事绘本（${aspectRatio}比例）...`);
    
    // 第一步：使用Gemini生成故事页面和图像提示词
    console.log('使用Gemini分析故事并生成页面...');
    if (onProgress) onProgress({ step: 'generating_pages', current: 0, total: pageCount + 1 });
    
    const storyPages = await generateStoryPages(storyText, pageCount, aspectRatio);
    
    if (!storyPages || storyPages.length === 0) {
      throw new Error('未能生成故事页面');
    }

    console.log(`生成了${storyPages.length}个故事页面`);
    if (onProgress) onProgress({ step: 'generating_images', current: 0, total: storyPages.length });

    // 第二步：为每个页面生成图像（串行处理以避免API限制）
    const pagesWithImages = [];
    let successCount = 0;
    let failureCount = 0;
    
    for (let index = 0; index < storyPages.length; index++) {
      const page = storyPages[index];
      console.log(`正在生成第${index + 1}页图像（${aspectRatio}比例）...`);
      
      try {
        // 使用增强的重试机制生成图像
        const imageUrl = await generateImageWithImagen(page.imagePrompt, index, aspectRatio, 3);
        
        // 检查是否是占位符图像（简单判断）
        const isPlaceholder = imageUrl.includes('placeholder') || imageUrl.includes('picsum');
        
        pagesWithImages.push({
          text: page.text,
          image: imageUrl,
          imagePrompt: page.imagePrompt,
          isPlaceholder: isPlaceholder,
          status: isPlaceholder ? 'fallback' : 'success'
        });
        
        if (isPlaceholder) {
          failureCount++;
          console.warn(`第${index + 1}页使用了占位符图像`);
        } else {
          successCount++;
          console.log(`第${index + 1}页图像生成成功`);
        }
        
      } catch (error) {
        console.error(`第${index + 1}页图像生成失败:`, error);
        failureCount++;
        
        // 即使出错也要提供基本的页面结构
        pagesWithImages.push({
          text: page.text,
          image: `https://via.placeholder.com/400x300/87CEEB/000000?text=Page+${index + 1}`,
          imagePrompt: page.imagePrompt,
          error: error.message,
          isPlaceholder: true,
          status: 'error'
        });
      }
      
      // 更新进度
      if (onProgress) {
        onProgress({ 
          step: 'generating_images', 
          current: index + 1, 
          total: storyPages.length,
          successCount,
          failureCount
        });
      }
      
      // 添加短暂延迟避免API限制
      if (index < storyPages.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log(`故事绘本生成完成！成功: ${successCount}, 失败: ${failureCount}`);
    
    // 返回结果包含统计信息
    return {
      pages: pagesWithImages,
      statistics: {
        totalPages: storyPages.length,
        successCount,
        failureCount,
        successRate: Math.round((successCount / storyPages.length) * 100)
      }
    };
    
  } catch (error) {
    console.error('生成故事绘本时出错:', error);
    throw new Error(`故事生成失败: ${error.message}`);
  }
}

