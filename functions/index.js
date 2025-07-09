const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2/options');
const admin = require('firebase-admin');
const { GoogleAuth } = require('google-auth-library');
const zlib = require('zlib');
const cors = require('cors')({origin: true});
const sharp = require('sharp');
const Stripe = require('stripe'); // Stripe SDK

// 导入集中配置
const {
  PROJECT_ID,
  LOCATION,
  STORAGE_MODE,
  API_CONFIG,
  STORAGE_CONFIG,
  STRIPE_CONFIG,
  PROMPTS,
  UTILS
} = require('./config');

// 导入安全日志工具
const { functionsLog } = require('./utils/logger');

// 设置全局选项
setGlobalOptions({ region: LOCATION });

// 初始化Firebase Admin
admin.initializeApp();

functionsLog.info(`Storage mode: ${STORAGE_MODE}`);
functionsLog.info(`Storage bucket: ${STORAGE_CONFIG.DEFAULT_BUCKET}`);

// 通用存储策略
class TaleStorageStrategy {
  static async saveTaleData(userId, taleData) {
    const taleId = admin.firestore().collection('tmp').doc().id;
    if (STORAGE_MODE === 'firestore') {
      return this.saveToFirestore(userId, taleId, taleData);
    }
    return this.saveToCloudStorage(userId, taleId, taleData);
  }

  static async getTaleData(userId, taleId) {
    if (STORAGE_MODE === 'firestore') {
      return this.getFromFirestore(userId, taleId);
    }
    return this.getFromCloudStorage(userId, taleId);
  }

