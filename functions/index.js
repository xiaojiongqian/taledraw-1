const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2/options');
const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const { GoogleAuth } = require('google-auth-library');
// 使用Node.js 22内置的全局fetch，无需导入

// 设置全局选项
setGlobalOptions({ region: 'us-central1' });

// 初始化Firebase Admin
admin.initializeApp();

// GCP配置
const PROJECT_ID = 'ai-app-taskforce';
const LOCATION = 'us-central1'; // 使用支持Gemini的主要区域

// 全局初始化Google Auth客户端，以供所有函数复用
const auth = new GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/cloud-platform']
});

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
exports.generateImage = onCall({ region: 'us-central1' }, async (request) => {
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

  console.log('[generateImage] request.data:', JSON.stringify(request.data));

  if (!prompt) {
    console.error('[generateImage] prompt is missing!');
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
  const callImagenAPI = async (accessToken) => {
    // 使用 imagen-3.0-generate-002 进行纯文本到图像生成
    // 不再处理参考图像，风格一致性通过种子值和增强提示词实现
    
    try {
      console.log(`Generating image for page ${pageIndex + 1} with aspect ratio ${aspectRatio} (${imagenAspectRatio})`);

      if (!accessToken) {
        throw new Error('Access token was not provided to callImagenAPI.');
      }

      // 使用 imagen-3.0-generate-002 模型，该模型支持图像生成
      // 注意：imagen-3.0-capability-001 不支持图像生成，只支持图像编辑
      const modelName = 'imagen-3.0-generate-002';
      const apiUrl = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${modelName}:predict`;
      
      console.log('[generateImage] Using API URL:', apiUrl);
      console.log('[generateImage] Using model:', modelName);

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

      console.log('[generateImage] Request body:', JSON.stringify(requestBody, null, 2));

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify(requestBody)
      });

      console.log('API Response Status:', response.status);
      console.log('API Response Headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[generateImage] Imagen API error details:', {
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
              'Authorization': `Bearer ${accessToken}`,
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
      console.log('[generateImage] Raw API Response Text:', responseText);
      console.log('[generateImage] Response Text Length:', responseText.length);

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
        console.error('[generateImage] Failed to parse response as JSON:', parseError);
        console.error('[generateImage] Response text that failed to parse:', responseText);
        throw new Error(`Invalid JSON response from Imagen API: ${parseError.message}`);
      }
      
      console.log('[generateImage] API Response structure:', {
        hasPredictions: !!data.predictions,
        predictionsLength: data.predictions ? data.predictions.length : 0,
        keys: Object.keys(data),
        fullResponse: data
      });
      
      // 检查响应是否有错误信息
      if (data.error) {
        console.error('[generateImage] Imagen API returned error in response:', data.error);
        throw new Error(`Imagen API error: ${JSON.stringify(data.error)}`);
      }

      if (!data.predictions || !data.predictions[0]) {
        console.error('[generateImage] Invalid Imagen API response structure:', data);
        throw new Error('Invalid response structure from Imagen API - no predictions');
      }

      const prediction = data.predictions[0];
      if (!prediction.bytesBase64Encoded) {
        console.error('[generateImage] No image data in prediction:', Object.keys(prediction));
        throw new Error('No image data in Imagen API response');
      }

      console.log('Successfully received image data from Imagen API');
      return prediction.bytesBase64Encoded;

    } catch (error) {
      console.error('[generateImage] Error in callImagenAPI:', error);
      throw error;
    }
  };

  try {
    // 在主函数入口处获取一次Token
    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();

    if (!accessToken || !accessToken.token) {
      throw new HttpsError('internal', 'Failed to acquire access token.');
    }

    // 调用Imagen API，并传入Token
    const base64Data = await callImagenAPI(accessToken.token);

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
exports.generateImageBatch = onCall({ region: 'us-central1' }, async (request) => {
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
exports.healthCheck = onCall({ region: 'us-central1' }, () => {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'tale-draw-functions'
  };
});

// 注意：原 generateStoryPages 函数已移除，现在直接使用优化的 generateTale 函数

// 角色提取函数
exports.extractCharacter = onCall({ region: 'us-central1' }, async (request) => {
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

    // 获取访问令牌 (复用全局auth实例)
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

**内容安全指导：**
在描述角色外观时，请确保：
- 避免任何可能被认为是刻板印象的特征描述
- 如果原故事中角色有负面特征，转化为中性或正面的外观描述
- 强调友善、温和的面部表情和身体语言
- 服装和配饰应该适合儿童观看，避免过于复杂或可能引起争议的元素
- 确保描述包容性强，适合多元化的读者群体

请返回JSON格式：
{
  "name": "角色名称",
  "description": "详细的外观描述，包括年龄、性别、外貌、穿着等特征"
}

只返回JSON，不要其他内容。
`;

    const geminiResponse = await callGemini(accessToken.token, characterExtractionPrompt, story);
    const characterData = JSON.parse(geminiResponse);
    
    return {
      name: characterData.name || '主角',
      description: characterData.description || '故事中的主要角色'
    };

  } catch (error) {
    console.error('Error extracting character:', error);
    throw new HttpsError('internal', `Character extraction failed: ${error.message}`);
  }
});

async function callGemini(accessToken, systemPrompt, story) {
  const model = 'gemini-2.5-flash';
  const apiUrl = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${model}:generateContent`;

  try {
    if (!accessToken) {
      throw new Error('Access token was not provided to callGemini.');
    }

    const requestBody = {
      contents: [{
        role: "user",
        parts: [{ text: story }]
      }],
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
      generationConfig: {
        temperature: 0.8,
        topP: 0.95,
        maxOutputTokens: 32768, // 增加输出token限制以利用Gemini 2.5 Flash的能力
        responseMimeType: "application/json"
      }
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', { status: response.status, body: errorText });
      throw new Error(`Gemini API failed with status ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts[0].text) {
      console.error('Invalid Gemini API response structure:', JSON.stringify(data, null, 2));
      throw new Error('Invalid or empty response structure from Gemini API.');
    }

    const generatedText = data.candidates[0].content.parts[0].text;
    console.log('Successfully received structured data from Gemini 2.5 Flash.');
    return generatedText;

  } catch (error) {
    console.error('Error in callGemini function:', error);
    throw new HttpsError('internal', `The call to Gemini API failed: ${error.message}`);
  }
}

