import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
import { getAuth } from 'firebase/auth';

// 导入配置
import { UTILS } from './config';
import { safeLog } from './utils/logger';

// 现在所有AI服务都通过Firebase Functions访问Vertex AI
// 数据存储也完全通过云函数管理，支持 Cloud Storage 和 Firestore 两种模式

// 注意：原来的 generateStoryPages 函数已移除，现在直接使用云函数的 generateTale

// 移除了占位符图像生成函数

// 重试辅助函数已移除 - 现在直接失败不重试

// 错误重试逻辑已移除

// 使用Imagen 3或4生成图像（通过Firebase Functions）- 智能多角色场景管理  
export async function generateImageWithImagen(prompt, pageIndex, aspectRatio = '1:1', pageData = {}, allCharacters = {}, artStyle = '儿童绘本插画风格', model = 'imagen4-fast', onProgress = null) {
  const attemptGeneration = async () => {
    const { sceneCharacters = [], sceneType = '主角场景' } = pageData;
    
    // 使用统一的generateImage函数，支持多模型
    const functionName = 'generateImage';
    
    safeLog.debug(UTILS.formatLogMessage(pageIndex, `Generating image - Function: ${functionName}, Model: ${model}`));
    safeLog.debug(`Scene: ${sceneType}, Characters: [${sceneCharacters.join(', ')}]`);

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
      model: model, // 添加模型参数
      seed: 42 + pageIndex, // 重新启用seed参数获得一致的图像生成
      maxRetries: 0, // 移除重试，直接失败
      // 新增的 Imagen 3 参数
      sampleCount: 1, // 生成图像数量
      safetyFilterLevel: 'OFF', // 安全过滤级别：完全关闭过滤
      personGeneration: 'allow_all', // 人物生成：allow_all (允许所有年龄段人物和面部)
      addWatermark: false, // 禁用水印以支持 seed 参数
      negativePrompt: enhancedNegativePrompt // 增强的负向提示词，明确排除文字
    };

    // Record scene type and character information with model info
    if (onProgress) {
      const characterInfo = sceneCharacters.length > 0 ? sceneCharacters.join(', ') : 'no characters';
      onProgress(`Generating page ${pageIndex + 1} illustration using ${model} - ${sceneType}, characters: ${characterInfo}`, 'image');
    }
    safeLog.debug(`Page ${pageIndex + 1}: ${sceneType} - Characters: [${sceneCharacters.join(', ')}] - Model: ${model}`);
    
    // Send image generation request
    if (onProgress) {
      onProgress(UTILS.formatLogMessage(pageIndex, `Calling ${model} API to generate image...`), 'image');
    }
    
    const result = await generateImage(requestData);
    
    if (result.data && result.data.success && result.data.imageUrl) {
      safeLog.debug(UTILS.formatLogMessage(pageIndex, `image generated successfully using ${model}`));
      if (onProgress) {
        onProgress(UTILS.formatLogMessage(pageIndex, `illustration generated successfully using ${model}!`), 'success');
      }
      return result.data.imageUrl;
    } else {
      safeLog.error(UTILS.formatErrorMessage('API returned error'), result.data);
      throw new Error(result.data.error || UTILS.formatErrorMessage('API returned invalid response'));
    }
  };

  try {
    // 直接调用图像生成，不进行重试
    return await attemptGeneration();
  } catch (error) {
    safeLog.error(`Error generating page ${pageIndex + 1} image with ${model}:`, error);
    
    // 简化错误处理逻辑
    const errorInfo = parseGenerationError(error, model, pageIndex);
    
    if (onProgress) {
      onProgress(`Page ${pageIndex + 1} image generation failed (${model}): ${errorInfo.message}`, 'error');
    }
    
    // 直接抛出错误，不再使用占位符图像
    safeLog.debug(`Image generation failed with ${model}, throwing error instead of using placeholder...`);
    throw errorInfo.enhancedError;
  }
}

// 新增：简化的错误解析函数
function parseGenerationError(error, model, pageIndex) {
  let errorMessage = 'Unknown error';
  let errorType = 'unknown';
  let errorDetails = '';
  
  // 首先检查是否是 RAI 过滤错误
  const raiInfo = extractRaiInfo(error);
  if (raiInfo) {
    return {
      message: raiInfo.message,
      enhancedError: createEnhancedError(raiInfo.message, 'safety_filter', raiInfo.details, model, error)
    };
  }
  
  // 处理其他类型的错误
  if (error.code === 'functions/unauthenticated') {
    errorMessage = 'Firebase authentication error';
    errorType = 'auth';
    errorDetails = 'Please ensure you are logged in';
  } else if (error.code === 'functions/permission-denied') {
    errorMessage = 'Permission denied';
    errorType = 'permission';
    errorDetails = 'Check Firebase rules configuration';
  } else if (error.code === 'functions/deadline-exceeded') {
    errorMessage = 'Request timeout';
    errorType = 'timeout';
    errorDetails = 'The generation request exceeded the time limit';
  } else if (error.code === 'functions/internal') {
    errorMessage = 'Server internal error';
    errorType = 'server';
    errorDetails = error.details?.error || error.message || 'Unknown server error';
  } else {
    errorMessage = error.message || 'Unknown error';
    errorDetails = error.message || 'An unexpected error occurred';
  }
  
  return {
    message: errorMessage,
    enhancedError: createEnhancedError(errorMessage, errorType, errorDetails, model, error)
  };
}