  // Firestore implementation (fallback)
  static async saveToFirestore(userId, taleId, taleData) {
    const docRef = admin.firestore().collection('users').doc(userId).collection('tales').doc(taleId);
    await docRef.set({ ...taleData, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    return { success: true, taleId, storageMode: 'firestore' };
  }

  static async getFromFirestore(userId, taleId) {
    const docRef = admin.firestore().collection('users').doc(userId).collection('tales').doc(taleId);
    const doc = await docRef.get();
    if (!doc.exists) throw new HttpsError('not-found', 'Tale not found.');
    return doc.data();
  }

  // Cloud Storage implementation (preferred for large data)
  static async saveToCloudStorage(userId, taleId, taleData) {
    const bucketName = UTILS.getBucketName();
    const bucket = admin.storage().bucket(bucketName);
    const fileName = UTILS.buildFilePath(userId, taleId);
    const file = bucket.file(fileName);

    const jsonString = JSON.stringify(taleData);
    functionsLog.debug(`Tale data size: ${jsonString.length} characters`);
    
    // 智能压缩策略：分析数据内容决定压缩方式
    const compressionAnalysis = this.analyzeDataForCompression(taleData, jsonString);
    functionsLog.debug('Compression analysis:', compressionAnalysis);
    
    let finalData;
    let metadata;
    
    // 简化的压缩策略：文本数据使用gzip压缩
    functionsLog.debug('Applying gzip compression for text data');
    finalData = zlib.gzipSync(Buffer.from(jsonString, 'utf8'));
    metadata = {
      contentType: 'application/gzip',
      contentEncoding: 'gzip',
      'content-type': 'application/gzip; charset=utf-8',
      'compression-strategy': 'gzip-text', // 简化标识
      'data-type': compressionAnalysis.dataType,
      'original-size': jsonString.length.toString()
    };
    
    const compressionRatio = ((jsonString.length - finalData.length) / jsonString.length * 100).toFixed(1);
    
    functionsLog.debug(`Final storage size: ${finalData.length} bytes, compression: ${compressionRatio}%`);
    functionsLog.debug('Simplified compression strategy: gzip applied');
    
    // 添加内存使用监控
    const memoryUsage = process.memoryUsage();
    functionsLog.debug(`Memory usage - RSS: ${Math.round(memoryUsage.rss / 1024 / 1024)}MB, Heap: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`);

    await file.save(finalData, { metadata });
    return { 
      success: true, 
      taleId, 
      storageMode: 'cloud_storage',
      compressionStrategy: 'gzip',
      compressionRatio: compressionRatio
    };
  }

  // 简化的数据压缩策略：文本数据gzip压缩，二进制数据不压缩
  static analyzeDataForCompression(taleData, jsonString) {
    const analysis = {
      totalSize: jsonString.length,
      dataType: 'text', // JSON文本数据
      shouldCompress: true, // 文本数据始终压缩
      reason: 'text-data-compression'
    };

    functionsLog.debug(`Simplified compression strategy: COMPRESS text data (${analysis.totalSize} chars)`);
    
    return analysis;
  }

  static async getFromCloudStorage(userId, taleId) {
    const bucketName = UTILS.getBucketName();
    const bucket = admin.storage().bucket(bucketName);
    const fileName = UTILS.buildFilePath(userId, taleId);
    const file = bucket.file(fileName);

    functionsLog.debug(`Attempting to read tale from Cloud Storage: ${fileName}`);

    try {
      const [exists] = await file.exists();
      if (!exists) {
        functionsLog.error(`Tale file not found in Cloud Storage: ${fileName}`);
        throw new HttpsError('not-found', 'Tale not found in Cloud Storage.');
      }
    } catch (connectionError) {
      // 如果是连接错误（如模拟器未运行），视为文件不存在
      if (connectionError.code === 'ECONNREFUSED' || 
          connectionError.type === 'system' || 
          connectionError.message.includes('ECONNREFUSED')) {
        functionsLog.debug(`Storage connection failed (emulator offline?), treating as not-found: ${connectionError.message}`);
        throw new HttpsError('not-found', 'Tale not found - storage unavailable.');
      }
      // 其他连接错误重新抛出
      throw connectionError;
    }

    try {
      functionsLog.debug(`File exists, starting download: ${fileName}`);
      const [fileBuffer] = await file.download();
      functionsLog.debug(`Downloaded file size: ${fileBuffer.length} bytes`);
      
      // 获取文件元数据以了解压缩策略
      const [metadata] = await file.getMetadata();
      const compressionStrategy = metadata.metadata?.['compression-strategy'] || 'unknown';
      const originalSize = metadata.metadata?.['original-size'] || 'unknown';
      
      functionsLog.debug(`File metadata - compression strategy: ${compressionStrategy}, original size: ${originalSize}`);
      
      // 检查文件大小，如果过大则提供警告
      if (fileBuffer.length > 50 * 1024 * 1024) { // 50MB
        functionsLog.warn(`Large file detected: ${fileBuffer.length} bytes, this may cause memory issues`);
      }
      
      let jsonString;
      
      // 简化的解压缩策略：检测gzip压缩或直接读取
      if (compressionStrategy.includes('gzip') || this.isGzipFile(fileBuffer)) {
        functionsLog.debug('File is gzip compressed, decompressing...');
        try {
          jsonString = zlib.gunzipSync(fileBuffer).toString('utf8');
          functionsLog.debug(`Decompressed content length: ${jsonString.length} characters`);
        } catch (gzipError) {
          functionsLog.warn('Gzip decompression failed, trying as plain JSON:', gzipError.message);
          jsonString = fileBuffer.toString('utf8');
        }
      } else {
        functionsLog.debug('Reading as uncompressed JSON...');
        jsonString = fileBuffer.toString('utf8');
        functionsLog.debug(`Plain JSON content length: ${jsonString.length} characters`);
      }
      
      // 解析JSON
      const result = JSON.parse(jsonString);
      functionsLog.debug(`Successfully parsed tale data with ${result.pages ? result.pages.length : 0} pages`);
      
      // 简化的性能分析
      if (originalSize !== 'unknown' && !isNaN(originalSize)) {
        const actualOriginalSize = parseInt(originalSize);
        const compressionRatio = ((actualOriginalSize - fileBuffer.length) / actualOriginalSize * 100).toFixed(1);
        functionsLog.debug(`Compression efficiency: ${compressionRatio}% (${actualOriginalSize} → ${fileBuffer.length} bytes)`);
      }
      
      return result;
      
    } catch (error) {
      functionsLog.error('Error reading from Cloud Storage:', error);
      functionsLog.error(`File: ${fileName}, Error type: ${error.constructor.name}, Error: ${error.message}`);
      
      // Enhanced fallback handling
      if (error.message.includes('JSON') || error.message.includes('parse')) {
        functionsLog.debug('JSON parsing failed, attempting alternative approach...');
        try {
          const [retryBuffer] = await file.download();
          
          // Try different decompression approaches
          let alternativeJson = null;
          
          if (this.isGzipFile(retryBuffer)) {
            try {
              alternativeJson = zlib.gunzipSync(retryBuffer).toString('utf8');
              functionsLog.debug('Alternative gzip decompression succeeded');
            } catch (altGzipError) {
              functionsLog.debug('Alternative gzip also failed, trying raw');
              alternativeJson = retryBuffer.toString('utf8');
            }
          } else {
            alternativeJson = retryBuffer.toString('utf8');
          }
          
          // Clean up potential encoding issues
          const cleanJson = alternativeJson
            .replace(/[^\x20-\x7E\r\n\t]/g, '') // Keep only printable ASCII characters, newlines, carriage returns, and tabs
            .replace(/\uFFFD/g, '') // Remove replacement characters
            .trim();
          
          const result = JSON.parse(cleanJson);
          functionsLog.debug('Alternative parsing succeeded');
          return result;
          
        } catch (alternativeError) {
          functionsLog.error('Alternative parsing also failed:', alternativeError);
          throw new HttpsError('internal', 'Tale data is corrupted and cannot be read after multiple attempts.');
        }
      }
      
      // 提供更详细的错误信息
      if (error.message.includes('memory') || error.message.includes('heap')) {
        throw new HttpsError('internal', 'Tale data is too large to process. Please try again or contact support.');
      }
      
      throw new HttpsError('internal', `Failed to read tale data: ${error.message}`);
    }
  }

  // 检查文件是否为gzip格式
  static isGzipFile(buffer) {
    return buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b;
  }
}

// 全局初始化Google Auth客户端，以供所有函数复用
const auth = new GoogleAuth({
  scopes: 'https://www.googleapis.com/auth/cloud-platform'
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
      functionsLog.debug(`Imagen API attempt ${attempt + 1} failed, retrying in ${delay.toFixed(0)}ms...`);
      
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

// 图像压缩和格式转换函数 - 优化版本
async function compressImageToWebP(base64Data) {
  const startTime = Date.now();
  
  try {
    functionsLog.debug(`Starting WebP conversion for image of size: ${base64Data.length} characters`);
    
    // ✅ Base64 → 二进制转换性能监控（符合opt_base64_bin.md要求）
    functionsLog.debug('🔄 Base64 → Binary conversion: Processing Imagen API response...');
    functionsLog.debug(`📊 Input: Base64 string (${base64Data.length} chars, ~${Math.round(base64Data.length * 0.75 / 1024)}KB estimated binary)`);
    
    // 检查输入大小，避免处理过大的图像
    const estimatedImageSize = Math.round(base64Data.length * 0.75); // base64解码后的近似大小
    if (estimatedImageSize > 20 * 1024 * 1024) { // 20MB
      functionsLog.warn(`Large image detected (${estimatedImageSize} bytes), may cause memory issues`);
    }
    
    // ✅ 关键优化：立即转换Base64为二进制Buffer
    const conversionStartTime = Date.now();
    const imageBuffer = Buffer.from(base64Data, 'base64');
    const conversionTime = Date.now() - conversionStartTime;
    
    functionsLog.debug(`✅ Base64 → Binary conversion completed: ${imageBuffer.length} bytes in ${conversionTime}ms`);
    functionsLog.debug(`📈 Conversion efficiency: ${base64Data.length} chars → ${imageBuffer.length} bytes (${((base64Data.length - imageBuffer.length) / base64Data.length * 100).toFixed(1)}% reduction)`);
    
    // ✅ WebP压缩处理（在二进制数据上进行）
    functionsLog.debug('🗜️ WebP compression: Processing binary data...');
    const compressionStartTime = Date.now();
    
    // 直接转换为90%质量的WebP格式，添加内存监控
    const compressedBuffer = await sharp(imageBuffer)
      .webp({ quality: 90, effort: 1 }) // effort: 1 为最快压缩，减少内存使用
      .toBuffer();
    
    const compressionTime = Date.now() - compressionStartTime;
    const totalTime = Date.now() - startTime;
    
    const originalSize = imageBuffer.length;
    const compressedSize = compressedBuffer.length;
    const compressionRatio = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);
    
    // ✅ 完整的性能报告
    functionsLog.debug(`✅ WebP compression completed: ${originalSize} bytes → ${compressedSize} bytes (${compressionRatio}% reduction) in ${compressionTime}ms`);
    functionsLog.debug(`🏁 Total processing time: ${totalTime}ms (Base64→Binary: ${conversionTime}ms, WebP compression: ${compressionTime}ms)`);
    functionsLog.debug(`💾 Final output: Binary WebP (${compressedSize} bytes) ready for storage`);
    
    // ✅ 内存使用监控
    const memUsage = process.memoryUsage();
    functionsLog.debug(`�� Memory usage - RSS: ${Math.round(memUsage.rss / 1024 / 1024)}MB, Heap: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
    
    return compressedBuffer;
    
  } catch (error) {
    const errorTime = Date.now() - startTime;
    functionsLog.error('Error converting image to WebP:', error);
    functionsLog.debug(`❌ Error occurred after ${errorTime}ms of processing`);
    
    // 如果是内存相关错误，回退到原始格式
    if (error.message.includes('memory') || error.message.includes('heap') || error.message.includes('allocation')) {
      functionsLog.warn('WebP conversion failed due to memory constraints, falling back to original format');
      functionsLog.debug('🔄 Fallback: Base64 → Binary conversion (without WebP compression)');
      
      try {
        const fallbackStartTime = Date.now();
        
        // ✅ 回退：直接返回原始图像数据（作为 Buffer）
        const originalBuffer = Buffer.from(base64Data, 'base64');
        const fallbackTime = Date.now() - fallbackStartTime;
        
        functionsLog.debug(`✅ Fallback completed: ${originalBuffer.length} bytes in ${fallbackTime}ms`);
        functionsLog.debug(`📊 Fallback efficiency: Base64 (${base64Data.length} chars) → Binary (${originalBuffer.length} bytes)`);
        functionsLog.debug('💾 Final output: Original binary format (no WebP compression)');
        
        return originalBuffer;
      } catch (fallbackError) {
        functionsLog.error('Fallback to original format also failed:', fallbackError);
        functionsLog.debug(`❌ Complete failure after ${Date.now() - startTime}ms total processing time`);
        throw new Error(`Image processing failed completely: ${fallbackError.message}`);
      }
    }
    
    functionsLog.debug(`❌ Non-recoverable error after ${errorTime}ms`);
    throw new Error(`Failed to convert image to WebP: ${error.message}`);
  }
}

// Stripe结账会话创建函数 (Callable API)
exports.createCheckoutSession = onCall({
  region: LOCATION
}, async (request) => {
  console.log('createCheckoutSession 被调用');
  console.log('认证信息:', request.auth ? '已认证' : '未认证');
  
  // 验证用户认证
  if (!request.auth) {
    console.error('用户未登录，拒绝访问');
    throw new HttpsError('unauthenticated', '用户必须登录');
  }

  const userId = request.auth.uid;
  console.log('已认证用户:', userId, request.auth.token.email);
  
  try {
    // 获取请求参数
    const { 
      priceId = STRIPE_CONFIG.PRICE_ID, 
      embeddedMode = false,
      successUrl,
      cancelUrl
    } = request.data;
    console.log('请求参数:', { priceId, embeddedMode, successUrl, cancelUrl });
    
    // 初始化Stripe
    const stripeClient = new Stripe(STRIPE_CONFIG.SECRET_KEY);
    console.log('Stripe已初始化');
    
    // 创建结账会话
    const sessionParams = {
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      client_reference_id: userId, // 用于关联用户
      metadata: {
        userId: userId
      }
    };
    
    if (embeddedMode) {
      // 嵌入式结账模式
      sessionParams.ui_mode = 'embedded';
      // 使用请求中的 successUrl 或默认配置
      sessionParams.return_url = successUrl || STRIPE_CONFIG.SUCCESS_URL;
    } else {
      // 传统重定向模式
      // 使用请求中的 URL 或默认配置
      sessionParams.success_url = successUrl || STRIPE_CONFIG.SUCCESS_URL;
      sessionParams.cancel_url = cancelUrl || STRIPE_CONFIG.CANCEL_URL;
    }
    
    console.log('准备创建Stripe结账会话:', sessionParams);
    const session = await stripeClient.checkout.sessions.create(sessionParams);
    console.log('Stripe结账会话创建成功:', session.id);
    
    // 根据模式返回不同的响应
    if (embeddedMode) {
      return { 
        clientSecret: session.client_secret,
        sessionId: session.id
      };
    } else {
      return { sessionId: session.id };
    }
  } catch (error) {
    console.error('创建结账会话失败:', error);
    console.error('错误详情:', error.code, error.message);
    throw new HttpsError('internal', `创建结账会话失败: ${error.message}`);
  }
});

// Stripe Webhook处理函数
exports.stripeWebhook = onRequest({
  region: LOCATION
}, async (req, res) => {
  const signature = req.headers['stripe-signature'];
  const endpointSecret = STRIPE_CONFIG.WEBHOOK_SECRET;

  try {
    // 初始化Stripe
    const stripeClient = new Stripe(STRIPE_CONFIG.SECRET_KEY);
    
    // 验证Webhook签名
    let event;
    try {
      event = stripeClient.webhooks.constructEvent(
        req.rawBody,
        signature,
        endpointSecret
      );
    } catch (err) {
      console.error('Webhook签名验证失败:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // 处理事件
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object;
        const userId = session.client_reference_id || session.metadata.userId;
        
        if (userId) {
          // 更新用户订阅状态
          await admin.firestore().collection('users').doc(userId).set({
            subscriptionStatus: 'active',
            subscriptionId: session.subscription,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
          
          console.log(`用户 ${userId} 订阅已激活`);
        }
        break;
        
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        const subscription = event.data.object;
        // 处理订阅更新或取消
        // 这里需要查询用户ID并更新状态
        break;
        
      default:
        console.log(`未处理的事件类型: ${event.type}`);
    }

    // 返回成功响应
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('处理Stripe Webhook失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// Imagen API调用函数
exports.generateImage = onCall({
  region: LOCATION,
  memory: '274MB', // 优化：从1GB减少到274MB (基于13.34%利用率 + 安全边际)
  timeoutSeconds: 300
}, async (request) => {
  // 验证用户认证
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const {
    prompt,
    pageIndex = 0,
    aspectRatio = '1:1',
    maxRetries = 2,
    referenceImageUrl,
    seed = 42,
    sampleCount = 1,
    safetyFilterLevel = 'OFF',
    personGeneration = 'allow_all',
    addWatermark = false,
    negativePrompt
  } = request.data;

  functionsLog.debug('[generateImage] request.data:', JSON.stringify(request.data));

  if (!prompt) {
    functionsLog.error('[generateImage] prompt is missing!');
    throw new HttpsError('invalid-argument', 'Prompt is required');
  }

  functionsLog.debug(`Starting image generation for page ${pageIndex + 1}:`, {
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
  
  const imagenAspectRatio = aspectRatioMapping[aspectRatio] || '1:1';

  // 创建Imagen API调用函数
  const callImagenAPI = async (accessToken) => {
    // 使用 API_CONFIG.IMAGEN3_MODEL 进行纯文本到图像生成
    // 不再处理参考图像，风格一致性通过种子值和增强提示词实现
    
    try {
      functionsLog.debug(`Generating image for page ${pageIndex + 1} with aspect ratio ${aspectRatio} (${imagenAspectRatio})`);

      if (!accessToken) {
        throw new Error('Access token was not provided to callImagenAPI.');
      }

      // 使用 API_CONFIG.IMAGEN3_MODEL 模型，该模型支持图像生成
      // 注意：imagen-3.0-capability-001 不支持图像生成，只支持图像编辑
      const modelName = API_CONFIG.IMAGEN3_MODEL;
      const apiUrl = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${modelName}:predict`;
      
      functionsLog.debug('[generateImage] Using API URL:', apiUrl);
      functionsLog.debug('[generateImage] Using model:', modelName);

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
      functionsLog.debug('Added negative prompt to API request:', finalNegativePrompt);
      
      // API_CONFIG.IMAGEN3_MODEL 专门用于文本到图像生成
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
        functionsLog.debug('Detected person-related keywords, using personGeneration:', parameters.personGeneration);
      } else {
        // 如果没有明确的人物关键词，可以不设置这个参数
        functionsLog.debug('No explicit person keywords detected, not setting personGeneration parameter');
      }
      
      // 如果有种子值，尝试添加
      if (seed && typeof seed === 'number') {
        parameters.seed = seed;
        functionsLog.debug('Added seed parameter:', seed);
      }
      
      // 根据宽高比添加 aspectRatio 参数
      if (aspectRatio && aspectRatio !== '1:1') {
        parameters.aspectRatio = aspectRatio;
        functionsLog.debug('Added aspect ratio parameter:', aspectRatio);
      }
      
      const requestBody = {
        instances: [instance],
        parameters: parameters
      };

      functionsLog.debug('[generateImage] Request body:', JSON.stringify(requestBody, null, 2));

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify(requestBody)
      });

      functionsLog.debug('API Response Status:', response.status);
      functionsLog.debug('API Response Headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        functionsLog.error('[generateImage] Imagen API error details:', {
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
          functionsLog.debug('Person generation error detected, attempting fallback...');
          
          // 移除人物生成参数，重试请求
          const fallbackParameters = { ...parameters };
          delete fallbackParameters.personGeneration;
          
          const fallbackRequestBody = {
            instances: [instance],
            parameters: fallbackParameters
          };
          
          functionsLog.debug('Retrying without personGeneration parameter:', JSON.stringify(fallbackRequestBody, null, 2));
          
          const fallbackResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json; charset=utf-8',
            },
            body: JSON.stringify(fallbackRequestBody)
          });
          
