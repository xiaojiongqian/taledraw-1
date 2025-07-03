import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

// GCP项目ID和区域配置
// const PROJECT_ID = 'ai-app-taskforce';
// const LOCATION = 'us-central1';

// 现在所有AI服务都通过Firebase Functions访问Vertex AI



// 从故事文本生成分页内容和图像提示词（通过Firebase Functions）
async function generateStoryPages(storyText, pageCount = 6, aspectRatio = '16:9') {
  try {
    console.log('通过Firebase Functions生成故事页面...');
    
    // 初始化Firebase Functions
    const generateStoryPagesFunc = httpsCallable(functions, 'generateStoryPages');
    
    // 调用Firebase Function
    const result = await generateStoryPagesFunc({
      storyText: storyText,
      pageCount: pageCount,
      aspectRatio: aspectRatio
    });
    
    console.log('故事页面生成结果:', result.data);
    
    if (result.data.success && result.data.pages) {
      // 返回完整的故事信息，包括多角色场景数据和自动生成的标题
      return {
        storyTitle: result.data.storyTitle, // ✅ 添加缺失的标题字段
        pages: result.data.pages,
        mainCharacter: result.data.mainCharacter,
        characterType: result.data.characterType,
        artStyle: result.data.artStyle,
        allCharacters: result.data.allCharacters || {},
        storyAnalysis: result.data.storyAnalysis || {},
        pagePlanStrategy: result.data.pagePlanStrategy || {},
        aspectRatio: result.data.aspectRatio
      };
    } else {
      throw new Error('故事页面生成失败');
    }
    
  } catch (error) {
    console.error('生成故事页面时出错:', error);
    
    // 返回友好的错误信息
    return {
      pages: [
        {
          text: "抱歉，无法生成故事页面。请检查网络连接并重试。",
          imagePrompt: "A simple children's book illustration showing an error message, friendly cartoon style, no text, no words, no letters, no signs, no symbols"
        }
      ],
      mainCharacter: "通用角色",
      characterType: "抽象角色",
      artStyle: "儿童绘本插画风格",
      allCharacters: {}
    };
  }
}

// 移除了占位符图像生成函数

