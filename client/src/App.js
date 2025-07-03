import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { auth } from './firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";
import { generateTale } from './api';
import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
import PageSelector from './components/PageSelector';
import AspectRatioSelector from './components/AspectRatioSelector';
import CharacterManager from './components/CharacterManager';
import PageItem from './components/PageItem';

function App() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [story, setStory] = useState('');
  const [storyTitle, setStoryTitle] = useState(''); // 自动生成的故事标题
  const [pageCount, setPageCount] = useState(6); // 默认6页
  const [aspectRatio, setAspectRatio] = useState('16:9'); // 默认16:9
  const [character, setCharacter] = useState({
    name: '',
    description: '',
    referenceImage: null,
    referenceImagePreview: null,
    fidelity: 50,
    isAutoExtracted: false
  }); // 角色状态
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'signup'
  const [logs, setLogs] = useState([]); // 生成过程日志
  const [isPaused, setIsPaused] = useState(false); // 暂停状态
  const [abortController, setAbortController] = useState(null); // 中断控制器
  const [showDebugWindow, setShowDebugWindow] = useState(false); // 调试窗口显示状态
  const [regeneratingPageIndex, setRegeneratingPageIndex] = useState(-1); // 正在重新生成的页面索引
  const [isEditingTitle, setIsEditingTitle] = useState(false); // 标题编辑状态
  const [editedTitle, setEditedTitle] = useState(''); // 编辑中的标题
  const logIdCounter = useRef(0); // 日志ID计数器
  const logsContentRef = useRef(null); // 日志内容引用

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
    });
    return () => unsubscribe();
  }, []);

  // 自动滚动日志到底部
  useEffect(() => {
    if (logsContentRef.current) {
      logsContentRef.current.scrollTop = logsContentRef.current.scrollHeight;
    }
  }, [logs]);

  const handleSignUp = async () => {
    setError('');
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      setProgress('注册成功！');
    } catch (error) {
      setError("注册错误: " + error.message);
      console.error("Error signing up:", error);
    }
  };

  const handleLogin = async () => {
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setProgress('登录成功！');
    } catch (error) {
      setError("登录错误: " + error.message);
      console.error("Error logging in:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setPages([]);
      setStory('');
      setStoryTitle(''); // 清空故事标题
      setPageCount(6); // 重置为默认值
      setAspectRatio('16:9'); // 重置为默认值
      setCharacter({
        name: '',
        description: '',
        referenceImage: null,
        referenceImagePreview: null,
        fidelity: 50,
        isAutoExtracted: false
      }); // 重置角色状态
      setRegeneratingPageIndex(-1); // 重置重新生成状态
      setProgress('已登出');
    } catch (error) {
      setError("登出错误: " + error.message);
      console.error("Error logging out:", error);
    }
  };

  const handleStoryChange = (event) => {
    const newValue = event.target.value;
    
    // 字数限制：2000字
    if (newValue.length <= 2000) {
      setStory(newValue);
      setError('');
    } else {
      // 如果超过限制，截取前2000字并显示警告
      setStory(newValue.substring(0, 2000));
      setError('故事内容已达到2000字限制，请精简内容');
    }
  };

  // 添加日志函数
  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    logIdCounter.current += 1;
    const newLog = {
      id: logIdCounter.current,
      timestamp,
      message,
      type
    };
    setLogs(prevLogs => [...prevLogs, newLog]);
  };

  // 暂停/继续功能
  const handlePauseResume = () => {
    setIsPaused(!isPaused);
    if (!isPaused) {
      addLog('Generation paused by user', 'warning');
    } else {
      addLog('Resuming generation process', 'info');
    }
  };

  // 中断生成功能
  const handleAbort = () => {
    if (abortController) {
      abortController.abort();
      addLog('Generation aborted by user', 'error');
    }
    setLoading(false);
    setIsPaused(false);
  };

  const generateTaleFlow = async () => {
    if (!story.trim()) {
      setError('请输入故事内容');
      return;
    }

    setLoading(true);
    setError('');
    setPages([]);
    setLogs([]); // 清空之前的日志
    logIdCounter.current = 0; // 重置日志计数器
    setIsPaused(false);
    setShowDebugWindow(true); // 显示调试窗口

    // 创建中断控制器
    const controller = new AbortController();
    setAbortController(controller);

    try {
      addLog(`Starting generation of ${pageCount}-page storybook (${aspectRatio} ratio)`, 'info');
      addLog(`Story content: ${story.substring(0, 100)}${story.length > 100 ? '...' : ''}`, 'info');

      // 使用新的返回格式，包含进度回调和中断信号
      const result = await generateTale(story, pageCount, aspectRatio, (progress) => {
        // 实时更新UI显示进度和页面
        if (progress.step === 'generating_pages') {
          if (progress.log) {
            addLog(progress.log, 'llm');
          }
        } else if (progress.step === 'generating_images') {
          
          // 添加图像生成日志，支持不同类型的日志
          if (progress.log) {
            const logType = progress.log.includes('failed') || progress.log.includes('error') ? 'error' :
                           progress.log.includes('retry') || progress.log.includes('invalid') ? 'warning' :
                           progress.log.includes('reference') || progress.log.includes('style') ? 'image' :
                           'image';
            addLog(progress.log, logType);
          }
          
          // 每生成一张图片就立即显示
          if (progress.allPages && progress.allPages.length > 0) {
            setPages([...progress.allPages]);
          }
        }
      }, controller.signal);
      
      // 现在result包含pages、statistics和storyTitle
      setPages(result.pages);
      setStoryTitle(result.storyTitle || '您的故事绘本');
      
      addLog(`Story generated with title: ${result.storyTitle || '未命名故事'}`, 'success');
      addLog('All pages generated successfully', 'success');
      
    } catch (error) {
      if (error.name === 'AbortError') {
        setError('Generation was aborted by user');
        addLog('Generation process was aborted by user', 'error');
      } else {
        setError('Error generating storybook: ' + error.message);
        addLog(`Generation error: ${error.message}`, 'error');
        console.error("Error generating tale:", error);
      }
    } finally {
      setLoading(false);
      setIsPaused(false);
      setAbortController(null);
    }
  };

  const clearStory = () => {
    setStory('');
    setStoryTitle(''); // 清空故事标题
    setIsEditingTitle(false); // 重置标题编辑状态
    setEditedTitle(''); // 清空编辑中的标题
    setPages([]);
    setPageCount(6); // 重置为默认值
    setAspectRatio('16:9'); // 重置为默认值
    setCharacter({
      name: '',
      description: '',
      referenceImage: null,
      referenceImagePreview: null,
      fidelity: 50,
      isAutoExtracted: false
    }); // 重置角色状态
    setError('');
    setProgress('');
    setLogs([]); // 清空日志
    logIdCounter.current = 0; // 重置日志计数器
    setIsPaused(false);
    setShowDebugWindow(false); // 隐藏调试窗口
    setRegeneratingPageIndex(-1); // 重置重新生成状态
  };

  // 重新生成单个页面图像
  const regeneratePageImage = async (pageIndex, customPrompt = null) => {
    if (pageIndex < 0 || pageIndex >= pages.length) {
      setError('无效的页面索引');
      return;
    }

    if (regeneratingPageIndex !== -1) {
      addLog('已有页面正在重新生成中，请稍候...', 'warning');
      return;
    }

    const currentPage = pages[pageIndex];
    const userPrompt = customPrompt || currentPage.imagePrompt;

    try {
      setRegeneratingPageIndex(pageIndex);
      
      // 更新页面状态为生成中，并立即更新提示词
      const updatedPages = [...pages];
      updatedPages[pageIndex] = {
        ...currentPage,
        status: 'generating',
        error: null,
        image: null,
        imagePrompt: userPrompt // 立即更新提示词到状态中
      };
      setPages(updatedPages);

      addLog(`Regenerating image for page ${pageIndex + 1}...`, 'info');

      // 判断是否为用户自定义的简单提示词（不包含原有的增强信息）
      const isUserCustomPrompt = userPrompt && userPrompt.length < 200 && 
                                !userPrompt.includes('IMPORTANT: Show the main character') &&
                                !userPrompt.includes('Show only these characters') &&
                                !userPrompt.includes('children\'s book illustration style');

      // 构建最终的增强提示词
      let finalPrompt = userPrompt;
      
      if (isUserCustomPrompt) {
        // 用户自定义提示词 - 应用内容安全优化和角色一致性增强
        const { sceneCharacters = [], sceneType = '主角场景', mainCharacter = '', characterType = '' } = currentPage;
        const artStyle = '儿童绘本插画风格';
        
        console.log(`User custom prompt detected for page ${pageIndex + 1}: "${userPrompt}"`);
        console.log(`Applying character consistency - Scene: ${sceneType}, Characters: [${sceneCharacters.join(', ')}]`);
        
        // 应用内容安全转换，确保用户输入的提示词安全友善
        const safetyReplacements = {
          // 暴力相关词汇转换
          '打架': '玩耍', '战斗': '友好竞赛', '愤怒': '专注', '凶恶': '认真',
          '打斗': '互动', '攻击': '接近', '武器': '工具', '刀': '魔法棒', '剑': '勇士棒',
          // 恐怖元素转换
          '可怕': '神秘', '恐怖': '有趣', '吓人': '令人好奇', '鬼': '精灵', '怪物': '奇幻生物',
          // 负面情绪转换
          '邪恶': '调皮', '坏': '淘气', '狡猾': '聪明', '阴险': '机智', '仇恨': '误解',
          // 危险行为转换
          '危险': '冒险', '伤害': '帮助', '破坏': '改造', '毁灭': '改变'
        };
        
        // 对用户提示词应用安全转换
        let safeUserPrompt = userPrompt;
        Object.entries(safetyReplacements).forEach(([unsafe, safe]) => {
          const regex = new RegExp(unsafe, 'gi');
          safeUserPrompt = safeUserPrompt.replace(regex, safe);
        });
        
        // 如果提示词被修改，记录日志
        if (safeUserPrompt !== userPrompt) {
          console.log(`Applied safety transformations to user prompt: "${userPrompt}" -> "${safeUserPrompt}"`);
          addLog(`为提高生成成功率，已优化用户提示词中的部分词汇`, 'info');
        }
        
        // 应用与原有系统相同的角色一致性逻辑，使用安全转换后的提示词
        if (sceneType === '无角色场景') {
          finalPrompt = `${safeUserPrompt}. Focus on the scene and environment only, no characters should appear. ${artStyle}.`;
        } else if (sceneType === '主角场景' && sceneCharacters.includes(mainCharacter?.split(' ')[0])) {
          // 主角场景 - 应用主角一致性
          if (pageIndex > 0) {
            finalPrompt = `${safeUserPrompt}. IMPORTANT: Show the main character - ${mainCharacter}. Maintain consistent character design, same colors, same appearance features. ${artStyle}. Consistent with previous pages.`;
          } else {
            finalPrompt = `${safeUserPrompt}. Establish clear character design for the main character - ${mainCharacter}. ${artStyle}. This sets the visual foundation for the story.`;
          }
        } else if (sceneType === '配角场景' || sceneType === '群体场景') {
          // 配角场景 - 只显示指定的配角，排除主角
          if (sceneCharacters.length > 0) {
            finalPrompt = `${safeUserPrompt}. Show only these characters: ${sceneCharacters.join(', ')}. Do NOT show the main character (${mainCharacter}) in this scene. ${artStyle}.`;
          } else {
            finalPrompt = `${safeUserPrompt}. Focus on the scene with the mentioned characters. Do NOT include the main character in this specific scene. ${artStyle}.`;
          }
        } else {
          // 备用方案 - 添加基础绘本风格
          finalPrompt = `${safeUserPrompt}. ${artStyle}.`;
        }
        
        // 根据宽高比优化构图描述
        if (aspectRatio === '9:16') {
          finalPrompt += ' Vertical composition, portrait orientation, characters positioned for tall frame.';
        } else if (aspectRatio === '16:9') {
          finalPrompt += ' Horizontal composition, landscape orientation, wide scene with good use of space.';
        }
        
        // 添加安全友善的氛围描述
        finalPrompt += ' Safe and welcoming atmosphere, friendly expressions, suitable for children.';
      }

      // 调用图像生成API
      const generateImage = httpsCallable(functions, 'generateImage');
      
      // 构建增强的负向提示词，明确排除文字内容
      const enhancedNegativePrompt = [
        'text', 'words', 'letters', 'writing', 'signs', 'symbols', 'captions', 'subtitles', 
        'labels', 'watermarks', 'typography', 'written text', 'readable text', 'book text',
        'speech bubbles', 'dialogue boxes', 'written words', 'script', 'handwriting',
        'blurry', 'low quality', 'distorted', 'bad anatomy'
      ].join(', ');
      
      const requestData = {
        prompt: finalPrompt,
        pageIndex: pageIndex,
        aspectRatio: aspectRatio,
        seed: isUserCustomPrompt ? Math.floor(Math.random() * 10000) : (42 + pageIndex), // 用户自定义使用随机种子
        maxRetries: 0, // 移除重试，直接失败
        sampleCount: 1,
        safetyFilterLevel: 'OFF',
        personGeneration: 'allow_all',
        addWatermark: false,
        negativePrompt: enhancedNegativePrompt
      };

      console.log('Final enhanced prompt:', finalPrompt);
      console.log('Is user custom prompt:', isUserCustomPrompt);
      console.log('Using seed:', requestData.seed);

      const result = await generateImage(requestData);

      if (result.data && result.data.success && result.data.imageUrl) {
        // 更新成功的页面
        const finalPages = [...pages];
        finalPages[pageIndex] = {
          ...currentPage,
          image: result.data.imageUrl,
          imagePrompt: userPrompt, // 保存用户的原始提示词
          status: 'success',
          error: null,
          isPlaceholder: false
        };
        setPages(finalPages);
        addLog(`Page ${pageIndex + 1} image regenerated successfully`, 'success');
      } else {
        throw new Error(result.data.error || 'Unknown error');
      }
    } catch (error) {
      console.error(`Failed to regenerate page ${pageIndex + 1}:`, error);
      
      // 更新失败的页面，但保持新的提示词
      const errorPages = [...pages];
      errorPages[pageIndex] = {
        ...currentPage,
        status: 'error',
        error: error.message,
        image: null,
        imagePrompt: userPrompt // 即使失败也要保持新提示词
      };
      setPages(errorPages);
      addLog(`Page ${pageIndex + 1} regeneration failed: ${error.message}`, 'error');
    } finally {
      setRegeneratingPageIndex(-1);
    }
  };

  // 更新页面提示词
  const updatePagePrompt = (pageIndex, newPrompt) => {
    if (pageIndex < 0 || pageIndex >= pages.length) return;
    
    const updatedPages = [...pages];
    updatedPages[pageIndex] = {
      ...updatedPages[pageIndex],
      imagePrompt: newPrompt
    };
    setPages(updatedPages);
  };

  // 开始编辑标题
  const handleStartEditTitle = () => {
    setEditedTitle(storyTitle || '您的故事绘本');
    setIsEditingTitle(true);
  };

  // 保存标题
  const handleSaveTitle = () => {
    setStoryTitle(editedTitle.trim() || '您的故事绘本');
    setIsEditingTitle(false);
  };

  // 取消编辑标题
  const handleCancelEditTitle = () => {
    setEditedTitle('');
    setIsEditingTitle(false);
  };

  // 登录/注册界面
  if (!user) {
    return (
      <div className="App">
        <header className="App-header">
          <h1>📚 故事绘本生成器</h1>
          <p>使用AI技术为您的故事生成精美的插图绘本</p>
        </header>
        <main className="auth-container">
          <div className="auth-form">
            <div className="auth-tabs">
              <button 
                className={authMode === 'login' ? 'active' : ''}
                onClick={() => setAuthMode('login')}
              >
                登录
              </button>
              <button 
                className={authMode === 'signup' ? 'active' : ''}
                onClick={() => setAuthMode('signup')}
              >
                注册
              </button>
            </div>
            
            <div className="input-group">
              <input 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                placeholder="邮箱地址" 
                required
              />
              <input 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                placeholder="密码" 
                required
              />
            </div>
            
            <button 
              className="auth-button"
              onClick={authMode === 'login' ? handleLogin : handleSignUp}
            >
              {authMode === 'login' ? '登录' : '注册'}
            </button>
            
            {error && <div className="error-message">{error}</div>}
            {progress && <div className="success-message">{progress}</div>}
          </div>
        </main>
      </div>
    );
  }

  // 主应用界面
  return (
    <div className="App">
      <header className="App-header">
        <div className="header-content">
          <h1>📚 故事绘本生成器</h1>
          <div className="user-info">
            <span>欢迎, {user.email}</span>
            <button onClick={handleLogout} className="logout-button">登出</button>
          </div>
        </div>
      </header>
      
      <main className="main-content">
        <div className="story-input-section">
          <h2>输入您的故事</h2>
          <div className="story-input">
            <textarea
              value={story}
              onChange={handleStoryChange}
              placeholder="在这里输入您的故事...&#10;&#10;系统会自动保持文字语言与输入一致，支持中文、英文、日文等多种语言。&#10;&#10;例如：从前有一只小兔子，它住在森林里的一个小洞里。有一天，小兔子决定去探险寻找传说中的胡萝卜王国..."
              rows="8"
              disabled={loading}
            />
            
            {/* 字数计数显示 */}
            <div className="character-count">
              <span className={story.length > 1800 ? 'count-warning' : story.length > 1500 ? 'count-notice' : ''}>
                {story.length}/2000 字
              </span>
              {story.length > 1800 && (
                <span className="count-tip">
                  {story.length >= 2000 ? ' - 已达字数上限' : ` - 还可输入 ${2000 - story.length} 字`}
                </span>
              )}
            </div>
            
            {/* 参数设置区域 */}
            <div className="story-settings">
              {/* 基础设置组合 */}
              <div className="basic-settings">
                <PageSelector 
                  pageCount={pageCount}
                  onPageCountChange={setPageCount}
                  disabled={loading}
                />
                <AspectRatioSelector 
                  aspectRatio={aspectRatio}
                  onAspectRatioChange={setAspectRatio}
                  disabled={loading}
                />
              </div>
              
              {/* 角色设置单独区域 */}
              <CharacterManager
                story={story}
                character={character}
                onCharacterChange={setCharacter}
                disabled={loading}
              />
            </div>
            
            <div className="input-actions">
              <button 
                onClick={generateTaleFlow} 
                disabled={loading || !story.trim()}
                className="generate-button"
              >
                {loading ? '生成中...' : `生成${pageCount}页绘本`}
              </button>
              <button 
                onClick={clearStory}
                disabled={loading}
                className="clear-button"
              >
                清空
              </button>
            </div>
          </div>
          
          {error && <div className="error-message">{error}</div>}
        </div>

        {(loading || showDebugWindow) && (
          <div className="loading-section">
            <div className="loading-header">
              <div className="loading-info">
                {loading && <div className="loading-spinner"></div>}
                <p>{loading ? '正在生成您的故事绘本，请稍候...' : '生成已完成'}</p>
              </div>
              <div className="loading-controls">
                {loading ? (
                  <>
                    <button 
                      onClick={handlePauseResume}
                      className="pause-button"
                      disabled={isPaused}
                    >
                      {isPaused ? '已暂停' : '暂停'}
                    </button>
                    <button 
                      onClick={handleAbort}
                      className="abort-button"
                    >
                      中断
                    </button>
                  </>
                ) : (
                  <button 
                    onClick={() => setShowDebugWindow(false)}
                    className="close-debug-button"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
            
            {/* 生成日志显示区域 */}
            <div className="generation-logs">
              <div className="logs-content" ref={logsContentRef}>
                {logs.map(log => (
                  <div key={log.id} className={`log-entry log-${log.type}`}>
                    <span className="log-timestamp">{log.timestamp}</span>
                    <span className="log-message">{log.message}</span>
                  </div>
                ))}
                {logs.length === 0 && (
                  <div className="log-entry log-placeholder">
                    <span className="log-message">Waiting for generation to start...</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {pages.length > 0 && (
          <div className="tale-display-section">
            <div className="tale-title-section">
              {isEditingTitle ? (
                <div className="title-editor">
                  <input
                    type="text"
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    className="title-input"
                    placeholder="输入故事标题..."
                    autoFocus
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleSaveTitle();
                      } else if (e.key === 'Escape') {
                        handleCancelEditTitle();
                      }
                    }}
                  />
                  <div className="title-editor-actions">
                    <button 
                      onClick={handleSaveTitle}
                      className="title-save-button"
                    >
                      保存
                    </button>
                    <button 
                      onClick={handleCancelEditTitle}
                      className="title-cancel-button"
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <div className="title-display">
                  <h2 onClick={handleStartEditTitle} className="editable-title">
                    {storyTitle || '您的故事绘本'}
                  </h2>
                </div>
              )}
            </div>
            
            <div className="tale-display">
              {pages.map((page, index) => (
                <PageItem
                  key={index}
                  page={page}
                  index={index}
                  onRegenerateImage={regeneratePageImage}
                  onUpdatePrompt={updatePagePrompt}
                  isGenerating={regeneratingPageIndex === index || loading}
                />
              ))}
            </div>
            
            <div className="tale-actions">
              <button onClick={clearStory} className="new-story-button">
                ✨ 创建新故事
              </button>
            </div>
          </div>
        )}
      </main>
      
      <footer className="App-footer">
        <p>由 Gemini AI 和 Imagen 4 驱动 | 使用 Firebase 云存储</p>
      </footer>
    </div>
  );
}

export default App;