          if (fallbackResponse.ok) {
            functionsLog.debug('Fallback request succeeded without personGeneration parameter');
            const fallbackResponseText = await fallbackResponse.text();
            const fallbackData = JSON.parse(fallbackResponseText);
            
            if (fallbackData.predictions && fallbackData.predictions[0] && fallbackData.predictions[0].bytesBase64Encoded) {
              return fallbackData.predictions[0].bytesBase64Encoded;
            }
          } else {
            const fallbackErrorText = await fallbackResponse.text();
            functionsLog.error('Fallback request also failed:', fallbackErrorText);
          }
        }
        
        // 提供更具体的错误信息
        let errorMessage = `Imagen API failed: ${response.status}`;
        if (response.status === 400) {
          errorMessage += ' - Invalid request parameters';
          if (isPersonGenerationError) {
            errorMessage += ' (Insufficient person generation permissions, please contact administrator for permission or adjust prompts)';
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
      functionsLog.debug('[generateImage] Raw API Response Text:', responseText);
      functionsLog.debug('[generateImage] Response Text Length:', responseText.length);

      // 检查响应是否为空
      if (!responseText || responseText.trim() === '') {
        functionsLog.error('Empty response from Imagen API');
        throw new Error('Empty response from Imagen API');
      }

      // 尝试解析JSON
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        functionsLog.error('[generateImage] Failed to parse response as JSON:', parseError);
        functionsLog.error('[generateImage] Response text that failed to parse:', responseText);
        throw new Error(`Invalid JSON response from Imagen API: ${parseError.message}`);
      }
      
      functionsLog.debug('[generateImage] API Response structure:', {
        hasPredictions: !!data.predictions,
        predictionsLength: data.predictions ? data.predictions.length : 0,
        keys: Object.keys(data),
        fullResponse: data
      });
      
      // 检查响应是否有错误信息
      if (data.error) {
        functionsLog.error('[generateImage] Imagen API returned error in response:', data.error);
        throw new Error(`Imagen API error: ${JSON.stringify(data.error)}`);
      }

      // 兼容新旧API响应格式
      let imageData = null;
      
      // 新格式：可能直接在data中包含图像数据
      if (data.bytesBase64Encoded) {
        functionsLog.debug('Found image data in new format (direct bytesBase64Encoded)');
        imageData = data.bytesBase64Encoded;
      }
      // 检查是否有candidates字段（类似GenerateContentResponse格式）
      else if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        functionsLog.debug('Found image data in candidates format');
        const candidate = data.candidates[0];
        if (candidate.content.parts && candidate.content.parts[0] && candidate.content.parts[0].inlineData) {
          imageData = candidate.content.parts[0].inlineData.data;
        }
      }
      // 旧格式：predictions字段
      else if (data.predictions && data.predictions[0]) {
        functionsLog.debug('Found image data in legacy predictions format');
        const prediction = data.predictions[0];
        if (prediction.bytesBase64Encoded) {
          imageData = prediction.bytesBase64Encoded;
        }
      }
      // 检查其他可能的响应格式
      else if (data.images && data.images[0]) {
        functionsLog.debug('Found image data in images array format');
        imageData = data.images[0].bytesBase64Encoded || data.images[0].data;
      }
      
      if (!imageData) {
        functionsLog.error('[generateImage] No image data found in response. Response structure:', {
          keys: Object.keys(data),
          hasError: !!data.error,
          hasPredictions: !!data.predictions,
          hasCandidates: !!data.candidates,
          hasImages: !!data.images,
          hasBytesBase64Encoded: !!data.bytesBase64Encoded,
          fullResponse: JSON.stringify(data, null, 2)
        });
        throw new Error('No image data found in Imagen API response. Response format may have changed.');
      }

      functionsLog.debug('Successfully received image data from Imagen API');
      return imageData;

    } catch (error) {
      functionsLog.error('[generateImage] Error in callImagenAPI:', error);
      throw error;
    }
  };

  try {
    const client = await auth.getClient();
    const accessToken = (await client.getAccessToken()).token;
    if (!accessToken) throw new HttpsError('internal', 'Failed to acquire access token.');

    const base64Data = await retryWithBackoff(() => callImagenAPI(accessToken), maxRetries);

    const bucketName = UTILS.getBucketName();
    const bucket = admin.storage().bucket(bucketName);
    const fileName = `tale-images/${request.auth.uid}/${Date.now()}_page_${pageIndex}.webp`;
    const file = bucket.file(fileName);

    functionsLog.debug('Converting image to WebP format...');
    
    // 转换图像为WebP格式
    const compressedImageBuffer = await compressImageToWebP(base64Data);
    
    functionsLog.debug('Uploading compressed WebP image to Firebase Storage:', fileName);
    functionsLog.debug(`Original size: ~${Math.round(base64Data.length * 0.75)} bytes, Compressed size: ${compressedImageBuffer.length} bytes`);

    // 上传压缩后的WebP图像
    await file.save(compressedImageBuffer, {
      metadata: {
        contentType: 'image/webp',
        metadata: {
          userId: request.auth.uid,
          pageIndex: pageIndex.toString(),
          prompt: prompt.substring(0, 500),
          originalFormat: 'webp',
          compressedFormat: 'webp'
        }
      }
    });

    // 使图像公开访问
    await file.makePublic();

    // 获取公开URL
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;

    functionsLog.info(`Image generated and uploaded successfully for page ${pageIndex + 1}: ${publicUrl}`);

    return {
      imageUrl: publicUrl,
      pageIndex: pageIndex,
      success: true
    };

  } catch (error) {
    functionsLog.error(`Error generating image for page ${pageIndex + 1}:`, error);
    
    if (error instanceof HttpsError) throw error;

    // 提供更详细的错误信息
    let errorMessage = `Failed to generate image: ${error.message}`;
    if (error.status) {
      errorMessage += ` (HTTP ${error.status})`;
    }

    functionsLog.error('Final error details:', {
      message: error.message,
      status: error.status,
      stack: error.stack
    });

    throw new HttpsError('internal', errorMessage);
  }
});



