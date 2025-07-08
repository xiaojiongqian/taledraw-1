import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
import { getAuth } from 'firebase/auth';

// 导入配置
import { API_CONFIG, UTILS } from './config';

// 现在所有AI服务都通过Firebase Functions访问Vertex AI
// 数据存储也完全通过云函数管理，支持 Cloud Storage 和 Firestore 两种模式

// 注意：原来的 generateStoryPages 函数已移除，现在直接使用云函数的 generateTale

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
      console.log(`Attempt ${attempt + 1} failed, retrying in ${delay.toFixed(0)}ms...`);
      
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

// 使用Imagen 3或4生成图像（通过Firebase Functions）- 智能多角色场景管理  
export async function generateImageWithImagen(prompt, pageIndex, aspectRatio = '1:1', pageData = {}, allCharacters = {}, artStyle = '儿童绘本插画风格', onProgress = null) {
  const attemptGeneration = async () => {
    const { sceneCharacters = [], sceneType = '主角场景' } = pageData;
    
    // 根据配置动态选择函数名
    const functionName = UTILS.getImageGenerationFunction(); 
    
    console.log(UTILS.formatLogMessage(pageIndex, `Generating image - Function: ${functionName}, Version: ${API_CONFIG.IMAGEN_API_VERSION}`));
    console.log(`Scene: ${sceneType}, Characters: [${sceneCharacters.join(', ')}]`);

    const generateImage = httpsCallable(functions, functionName);
    
    // 智能构建基于场景的角色提示词
    let enhancedPrompt;
    
    if (sceneType === '无角色场景') {
      // 纯场景，不包含任何角色
      enhancedPrompt = `${prompt}. Focus on the scene and environment only, no characters should appear. ${artStyle}.`;
    } else if (sceneType === '主角场景' || sceneType === '配角场景' || sceneType === '群体场景') {
      // 显示指定的角色
      const sceneCharacterDescriptions = sceneCharacters
        .map(charName => allCharacters[charName] || charName)
        .filter(desc => desc)
        .join(', ');
      
      if (sceneCharacterDescriptions) {
        if (pageIndex > 0) {
          enhancedPrompt = `${prompt}. Show these characters: ${sceneCharacterDescriptions}. Maintain consistent character design, same colors, same appearance features. ${artStyle}. Consistent with previous pages.`;
        } else {
          enhancedPrompt = `${prompt}. Establish clear character design for these characters: ${sceneCharacterDescriptions}. ${artStyle}. This sets the visual foundation for the story.`;
        }
      } else {
        enhancedPrompt = `${prompt}. Focus on the scene with the mentioned characters. ${artStyle}.`;
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

    // Record scene type and character information
    if (onProgress) {
      const characterInfo = sceneCharacters.length > 0 ? sceneCharacters.join(', ') : 'no characters';
      onProgress(`Generating page ${pageIndex + 1} illustration - ${sceneType}, characters: ${characterInfo}`, 'image');
    }
    console.log(`Page ${pageIndex + 1}: ${sceneType} - Characters: [${sceneCharacters.join(', ')}]`);
    
    // Send image generation request
    if (onProgress) {
      onProgress(UTILS.formatLogMessage(pageIndex, `Calling image generation API to generate image...`), 'image');
    }
    
    const result = await generateImage(requestData);
    
    if (result.data && result.data.success && result.data.imageUrl) {
      console.log(UTILS.formatLogMessage(pageIndex, 'image generated successfully'));
      if (onProgress) {
        onProgress(UTILS.formatLogMessage(pageIndex, 'illustration generated successfully!'), 'success');
      }
      return result.data.imageUrl;
    } else {
      console.error(UTILS.formatErrorMessage('API returned error'), result.data);
      throw new Error(result.data.error || UTILS.formatErrorMessage('API returned invalid response'));
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
      onProgress(`Page ${pageIndex + 1} image generation failed: ${errorMessage}`, 'error');
    }
    
    // 直接抛出错误，不再使用占位符图像
    console.log(`Image generation failed, throwing error instead of using placeholder...`);
    throw new Error(errorMessage);
  }
}

// 新增：流式故事生成函数
export async function generateTaleStream(storyText, pageCount, aspectRatio, onProgress, signal) {
  try {
    if (!storyText || !storyText.trim()) {
      throw new Error('Story content cannot be empty');
    }

    // 获取当前用户的认证token
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User must be authenticated');
    }

    const idToken = await user.getIdToken();
    
    // 构建流式请求URL
    const region = UTILS.getImagenRegion();
    const baseUrl = UTILS.buildFunctionUrl('generateTaleStream', region);
    // 添加时间戳参数来避免缓存问题
    const streamUrl = `${baseUrl}?_t=${Date.now()}`;

    // 发送初始进度
    if (onProgress) {
      onProgress({
        step: 'initializing',
        log: 'Initializing streaming story generation...'
      });
    }

    // 创建fetch请求，处理流式响应
    return new Promise((resolve, reject) => {
      let isResolved = false;
      let reader = null;
      
      const cleanup = () => {
        if (reader) {
          try {
            reader.cancel();
          } catch (e) {
            console.warn('Failed to cancel reader:', e);
          }
        }
      };

      // 设置信号监听器
      if (signal) {
        signal.addEventListener('abort', () => {
          if (!isResolved) {
            cleanup();
            const abortError = new Error('Generation process was aborted by user');
            abortError.name = 'AbortError';
            reject(abortError);
          }
        });
      }

      fetch(streamUrl, {
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
        headers: {
          'Content-Type': 'application/json; charset=UTF-8',
          'Authorization': `Bearer ${idToken}`,
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        },
        body: JSON.stringify({
          story: storyText.trim(),
          pageCount: pageCount,
          aspectRatio: aspectRatio
        }),
        signal: signal // 支持取消请求
      })
      .then(async response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        if (!response.body) {
          throw new Error('Response body is null');
        }

        reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        try {
          while (true) {
            // 检查是否被取消
            if (signal && signal.aborted) {
              const abortError = new Error('Generation process was aborted by user');
              abortError.name = 'AbortError';
              throw abortError;
            }

            const { done, value } = await reader.read();
            
            if (done) {
              console.log('Stream reading completed');
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // 保留最后一行可能不完整的数据

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const jsonStr = line.substring(6).trim();
                  if (!jsonStr || jsonStr === '[DONE]') continue;
                  
                  const data = JSON.parse(jsonStr);
                  
                  if (data.type === 'progress') {
                    if (onProgress) {
                      onProgress({
                        step: data.step,
                        log: data.message,
                        progress: data.progress
                      });
                    }
                  } else if (data.type === 'partial_content') {
                    if (onProgress) {
                      onProgress({
                        step: 'streaming',
                        log: 'Receiving generated content...',
                        partialContent: data.content
                      });
                    }
                  } else if (data.type === 'complete') {
                    if (onProgress) {
                      onProgress({
                        step: 'complete',
                        log: data.message || 'Story generation completed!'
                      });
                    }
                    
                    if (!isResolved) {
                      isResolved = true;
                      cleanup();
                      
                      // 获取生成的数据
                      try {
                        const getTaleDataFunc = httpsCallable(functions, 'getTaleData', { timeout: 60000 });
                        const taleDataResult = await getTaleDataFunc({ taleId: data.taleId });
                        
                        if (!taleDataResult.data) {
                          throw new Error(`Failed to retrieve generated tale (ID: ${data.taleId}).`);
                        }
                        resolve(taleDataResult.data);
                      } catch (err) {
                        reject(err);
                      }
                    }
                    return;
                  } else if (data.type === 'error' || data.error) {
                    if (!isResolved) {
                      isResolved = true;
                      cleanup();
                      reject(new Error(data.message || data.error || 'Unknown error from server'));
                    }
                    return;
                  }
                } catch (parseError) {
                  console.warn('Failed to parse SSE data:', line, parseError);
                }
              }
            }
          }
          
          // 如果到这里还没有resolve，说明流结束了但没有收到complete消息
          if (!isResolved) {
            isResolved = true;
            cleanup();
            reject(new Error('Stream ended unexpectedly without completion message'));
          }
          
        } catch (streamError) {
          if (!isResolved) {
            isResolved = true;
            cleanup();
            
            if (streamError.name === 'AbortError') {
              reject(streamError);
            } else {
              console.error('Stream processing error:', streamError);
              reject(new Error(`Stream processing failed: ${streamError.message}`));
            }
          }
        }
      })
      .catch(error => {
        if (!isResolved) {
          isResolved = true;
          cleanup();
          
          console.error('Stream connection error:', error);
          
          // Check if it was user-initiated abort
          if (error.name === 'AbortError') {
            const abortError = new Error('Generation process was aborted by user');
            abortError.name = 'AbortError';
            reject(abortError);
          } else {
            // 提供更详细的错误信息
            let errorMessage = 'Network connection failed';
            if (error.message) {
              if (error.message.includes('Failed to fetch')) {
                errorMessage = 'Unable to connect to server. Please check your internet connection and try again.';
              } else if (error.message.includes('network error')) {
                errorMessage = 'Network error occurred. Please check your connection and try again.';
              } else {
                errorMessage = `Connection error: ${error.message}`;
              }
            }
            reject(new Error(errorMessage));
          }
        }
      });
    });

  } catch (error) {
    console.error('Error in generateTaleStream:', error);
    if (onProgress) {
      onProgress({ step: 'error', log: `Stream generation failed: ${error.message}` });
    }
    throw error;
  }
}

// 修改原有的generateTale函数，直接使用流式处理
export async function generateTale(storyText, pageCount, aspectRatio, onProgress, signal) {
  // 直接使用流式处理，提供更好的用户体验
  return generateTaleStream(storyText, pageCount, aspectRatio, onProgress, signal);
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

    // 使用Firebase Functions调用Imagen API
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
      console.error(UTILS.formatErrorMessage('API returned error'), result.data);
      throw new Error(result.data.error || UTILS.formatErrorMessage('API returned invalid response'));
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