exports.generateTale = onCall({
  region: 'us-central1',
  timeoutSeconds: 540,
  memory: '1GiB'
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated to generate a tale.');
  }

  const { story, pageCount = 10, aspectRatio = '16:9' } = request.data;
  console.log('Received generation request:', {
    userId: request.auth.uid,
    storyLength: story.length,
    pageCount,
    aspectRatio
  });

  const systemPrompt = `
You are a professional children's storybook editor and creative assistant. Your task is to transform a user-submitted story into a complete ${pageCount}-page illustrated storybook with consistent character design and child-friendly content.

## WORKFLOW OVERVIEW

### STEP 1: GLOBAL STORY ANALYSIS
Analyze the complete story structure:
- Assess total story length and complexity
- Identify key plot points and turning points
- Map story arc: beginning → development → climax → resolution
- Catalog all important characters and settings
- Ensure NO content will be omitted (cover 100% of original story)

### STEP 2: CHARACTER CONSISTENCY MANAGEMENT
For EACH main character appearing in the story:
- Create detailed character sheet with physical appearance (hair, eyes, build, age, distinctive features)
- Define consistent clothing/attire description
- Note personality traits that affect visual representation
- Ensure descriptions work across all cultural contexts
- These descriptions will be referenced in every image prompt featuring that character

### STEP 3: CONTENT SAFETY OPTIMIZATION
Transform any potentially problematic content using child-friendly alternatives:
- Violence/conflict → "friendly competition" or "discussion to resolve differences"
- Horror/scary elements → "mysterious adventure" or "interesting challenge"
- Negative emotions → "confusion" or "need for help"
- Dangerous activities → "safe exploration under adult supervision"
- Cultural stereotypes → inclusive, diverse descriptions
**Goal**: Maintain story essence while ensuring high image generation success rate

### STEP 4: PAGE DISTRIBUTION STRATEGY
Distribute content across ${pageCount} pages ensuring:
- Balanced content per page (avoid front-loaded or back-loaded distribution)
- Complete story coverage (no important plot omissions)
- No repetitive or filler content
- Logical narrative flow and pacing
- Each page contributes meaningfully to the story

### STEP 5: ART STYLE IDENTIFICATION
Determine the most appropriate visual style based on:
- Story genre and mood
- Target age group
- Cultural context
- Character types (human/animal/fantasy)

## OUTPUT REQUIREMENTS

Return a single valid JSON object with this exact structure:

{
  "storyTitle": "Creative, engaging title in the same language as input story",
  "artStyle": "Specific art style description (e.g., 'children's book watercolor illustration', 'cartoon style digital art')",
  "storyAnalysis": {
    "totalLength": "short|medium|long",
    "keyPlots": ["plot point 1", "plot point 2", "..."],
    "storyStructure": {
      "beginning": "beginning summary",
      "development": "development summary", 
      "climax": "climax summary",
      "ending": "ending summary"
    }
  },
  "allCharacters": {
    "Character Name 1": {
      "appearance": "Detailed physical description including age, build, facial features, hair, distinctive characteristics",
      "clothing": "Typical attire, accessories, colors, style",
      "personality": "Key personality traits that affect visual representation (e.g., confident posture, shy demeanor)"
    },
    "Character Name 2": {
      "appearance": "...",
      "clothing": "...",
      "personality": "..."
    }
  },
  "pages": [
    {
      "pageNumber": 1,
      "title": "Brief page title in same language as story (3-8 words)",
      "text": "Page content in same language as input story, ensuring story completeness",
      "sceneType": "Brief setting description (e.g., 'enchanted forest', 'cozy kitchen')",
      "sceneCharacters": ["Character names present in this scene"],
      "imagePrompt": "Detailed English prompt starting with the identified art style. Include specific character descriptions from character sheets for any characters present. Describe scene, actions, expressions, mood. End with: ', children's book illustration style, warm and friendly colors, safe and welcoming atmosphere, absolutely no text, no words, no letters, no signs, no symbols, no writing, no captions'",
      "scenePrompt": "Scene/setting portion of the imagePrompt",
      "characterPrompts": "Character description portion of the imagePrompt"
    }
  ]
}

## CRITICAL REQUIREMENTS
- Use the SAME LANGUAGE as the input story for all text content (title, page text)
- Use ENGLISH for imagePrompt, scenePrompt, characterPrompts (for optimal image generation)
- Include ALL story content across pages (no omissions)
- Maintain character visual consistency through detailed character sheets
- Apply content safety transformations while preserving story meaning
- Ensure each page has unique, meaningful content (no filler or repetition)

## EXAMPLE CHARACTER SHEET
"Leo": {
  "appearance": "An 8-year-old boy with messy brown curly hair, bright green eyes, freckles across his nose, medium build for his age, cheerful facial expression",
  "clothing": "Red and white striped t-shirt, blue denim shorts, white sneakers with blue laces, small brown backpack",
  "personality": "Curious and adventurous, confident posture, tends to lean forward when interested, expressive hand gestures"
}

Analyze this story and transform it according to the above requirements:

${story}
`;

  try {
    // 在主函数入口处获取一次Token
    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();

    if (!accessToken || !accessToken.token) {
      throw new HttpsError('internal', 'Failed to acquire access token for tale generation.');
    }
    
    const geminiResponse = await callGemini(accessToken.token, systemPrompt, story);
    const taleData = JSON.parse(geminiResponse);

    // Validate the response structure
    if (!taleData.pages || !Array.isArray(taleData.pages)) {
      throw new Error('Invalid pages structure in Gemini response');
    }

    console.log('Story generation successful:', {
      storyTitle: taleData.storyTitle,
      pages: taleData.pages.length,
      artStyle: taleData.artStyle,
      characterCount: taleData.allCharacters ? Object.keys(taleData.allCharacters).length : 0
    });

    return {
      pages: taleData.pages || [],
      storyTitle: taleData.storyTitle || 'Untitled Story',
      artStyle: taleData.artStyle || 'children\'s book illustration',
      allCharacters: taleData.allCharacters || {},
      storyAnalysis: taleData.storyAnalysis || {},
      aspectRatio: aspectRatio,
      success: true,
      generatedAt: new Date().toISOString()
    };

  } catch (error) {
    console.error('Error in generateTale:', error);
    throw new HttpsError('internal', 'Failed to generate tale: ' + error.message);
  }
});