// 图像代理端点 - 解决CORS问题
exports.imageProxy = onRequest({
  memory: '256MB',
  timeoutSeconds: 60,
  invoker: 'public'
}, (req, res) => {
  cors(req, res, async () => {
    try {
      // 只允许GET请求
      if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
      }

      // 获取图像URL参数
      const imageUrl = req.query.url;
      if (!imageUrl) {
        return res.status(400).json({ error: 'Missing image URL parameter' });
      }

      // 验证URL是否来自我们的Firebase Storage
      if (!imageUrl.startsWith('https://storage.googleapis.com/ai-app-taskforce.appspot.com/')) {
        return res.status(403).json({ error: 'Unauthorized image URL' });
      }

      functionsLog.debug(`Image proxy request for: ${imageUrl}`);

      // 使用Firebase Admin SDK直接访问Storage，避免HTTP CORS问题
      const bucket = admin.storage().bucket('ai-app-taskforce.appspot.com');
      
      // 从URL中提取文件路径
      const urlParts = imageUrl.split('/');
      const bucketIndex = urlParts.indexOf('ai-app-taskforce.appspot.com');
      if (bucketIndex === -1 || bucketIndex + 1 >= urlParts.length) {
        return res.status(400).json({ error: 'Invalid image URL format' });
      }
      
      const filePath = urlParts.slice(bucketIndex + 1).join('/');
      functionsLog.debug(`Extracted file path: ${filePath}`);
      
      const file = bucket.file(filePath);
      
      try {
        // 检查文件是否存在
        const [exists] = await file.exists();
        if (!exists) {
          functionsLog.debug(`File not found: ${filePath}`);
          return res.status(404).json({ error: 'Image not found' });
        }
        
        // 读取文件
        const [buffer] = await file.download();
        const [metadata] = await file.getMetadata();
        const contentType = metadata.contentType || 'image/webp';
        
        functionsLog.debug(`Image proxy success: ${buffer.length} bytes, content-type: ${contentType}`);
        
        // 设置响应头
        res.set({
          'Content-Type': contentType,
          'Content-Length': buffer.length,
          'Cache-Control': 'public, max-age=3600',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET',
          'Access-Control-Allow-Headers': 'Content-Type'
        });

        // 发送图像数据
        res.send(buffer);
        
      } catch (storageError) {
        functionsLog.error('Storage access error:', storageError);
        return res.status(500).json({ 
          error: 'Failed to access image from storage',
          details: storageError.message 
        });
      }

    } catch (error) {
      functionsLog.error('Image proxy error:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        message: error.message
      });
    }
  });
});

