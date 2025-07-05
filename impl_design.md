# Tale Draw - 实现设计文档

## 1. 核心架构

### 1.1 技术栈
- **前端**: React (Create React App), JavaScript
- **后端**: Firebase Functions (Node.js)
- **数据库/存储**: Cloud Storage (主), Firestore (备)
- **AI 服务**: Google Vertex AI (Gemini 2.5-flash, Imagen 3/4)
- **认证**: Firebase Authentication

### 1.2 系统架构图
```
+----------------+      +---------------------+      +----------------------+
|                |      |                     |      |                      |
|  React (UI)    |----->|  Firebase Functions |----->|  Google AI Services  |
|                |      |                     |      | (Gemini, Imagen)     |
+-------+--------+      +----------+----------+      +----------------------+
        |                          |
        |                          |
        v                          v
+-------+--------+      +----------+----------+
|                |      |                     |
| Firebase Auth  |      |   Cloud Storage /   |
|                |      |      Firestore      |
+----------------+      +---------------------+
```

## 2. 数据与流程设计

### 2.1 完整数据流
1.  **用户输入**: 用户在前端界面输入故事文本、选择页数、宽高比等参数。
2.  **认证**: Firebase Auth 验证用户身份。
3.  **故事生成请求 (流式)**: 前端默认调用 `generateTaleStream` HTTP端点，建立一个 Server-Sent Events (SSE) 连接。
4.  **AI实时分析与转发**:
    - `generateTaleStream` 函数流式调用 Gemini 2.5-flash API。
    - Gemini 返回的数据块被实时转发给前端，用于显示进度和部分内容。
5.  **数据存储**: 在流式传输结束后，云函数将完整的结构化JSON数据进行 Gzip 压缩，并存入 Cloud Storage，路径为 `tales/{userId}/{taleId}.json.gz`。
6.  **流式结束**: 云函数通过 SSE 连接发送一个包含 `taleId` 的 `complete` 消息。
7.  **获取完整数据**: 前端收到 `complete` 消息后，调用 `getTaleData` 云函数，从 Cloud Storage 下载并解压完整的绘本数据。
8.  **UI渲染**: 前端收到完整的绘本数据，渲染出不含图片的故事页面。
9.  **图像生成**: 前端自动为每一页调用 `generateImageWithImagen` API（内部调用 `generateImageV4` 或 `generateImage` 云函数）。
10. **图像处理**: 云函数调用 Imagen API 生成图像，将图像上传至 Cloud Storage 并返回公开 URL。
11. **最终展示**: 前端获取图像 URL，实时更新页面，完成绘本展示。

### 2.2 核心用户流程
```mermaid
sequenceDiagram
    participant User
    participant Frontend (React App)
    participant Backend (Firebase Functions)
    participant AI (Gemini/Imagen)
    participant Storage (GCS)

    User->>Frontend: 输入故事 & 设置参数
    User->>Frontend: 点击 "生成绘本"
    
    Frontend->>+Backend: 调用 generateTaleStream (HTTP SSE)
    Backend-->>-Frontend: 建立连接, 实时发送进度
    
    Backend->>AI: 流式调用 Gemini API
    
    loop Gemini 返回数据块
        AI-->>Backend: 数据块
        Backend-->>Frontend: 转发数据块 (progress, partial_content)
    end
    
    Backend->>Storage: (接收完后) 压缩并保存完整 taleData.json.gz
    
    Backend-->>Frontend: 发送 { type: 'complete', taleId }
    deactivate Backend
    
    Frontend->>Backend: 调用 getTaleData(taleId)
    activate Backend
    
    Backend->>Storage: 读取 taleData.json.gz
    Storage-->>Backend: 返回压缩数据
    
    Backend-->>Frontend: 返回解压后的 taleData
    deactivate Backend

    Frontend->>Frontend: 渲染故事页面（无图）
    
    loop 为每一页
        Frontend->>Backend: 调用 generateImage (V3/V4)
        activate Backend
        Backend->>AI: 调用 Imagen API 生成图片
        AI-->>Backend: 返回图片数据 (base64)
        Backend->>Storage: 保存图片并获取URL
        Storage-->>Backend: 返回公开URL
        Backend-->>Frontend: 返回 { imageUrl }
        deactivate Backend
        Frontend->>Frontend: 更新页面，显示图片
    end
    
    User->>Frontend: 查看/编辑/导出绘本
```