// ========== Imagen 4 专用函数组 ========== //

const IMAGEN4_PROJECT_ID = 'ai-app-taskforce';
const IMAGEN4_LOCATION = 'us-central1';
const IMAGEN4_MODEL = 'imagen-4.0-generate-preview-06-06';

/**
 * 专用函数组：使用Imagen 4生成图像
 * - 使用 us-central1 区域
 * - 模型：imagen-4.0-generate-preview-06-06
 * - 支持一致的角色生成
 * - 更好的提示词理解能力
 * - 更高的图像质量
 */
exports.generateImageV4 = onCall(
  {
    region: "us-central1", //  Imagen 4 专用
    timeoutSeconds: 540,
    memory: "4GB",
    minInstances: 0,
    concurrency: 1, // 根据需要调整并发
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "User must be authenticated");
    }

    const {
      prompt,
      pageIndex = 0,
      aspectRatio = '16:9',
      maxRetries = 2,
      seed = 42,
      sampleCount = 1,
      safetyFilterLevel = 'OFF',
      personGeneration = 'allow_all',
      addWatermark = false,
      negativePrompt
    } = request.data;

    console.log('[generateImageV4] request.data:', JSON.stringify(request.data));

    if (!prompt) {
      console.error('[generateImageV4] prompt is missing!');
      throw new HttpsError('invalid-argument', 'Prompt is required');
    }

    // 将用户友好的比例转换为Imagen API支持的格式
    const aspectRatioMapping = {
      '16:9': '16:9',
      '9:16': '9:16',
      '1:1': '1:1',
      '3:4': '3:4',
      '4:3': '4:3'
    };
    const imagenAspectRatio = aspectRatioMapping[aspectRatio] || '16:9';

    // 构建Imagen 4 API调用
    const callImagen4API = async (accessToken) => {
      try {
        if (!accessToken) {
          throw new Error('Access token was not provided to callImagen4API.');
        }

        const apiUrl = `https://${IMAGEN4_LOCATION}-aiplatform.googleapis.com/v1/projects/${IMAGEN4_PROJECT_ID}/locations/${IMAGEN4_LOCATION}/publishers/google/models/${IMAGEN4_MODEL}:predict`;
        const instance = { prompt };
        const parameters = {
          sampleCount: Math.min(Math.max(1, sampleCount), 4),
          safetyFilterLevel: safetyFilterLevel,
          addWatermark: addWatermark
        };
        const promptLower = prompt.toLowerCase();
        const hasPersonKeywords = /person|people|man|woman|boy|girl|child|adult|human|character|protagonist|hero|heroine/.test(promptLower);
        if (hasPersonKeywords) {
          parameters.personGeneration = personGeneration || 'allow_all';
        }
        if (seed && typeof seed === 'number') {
          parameters.seed = seed;
        }
        if (aspectRatio && aspectRatio !== '1:1') {
          parameters.aspectRatio = imagenAspectRatio;
        }
        const requestBody = {
          instances: [instance],
          parameters: parameters
        };
        console.log('[generateImageV4] API URL:', apiUrl);
        console.log('[generateImageV4] requestBody:', JSON.stringify(requestBody));
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json; charset=utf-8',
          },
          body: JSON.stringify(requestBody)
        });
        const responseText = await response.text();
        console.log('[generateImageV4] Imagen 4 API raw response:', responseText);
        if (!response.ok) {
          let errorMessage = `Imagen 4 API failed: ${response.status}`;
          errorMessage += ` - ${responseText}`;
          const error = new Error(errorMessage);
          error.status = response.status;
          throw error;
        }
        if (!responseText || responseText.trim() === '') {
          throw new Error('Empty response from Imagen 4 API');
        }
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (parseError) {
          console.error('[generateImageV4] Failed to parse Imagen 4 API response as JSON:', responseText);
          throw new Error(`Invalid JSON response from Imagen 4 API: ${parseError.message}`);
        }
        if (data.error) {
          console.error('[generateImageV4] Imagen 4 API returned error:', data.error);
          throw new Error(`Imagen 4 API error: ${JSON.stringify(data.error)}`);
        }
        if (!data.predictions || !data.predictions[0]) {
          console.error('[generateImageV4] Invalid response structure from Imagen 4 API:', data);
          throw new Error('Invalid response structure from Imagen 4 API - no predictions. Full response: ' + JSON.stringify(data));
        }
        const prediction = data.predictions[0];
        if (!prediction.bytesBase64Encoded) {
          throw new Error('No image data in Imagen 4 API response');
        }
        return prediction.bytesBase64Encoded;
      } catch (error) {
        console.error('[generateImageV4] Exception:', {
          prompt,
          pageIndex,
          aspectRatio,
          seed,
          sampleCount,
          safetyFilterLevel,
          personGeneration,
          addWatermark,
          apiUrl: typeof apiUrl !== 'undefined' ? apiUrl : null,
          requestBody: typeof requestBody !== 'undefined' ? requestBody : null,
          error: error && error.message ? error.message : error
        });
        throw error;
      }
    };

    try {
      // 在主函数入口处获取一次Token
      const client = await auth.getClient();
      const accessToken = await client.getAccessToken();

      if (!accessToken || !accessToken.token) {
        throw new HttpsError('internal', 'Failed to acquire access token for Imagen4.');
      }

      const base64Data = await callImagen4API(accessToken.token);
      // 上传到Firebase Storage
      const bucketName = `${IMAGEN4_PROJECT_ID}.firebasestorage.app`;
      const bucket = admin.storage().bucket(bucketName);
      const fileName = `tale-images-v4/${request.auth.uid}/${Date.now()}_page_${pageIndex}.jpg`;
      const file = bucket.file(fileName);
      const imageBuffer = Buffer.from(base64Data, 'base64');
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
      await file.makePublic();
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
      return {
        imageUrl: publicUrl,
        pageIndex: pageIndex,
        success: true
      };
    } catch (error) {
      let errorMessage = `Failed to generate image (Imagen 4): ${error.message}`;
      if (error.status) {
        errorMessage += ` (HTTP ${error.status})`;
      }
      throw new HttpsError('internal', errorMessage);
    }
  }
);

exports.generateImageBatchV4 = onCall(
  { region: 'us-central1' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }
    const { prompts } = request.data;
    if (!prompts || !Array.isArray(prompts)) {
      throw new HttpsError('invalid-argument', 'Prompts array is required');
    }
    try {
      const results = [];
      for (let i = 0; i < prompts.length; i++) {
        try {
          const imageRequest = {
            auth: request.auth,
            data: {
              prompt: prompts[i],
              pageIndex: i
            }
          };
          const result = await exports.generateImageV4(imageRequest);
          results.push({
            pageIndex: i,
            success: true,
            imageUrl: result.imageUrl
          });
        } catch (error) {
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
      throw new HttpsError('internal', `Batch generation (Imagen 4) failed: ${error.message}`);
    }
  }
);

