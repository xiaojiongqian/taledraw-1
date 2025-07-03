const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2/options');
const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const { GoogleAuth } = require('google-auth-library');
// 使用Node.js 22内置的全局fetch，无需导入

// 设置全局选项
setGlobalOptions({ region: 'us-east5' });

// 初始化Firebase Admin
admin.initializeApp();

// GCP配置
const PROJECT_ID = 'ai-app-taskforce';
const LOCATION = 'us-east5'; // 切换到支持Imagen 4的区域

// 重试辅助函数 - 指数退避算法（服务端版本）
async function retryWithBackoff(asyncFn, maxRetries = 2, baseDelay = 1000) {
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
      
      // 检查是否应该重试
      if (!shouldRetryImagenError(error)) {
        throw lastError;
      }
      
      // 计算延迟时间（指数退避 + 随机抖动）
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 500;
      console.log(`Imagen API第${attempt + 1}次调用失败，${delay.toFixed(0)}ms后重试...`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

// 判断Imagen API错误是否值得重试
function shouldRetryImagenError(error) {
  // 检查HTTP状态码 - 某些状态码不值得重试
  if (error.status) {
    const nonRetryableStatusCodes = [400, 401, 403, 404]; // Bad Request, Unauthorized, Forbidden, Not Found
    if (nonRetryableStatusCodes.includes(error.status)) {
      return false;
    }
  }
  
  // 检查错误消息中的关键词
  const errorMessage = error.message ? error.message.toLowerCase() : '';
  const nonRetryableMessages = [
    'invalid request',
    'quota exceeded',
    'authentication failed',
    'permission denied',
    'project not found'
  ];
  
  if (nonRetryableMessages.some(msg => errorMessage.includes(msg))) {
    return false;
  }
  
  // 5xx错误、网络错误、超时等可以重试
  return true;
}

// Imagen API调用函数
exports.generateImage = onCall(async (request) => {
  // 验证用户认证
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { 
    prompt, 
    pageIndex = 0, 
    aspectRatio = '16:9', 
    maxRetries = 2, 
    referenceImageUrl, 
    seed = 42,
    sampleCount = 1,
    safetyFilterLevel = 'OFF',
    personGeneration = 'allow_all',
    addWatermark = false,
    negativePrompt
  } = request.data;

  if (!prompt) {
    throw new HttpsError('invalid-argument', 'Prompt is required');
  }

  console.log(`Starting image generation for page ${pageIndex + 1}:`, {
    promptLength: prompt.length,
    aspectRatio,
    hasReference: !!referenceImageUrl,
    userId: request.auth.uid
  });

  // 将用户友好的比例转换为Imagen API支持的格式
  const aspectRatioMapping = {
    '16:9': '16:9',
    '9:16': '9:16'
  };
  
  const imagenAspectRatio = aspectRatioMapping[aspectRatio] || '16:9';

  // 创建Imagen API调用函数
  const callImagenAPI = async () => {
    // 使用 imagen-3.0-generate-002 进行纯文本到图像生成
    // 不再处理参考图像，风格一致性通过种子值和增强提示词实现
    
    try {
      console.log(`Generating image for page ${pageIndex + 1} with aspect ratio ${aspectRatio} (${imagenAspectRatio})`);

      // 初始化Google Auth
      const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform']
      });

      // 获取访问令牌
      const client = await auth.getClient();
      const accessToken = await client.getAccessToken();
      
      if (!accessToken || !accessToken.token) {
        throw new Error('Failed to get access token');
      }

      console.log('Successfully obtained access token');
      console.log('Token type:', typeof accessToken.token);
      console.log('Token starts with:', accessToken.token.substring(0, 20) + '...');

      // 使用 imagen-3.0-generate-002 模型，该模型支持图像生成
      // 注意：imagen-3.0-capability-001 不支持图像生成，只支持图像编辑
      const modelName = 'imagen-3.0-generate-002';
      const apiUrl = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${modelName}:predict`;
      
      console.log('Using API URL:', apiUrl);
      console.log('Using model:', modelName);

      // 构建 Imagen 3 Generate 模型的标准请求格式
      const instance = {
        prompt: prompt
      };
      
      // 构建增强的负向提示词 - 明确排除所有文字相关内容
      const defaultNegativePrompt = [
        'text', 'words', 'letters', 'writing', 'signs', 'symbols', 'captions', 'subtitles', 
        'labels', 'watermarks', 'typography', 'written text', 'readable text', 'book text',
        'speech bubbles', 'dialogue boxes', 'written words', 'script', 'handwriting',
        'newspaper', 'magazine text', 'signage', 'readable signs', 'visible text',
        'blurry', 'low quality', 'distorted', 'bad anatomy'
      ].join(', ');
      
      let finalNegativePrompt = defaultNegativePrompt;
      
      if (negativePrompt && negativePrompt.trim()) {
        finalNegativePrompt = `${negativePrompt.trim()}, ${defaultNegativePrompt}`;
      }
      
      instance.negativePrompt = finalNegativePrompt;
      console.log('Added negative prompt to API request:', finalNegativePrompt);
      
      // imagen-3.0-generate-002 专门用于文本到图像生成
      // 风格一致性通过种子值和增强的文本提示词实现
      
      // 构建标准的图像生成参数 - 智能调整人物生成设置
      const parameters = {
        sampleCount: Math.min(Math.max(1, sampleCount), 4), // 限制在 1-4 之间
        safetyFilterLevel: safetyFilterLevel,
        addWatermark: addWatermark
      };

      // 智能设置人物生成参数 - 根据提示词内容动态调整
      const promptLower = prompt.toLowerCase();
      const hasPersonKeywords = /person|people|man|woman|boy|girl|child|adult|human|character|protagonist|hero|heroine/.test(promptLower);
      
      if (hasPersonKeywords) {
        // 如果提示词包含人物相关关键词，允许所有年龄段人物和面部
        parameters.personGeneration = personGeneration || 'allow_all';
        console.log('Detected person-related keywords, using personGeneration:', parameters.personGeneration);
      } else {
        // 如果没有明确的人物关键词，可以不设置这个参数
        console.log('No explicit person keywords detected, not setting personGeneration parameter');
      }
      
      // 如果有种子值，尝试添加
      if (seed && typeof seed === 'number') {
        parameters.seed = seed;
        console.log('Added seed parameter:', seed);
      }
      
      // 根据宽高比添加 aspectRatio 参数
      if (aspectRatio && aspectRatio !== '1:1') {
        parameters.aspectRatio = aspectRatio;
        console.log('Added aspect ratio parameter:', aspectRatio);
      }
      
      const requestBody = {
        instances: [instance],
        parameters: parameters
      };

      console.log('Request body:', JSON.stringify(requestBody, null, 2));

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken.token}`,
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify(requestBody)
      });

      console.log('API Response Status:', response.status);
      console.log('API Response Headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Imagen API error details:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        
        // 检查是否是人物生成相关的错误
        const isPersonGenerationError = errorText.includes('Person Generation') || 
                                      errorText.includes('person generation') ||
                                      errorText.includes('allow_adult') ||
                                      errorText.includes('allow_all');
        
        // 如果是人物生成错误，尝试自动降级处理
        if (isPersonGenerationError && parameters.personGeneration) {
          console.log('Person generation error detected, attempting fallback...');
          
          // 移除人物生成参数，重试请求
          const fallbackParameters = { ...parameters };
          delete fallbackParameters.personGeneration;
          
          const fallbackRequestBody = {
            instances: [instance],
            parameters: fallbackParameters
          };
          
          console.log('Retrying without personGeneration parameter:', JSON.stringify(fallbackRequestBody, null, 2));
          
          const fallbackResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken.token}`,
              'Content-Type': 'application/json; charset=utf-8',
            },
            body: JSON.stringify(fallbackRequestBody)
          });
          
          if (fallbackResponse.ok) {
            console.log('Fallback request succeeded without personGeneration parameter');
            const fallbackResponseText = await fallbackResponse.text();
            const fallbackData = JSON.parse(fallbackResponseText);
            
            if (fallbackData.predictions && fallbackData.predictions[0] && fallbackData.predictions[0].bytesBase64Encoded) {
              return fallbackData.predictions[0].bytesBase64Encoded;
            }
          } else {
            const fallbackErrorText = await fallbackResponse.text();
            console.error('Fallback request also failed:', fallbackErrorText);
          }
        }
        
        // 提供更具体的错误信息
        let errorMessage = `Imagen API failed: ${response.status}`;
        if (response.status === 400) {
          errorMessage += ' - Invalid request parameters';
          if (isPersonGenerationError) {
            errorMessage += ' (人物生成权限不足，请联系管理员申请权限或调整提示词)';
          }
        } else if (response.status === 401) {
          errorMessage += ' - Authentication failed';
        } else if (response.status === 403) {
          errorMessage += ' - Permission denied or API not enabled';
        } else if (response.status === 429) {
          errorMessage += ' - Rate limit exceeded';
        } else if (response.status >= 500) {
          errorMessage += ' - Server error';
        }
        errorMessage += ` - ${errorText}`;
        
        const error = new Error(errorMessage);
        error.status = response.status;
        throw error;
      }

      // 先获取原始响应文本进行详细记录
      const responseText = await response.text();
      console.log('Raw API Response Text:', responseText);
      console.log('Response Text Length:', responseText.length);

      // 检查响应是否为空
      if (!responseText || responseText.trim() === '') {
        console.error('Empty response from Imagen API');
        throw new Error('Empty response from Imagen API');
      }

      // 尝试解析JSON
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse response as JSON:', parseError);
        console.error('Response text that failed to parse:', responseText);
        throw new Error(`Invalid JSON response from Imagen API: ${parseError.message}`);
      }
      
      console.log('API Response structure:', {
        hasPredictions: !!data.predictions,
        predictionsLength: data.predictions ? data.predictions.length : 0,
        keys: Object.keys(data),
        fullResponse: data
      });
      
      // 检查响应是否有错误信息
      if (data.error) {
        console.error('Imagen API returned error in response:', data.error);
        throw new Error(`Imagen API error: ${JSON.stringify(data.error)}`);
      }

      if (!data.predictions || !data.predictions[0]) {
        console.error('Invalid Imagen API response structure:', data);
        throw new Error('Invalid response structure from Imagen API - no predictions');
      }

      const prediction = data.predictions[0];
      if (!prediction.bytesBase64Encoded) {
        console.error('No image data in prediction:', Object.keys(prediction));
        throw new Error('No image data in Imagen API response');
      }

      console.log('Successfully received image data from Imagen API');
      return prediction.bytesBase64Encoded;

    } catch (error) {
      console.error('Error in callImagenAPI:', error);
      throw error;
    }
  };

  try {
    // 直接调用Imagen API，不进行重试
    const base64Data = await callImagenAPI();

    // 上传到Firebase Storage
    const bucketName = `${PROJECT_ID}.firebasestorage.app`;
    const bucket = admin.storage().bucket(bucketName);
    const fileName = `tale-images/${request.auth.uid}/${Date.now()}_page_${pageIndex}.jpg`;
    const file = bucket.file(fileName);

    console.log('Uploading image to Firebase Storage:', fileName);

    // 将base64转换为Buffer
    const imageBuffer = Buffer.from(base64Data, 'base64');

    // 上传图像
    await file.save(imageBuffer, {
      metadata: {
        contentType: 'image/jpeg',
        metadata: {
          userId: request.auth.uid,
          pageIndex: pageIndex.toString(),
          prompt: prompt.substring(0, 500)
        }
      }
    });

    // 使图像公开访问
    await file.makePublic();

    // 获取公开URL
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;

    console.log(`Image generated and uploaded successfully for page ${pageIndex + 1}: ${publicUrl}`);

    return {
      imageUrl: publicUrl,
      pageIndex: pageIndex,
      success: true
    };

  } catch (error) {
    console.error(`Error generating image for page ${pageIndex + 1}:`, error);
    
    if (error instanceof HttpsError) {
      throw error;
    }

    // 提供更详细的错误信息
    let errorMessage = `Failed to generate image: ${error.message}`;
    if (error.status) {
      errorMessage += ` (HTTP ${error.status})`;
    }

    console.error('Final error details:', {
      message: error.message,
      status: error.status,
      stack: error.stack
    });

    throw new HttpsError('internal', errorMessage);
  }
});

// 批量生成图像函数（可选）
exports.generateImageBatch = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { prompts } = request.data;

  if (!prompts || !Array.isArray(prompts)) {
    throw new HttpsError('invalid-argument', 'Prompts array is required');
  }

  try {
    const results = [];
    
    // 串行处理，避免并发限制
    for (let i = 0; i < prompts.length; i++) {
      try {
        // 直接调用生成图像逻辑
        const imageRequest = {
          auth: request.auth,
          data: {
            prompt: prompts[i],
            pageIndex: i
            // 移除seed参数，因为启用水印时不支持seed
          }
        };
        const result = await exports.generateImage(imageRequest);
        
        results.push({
          pageIndex: i,
          success: true,
          imageUrl: result.imageUrl
        });
      } catch (error) {
        console.error(`Failed to generate image for page ${i + 1}:`, error);
        results.push({
          pageIndex: i,
          success: false,
          error: error.message
        });
      }
    }

    return {
      results: results,
      totalPages: prompts.length,
      successCount: results.filter(r => r.success).length
    };

  } catch (error) {
    console.error('Error in batch generation:', error);
    throw new HttpsError('internal', `Batch generation failed: ${error.message}`);
  }
});

// 健康检查函数
exports.healthCheck = onCall(() => {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'tale-draw-functions'
  };
});

// 故事页面生成函数
exports.generateStoryPages = onCall(async (request) => {
  // 验证用户认证
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { storyText, pageCount = 6, aspectRatio = '16:9' } = request.data;

  if (!storyText || !storyText.trim()) {
    throw new HttpsError('invalid-argument', 'Story text is required');
  }

  try {
    console.log('Generating story pages with Vertex AI Gemini...');

    // 初始化Google Auth
    const auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });

    // 获取访问令牌
    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();

    // 创建智能的故事分页提示词 - 采用全局规划方式
    const prompt = `
你是一位专业的儿童绘本编辑师。请分析并将以下故事改编为${pageCount}页的绘本，确保故事完整性和合理分布。

**第一步：全局分析**
首先分析故事的完整结构：
1. 故事总长度和复杂度评估
2. 识别关键情节点和转折点
3. 确定故事的开始、发展、高潮、结局
4. 分析所有重要角色和场景

**第二步：分页规划**
根据${pageCount}页的容量进行合理规划：
1. 确保故事的每个重要部分都被包含（不能遗漏30-40%的内容）
2. 避免最后几页重复或凑数
3. 每页内容量要均衡，避免前松后紧
4. 确保情节发展的连贯性和节奏感

**第三步：角色一致性管理**
1. 识别故事中的所有重要角色（主角和配角）
2. 为每个角色建立统一的外观描述
3. 确保角色在不同页面中保持视觉一致性

**重要约束：**
- 必须覆盖原故事的100%内容，不能省略任何重要情节
- 每页文字内容要适中，避免信息过载
- 严格控制角色出现的逻辑性
- 图像中绝对不能包含任何文字、标识、符号等
- 保持儿童绘本的温馨画风

**原故事内容：**
${storyText}

**请务必确保以下要点：**
1. 故事开头到结尾的完整呈现
2. 关键情节的合理分布
3. 避免内容重复或凑数
4. 每页都有独特且有意义的内容

**第四步：标题创作**
为故事创作一个吸引人的标题：
1. 标题要体现故事的核心主题和精神
2. 适合儿童绘本，简洁易记
3. 与输入故事的语言保持一致
4. 可以包含主角名称或关键元素

请严格按照以下JSON格式返回：

{
  "storyTitle": "为故事生成的吸引人标题（与输入语言一致）",
  "storyAnalysis": {
    "totalLength": "故事长度评估（短/中/长）",
    "keyPlots": ["关键情节点1", "关键情节点2", "..."],
    "storyStructure": {
      "beginning": "开始部分摘要",
      "development": "发展部分摘要", 
      "climax": "高潮部分摘要",
      "ending": "结局部分摘要"
    }
  },
  "pagePlanStrategy": {
    "contentDistribution": "内容分布策略说明",
    "plotMapping": ["第1页情节", "第2页情节", "..."]
  },
  "mainCharacter": "主角的统一描述（外观特征详细描述）",
  "characterType": "人物|动物|拟人物体|抽象角色",
  "artStyle": "整体绘画风格描述",
  "allCharacters": {
    "主角名称": "主角详细外观描述",
    "配角名称": "配角详细外观描述"
  },
  "pages": [
    {
      "pageNumber": 1,
      "title": "每页的吸引人小标题（与输入故事语言一致，简洁概括本页主要内容或情节，3-8个字）",
      "plotPosition": "开始|发展|高潮|结局",
      "text": "页面文字内容（与输入故事语言一致，确保不遗漏重要信息）",
      "sceneCharacters": ["此页面应该出现的角色名称"],
      "sceneType": "主角场景|配角场景|群体场景|无角色场景",
      "keyPlotPoint": "本页承载的关键情节",
      "imagePrompt": "详细的英文图像生成提示词，明确指出应该出现的角色外观，并排除其他角色，以', children's book illustration style, warm colors, absolutely no text, no words, no letters, no signs, no symbols, no writing, no captions'结尾"
    }
  ]
}
`;

    // 调用Vertex AI Gemini 2.0 Flash API (最新推荐模型)
    const apiUrl = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/gemini-2.0-flash:generateContent`;
    
    const requestBody = {
      contents: [{
        role: "user",
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8000, // 提升到8000 tokens以支持更长的故事和更多页数
        responseMimeType: "application/json"
      }
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken.token}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Vertex AI Gemini API error:', response.status, errorText);
      throw new Error(`Vertex AI Gemini API failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    // 解析Gemini响应
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      console.error('Invalid Vertex AI Gemini API response structure:', data);
      throw new Error('Invalid response structure from Vertex AI Gemini API');
    }

    const generatedText = data.candidates[0].content.parts[0].text;
    console.log('Generated story pages:', generatedText);

    // 尝试解析JSON响应
    let pagesData;
    try {
      pagesData = JSON.parse(generatedText);
    } catch (parseError) {
      console.error('Failed to parse JSON response:', generatedText);
      
      // 如果JSON解析失败，返回错误
      throw new Error('Failed to parse story pages from Gemini response');
    }

    // 验证返回的数据结构
    if (!pagesData.pages || !Array.isArray(pagesData.pages)) {
      throw new Error('Invalid pages structure in Gemini response');
    }

    console.log('Story pages generation successful:', {
      storyTitle: pagesData.storyTitle,
      pages: pagesData.pages.length,
      mainCharacter: pagesData.mainCharacter,
      characterType: pagesData.characterType,
      artStyle: pagesData.artStyle,
      allCharacters: pagesData.allCharacters ? Object.keys(pagesData.allCharacters).length : 0,
      storyLength: pagesData.storyAnalysis?.totalLength,
      keyPlots: pagesData.storyAnalysis?.keyPlots?.length || 0,
      contentDistribution: pagesData.pagePlanStrategy?.contentDistribution
    });

    return {
      storyTitle: pagesData.storyTitle || '未命名故事',
      pages: pagesData.pages,
      pageCount: pagesData.pages.length,
      mainCharacter: pagesData.mainCharacter || '故事主角',
      characterType: pagesData.characterType || '故事角色',
      artStyle: pagesData.artStyle || '儿童绘本插画风格',
      allCharacters: pagesData.allCharacters || {},
      storyAnalysis: pagesData.storyAnalysis || {},
      pagePlanStrategy: pagesData.pagePlanStrategy || {},
      aspectRatio: aspectRatio,
      success: true,
      generatedAt: new Date().toISOString()
    };

  } catch (error) {
    console.error('Error generating story pages:', error);
    
    if (error instanceof HttpsError) {
      throw error;
    }

    // 提供更详细的错误信息
    let errorMessage = `Failed to generate story pages: ${error.message}`;
    throw new HttpsError('internal', errorMessage);
  }
});

// 角色提取函数
exports.extractCharacter = onCall(async (request) => {
  // 验证用户认证
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { story } = request.data;

  if (!story || !story.trim()) {
    throw new HttpsError('invalid-argument', 'Story content is required');
  }

  try {
    console.log('Extracting character from story...');

    // 初始化Google Auth
    const auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });

    // 获取访问令牌
    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();

    // 创建角色提取的提示词
    const characterExtractionPrompt = `
分析以下故事，提取最主要的一个角色信息：

故事内容：
${story.trim()}

要求：
1. 识别故事中最重要的主角
2. 生成详细的外观描述，包括年龄、性别、外貌特征、穿着、配饰等
3. 确保描述足够详细以保持视觉一致性
4. 使用与故事相同的语言回复
5. **重要：角色应该适合儿童绘本**

请返回JSON格式：
{
  "name": "角色名称",
  "description": "详细的外观描述，包括年龄、性别、外貌、穿着等特征"
}

只返回JSON，不要其他内容。
`;

    // 调用Vertex AI Gemini 2.0 Flash Lite API (轻量级快速模型)
    const apiUrl = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/gemini-2.0-flash-lite:generateContent`;
    
    const requestBody = {
      contents: [{
        role: "user",
        parts: [{
          text: characterExtractionPrompt
        }]
      }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2000, // 适度提升角色提取的token限制
        responseMimeType: "application/json"
      }
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken.token}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', response.status, errorText);
      throw new Error(`Gemini API failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    // 解析Gemini响应
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      console.error('Invalid Gemini API response structure:', data);
      throw new Error('Invalid response structure from Gemini API');
    }

    const generatedText = data.candidates[0].content.parts[0].text;
    console.log('Generated character info:', generatedText);

    // 尝试解析JSON响应
    let characterInfo;
    try {
      characterInfo = JSON.parse(generatedText);
    } catch (parseError) {
      console.error('Failed to parse JSON response:', generatedText);
      
      // 如果JSON解析失败，使用默认格式
      const lines = generatedText.split('\n').filter(line => line.trim());
      characterInfo = {
        name: '主角',
        description: lines.length > 0 ? lines.join(' ') : '故事中的主要角色'
      };
    }

    // 验证返回的数据结构
    if (!characterInfo.name) {
      characterInfo.name = '主角';
    }
    if (!characterInfo.description) {
      characterInfo.description = '故事中的主要角色，具有独特的个性和外观特征';
    }

    console.log('Character extraction successful:', characterInfo);

    return {
      name: characterInfo.name,
      description: characterInfo.description,
      success: true,
      extractedAt: new Date().toISOString()
    };

  } catch (error) {
    console.error('Error extracting character:', error);
    
    if (error instanceof HttpsError) {
      throw error;
    }

    // 提供更详细的错误信息
    let errorMessage = `Failed to extract character: ${error.message}`;
    throw new HttpsError('internal', errorMessage);
  }
});

