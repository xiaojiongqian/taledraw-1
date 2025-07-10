# 多 Imagen 模型支持设计文档

## 1. 目标

为了提升灵活性和用户体验，本项目将引入对多种 Imagen 模型（包括 Imagen3, Imagen4, Imagen4-fast）的支持。用户将可以在前端界面选择不同的模型来生成图像，后端 `generateImage` 云函数将进行相应改造以支持动态模型调用，并返回更详细的失败原因。

## 2. 需求概述

- **前端**：增加一个模型选择器，允许用户在不同 Imagen 模型间切换。
- **后端**：`generateImage` 函数需要能够根据前端传递的参数调用指定的 Imagen 模型。
- **扩展性**：后端架构应设计为易于接入未来的新图像生成模型。
- **错误处理**：后端需要返回生成失败的具体原因（RAI, Responsible AI），以便前端提示用户优化。

## 3. 技术设计

### 3.1. 前端 (React)

#### 3.1.1. UI 组件

- 在 `AspectRatioSelector.js` 组件旁边，新增一个 `ImagenModelSelector.js` 组件。
- 该组件是一个下拉菜单，包含以下选项：
  - `Imagen4-fast` (默认值)
  - `Imagen4`
  - `Imagen3`

#### 3.1.2. 状态管理 (`stateManager.js`)

- 在全局状态中增加 `selectedImagenModel` 字段，默认值为 `'imagen4-fast'`。
- `ImagenModelSelector` 组件将负责更新此状态。

#### 3.1.3. API 调用 (`api.js`)

- 修改 `generateImage` 的 API 调用函数。
- 在请求体中增加 `model` 参数，其值来自 `selectedImagenModel` 状态。

```javascript
// Example api.js modification
async function generateImage(prompt, model = 'imagen4-fast', ...) {
  // ...
  const response = await callCloudFunction('generateImage', {
    prompt,
    model, // Pass selected model to backend
    // ... other parameters
  });
  // ...
}
```

### 3.2. 后端 (Firebase Functions)

#### 3.2.1. 配置管理 (`config.js`)

- 修改 `API_CONFIG`，将模型名称结构化，便于管理和扩展。

```javascript
// functions/config.js
const API_CONFIG = {
  GEMINI_MODEL: 'gemini-2.5-flash',
  IMAGEN_MODELS: {
    'imagen3': 'imagen-3.0-generate-002',
    'imagen4': 'imagen-4.0-generate-preview-06-06',
    'imagen4-fast': 'imagen-4.0-fast-generate-preview-06-06',
  },
  DEFAULT_IMAGEN_MODEL: 'imagen4-fast',
  // ... other configs
};
```

#### 3.2.2. 云函数 (`index.js`)

- **`generateImage` 函数改造**:
  - 函数签名将接收一个新的 `model` 参数，并设置默认值。
  - 增加参数校验，确保传入的 `model` 是 `API_CONFIG.IMAGEN_MODELS` 中支持的键。

- **创建模型调用封装层**:
  - 创建一个统一的 `callImagenModel` 辅助函数，该函数接收 `modelId` 和其他图像生成参数。
  - `generateImage` 函数将根据传入的 `model` 参数从 `API_CONFIG` 获取真实的模型ID，并调用 `callImagenModel`。
  - 这种封装可以隔离不同模型 API 之间可能存在的细微差异，为未来接入更多模型（如 DALL-E, Midjourney 的 API）提供便利。

```javascript
// functions/index.js - simplified example
exports.generateImage = onCall(..., async (request) => {
  // 1. Get model from request data, with a default
  const requestedModel = request.data.model || API_CONFIG.DEFAULT_IMAGEN_MODEL;
  
  // 2. Validate model
  if (!Object.keys(API_CONFIG.IMAGEN_MODELS).includes(requestedModel)) {
    throw new HttpsError('invalid-argument', 'Unsupported model specified.');
  }

  const modelId = API_CONFIG.IMAGEN_MODELS[requestedModel];

  // 3. Call the unified wrapper
  try {
    const result = await callImagenModel(modelId, request.data);
    return result;
  } catch (error) {
    // 4. Return detailed error, including raiReason
    throw new HttpsError('internal', error.message, { raiReason: error.raiReason });
  }
});

async function callImagenModel(modelId, params) {
  // ... build request body for the given modelId and params ...
  const response = await fetch(...);
  
  if (!response.ok) {
    const errorBody = await response.json();
    const error = new Error('Image generation failed.');
    // Extract raiReason from the error response
    error.raiReason = errorBody?.error?.details?.[0]?.reason || 'Unknown';
    throw error;
  }
  
  const data = await response.json();
  // ... return successful result
}
```

### 3.3. 错误处理

- 在 `callImagenModel` 的 `catch` 块中，解析 Imagen API 返回的错误体。
- 提取与 Responsible AI 相关的失败原因（通常在 `error.details[0].reason` 字段）。
- 将这个原因附加到 `HttpsError` 的 `details` 对象中，以便前端可以接收并展示给用户。

### 3.4. 提示词语言要求 (Prompt Language Requirement)

- **英文提示词**: 为保证最高的图像生成质量和模型兼容性，所有传递给 Imagen API 的 `prompt` 参数都 **必须** 是英文。`generateImage` 函数将直接使用前端传递的提示词，不进行语言转换。前端需要确保在调用 `generateImage` 时提供的提示词是英文。

## 4. 部署计划

1.  **后端部署**：首先部署改造后的 `generateImage` 云函数。
2.  **前端部署**：在后端接口更新后，部署前端 UI 和 API 调用逻辑的改动。
3.  **测试**：进行端到端测试，确保每个模型都能被正确选择和调用，并且失败原因能正确回传。 