// 健康检查函数
exports.healthCheck = onCall({
  memory: '170MB', // 优化：从128MB增加到170MB (基于88.20%利用率 + 安全边际)
  timeoutSeconds: 60
}, async (_request) => {
  functionsLog.info('Health check successful');
  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'tale-draw-functions',
    functions: [
      'generateImage',
      'generateImageV4', 
      'generateTaleStream',
      'getTaleData',
      'healthCheck',
      'imageProxy'
    ]
  };
});

// 获取故事数据函数
exports.getTaleData = onCall({
  memory: '258MB', // 优化：从1GB减少到258MB (基于12.56%利用率 + 安全边际)
  timeoutSeconds: 120 // 增加超时从 60 秒到 120 秒
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'The function must be called while authenticated.');
  }
  const { taleId } = request.data;
  if (!taleId) {
    throw new HttpsError('invalid-argument', 'Tale ID is required.');
  }
  
  try {
    functionsLog.debug(`Getting tale data for user ${request.auth.uid}, tale ID: ${taleId}`);
    const result = await TaleStorageStrategy.getTaleData(request.auth.uid, taleId);
    functionsLog.debug(`Successfully retrieved tale data, size: ${JSON.stringify(result).length} characters`);
    return result;
  } catch (error) {
    functionsLog.error('Error in getTaleData:', error);
    
    // 如果是特定的错误代码，直接传递
    if (error.code === 'not-found') {
      throw error;  // 直接传递not-found错误
    }
    
    // 其他错误转换为internal错误
    throw new HttpsError('internal', `Failed to retrieve tale data: ${error.message}`);
  }
});

