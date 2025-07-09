// 集中配置文件 - 管理所有常量、提示词和共享函数

// === 项目配置常量 ===
const PROJECT_ID = 'ai-app-taskforce';
const LOCATION = 'us-central1'; // 使用支持Gemini的主要区域
const STORAGE_MODE = 'cloud_storage'; // 默认存储模式

// === API 配置 ===
const API_CONFIG = {
  GEMINI_MODEL: 'gemini-2.5-flash',
  IMAGEN3_MODEL: 'imagen-3.0-generate-002',
  IMAGEN4_MODEL: 'imagen-4.0-generate-preview-06-06',
  MAX_OUTPUT_TOKENS: 32768,
  DEFAULT_TIMEOUT: 900, // 15 minutes
  DEFAULT_MEMORY: '1GiB'
};

// === 存储配置 ===
const STORAGE_CONFIG = {
  DEFAULT_BUCKET: `${PROJECT_ID}.appspot.com`,
  STREAM_PATH: 'tales/stream/',
  REGULAR_PATH: 'tales/'
};

// === CORS 配置 ===
const CORS_CONFIG = {
  origin: [
    'http://localhost:3000', 
    'https://ai-app-taskforce.web.app', 
    'https://ai-app-taskforce.firebaseapp.com'
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control'],
  credentials: true
};

// === 共享提示词模板 ===
const PROMPTS = {
  // 故事生成系统提示词 --- important! 不要修改！！！
  STORY_GENERATION: (pageCount) => `
You are a professional children's storybook editor and creative assistant. Your task is to transform a user-submitted story into a complete ${pageCount}-page illustrated storybook with consistent character design and child-friendly content.

**CRITICAL ENGLISH REQUIREMENT**: ALL image generation prompts (imagePrompt, scenePrompt, characterPrompts) MUST be written in ENGLISH ONLY. This is absolutely mandatory for optimal image generation quality. Even if the input story is in another language, these specific fields must always be in English.

**IMPORTANT**: Your response must be concise and stay within 30,000 tokens total. Keep descriptions focused and avoid unnecessary verbosity.

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
Distribute content across ${pageCount} pages:
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
    }
  },
  "pages": [
    {
      "pageNumber": 1,
      "title": "Brief page title in same language as story (3-8 words)",
      "text": "Page content in same language as input story, ensuring story completeness",
      "sceneType": "Brief setting description (e.g., 'enchanted forest', 'cozy kitchen')",
      "sceneCharacters": ["Character names present in this scene"],
      "imagePrompt": "**MUST BE IN ENGLISH** - Detailed English prompt starting with the identified art style. Include specific character descriptions from character sheets for any characters present. Describe scene, actions, expressions, mood. End with: ', children's book illustration style, warm and friendly colors, safe and welcoming atmosphere, absolutely no text, no words, no letters, no signs, no symbols, no writing, no captions'",
      "scenePrompt": "**MUST BE IN ENGLISH** - Scene/setting portion of the imagePrompt in English",
      "characterPrompts": "**MUST BE IN ENGLISH** - Character description portion of the imagePrompt in English"
    }
  ]
}

## CRITICAL REQUIREMENTS
- Use the SAME LANGUAGE as the input story for all text content (title, page text)
- **ABSOLUTE REQUIREMENT**: Use ENGLISH ONLY for imagePrompt, scenePrompt, characterPrompts (for optimal image generation)
- **NO EXCEPTIONS**: Even if input story is Chinese, Japanese, Spanish etc., imagePrompt/scenePrompt/characterPrompts must be 100% English
- Include ALL story content across pages (no omissions)
- Maintain character visual consistency through detailed character sheets
- Apply content safety transformations while preserving story meaning
- Ensure each page has unique, meaningful content (no filler or repetition)
- **OUTPUT LENGTH CONSTRAINT**: Keep the total JSON output concise and within 30,000 tokens. Prioritize essential content over verbose descriptions. Each page text should be 2-4 sentences maximum. Image prompts should be detailed but concise (under 200 words each).

## ENGLISH PROMPT EXAMPLES
Good imagePrompt examples:
- "Children's book watercolor illustration of a brave little girl with red hood walking through a peaceful enchanted forest with tall oak trees and colorful wildflowers, warm afternoon sunlight filtering through leaves, friendly woodland creatures watching from behind trees, children's book illustration style, warm and friendly colors, safe and welcoming atmosphere, absolutely no text, no words, no letters, no signs, no symbols, no writing, no captions"
- "Cartoon style digital art showing a wise grandmother with silver hair and kind blue eyes, wearing a cozy purple sweater and floral apron, standing in her warm cottage kitchen with wooden furniture and hanging herbs, gentle smile on her face, children's book illustration style, warm and friendly colors, safe and welcoming atmosphere, absolutely no text, no words, no letters, no signs, no symbols, no writing, no captions"

## EXAMPLE CHARACTER SHEET
"Leo": {
  "appearance": "An 8-year-old boy with messy brown curly hair, bright green eyes, freckles across his nose, medium build for his age, cheerful facial expression",
  "clothing": "Red and white striped t-shirt, blue denim shorts, white sneakers with blue laces, small brown backpack",
  "personality": "Curious and adventurous, confident posture, tends to lean forward when interested, expressive hand gestures"
}

**FINAL REMINDER**: imagePrompt, scenePrompt, and characterPrompts fields MUST be written in English regardless of input language. This is non-negotiable for image generation quality.

Analyze this story and transform it according to the above requirements:
`
};

// === 共享工具函数 ===
const UTILS = {
  // 构建 API URL - 统一使用当前项目ID
  buildApiUrl: (model, endpoint = 'generateContent') => {
    return `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${model}:${endpoint}`;
  },

  // 构建存储桶名称
  getBucketName: () => {
    return STORAGE_CONFIG.DEFAULT_BUCKET;
  },

  // 构建文件路径
  buildFilePath: (userId, taleId, isStream = false) => {
    const basePath = isStream ? STORAGE_CONFIG.STREAM_PATH : STORAGE_CONFIG.REGULAR_PATH;
    return `${basePath}${userId}/${taleId}.json.gz`;
  },

  // 生成 Gemini 请求配置
  buildGeminiRequest: (story, systemPrompt) => ({
    contents: [{ role: "user", parts: [{ text: story }] }],
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig: {
      temperature: 0.8,
      topP: 0.95,
      maxOutputTokens: API_CONFIG.MAX_OUTPUT_TOKENS,
      responseMimeType: "application/json"
    }
  }),

  // 生成函数配置
  buildFunctionConfig: (memory = API_CONFIG.DEFAULT_MEMORY, timeout = API_CONFIG.DEFAULT_TIMEOUT) => ({
    region: LOCATION,
    timeoutSeconds: timeout,
    memory: memory
  }),

  // 生成流式函数配置
  buildStreamFunctionConfig: () => ({
    region: LOCATION,
    timeoutSeconds: API_CONFIG.DEFAULT_TIMEOUT,
    memory: API_CONFIG.DEFAULT_MEMORY,
    cors: CORS_CONFIG,
    invoker: 'public' // 允许公开访问以处理CORS预检请求
  })
};

// === 导出所有配置 ===
module.exports = {
  // 基础配置
  PROJECT_ID,
  LOCATION,
  STORAGE_MODE,
  
  // 配置对象
  API_CONFIG,
  STORAGE_CONFIG,
  CORS_CONFIG,
  
  // 提示词
  PROMPTS,
  
  // 工具函数
  UTILS
}; 