// 新增：专门提取RAI信息的函数
function extractRaiInfo(error) {
  // 检查多个可能的 RAI 信息来源
  let raiReason = null;
  let raiDetails = null;
  
  // 方式1：直接在 error.details 中
  if (error.details?.raiReason && error.details.raiReason !== 'Unknown') {
    raiReason = error.details.raiReason;
    raiDetails = error.details.detailedRaiInfo;
  }
  
  // 方式2：在错误消息中查找RAI信息
  if (!raiReason && error.message) {
    const raiMatch = error.message.match(/RAI[^:]*:\s*([^,\n]+)/i);
    if (raiMatch) {
      raiReason = raiMatch[1].trim();
    }
  }
  
  // 方式3：检查是否是内容过滤的通用指标
  if (!raiReason && error.message?.includes('No image data found') && error.details?.raiReason) {
    raiReason = error.details.raiReason;
    raiDetails = error.details.detailedRaiInfo;
  }
  
  if (!raiReason) {
    return null;
  }
  
  // 记录原始RAI信息到调试日志
  safeLog.debug('RAI filter detected:', {
    reason: raiReason,
    details: raiDetails
  });
  
  // 根据RAI原因生成用户友好的错误信息
  const raiLower = raiReason.toLowerCase();
  let message = 'Content was filtered by safety policies';
  let details = 'Content does not meet safety guidelines';
  
  if (raiLower.includes('copyright') || raiLower.includes('recitation')) {
    message = 'Content blocked due to copyright concerns';
    details = 'The prompt may reference copyrighted characters, brands, or artwork. Try using original descriptions instead of referencing specific works.';
  } else if (raiLower.includes('hate') || raiLower.includes('discrimination')) {
    message = 'Content filtered for hate speech';
    details = 'The prompt may contain hate speech or discriminatory language. Please use respectful and inclusive language.';
  } else if (raiLower.includes('violence') || raiLower.includes('harmful')) {
    message = 'Content filtered for violence';
    details = 'The prompt may contain violent or harmful imagery. Try focusing on peaceful, positive scenes instead.';
  } else if (raiLower.includes('sexual') || raiLower.includes('adult')) {
    message = 'Content filtered for sexual content';
    details = 'The prompt may contain sexual or adult material. Please use family-friendly descriptions.';
  } else if (raiLower.includes('dangerous')) {
    message = 'Content filtered for dangerous activities';
    details = 'The prompt may promote dangerous or harmful activities. Try focusing on safe, positive activities.';
  } else if (raiLower.includes('safety') || raiLower.includes('blocked') || raiLower.includes('filter')) {
    message = 'Content filtered by safety policies';
    details = 'The prompt does not meet safety guidelines. Try rephrasing with different wording.';
  } else {
    // 对于不明确的RAI原因，尝试提取更多信息
    message = 'Content filtered by AI safety policies';
    
    // 尝试从RAI原因中提取更具体的信息
    if (raiReason.includes('SPII') || raiReason.includes('personal information')) {
      details = 'The prompt may contain personal information. Avoid using specific names, addresses, or personal details.';
    } else if (raiReason.includes('medical') || raiReason.includes('health')) {
      details = 'The prompt may contain medical or health-related content that requires caution. Try using general descriptions instead.';
    } else if (raiReason.includes('political') || raiReason.includes('controversial')) {
      details = 'The prompt may contain political or controversial content. Try focusing on neutral, non-political themes.';
    } else {
      // 直接显示过滤的原因，但清理掉support code
      const cleanReason = raiReason.replace(/Support codes?:\s*\d+/gi, '').trim();
      if (cleanReason && cleanReason !== 'Unknown') {
        details = `The prompt was filtered: ${cleanReason}. Try rephrasing with different wording.`;
      } else {
        details = 'The prompt does not meet safety guidelines. Try rephrasing with different wording.';
      }
    }
  }
  
  // 不再显示support code
  
  return {
    message: message,
    details: details,
    originalReason: raiReason
  };
}

// 新增：创建增强错误对象的辅助函数
function createEnhancedError(message, type, details, model, originalError) {
  const enhancedError = new Error(message);
  enhancedError.type = type;
  enhancedError.details = details;
  enhancedError.model = model;
  enhancedError.originalError = originalError;
  return enhancedError;
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
            safeLog.warn('Failed to cancel reader:', e);
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
              safeLog.debug('Stream reading completed');
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
                  safeLog.warn('Failed to parse SSE data:', line, parseError);
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
              safeLog.error('Stream processing error:', streamError);
              reject(new Error(`Stream processing failed: ${streamError.message}`));
            }
          }
        }
      })
      .catch(error => {
        if (!isResolved) {
          isResolved = true;
          cleanup();
          
          safeLog.error('Stream connection error:', error);
          
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
    safeLog.error('Error in generateTaleStream:', error);
    if (onProgress) {
      onProgress({ step: 'error', log: `Stream generation failed: ${error.message}` });
    }
    throw error;
  }
}

// 已删除 generateTale 包装函数，前端直接使用 generateTaleStream