// 注意：原 generateStoryPages 函数已移除，现在直接使用优化的 generateTale 函数

// 流式Gemini调用函数
async function callGeminiStream(accessToken, story, pageCount, response, userId) {
  const model = API_CONFIG.GEMINI_MODEL;
  const apiUrl = UTILS.buildApiUrl(model, 'streamGenerateContent');

  // 使用配置文件中的故事生成提示词
  const systemPrompt = PROMPTS.STORY_GENERATION(pageCount);
  const requestBody = UTILS.buildGeminiRequest(story, systemPrompt);

  response.write(`data: ${JSON.stringify({ 
    type: 'progress', 
    step: 'analyzing',
    message: 'Analyzing story structure and characters...' 
  })}\n\n`);

  try {
    const fetch = require('node-fetch');
    const streamResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(requestBody)
    });

    if (!streamResponse.ok) {
      const errorText = await streamResponse.text();
      functionsLog.error(`Gemini API call failed with status ${streamResponse.status}:`, errorText);
      throw new Error(`Gemini API failed with status ${streamResponse.status}`);
    }

    let accumulatedContent = '';
    let chunkCount = 0;

    // 处理流式响应
    streamResponse.body.setEncoding('utf8');
    streamResponse.body.on('data', (chunk) => {
      chunkCount++;
      const chunkStr = chunk;
      
      // 每100个chunk发送一次进度更新
      if (chunkCount % 100 === 0 || chunkCount === 1) {
        response.write(`data: ${JSON.stringify({ 
          type: 'progress', 
          step: 'generating',
          message: `Processing content chunk ${chunkCount}...`,
          progress: Math.min(chunkCount * 0.1, 90)
        })}\n\n`);
      }

      // 累积内容
      accumulatedContent += chunkStr;
      
      // 尝试解析部分JSON（如果可能）
      try {
        const lines = chunkStr.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.substring(6);
            if (jsonStr.trim() && jsonStr !== '[DONE]') {
              const data = JSON.parse(jsonStr);
              if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
                // 发送部分内容
                response.write(`data: ${JSON.stringify({ 
                  type: 'partial_content', 
                  content: data.candidates[0].content.parts[0].text
                })}\n\n`);
              }
            }
          }
        }
      } catch (parseError) {
        // 忽略部分解析错误，继续累积
      }
    });

    streamResponse.body.on('end', async () => {
      try {
        functionsLog.debug('Accumulated content length:', accumulatedContent.length);
        functionsLog.debug('First 1000 chars:', accumulatedContent.substring(0, 1000));
        functionsLog.debug('Last 1000 chars:', accumulatedContent.substring(Math.max(0, accumulatedContent.length - 1000)));
        
        // 解析最终内容 - Gemini返回的是JSON数组格式
        functionsLog.debug('Attempting to parse as complete JSON array...');
        
        let finalContent = '';
        let validJsonObjects = 0;
        
        try {
          // 尝试将整个响应解析为JSON数组
          const responseData = JSON.parse(accumulatedContent);
          functionsLog.debug('Successfully parsed as JSON array, length:', responseData.length);
          
          if (Array.isArray(responseData)) {
            for (const item of responseData) {
              if (item.candidates?.[0]?.content?.parts?.[0]?.text) {
                finalContent += item.candidates[0].content.parts[0].text;
                validJsonObjects++;
              }
            }
          } else {
            functionsLog.debug('Response is not an array, trying as single object');
            if (responseData.candidates?.[0]?.content?.parts?.[0]?.text) {
              finalContent += responseData.candidates[0].content.parts[0].text;
              validJsonObjects++;
            }
          }
        } catch (jsonError) {
          functionsLog.debug('Failed to parse as complete JSON, trying line-by-line approach...');
          
          // 回退到逐行解析
          const lines = accumulatedContent.split('\n');
          let sseLines = 0;
          let directJsonLines = 0;
          let emptyLines = 0;
          let dataLines = 0;
          
          for (const line of lines) {
            if (!line.trim()) {
              emptyLines++;
            } else if (line.startsWith('data: ')) {
              dataLines++;
              const jsonStr = line.substring(6);
              if (jsonStr.trim() && jsonStr !== '[DONE]') {
                sseLines++;
                try {
                  const data = JSON.parse(jsonStr);
                  validJsonObjects++;
                  if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
                    finalContent += data.candidates[0].content.parts[0].text;
                  }
                } catch (parseError) {
                  functionsLog.debug('Failed to parse SSE line:', jsonStr.substring(0, 200));
                }
              }
            } else if (line.trim() && !line.startsWith('data:')) {
              directJsonLines++;
              try {
                const data = JSON.parse(line);
                validJsonObjects++;
                if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
                  finalContent += data.candidates[0].content.parts[0].text;
                }
              } catch (parseError) {
                // 忽略单行解析错误，这是预期的
              }
            }
          }
          
          functionsLog.debug('Line-by-line analysis:');
          functionsLog.debug('- Total lines:', lines.length);
          functionsLog.debug('- Empty lines:', emptyLines);
          functionsLog.debug('- Data lines (SSE format):', dataLines);
          functionsLog.debug('- Valid SSE lines:', sseLines);
          functionsLog.debug('- Direct JSON lines:', directJsonLines);
        }
        
        functionsLog.debug('Parsing summary:');
        functionsLog.debug('- Valid JSON objects processed:', validJsonObjects);
        functionsLog.debug('- Final content length:', finalContent.length);

        if (!finalContent) {
          // 保存原始响应以供调试
          functionsLog.debug('Saving raw response for debugging...');
          const debugContent = accumulatedContent.substring(0, 5000); // 前5000字符
          functionsLog.debug('Debug content:', debugContent);
          throw new Error('No content generated from Gemini API');
        }

        response.write(`data: ${JSON.stringify({ 
          type: 'progress', 
          step: 'parsing',
          message: 'Parsing generated content...' 
        })}\n\n`);

        // 解析JSON
        const taleData = JSON.parse(finalContent);
        
        if (!taleData || !taleData.pages) {
          throw new Error('Invalid JSON structure from Gemini, \'pages\' field is missing.');
        }

        response.write(`data: ${JSON.stringify({ 
          type: 'progress', 
          step: 'saving',
          message: 'Saving generated content...' 
        })}\n\n`);

        // 保存数据（使用流式方式减少内存使用）
        const taleId = admin.firestore().collection('tmp').doc().id;
        await saveDataStreamWise(userId, taleId, taleData);

        // 直接在complete事件中返回完整的故事数据，避免客户端再次调用getTaleData
        response.write(`data: ${JSON.stringify({ 
          type: 'complete', 
          taleId: taleId,
          message: 'Story generation completed successfully!',
          taleData: taleData
        })}\n\n`);

        response.end();

      } catch (error) {
        functionsLog.error('Error processing final content:', error);
        response.write(`data: ${JSON.stringify({ 
          type: 'error', 
          message: error.message 
        })}\n\n`);
        response.end();
      }
    });

    streamResponse.body.on('error', (error) => {
      functionsLog.error('Stream error:', error);
      response.write(`data: ${JSON.stringify({ 
        type: 'error', 
        message: error.message 
      })}\n\n`);
      response.end();
    });

  } catch (error) {
    functionsLog.error('Error in stream processing:', error);
    response.write(`data: ${JSON.stringify({ 
      type: 'error', 
      message: error.message 
    })}\n\n`);
    response.end();
  }
}

