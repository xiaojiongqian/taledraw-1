const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2/options');
const admin = require('firebase-admin');
const { GoogleAuth } = require('google-auth-library');
// 使用Node.js 22内置的全局fetch，无需导入

// 设置全局选项
setGlobalOptions({ region: 'us-central1' });

// 初始化Firebase Admin
admin.initializeApp();

// GCP配置
const PROJECT_ID = 'ai-app-taskforce';
const LOCATION = 'us-central1';

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

  const { prompt, pageIndex = 0, seed = 42, aspectRatio = '16:9', maxRetries = 2 } = request.data;

  if (!prompt) {
    throw new HttpsError('invalid-argument', 'Prompt is required');
  }

  // 将用户友好的比例转换为Imagen API支持的格式
  const aspectRatioMapping = {
    '16:9': '16:9',
    '9:16': '9:16'
  };
  
  const imagenAspectRatio = aspectRatioMapping[aspectRatio] || '16:9';

  // 创建Imagen API调用函数
  const callImagenAPI = async () => {
    console.log(`Generating image for page ${pageIndex + 1} with aspect ratio ${aspectRatio} (${imagenAspectRatio}) and prompt: ${prompt.substring(0, 100)}...`);

    // 初始化Google Auth
    const auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });

    // 获取访问令牌
    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();

    // 调用Imagen 4 API (最新版本)
    const apiUrl = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/imagen-4.0-generate-preview-06-06:predict`;
    
    const requestBody = {
      instances: [{
        prompt: prompt
      }],
      parameters: {
        sampleCount: 1,
        aspectRatio: imagenAspectRatio, // 使用动态长宽比
        addWatermark: false,
        seed: seed + pageIndex,
        safetySetting: "block_medium_and_above",
        personGeneration: "allow_adult"
      }
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Imagen API error:', response.status, errorText);
      
      // 创建包含状态码的错误对象
      const error = new Error(`Imagen API failed: ${response.status} - ${errorText}`);
      error.status = response.status;
      throw error;
    }

    const data = await response.json();
    
    // 添加详细的响应日志
    console.log('Imagen API Response:', JSON.stringify(data, null, 2));

    if (!data.predictions || !data.predictions[0] || !data.predictions[0].bytesBase64Encoded) {
      console.error('Invalid Imagen API response structure:', {
        hasPredictions: !!data.predictions,
        predictionsLength: data.predictions ? data.predictions.length : 0,
        firstPrediction: data.predictions && data.predictions[0] ? Object.keys(data.predictions[0]) : 'N/A',
        fullResponse: data
      });
      throw new Error('Invalid response structure from Imagen API');
    }

    return data.predictions[0].bytesBase64Encoded;
  };

  try {
    // 使用重试机制调用Imagen API
    const base64Data = await retryWithBackoff(callImagenAPI, maxRetries, 1500);

    // 上传到Firebase Storage
    // 明确指定bucket名称 (新版Firebase格式)
    const bucketName = `${PROJECT_ID}.firebasestorage.app`;
    const bucket = admin.storage().bucket(bucketName);
    const fileName = `tale-images/${request.auth.uid}/${Date.now()}_page_${pageIndex}.jpg`;
    const file = bucket.file(fileName);

    // 将base64转换为Buffer
    const imageBuffer = Buffer.from(base64Data, 'base64');

    // 上传图像
    await file.save(imageBuffer, {
      metadata: {
        contentType: 'image/jpeg',
        metadata: {
          userId: request.auth.uid,
          pageIndex: pageIndex.toString(),
          prompt: prompt.substring(0, 500) // 限制长度
        }
      }
    });

    // 使图像公开访问
    await file.makePublic();

    // 获取公开URL
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;

    console.log(`Image generated successfully for page ${pageIndex + 1} after retries`);

    return {
      imageUrl: publicUrl,
      pageIndex: pageIndex,
      success: true
    };

  } catch (error) {
    console.error(`Error generating image for page ${pageIndex + 1} after ${maxRetries + 1} attempts:`, error);
    
    if (error instanceof HttpsError) {
      throw error;
    }

    // 提供更详细的错误信息
    let errorMessage = `Failed to generate image: ${error.message}`;
    if (error.status) {
      errorMessage += ` (HTTP ${error.status})`;
    }

    throw new HttpsError('internal', errorMessage);
  }
});

// 批量生成图像函数（可选）
exports.generateImageBatch = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { prompts, seed = 42 } = request.data;

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
            pageIndex: i,
            seed: seed
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