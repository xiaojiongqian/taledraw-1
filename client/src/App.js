import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { auth } from './firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";
import { generateTale, generateCharacterAvatar, generateImageWithImagen } from './api';
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
  const [artStyle, setArtStyle] = useState('儿童绘本插画风格'); // 新增艺术风格状态
  const [allCharacters, setAllCharacters] = useState({}); // 新增所有角色信息状态
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
  const [isEditingTitle, setIsEditingTitle] = useState(false); // 标题编辑状态
  const [editedTitle, setEditedTitle] = useState(''); // 编辑中的标题
  const logIdCounter = useRef(0); // 日志ID计数器
  const logsContentRef = useRef(null); // 日志内容引用
  const [storyWordCount, setStoryWordCount] = useState(0); // 新增字数状态

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

  // 多语言字数统计函数
  function countWords(text) {
    // 匹配所有CJK字符（中文、日文、韩文）
    const cjk = text.match(/[\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]/g) || [];
    // 匹配所有非CJK的单词（包括阿拉伯语、英文等）
    const nonCjk = text
      .replace(/[\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    return cjk.length + nonCjk.length;
  }

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
      setProgress('已登出');
    } catch (error) {
      setError("登出错误: " + error.message);
      console.error("Error logging out:", error);
    }
  };

  const handleStoryChange = (event) => {
    const newValue = event.target.value;
    const wordLimit = 2000;
    let currentCount = countWords(newValue);
    let finalValue = newValue;
    // 超出字数时进行截断
    if (currentCount > wordLimit) {
      // 逐步截断，直到不超过限制
      let temp = '';
      for (let i = 0, w = 0; i < newValue.length && w < wordLimit; i++) {
        temp += newValue[i];
        if (countWords(temp) > w) {
          w = countWords(temp);
        }
        if (w > wordLimit) {
          temp = temp.slice(0, -1);
          break;
        }
      }
      finalValue = temp;
      currentCount = countWords(finalValue);
      setError('故事内容已达到2000字限制，请精简内容');
    } else {
      setError('');
    }
    setStory(finalValue);
    setStoryWordCount(currentCount);
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
      setAllCharacters(result.allCharacters || {}); // 保存角色信息
      setArtStyle(result.artStyle || '儿童绘本插画风格'); // 保存艺术风格
      
      addLog(`Story generated with title: ${result.storyTitle || '未命名故事'}`, 'success');
      addLog(`Art style identified: ${result.artStyle}`, 'info');
      addLog(`Total ${Object.keys(result.allCharacters || {}).length} characters identified`, 'info');

      // 提取统计数据并记录
      if (result.statistics) {
        // ... existing code ...
      }
      
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
  };

  // 重新生成单个页面图像
  const regeneratePageImage = async (pageIndex, customPrompt = null) => {
    addLog(`Regenerating image for page ${pageIndex + 1}...`, 'info');

    // Step 1: Set page status to 'regenerating' to show loading indicator immediately
    const pagesWithLoading = pages.map((page, index) => {
      if (index === pageIndex) {
        return { ...page, status: 'regenerating' };
      }
      return page;
    });
    setPages(pagesWithLoading);

    try {
      const pageToRegenerate = pages[pageIndex];
      const prompt = customPrompt || pageToRegenerate.imagePrompt;

      // Step 2: Await the image generation
      const newImageUrl = await generateImageWithImagen(
        prompt,
        pageIndex,
        aspectRatio,
        pageToRegenerate, // pageData
        allCharacters,    // allCharacters
        artStyle          // artStyle
      );

      // Step 3: Update page with new image and 'success' status
      const finalPages = pages.map((page, index) => {
        if (index === pageIndex) {
          return {
            ...page,
            image: newImageUrl,
            imagePrompt: prompt,
            status: 'success',
            error: null,
          };
        }
        return page;
      });
      setPages(finalPages);
      addLog(`Page ${pageIndex + 1} image regenerated successfully!`, 'success');

    } catch (error) {
      console.error(`Failed to regenerate page ${pageIndex + 1}:`, error);
      addLog(`Failed to regenerate page ${pageIndex + 1}: ${error.message}`, 'error');
      
      // Step 4: Update page with 'error' status
      const errorPages = pages.map((page, index) => {
        if (index === pageIndex) {
          return {
            ...page,
            status: 'error',
            error: error.message,
          };
        }
        return page;
      });
      setPages(errorPages);
    }
  };

  // 更新页面提示词
  const updatePagePrompt = (pageIndex, newPrompt) => {
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

  // 在 useEffect 中初始化 storyWordCount
  useEffect(() => {
    setStoryWordCount(countWords(story));
  }, []);

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
              <span className={storyWordCount > 1800 ? 'count-warning' : storyWordCount > 1500 ? 'count-notice' : ''}>
                {storyWordCount}/2000 字
              </span>
              {storyWordCount > 1800 && (
                <span className="count-tip">
                  {storyWordCount >= 2000 ? ' - 已达字数上限' : ` - 还可输入 ${2000 - storyWordCount} 字`}
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
            
            <div className="story-pages">
              {pages.map((page, index) => (
                <PageItem
                  key={page.id || index}
                  page={page}
                  index={index}
                  allCharacters={allCharacters}
                  onRegenerateImage={regeneratePageImage}
                  onUpdatePrompt={updatePagePrompt}
                  isGenerating={loading && progress.includes(`${index + 1}`)}
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