// 流式数据保存函数 - 减少内存使用，支持智能压缩
async function saveDataStreamWise(userId, taleId, taleData) {
  const bucketName = UTILS.getBucketName();
  const bucket = admin.storage().bucket(bucketName);
  const fileName = UTILS.buildFilePath(userId, taleId); // 使用正常路径，与getTaleData一致
  const file = bucket.file(fileName);

  const jsonString = JSON.stringify(taleData);
  functionsLog.debug(`Stream-wise save: Tale data size: ${jsonString.length} characters`);
  
  // 简化的压缩策略：文本数据始终使用gzip压缩
  const compressionAnalysis = TaleStorageStrategy.analyzeDataForCompression(taleData, jsonString);
  functionsLog.debug('Stream-wise compression analysis:', compressionAnalysis);
  
  functionsLog.debug('Using gzip compression for stream-wise save');
  
  // 创建写入流和gzip压缩流
  const writeStream = file.createWriteStream({
    metadata: {
      contentType: 'application/gzip',
      contentEncoding: 'gzip',
      'content-type': 'application/gzip; charset=utf-8',
      'compression-strategy': 'gzip-text',
      'data-type': compressionAnalysis.dataType,
      'original-size': jsonString.length.toString()
    },
  });

  const gzipStream = zlib.createGzip();
  
  return new Promise((resolve, reject) => {
    writeStream.on('error', reject);
    writeStream.on('finish', () => {
      functionsLog.debug('Stream-wise gzip save completed');
      resolve({
        success: true,
        compressionStrategy: 'gzip',
        originalSize: jsonString.length
      });
    });
    
    gzipStream.pipe(writeStream);
    
    // 分块写入数据以减少内存使用
    const chunkSize = 1024 * 64; // 64KB chunks
    
    for (let i = 0; i < jsonString.length; i += chunkSize) {
      const chunk = jsonString.slice(i, i + chunkSize);
      gzipStream.write(chunk, 'utf8');
    }
    
    gzipStream.end();
  });
}

// ========== Imagen 4 专用函数组 ========== //

/**
 * 专用函数组：使用Imagen 4生成图像
 * - 使用 LOCATION 区域
 * - 模型：API_CONFIG.IMAGEN4_MODEL
 * - 支持一致的角色生成
 * - 更好的提示词理解能力
 * - 更高的图像质量
 * - 统一使用当前项目配置
 */
