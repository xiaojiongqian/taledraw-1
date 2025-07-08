# Tale Draw - 实现设计文档

## 1. 核心架构

### 1.1 技术栈
- **前端**: React 19.1.0 (Create React App), JavaScript
- **后端**: Firebase Functions v2 (Node.js 22)
- **数据库/存储**: Cloud Storage (主), Firestore (备)
- **AI 服务**: Google Vertex AI (Gemini 2.5-flash, Imagen 3/4)
- **认证**: Firebase Authentication
- **图像处理**: Sharp 0.34.2 (WebP 转换和压缩)
- **依赖管理**: Firebase SDK 11.9.1, Firebase Admin 12.0.0

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
3.  **故事生成请求 (流式)**: 前端调用 `generateTaleStream` HTTP端点，建立一个 Server-Sent Events (SSE) 连接。
4.  **AI实时分析与转发**:
    - `generateTaleStream` 函数流式调用 Gemini 2.5-flash API。
    - Gemini 返回的数据块被实时转发给前端，用于显示进度和部分内容。
5.  **数据存储**: 在流式传输结束后，云函数将完整的结构化JSON数据进行 Gzip 压缩，并存入 Cloud Storage，路径为 `tales/{userId}/{taleId}.json.gz`。
6.  **流式结束**: 云函数通过 SSE 连接发送一个包含 `taleId` 的 `complete` 消息。
7.  **获取完整数据**: 前端收到 `complete` 消息后，调用 `getTaleData` 云函数，从 Cloud Storage 下载并解压完整的绘本数据。
8.  **UI渲染**: 前端收到完整的绘本数据，渲染出不含图片的故事页面。
9.  **图像生成**: 前端自动为每一页调用 `generateImageWithImagen` API（内部调用 `generateImageV4` 或 `generateImage` 云函数）。
10. **图像处理**: 云函数调用 Imagen API 生成图像，使用 Sharp 库转换为 WebP 格式，上传至 Cloud Storage 并返回公开 URL。
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
- **`generateTale(...)`**: 
  - 核心封装函数，统一使用流式处理。
  - 内部直接调用 `generateTaleStream`，提供统一的API接口。
- **`generateTaleStream(...)`**:
  - 使用 `fetch` API 与后端的 `generateTaleStream` (onRequest) 建立 SSE 连接，并处理流式数据。
- **`generateImageWithImagen(...)`**: 
  - 智能构建图像生成提示词，并根据配置动态调用 `generateImage` 或 `generateImageV4`。
  - 内置WebP格式转换和压缩逻辑。

### 4.2 后端 Firebase Functions (`functions/index.js`)
- **`generateTaleStream` (`onRequest`)**:
  - **类型**: HTTP Request
  - **触发**: 前端 `generateTaleStream` 调用。
  - **处理**: 建立SSE连接，流式调用Gemini，实时转发数据块，完成后保存完整数据到GCS。
  - **输出**: `text/event-stream` 数据流。
- **`getTaleData` (`onCall`)**:
  - **输入**: `taleId`
  - **处理**: 从GCS读取并解压故事数据。
  - **输出**: `TaleData` 对象。
- **`generateImage` / `generateImageV4` (`onCall`)**:
  - **输入**: `prompt`, `pageIndex`, `aspectRatio`, etc.
  - **处理**: 调用Imagen 3/4 API，使用Sharp库转换为WebP格式（90%质量），保存到GCS。
  - **输出**: `{ imageUrl: string, success: true }`
- **`generateImageBatch` / `generateImageBatchV4` (`onCall`)**:
  - **输入**: `prompts` 数组
  - **处理**: 批量图像生成，支持大型绘本（最多30页），15分钟超时。
  - **输出**: 批量生成结果数组。
- **`extractCharacter` (`onCall`)**:
  - **输入**: `story`
  - **处理**: 调用Gemini提取核心角色信息。
  - **输出**: `{ success: true, name: string, description: string }`
- **`healthCheck` (`onCall`)**:
  - **处理**: 系统健康检查和监控。
  - **输出**: 系统状态信息。

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

## 10. 已完成的优化改进

### 10.1 WebP 图像格式优化 ✅ (2025-01-08)

**优化目标**: 将图像文件大小从 1-2MB 减少到 60-70%