### 2.3 交互式工作流
- **状态监控**: UI界面提供一个调试/日志窗口，实时显示从故事分析到图片生成的每一步进展。
- **任务控制**: 用户可以在生成过程中随时 **暂停 (Pause)** 或 **中止 (Abort)** 任务。
- **图像编辑**:
  - 用户可以查看每页的图像生成提示词 (Prompt)。
  - 用户可以修改提示词并 **重新生成 (Regenerate)** 单个页面的图像。

## 3. 数据结构

### 3.1 故事数据结构 (TaleData)
```json
{
  "storyTitle": "string",
  "artStyle": "string",
  "storyAnalysis": {
    "totalLength": "string",
    "keyPlots": ["string"],
    "storyStructure": {
      "beginning": "string",
      "development": "string",
      "climax": "string",
      "ending": "string"
    }
  },
  "allCharacters": {
    "characterName": {
      "appearance": "string",
      "clothing": "string",
      "personality": "string"
    }
  },
  "pages": [
    {
      "pageNumber": "number",
      "title": "string",
      "text": "string",
      "sceneType": "string",
      "sceneCharacters": ["string"],
      "imagePrompt": "string",
      "scenePrompt": "string",
      "characterPrompts": "string"
    }
  ]
}
```

### 3.2 前端核心状态 (App.js State)
```javascript
{
  user: Object,           // Firebase认证用户
  story: "string",        // 用户输入的故事原文
  pageCount: "number",      // 期望页数
  aspectRatio: "string",  // 图像宽高比
  character: Object,      // 角色信息 (name, description, etc.)
  pages: [Object],        // 页面数据数组
  allCharacters: Object,  // 从故事中提取的所有角色
  loading: "boolean",       // 全局加载状态
  logs: [Object],         // 操作日志
  isPaused: "boolean",      // 暂停状态
  abortController: "AbortController" // 中断控制器
}
```

## 4. API 设计

### 4.1 前端 API 封装 (`client/src/api.js`)
- **`generateTale(..., useStreaming = true)`**: 
  - 核心封装函数，默认启用流式处理。
  - 当 `useStreaming` 为 `true` 时，内部调用 `generateTaleStream`。
  - 当为 `false` 时，调用后端的 `generateTale` (onCall) 作为备用方案。
- **`generateTaleStream(...)`**:
  - 使用 `fetch` API 与后端的 `generateTaleStream` (onRequest) 建立 SSE 连接，并处理流式数据。
- **`generateImageWithImagen(...)`**: 
  - 智能构建图像生成提示词，并根据配置动态调用 `generateImage` 或 `generateImageV4`。

### 4.2 后端 Firebase Functions (`functions/index.js`)
- **`generateTaleStream` (`onRequest`)**:
  - **类型**: HTTP Request
  - **触发**: 前端 `generateTaleStream` 调用。
  - **处理**: 建立SSE连接，流式调用Gemini，实时转发数据块，完成后保存完整数据到GCS。
  - **输出**: `text/event-stream` 数据流。
- **`generateTale` (`onCall`)**:
  - **类型**: Callable
  - **触发**: 作为非流式备用方案被调用。
  - **处理**: 一次性调用Gemini，将完整响应存入GCS。
  - **输出**: `{ success: true, taleId: string }`
- **`getTaleData` (`onCall`)**:
  - **输入**: `taleId`
  - **处理**: 从GCS读取并解压故事数据。
  - **输出**: `TaleData` 对象。
- **`generateImage` / `generateImageV4` (`onCall`)**:
  - **输入**: `prompt`, `pageIndex`, `aspectRatio`, etc.
  - **处理**: 调用Imagen 3/4 API，保存图片到GCS。
  - **输出**: `{ imageUrl: string, success: true }`
- **`extractCharacter` (`onCall`)**:
  - **输入**: `story`
  - **处理**: 调用Gemini提取核心角色信息。
  - **输出**: `{ success: true, name: string, description: string }`