exports.generateImageV4 = onCall({
  memory: '282MB', // 优化：从1GB减少到282MB (基于13.74%利用率 + 安全边际)
  timeoutSeconds: 300
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const {
    prompt,
    pageIndex,
    aspectRatio = '1:1',
    seed = 1,
    sampleCount = 1,
    safetyFilterLevel = 'block_most',
    personGeneration = 'allow_adult',
    addWatermark = false
  } = request.data;

  const callImagen4API = async (accessToken) => {
    const apiUrl = UTILS.buildApiUrl(API_CONFIG.IMAGEN4_MODEL, 'predict');
    const instance = { prompt };
    const parameters = {
      aspectRatio,
      seed,
      sampleCount,
      safetyFilterLevel,
      personGeneration,
      addWatermark
    };

    const requestBody = {
      instances: [instance],
      parameters: parameters,
    };

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify(requestBody)
      });

      const responseText = await response.text();
      functionsLog.debug('[generateImageV4] Imagen 4 API raw response:', responseText);

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
        functionsLog.error('[generateImageV4] Failed to parse Imagen 4 API response as JSON:', responseText);
        throw new Error(`Invalid JSON response from Imagen 4 API: ${parseError.message}`);
      }

      if (data.error) {
        functionsLog.error('[generateImageV4] Imagen 4 API returned error:', data.error);
        throw new Error(`Imagen 4 API error: ${JSON.stringify(data.error)}`);
      }

      // 兼容新旧API响应格式
      let imageData = null;
      
      // 新格式：可能直接在data中包含图像数据
      if (data.bytesBase64Encoded) {
        functionsLog.debug('[generateImageV4] Found image data in new format (direct bytesBase64Encoded)');
        imageData = data.bytesBase64Encoded;
      }
      // 检查是否有candidates字段（类似GenerateContentResponse格式）
      else if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        functionsLog.debug('[generateImageV4] Found image data in candidates format');
        const candidate = data.candidates[0];
        if (candidate.content.parts && candidate.content.parts[0] && candidate.content.parts[0].inlineData) {
          imageData = candidate.content.parts[0].inlineData.data;
        }
      }
      // 旧格式：predictions字段
      else if (data.predictions && data.predictions[0]) {
        functionsLog.debug('[generateImageV4] Found image data in legacy predictions format');
        const prediction = data.predictions[0];
        if (prediction.bytesBase64Encoded) {
          imageData = prediction.bytesBase64Encoded;
        }
      }
      // 检查其他可能的响应格式
      else if (data.images && data.images[0]) {
        functionsLog.debug('[generateImageV4] Found image data in images array format');
        imageData = data.images[0].bytesBase64Encoded || data.images[0].data;
      }
      
      if (!imageData) {
        functionsLog.error('[generateImageV4] No image data found in response. Response structure:', {
          keys: Object.keys(data),
          hasError: !!data.error,
          hasPredictions: !!data.predictions,
          hasCandidates: !!data.candidates,
          hasImages: !!data.images,
          hasBytesBase64Encoded: !!data.bytesBase64Encoded,
          fullResponse: JSON.stringify(data, null, 2)
        });
        throw new Error('No image data found in Imagen 4 API response. Response format may have changed.');
      }

      functionsLog.debug('[generateImageV4] Successfully received image data from Imagen 4 API');
      return imageData;
    } catch (error) {
      functionsLog.error('[generateImageV4] Exception:', {
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
    const client = await auth.getClient();
    const accessToken = (await client.getAccessToken()).token;

    if (!accessToken) {
      throw new HttpsError('internal', 'Failed to acquire access token for Imagen4.');
    }

    const base64Data = await callImagen4API(accessToken);

    // 上传到Firebase Storage
    const bucketName = UTILS.getBucketName();
    const bucket = admin.storage().bucket(bucketName);
    const fileName = `tale-images-v4/${request.auth.uid}/${Date.now()}_page_${pageIndex}.webp`;
    const file = bucket.file(fileName);
    
    functionsLog.debug('Converting Imagen 4 image to WebP format...');
    
    // 转换图像为WebP格式
    const compressedImageBuffer = await compressImageToWebP(base64Data);
    
    functionsLog.debug('Uploading compressed WebP image (Imagen 4) to Firebase Storage:', fileName);
    functionsLog.debug(`Original size: ~${Math.round(base64Data.length * 0.75)} bytes, Compressed size: ${compressedImageBuffer.length} bytes`);

    await file.save(compressedImageBuffer, {
      metadata: {
        contentType: 'image/webp',
        metadata: {
          userId: request.auth.uid,
          pageIndex: pageIndex.toString(),
          prompt: prompt.substring(0, 500),
          originalFormat: 'webp',
          compressedFormat: 'webp',
          modelVersion: 'imagen-4'
        }
      }
    });

    await file.makePublic();
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
    return { imageUrl: publicUrl, pageIndex: pageIndex, success: true };

  } catch (error) {
    let errorMessage = `Failed to generate image (Imagen 4): ${error.message}`;
    if (error.status) {
      errorMessage += ` (HTTP ${error.status})`;
    }
    throw new HttpsError('internal', errorMessage);
  }
});



// 新增：流式故事生成函数
exports.generateTaleStream = onRequest(
  { memory: '1GB', timeoutSeconds: 300, region: LOCATION },
  (request, response) => {
    cors(request, response, async () => {
      try {
        // 首先验证请求方法
        if (request.method !== 'POST') {
          response.status(405).json({ error: 'Method not allowed. Use POST.' });
          return;
        }

        // 验证认证头
        const authHeader = request.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          response.status(401).json({ error: 'Missing or invalid authorization header' });
          return;
        }

        const idToken = authHeader.split('Bearer ')[1];
        let decodedToken;
        try {
          decodedToken = await admin.auth().verifyIdToken(idToken);
        } catch (error) {
          functionsLog.error('Token verification failed:', error.message);
          response.status(401).json({ error: 'Invalid authentication token' });
          return;
        }

        // 验证请求体
        const { story, pageCount = 10 } = request.body;
        if (!story || !story.trim()) {
          response.status(400).json({ error: 'Story content is required' });
          return;
        }

        // 只有在所有验证通过后才设置 SSE 头
        response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        response.setHeader('Cache-Control', 'no-cache');
        response.setHeader('Connection', 'keep-alive');

        // 发送初始状态
        response.write(`data: ${JSON.stringify({ 
          type: 'progress', 
          step: 'initializing',
          message: 'Initializing story generation process...' 
        })}\n\n`);

        // 获取访问令牌
        const client = await auth.getClient();
        const accessToken = (await client.getAccessToken()).token;
        if (!accessToken) {
          response.write(`data: ${JSON.stringify({ 
            type: 'error', 
            message: 'Failed to acquire access token for AI service' 
          })}\n\n`);
          response.end();
          return;
        }

        response.write(`data: ${JSON.stringify({ 
          type: 'progress', 
          step: 'connecting',
          message: 'Connecting to LLM service...' 
        })}\n\n`);

        // 调用Gemini API进行流式生成
        await callGeminiStream(accessToken, story, pageCount, response, decodedToken.uid);

      } catch (error) {
        functionsLog.error('Error in generateTaleStream:', error);
        
        // 检查是否已经设置了 SSE 头
        if (response.headersSent) {
          // 如果已经开始发送 SSE 数据，使用 SSE 格式发送错误
          response.write(`data: ${JSON.stringify({ 
            type: 'error', 
            message: error.message 
          })}\n\n`);
          response.end();
        } else {
          // 如果还没有设置头，使用 JSON 格式返回错误
          response.status(500).json({ error: error.message });
        }
      }
    });
  });