// 重试辅助函数 - 指数退避算法
async function retryWithBackoff(asyncFn, maxRetries = 3, baseDelay = 1000, onRetry = null) {
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
      
      // 调用重试回调
      if (onRetry) {
        onRetry(attempt + 1, error, delay);
      }
      
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

// 使用Imagen 3生成图像（通过Firebase Functions）- 智能多角色场景管理  
async function generateImageWithImagen(prompt, pageIndex, aspectRatio = '16:9', pageData = {}, allCharacters = {}, artStyle = '儿童绘本插画风格', onProgress = null) {
  const attemptGeneration = async () => {
    const { sceneCharacters = [], sceneType = '主角场景', mainCharacter = '' } = pageData;
    console.log(`Generating page ${pageIndex + 1} image - Scene: ${sceneType}, Characters: [${sceneCharacters.join(', ')}]`);
    
    // 使用Firebase Functions调用Imagen 3
    const generateImage = httpsCallable(functions, 'generateImage');
    
    // 智能构建基于场景的角色提示词
    let enhancedPrompt;
    
    if (sceneType === '无角色场景') {
      // 纯场景，不包含任何角色
      enhancedPrompt = `${prompt}. Focus on the scene and environment only, no characters should appear. ${artStyle}.`;
    } else if (sceneType === '主角场景' && sceneCharacters.includes(mainCharacter.split(' ')[0])) {
      // 主角场景 - 应用主角一致性
      if (pageIndex > 0) {
        enhancedPrompt = `${prompt}. IMPORTANT: Show the main character - ${mainCharacter}. Maintain consistent character design, same colors, same appearance features. ${artStyle}. Consistent with previous pages.`;
      } else {
        enhancedPrompt = `${prompt}. Establish clear character design for the main character - ${mainCharacter}. ${artStyle}. This sets the visual foundation for the story.`;
      }
    } else if (sceneType === '配角场景' || sceneType === '群体场景') {
      // 配角场景 - 只显示指定的配角，排除主角
      const sceneCharacterDescriptions = sceneCharacters
        .map(charName => allCharacters[charName] || charName)
        .filter(desc => desc)
        .join(', ');
      
      if (sceneCharacterDescriptions) {
        enhancedPrompt = `${prompt}. Show only these characters: ${sceneCharacterDescriptions}. Do NOT show the main character (${mainCharacter}) in this scene. ${artStyle}.`;
      } else {
        enhancedPrompt = `${prompt}. Focus on the scene with the mentioned characters. Do NOT include the main character in this specific scene. ${artStyle}.`;
      }
    } else {
      // 备用方案 - 使用原始逻辑
      enhancedPrompt = `${prompt}. ${artStyle}.`;
    }
    
    // 根据宽高比优化构图描述
    if (aspectRatio === '9:16') {
      enhancedPrompt += ' Vertical composition, portrait orientation, characters positioned for tall frame.';
    } else if (aspectRatio === '16:9') {
      enhancedPrompt += ' Horizontal composition, landscape orientation, wide scene with good use of space.';
    }
    
    // 构建增强的负向提示词，明确排除文字内容
    const enhancedNegativePrompt = [
      'text', 'words', 'letters', 'writing', 'signs', 'symbols', 'captions', 'subtitles', 
      'labels', 'watermarks', 'typography', 'written text', 'readable text', 'book text',
      'speech bubbles', 'dialogue boxes', 'written words', 'script', 'handwriting',
      'blurry', 'low quality', 'distorted', 'bad anatomy'
    ].join(', ');

    const requestData = {
      prompt: enhancedPrompt,
      pageIndex: pageIndex,
      aspectRatio: aspectRatio,
      seed: 42 + pageIndex, // 重新启用seed参数获得一致的图像生成
      maxRetries: 0, // 移除重试，直接失败
      // 新增的 Imagen 3 参数
      sampleCount: 1, // 生成图像数量
      safetyFilterLevel: 'OFF', // 安全过滤级别：完全关闭过滤
      personGeneration: 'allow_all', // 人物生成：allow_all (允许所有年龄段人物和面部)
      addWatermark: false, // 禁用水印以支持 seed 参数
      negativePrompt: enhancedNegativePrompt // 增强的负向提示词，明确排除文字
    };

    // 记录场景类型和角色信息
    if (onProgress) {
      const characterInfo = sceneCharacters.length > 0 ? sceneCharacters.join(', ') : 'no characters';
      onProgress(`Generating page ${pageIndex + 1} - ${sceneType} with ${characterInfo}`, 'image');
    }
    console.log(`Page ${pageIndex + 1}: ${sceneType} - Characters: [${sceneCharacters.join(', ')}]`);
    
    const result = await generateImage(requestData);
    
    if (result.data && result.data.success && result.data.imageUrl) {
      console.log(`Page ${pageIndex + 1} image generated successfully`);
      return result.data.imageUrl;
    } else {
      console.error('Imagen 4 API returned error:', result.data);
      throw new Error(result.data.error || 'Imagen 4 API returned invalid response');
    }
  };

  try {
    // 直接调用图像生成，不进行重试
    return await attemptGeneration();
  } catch (error) {
    console.error(`Error generating page ${pageIndex + 1} image:`, error);
    
    // 提供详细的错误信息
    let errorMessage = '';
    if (error.code === 'functions/unauthenticated') {
      errorMessage = 'Firebase authentication error';
      console.error('Firebase authentication error, please ensure you are logged in');
    } else if (error.code === 'functions/permission-denied') {
      errorMessage = 'Permission denied';
      console.error('Permission denied, please check Firebase rules');
    } else if (error.code === 'functions/internal') {
      errorMessage = 'Server internal error';
      console.error('Server internal error');
    } else {
      errorMessage = error.message || 'Unknown error';
    }
    
    if (onProgress) {
      onProgress(`Page ${pageIndex + 1} generation failed: ${errorMessage}`, 'error');
    }
    
    // 直接抛出错误，不再使用占位符图像
    console.log(`Image generation failed, throwing error instead of using placeholder...`);
    throw new Error(errorMessage);
  }
}



// 主要的故事生成函数
export async function generateTale(storyText, pageCount = 6, aspectRatio = '16:9', onProgress = null, signal = null) {
  try {
    console.log(`Starting generation of ${pageCount}-page story book (${aspectRatio} ratio)...`);
    
    // 第一步：使用Gemini生成故事页面和图像提示词
    console.log('Using Gemini to analyze story and generate pages...');
    if (onProgress) {
      onProgress({ 
        step: 'generating_pages', 
        current: 0, 
        total: pageCount + 1,
        log: 'Analyzing story with Gemini LLM...'
      });
    }
    
    const storyData = await generateStoryPages(storyText, pageCount, aspectRatio);
    
    if (!storyData || !storyData.pages || storyData.pages.length === 0) {
      throw new Error('Failed to generate story pages');
    }

    const { 
      storyTitle,
      pages: storyPages, 
      mainCharacter, 
      characterType, 
      artStyle, 
      allCharacters,
      storyAnalysis,
      pagePlanStrategy 
    } = storyData;
    
    console.log(`Generated ${storyPages.length} story pages with character: ${mainCharacter} (${characterType})`);
    console.log(`Story analysis:`, storyAnalysis);
    console.log(`Page planning strategy:`, pagePlanStrategy);
    console.log(`Total characters identified:`, allCharacters);
    
    // 构建详细的分析日志
    let analysisLog = `Generated ${storyPages.length} story pages with ${Object.keys(allCharacters || {}).length} characters`;
    if (storyAnalysis?.totalLength) {
      analysisLog += ` | Story length: ${storyAnalysis.totalLength}`;
    }
    if (storyAnalysis?.keyPlots?.length) {
      analysisLog += ` | Key plots: ${storyAnalysis.keyPlots.length}`;
    }
    if (pagePlanStrategy?.contentDistribution) {
      analysisLog += ` | Strategy: ${pagePlanStrategy.contentDistribution}`;
    }
    
    if (onProgress) {
      onProgress({ 
        step: 'generating_pages', 
        current: 1, 
        total: pageCount + 1,
        storyAnalysis: storyAnalysis || {},
        pagePlanStrategy: pagePlanStrategy || {},
        log: analysisLog
      });
    }

    // 第二步：为每个页面生成图像（串行处理以避免API限制）
    // 首先创建基础的页面结构，这样可以立即显示文字内容
    const pagesWithImages = storyPages.map((page, index) => ({
      text: page.text,
      title: page.title, // ✅ 添加缺失的title字段
      image: null, // 图片待生成
      imagePrompt: page.imagePrompt,
      sceneType: page.sceneType, // ✅ 添加场景类型
      sceneCharacters: page.sceneCharacters || [], // ✅ 添加场景角色
      isPlaceholder: false,
      status: 'generating' // 标记为生成中
    }));
    
    // 立即显示包含文字的页面结构
    if (onProgress) {
      onProgress({ 
        step: 'generating_images', 
        current: 0, 
        total: storyPages.length,
        successCount: 0,
        failureCount: 0,
        allPages: [...pagesWithImages], // 显示带文字的页面结构
        log: 'Starting image generation with Imagen 4...'
      });
    }
    
    let successCount = 0;
    let failureCount = 0;
    
    for (let index = 0; index < storyPages.length; index++) {
      // 检查是否用户已经中断操作
      if (signal && signal.aborted) {
        throw new Error('Generation was aborted by user');
      }
      
      const page = storyPages[index];
      console.log(`Generating page ${index + 1} image (${aspectRatio} ratio) with character: ${mainCharacter}...`);
      
      // 生成开始日志
      if (onProgress) {
        const characterText = index > 0 ? ` maintaining ${mainCharacter} consistency` : ` establishing ${mainCharacter} design`;
        onProgress({ 
          step: 'generating_images', 
          current: index, 
          total: storyPages.length,
          successCount,
          failureCount,
          allPages: [...pagesWithImages],
          log: `Generating image for page ${index + 1}${characterText}...`
        });
      }
      
      try {
        
        // 使用增强的重试机制生成图像，传入参考图片URL和进度回调
        const currentIndex = index;
        const currentSuccessCount = successCount;
        const currentFailureCount = failureCount;
        
        // 构建页面角色场景数据结构
        const sceneData = {
          sceneCharacters: page.sceneCharacters || [],
          sceneType: page.sceneType || '主角场景',
          mainCharacter: mainCharacter,
          characterType: characterType
        };

        const imageUrl = await generateImageWithImagen(
          page.imagePrompt, 
          currentIndex, 
          aspectRatio,
          sceneData, // 传递页面角色场景数据
          allCharacters || {}, // 传递所有角色描述
          artStyle, // 传递艺术风格
          (message, type) => {
            // 将图像生成的详细日志传递给UI
            if (onProgress) {
              onProgress({
                step: 'generating_images',
                current: currentIndex,
                total: storyPages.length,
                successCount: currentSuccessCount,
                failureCount: currentFailureCount,
                allPages: [...pagesWithImages],
                log: message
              });
            }
          }
        );
        
        // 图像生成成功
        const pageData = {
          text: page.text,
          title: page.title, // ✅ 添加缺失的title字段
          image: imageUrl,
          imagePrompt: page.imagePrompt,
          sceneType: page.sceneType || '主角场景',
          sceneCharacters: page.sceneCharacters || [],
          isPlaceholder: false,
          status: 'success',
          mainCharacter: mainCharacter,
          characterType: characterType
        };
        
        // 更新对应的页面数据
        pagesWithImages[index] = pageData;
        
        successCount++;
        console.log(`Page ${index + 1} image generated successfully with character: ${mainCharacter}`);
        
      } catch (error) {
        console.error(`Page ${index + 1} image generation failed:`, error);
        failureCount++;
        
        // 生成失败时不提供占位符图像，而是保持错误状态
        pagesWithImages[index] = {
          text: page.text,
          title: page.title, // ✅ 添加缺失的title字段
          image: null, // 不提供占位符图像
          imagePrompt: page.imagePrompt,
          sceneType: page.sceneType || '主角场景',
          sceneCharacters: page.sceneCharacters || [],
          error: error.message,
          isPlaceholder: false,
          status: 'error',
          mainCharacter: mainCharacter,
          characterType: characterType
        };
      }
      
      // 更新进度并传递当前生成的页面
      if (onProgress) {
        const pageStatus = pagesWithImages[index];
        let logMessage = '';
        if (pageStatus.status === 'success') {
          logMessage = `Page ${index + 1} image generated successfully (${characterType}: ${mainCharacter})`;
        } else if (pageStatus.status === 'error') {
          logMessage = `Page ${index + 1} generation failed: ${pageStatus.error}`;
        }
        
        onProgress({ 
          step: 'generating_images', 
          current: index + 1, 
          total: storyPages.length,
          successCount,
          failureCount,
          newPage: pagesWithImages[index], // 传递新生成的页面数据
          allPages: [...pagesWithImages], // 传递当前所有已生成的页面
          log: logMessage
        });
      }
      
      // 添加延迟避免API频繁调用导致的问题（优化稳定性）
      if (index < storyPages.length - 1) {
        console.log(`Waiting 500ms before generating next page to avoid API rate limits...`);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log(`Story book generation completed! Success: ${successCount}, Failed: ${failureCount}`);
    
    // 返回结果包含统计信息和故事标题
    return {
      storyTitle: storyTitle || '未命名故事',
      pages: pagesWithImages,
      statistics: {
        totalPages: storyPages.length,
        successCount,
        failureCount,
        successRate: Math.round((successCount / storyPages.length) * 100)
      }
    };
    
  } catch (error) {
    console.error('Error generating story book:', error);
    throw new Error(`Story generation failed: ${error.message}`);
  }
}

// 角色提取函数 - 通过Firebase Functions调用Vertex AI
export async function extractCharacter(storyText) {
  try {
    console.log('Starting to extract character information from story...');
    
    if (!storyText || !storyText.trim()) {
      throw new Error('Story content cannot be empty');
    }

    // 使用Firebase Functions调用Vertex AI Gemini
    const extractCharacterFunc = httpsCallable(functions, 'extractCharacter');

    // 调用Firebase Function进行角色提取
    const result = await extractCharacterFunc({
      story: storyText.trim()
    });
    
    console.log('Character extraction result:', result.data);
    
    // Firebase Function已经处理好了数据，直接使用
    if (result.data && result.data.success) {
      console.log('Character extraction successful:', result.data);
      return result.data;
    } else {
      throw new Error(result.data?.error || 'Character extraction failed');
    }
    
  } catch (error) {
    console.error('Error during character extraction:', error);
    
    // 提供更友好的错误信息
    if (error.message && error.message.includes('API key')) {
      throw new Error('API key configuration error, please contact administrator');
    } else if (error.message && error.message.includes('quota')) {
      throw new Error('API quota insufficient, please try again later');
    }
    
    throw new Error(`Character extraction failed: ${error.message}`);
  }
}

// 角色形象生成函数
export async function generateCharacterAvatar(characterName, characterDescription, negativePrompt = '', referenceImage = null, fidelity = 50) {
  try {
    console.log('Starting character avatar generation...');
    
    if (!characterName || !characterDescription) {
      throw new Error('Character name and description cannot be empty');
    }

    // 构建角色形象的提示词，严格遵循角色描述，并应用内容安全优化
    let safeCharacterDescription = characterDescription;
    
    // 应用内容安全转换，确保描述友善且适合儿童绘本
    const safetyReplacements = {
      // 暴力相关词汇转换
      '打架': '玩耍', '战斗': '竞赛', '愤怒': '专注', '凶恶': '认真',
      '可怕': '神秘', '恐怖': '有趣', '吓人': '令人好奇',
      // 负面情绪转换
      '邪恶': '调皮', '坏': '淘气', '狡猾': '聪明', '阴险': '机智',
      // 危险行为转换
      '危险': '冒险', '武器': '工具', '刀': '魔法棒', '剑': '勇士棒'
    };
    
    // 应用安全词汇替换
    Object.entries(safetyReplacements).forEach(([unsafe, safe]) => {
      const regex = new RegExp(unsafe, 'gi');
      safeCharacterDescription = safeCharacterDescription.replace(regex, safe);
    });
    
    let characterPrompt = `Character portrait: ${characterName}. ${safeCharacterDescription}. Friendly and warm expression, suitable for children's book illustration style, PNG with transparent background, no background elements, safe and welcoming appearance.`;

    // 添加负向提示（用户自定义或默认，包含文字排除）
    const defaultNegativePrompt = [
      'text', 'words', 'letters', 'writing', 'signs', 'symbols', 'captions',
      'extra decorations not mentioned in description', 'additional accessories', 
      'complex patterns', 'overly detailed textures', 'dramatic lighting', 
      'realistic rendering', 'photorealistic style', 'busy designs', 
      'extra colors not specified', 'ornate details'
    ].join(', ');
    const finalNegativePrompt = negativePrompt.trim() ? `${negativePrompt.trim()}, ${defaultNegativePrompt}` : defaultNegativePrompt;
    
    characterPrompt += `\n\nAVOID: ${finalNegativePrompt}.`;

    // 如果有参考图片，根据遵循度调整提示词
    if (referenceImage && fidelity > 0) {
      if (fidelity > 70) {
        characterPrompt += ` Style should closely follow the reference image with high fidelity (${fidelity}% similarity).`;
      } else if (fidelity > 30) {
        characterPrompt += ` Style should moderately follow the reference image (${fidelity}% similarity).`;
      } else {
        characterPrompt += ` Style inspired by reference image but with creative freedom (${fidelity}% similarity).`;
      }
    }

    console.log('Character avatar generation prompt:', characterPrompt);

    // 使用Firebase Functions调用Imagen 4
    const generateImage = httpsCallable(functions, 'generateImage');
    
    const result = await generateImage({
      prompt: characterPrompt,
      pageIndex: 0, // 角色形象使用固定index
      aspectRatio: '9:16', // 角色形象使用竖屏比例
      // seed: characterName.split('').reduce((a, b) => a + b.charCodeAt(0), 0), // 临时禁用种子值
      maxRetries: 0, // 移除重试，直接失败
      // 角色头像专用参数
      sampleCount: 1,
      safetyFilterLevel: 'OFF',
      personGeneration: 'allow_all', // 允许所有年龄段人物和面部生成
      addWatermark: false, // 禁用水印以支持 seed 参数
      negativePrompt: finalNegativePrompt
    });
    
    if (result.data && result.data.success && result.data.imageUrl) {
      console.log('Character avatar generated successfully');
      return {
        success: true,
        imageUrl: result.data.imageUrl,
        prompt: characterPrompt,
        generatedAt: new Date().toISOString()
      };
    } else {
      console.error('Imagen 4 API returned error:', result.data);
      throw new Error(result.data.error || 'Imagen 4 API returned invalid response');
    }
    
  } catch (error) {
    console.error('Error generating character avatar:', error);
    
    // 提供更友好的错误信息
    if (error.code === 'functions/unauthenticated') {
      throw new Error('Please login first to use character avatar generation');
    } else if (error.code === 'functions/permission-denied') {
      throw new Error('Insufficient permissions to access character avatar generation service');
    } else if (error.code === 'functions/internal') {
      throw new Error('Server internal error, please try again later');
    }
    
    throw new Error(`Character avatar generation failed: ${error.message}`);
  }
}