## 5. 存储策略

- **主存储 (Cloud Storage)**:
  - 路径: `tales/{userId}/{taleId}.json.gz`
  - 格式: 默认使用 Gzip 压缩 JSON 文件。
  - 优点: 成本低，适合存储大对象。
- **备用存储 (Firestore)**:
  - 逻辑存在，但当前默认使用 Cloud Storage。
  - 路径: `users/{userId}/tales/{taleId}`
  - 优点: 强大的查询能力，适合结构化数据。
- **Gzip 健壮性处理**:
  - 在从 Cloud Storage 读取数据时，系统实现了双重降级策略以确保健壮性：
    1.  **魔数校验 (Magic Number Check)**: 首先检查文件头是否匹配Gzip格式 (`0x1f 0x8b`)。如果不匹配，系统会假定它是未压缩的纯文本JSON并直接解析。
    2.  **解压失败降级**: 如果魔数校验通过但解压失败（如文件损坏），系统会捕获错误并再次尝试将文件作为纯文本JSON解析。
  - 这个机制确保了无论存储的是压缩文件还是纯文本文件，系统都能最大程度地成功读取数据。

## 6. 错误处理与可靠性
- **客户端重试**: 前端 `api.js` 实现 `retryWithBackoff` 机制，对可重试的网络错误（如API调用失败）进行指数退避重试。
- **服务端重试**: 后端对 Imagen API 的调用也实现了类似的指数退避重试逻辑，处理临时的API不稳定。
- **存储恢复机制**: 如 "5. 存储策略" 中所述，系统能够自动处理Gzip格式错误和文件损坏问题，提高了数据读取的成功率。
- **用户反馈**: 所有错误都会在UI的日志窗口中清晰展示，并更新页面状态（如显示"生成失败"）。
- **超时管理**: Firebase Functions 设置了900秒（15分钟）的超时，以处理耗时较长的AI任务。

## 7. 内容安全
- **多层过滤**:
  1. **LLM层**: Gemini 模型内置安全策略。
  2. **提示词层**: `config.js` 中的 `PROMPTS` 和 `api.js` 中的处理逻辑包含安全转换规则，将潜在的敏感词汇替换为儿童友好的描述。
  3. **图像层**: 调用Imagen API时，设置安全过滤级别，并使用负向提示词排除不当内容（如文字、暴力元素）。

## 8. 性能优化
- **流式处理 (Streaming)**: `generateTale` 过程默认采用流式处理，通过 Server-Sent Events (SSE) 将 Gemini 的响应分块传输。这显著降低了云函数的内存峰值，解决了处理长篇故事时可能出现的内存溢出问题，并能实时向前端反馈生成进度。
- **数据压缩**: 对存储在 GCS 中的故事数据使用 Gzip 压缩，减少存储成本和网络传输时间。
- **并发控制**: 图片生成采用串行（for循环 + await），并加入1秒延迟，避免触发API的速率限制。
- **资源配置**: `generateTale` 等核心函数配置了 `2GiB` 内存，确保有足够资源处理大型数据。
- **前端渲染**: 故事结构和图片分离加载，先展示文本内容，然后异步加载图片，提升用户感知性能。

## 9. 配置管理
- **后端 (`functions/config.js`)**: 集中管理所有后端配置，包括项目ID、API模型名称、提示词模板、存储路径和共享工具函数。
- **前端 (`client/src/config.js`)**: 集中管理前端配置，包括API版本、区域选择和URL构建逻辑。
- **单一事实来源**: 严格的中心化配置避免了硬编码和配置不一致的问题。

## 10. 未来规划
- **用户历史记录**: 实现用户历史绘本列表，方便用户查看、加载和管理自己创作的作品。
- **角色形象预设**: 允许用户保存和复用角色形象，确保在不同绘本中角色形象的统一性。
- **模板系统**: 提供预设的故事模板和艺术风格，简化创作流程。
- **移动端适配**: 使用 React Native 或其他技术开发移动应用版本。
- **多语言支持**: 完善UI界面的多语言本地化支持。

This implementation design ensures scalable, reliable, and user-friendly story generation with comprehensive error handling and content safety measures.