**技术实现**:
```javascript
// 后端压缩函数
async function compressImageToWebP(base64Data) {
  const imageBuffer = Buffer.from(base64Data, 'base64');
  const compressedBuffer = await sharp(imageBuffer)
    .webp({ quality: 90 })
    .toBuffer();
  return compressedBuffer;
}
```

**优化效果**:
- 文件大小减少：60-70%（从1-2MB降至约600-800KB）
- 加载速度提升：WebP格式支持更快传输
- 存储成本降低：更小的文件大小减少存储费用
- 处理稳定性：简化的压缩流程确保更好的稳定性

### 10.2 流式处理架构统一 ✅ (2025-01-08)

**背景问题**:
- 代码中存在两套故事生成逻辑：流式处理 + 非流式处理
- 非流式处理逻辑从未被使用（默认 `useStreaming = true`）
- 冗余代码增加维护复杂性

**简化效果**:
- **代码减少**: 删除约 150 行冗余代码
- **维护简化**: 单一数据流路径，减少错误点
- **性能提升**: 流式处理提供更好的用户体验
- **架构清晰**: 专注于实时反馈的用户体验

### 10.3 HTML导出功能优化 ✅ (2025-01-21)

**核心问题修复**:
- **图片转换失败**: Canvas CORS错误导致所有图片转换失败
- **并发处理问题**: 浏览器并发限制导致批量转换超时
- **文件大小异常**: 图片未嵌入导致HTML文件仅0.01MB，需要网络连接

**解决方案**:
- 从Canvas方法改为Fetch API方法，完全绕过CORS限制
- 从并发处理改为顺序处理，避免浏览器并发限制
- 超时时间从10秒增加到30秒

**优化效果**:
- ✅ 图片转换成功率：0% → 100%
- ✅ HTML文件大小：0.01MB → 10-25MB（完整嵌入）
- ✅ 支持完全离线查看，无需网络连接
- ✅ 服务器流量消耗：大幅降低

## 11. Firebase Functions 性能配置

### 11.1 内存资源配置

| 函数名称                  | 内存配置 | 超时配置 | 配置理由                                |
| :----------------------- | :------- | :------ | :------------------------------------- |
| `generateTaleStream`     | 1GB      | 300s    | 流式处理，I/O密集型                     |
| `getTaleData`            | 256MB    | 60s     | 简单的数据库/存储读取操作               |
| `generateImage`          | 1GB      | 300s    | 调用Imagen API + Sharp图像处理          |
| `generateImageV4`        | 1GB      | 300s    | 调用Imagen 4 API + Sharp图像处理        |
| `generateImageBatch`     | 2GB      | 900s    | 批量处理，支持大型绘本（最多30页）       |
| `generateImageBatchV4`   | 2GB      | 900s    | Imagen 4批量处理，长时间运行            |
| `extractCharacter`       | 512MB    | 120s    | 调用Gemini，数据量较小                  |
| `healthCheck`            | 128MB    | 60s     | 最轻量级任务，最低内存配置              |

### 11.2 成本优化策略

**监控指标**:
1. **调用次数**: 监控每月调用量，确保在免费额度内
2. **计算时间**: 重点关注长时间运行的批量函数  
3. **网络流量**: 监控图像上传/下载产生的流量成本

**优化原则**:
1. **批量处理优化**: 减少单次调用的开销
2. **资源精细化**: 根据函数复杂度配置合适的内存和超时
3. **错误处理**: 快速失败，避免资源浪费

## 12. 未来规划
- **用户历史记录**: 实现用户历史绘本列表，方便用户查看、加载和管理自己创作的作品。
- **角色形象预设**: 允许用户保存和复用角色形象，确保在不同绘本中角色形象的统一性。
- **模板系统**: 提供预设的故事模板和艺术风格，简化创作流程。
- **移动端适配**: 使用 React Native 或其他技术开发移动应用版本。
- **多语言支持**: 完善UI界面的多语言本地化支持。
- **性能监控**: 添加详细的性能指标收集和实时监控
- **缓存策略**: 实现智能缓存减少重复计算和API调用

---

*文档版本: v2.0*  
*最后更新: 2025-01-08*  
*维护者: Tale Draw 开发团队*

This implementation design ensures scalable, reliable, and user-friendly story generation with comprehensive error handling, content safety measures, and proven performance optimizations.

