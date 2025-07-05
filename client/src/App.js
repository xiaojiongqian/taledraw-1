import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { auth } from './firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";
import { generateTale, generateCharacterAvatar, generateImageWithImagen } from './api';
import PageSelector from './components/PageSelector';
import AspectRatioSelector from './components/AspectRatioSelector';
import CharacterManager from './components/CharacterManager';
import PageItem from './components/PageItem';
import PptxGenJS from 'pptxgenjs';

function App() {
  const [user, setUser] = useState(null);
  const appVersion = process.env.REACT_APP_VERSION || 'v0.2.2';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [story, setStory] = useState('');
  const [storyTitle, setStoryTitle] = useState(''); // 自动生成的故事标题
  const [pageCount, setPageCount] = useState(10); // 默认10页
  const [aspectRatio, setAspectRatio] = useState('1:1'); // 默认1:1
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

  const abortControllerRef = useRef(null); // 使用ref来持续跟踪AbortController
  const [showDebugWindow, setShowDebugWindow] = useState(false); // 调试窗口显示状态
  const [isEditingTitle, setIsEditingTitle] = useState(false); // 标题编辑状态
  const [editedTitle, setEditedTitle] = useState(''); // 编辑中的标题
  const [showSaveOptions, setShowSaveOptions] = useState(false); // 保存选项
  const logIdCounter = useRef(0); // 日志ID计数器
  const logsContentRef = useRef(null); // 日志内容引用
  const saveContainerRef = useRef(null); // Ref for the save container
  const [storyWordCount, setStoryWordCount] = useState(0); // 新增字数状态
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedResult, setGeneratedResult] = useState(null);

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

  // Click outside to close save options
  useEffect(() => {
    function handleClickOutside(event) {
      if (saveContainerRef.current && !saveContainerRef.current.contains(event.target)) {
        setShowSaveOptions(false);
      }
    }
    // Bind the event listener
    if (showSaveOptions) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    // Unbind the event listener on clean up
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showSaveOptions]);

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
      setProgress('Registration successful!');
    } catch (error) {
              setError("Registration error: " + error.message);
      console.error("Error signing up:", error);
    }
  };

  const handleLogin = async () => {
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setProgress('Login successful!');
    } catch (error) {
              setError("Login error: " + error.message);
      console.error("Error logging in:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setPages([]);
      setStory('');
      setStoryTitle(''); // 清空故事标题
      setPageCount(10); // 重置为默认值
      setAspectRatio('1:1'); // 重置为默认值
      setCharacter({
        name: '',
        description: '',
        referenceImage: null,
        referenceImagePreview: null,
        fidelity: 50,
        isAutoExtracted: false
      }); // 重置角色状态
      setProgress('Logged out');
    } catch (error) {
              setError("Logout error: " + error.message);
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
      setError('Story content has reached the 2000 word limit, please simplify the content');
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



  // Abort generation functionality
  const handleAbort = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      addLog('Generation process aborted by user', 'error');
      setLoading(false);
      setIsGenerating(false);
    } else {
      addLog('No active generation process found to abort', 'warning');
    }
  };

  const generateTaleFlow = async () => {
    if (!story) {
      alert('Please enter story content');
      return;
    }

    // 创建新的AbortController
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setIsGenerating(true);
    setShowDebugWindow(true); // 自动显示调试窗口
    setPages([]);
    setGeneratedResult(null);
    setStoryTitle('');
    setArtStyle('');
    setAllCharacters({});
    setError(null);
    setLogs([]); // 清空旧日志
    logIdCounter.current = 0; // 重置日志计数器
    addLog('Starting story generation...', 'info');

    try {
      const taleData = await generateTale(story, pageCount, aspectRatio, (progress) => {
        if (progress.log) {
          addLog(progress.log, 'info');
        }
        // 清除之前的错误状态，表明流式处理正在正常进行
        if (progress.step && progress.step !== 'error') {
          setError(null);
        }
      }, controller.signal);
      
      // The API now returns the full data at the end.
      setStoryTitle(taleData.storyTitle);
      setArtStyle(taleData.artStyle);
      setAllCharacters(taleData.allCharacters);
      setPages(taleData.pages.map(p => ({ ...p, image: null, status: 'pending' })));
      setGeneratedResult(taleData);
      setError(null); // 清除错误状态，表明故事生成成功
      addLog('Story structure generation completed, starting automatic image generation...', 'success');
      
      // 自动生成所有图片 - 不重新设置loading状态，因为已经在生成过程中
      await generateAllImagesInternal(taleData.pages, taleData.allCharacters, taleData.artStyle);

    } catch (error) {
      console.error('An error occurred during the tale generation flow:', error);
      
      // Check if it was user-initiated abort
      if (error.name === 'AbortError') {
        addLog('Generation process was aborted by user', 'warning');
        setError('Generation process was aborted by user');
      } else {
        setError(error.message);
        addLog(`Generation flow interrupted: ${error.message}`, 'error');
      }
    } finally {
      setLoading(false);
      setIsGenerating(false);
      abortControllerRef.current = null; // Clean up AbortController reference
    }
  };

  // Internal function for image generation without state management
  const generateAllImagesInternal = async (pagesData, charactersData, artStyleData) => {
    if (!pagesData || pagesData.length === 0) {
      addLog('No pages available for image generation', 'warning');
      return;
    }

    // Count how many images need to be generated
    const pendingPages = pagesData.filter(page => !page.image || page.status === 'error');
    const totalPages = pagesData.length;
    const pendingCount = pendingPages.length;
    
    if (pendingCount === 0) {
      addLog('All images have been generated successfully!', 'success');
      return;
    }

    addLog(`Starting image generation for ${pendingCount} out of ${totalPages} pages...`, 'info');

    // 更新所有页面状态为生成中
    const pagesWithGenerating = pagesData.map(page => ({ ...page, status: 'generating' }));
    setPages(pagesWithGenerating);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < pagesData.length; i++) {
      const page = pagesData[i];
      
      // Skip if image already generated successfully
      if (page.image && page.status === 'success') {
        addLog(`Page ${i + 1} already has image, skipping...`, 'info');
        successCount++;
        continue;
      }

      // Update page status to generating for this specific page
      setPages(prevPages => prevPages.map((p, index) => {
        if (index === i) {
          return { ...p, status: 'generating' };
        }
        return p;
      }));

      addLog(`Generating image for page ${i + 1}...`, 'info');

      try {
        const imageUrl = await generateImageWithImagen(
          page.imagePrompt,
          i,
          aspectRatio,
          page,
          charactersData,
          artStyleData
        );

        // 更新单个页面的图片和状态
        setPages(prevPages => prevPages.map((p, index) => {
          if (index === i) {
            return { ...p, image: imageUrl, status: 'success', error: null };
          }
          return p;
        }));

        successCount++;
        addLog(`Page ${i + 1} image generated successfully!`, 'success');

      } catch (error) {
        console.error(`Failed to generate image for page ${i + 1}:`, error);
        
        // Check if it was aborted
        if (error.name === 'AbortError') {
          addLog(`Page ${i + 1} image generation was aborted`, 'warning');
          // Update page status back to pending so it can be resumed later
          setPages(prevPages => prevPages.map((p, index) => {
            if (index === i) {
              return { ...p, status: 'pending', error: null };
            }
            return p;
          }));
          // Break out of the loop when aborted
          break;
        } else {
          // 更新页面状态为错误
          setPages(prevPages => prevPages.map((p, index) => {
            if (index === i) {
              return { ...p, status: 'error', error: error.message };
            }
            return p;
          }));

          errorCount++;
          addLog(`Page ${i + 1} image generation failed: ${error.message}`, 'error');
        }
      }

      // 添加延迟避免API限制
      if (i < pagesData.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // 生成完成总结 - 不设置loading状态，由调用者处理
    if (successCount > 0) {
      addLog(`Image generation completed! Success: ${successCount}, Failed: ${errorCount}`, 'success');
    } else if (errorCount > 0) {
      addLog(`Image generation failed. Please check network connection and retry.`, 'error');
    }
  };

  // Public function for standalone image generation
  const generateAllImages = async (pagesData = pages, charactersData = allCharacters, artStyleData = artStyle) => {
    if (!user) {
      addLog('Please login to use AI generation features', 'error');
      return;
    }

    if (!pagesData || pagesData.length === 0) {
      addLog('No pages available for image generation', 'warning');
      return;
    }

    // Count how many images need to be generated
    const pendingPages = pagesData.filter(page => !page.image || page.status === 'error');
    const totalPages = pagesData.length;
    const pendingCount = pendingPages.length;
    
    if (pendingCount === 0) {
      addLog('All images have been generated successfully!', 'success');
      return;
    }

    addLog(`Starting image generation for ${pendingCount} out of ${totalPages} pages...`, 'info');
    setLoading(true);
    setIsGenerating(true);

    try {
      await generateAllImagesInternal(pagesData, charactersData, artStyleData);
    } finally {
      setLoading(false);
      setIsGenerating(false);
    }
  };

  const clearStory = () => {
    setStory('');
    setStoryTitle(''); // 清空故事标题
    setIsEditingTitle(false); // 重置标题编辑状态
    setEditedTitle(''); // 清空编辑中的标题
    setPages([]);
    setPageCount(10); // 重置为默认值
    setAspectRatio('1:1'); // 重置为默认值
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
    setLoading(false); // 重置loading状态
    setIsGenerating(false); // 重置生成状态
    setLogs([]); // 清空日志
    logIdCounter.current = 0; // 重置日志计数器
    setShowDebugWindow(false); // 隐藏调试窗口
  };

  // 重新生成单个页面图像
  const regeneratePageImage = async (pageIndex, customPrompt = null) => {
    // 检查用户是否已认证
    if (!user) {
      setError('请先登录以使用AI生成功能');
      addLog('User not authenticated', 'error');
      return;
    }

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
    setEditedTitle(storyTitle || 'Your Story Book');
    setIsEditingTitle(true);
  };

  // 保存标题
  const handleSaveTitle = () => {
    setStoryTitle(editedTitle.trim() || 'Your Story Book');
    setIsEditingTitle(false);
  };

  // 取消编辑标题
  const handleCancelEditTitle = () => {
    setEditedTitle('');
    setIsEditingTitle(false);
  };

  const handleSave = () => {
    setShowSaveOptions(!showSaveOptions);
  };

  const handleSaveAsPptx = async () => {
    if (pages.length === 0) {
      addLog('No pages available to save.', 'warning');
      return;
    }
    addLog('Preparing PPTX file download...', 'info');
    setShowSaveOptions(false);

    let pptx = new PptxGenJS();
    pptx.title = storyTitle || '我的故事绘本';

    // Helper function to fetch and convert image to Base64
    const toBase64 = async (url) => {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`图片加载失败: ${response.statusText}`);
        }
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } catch (e) {
        console.error(`获取图片 ${url} 时出现CORS或网络错误。`, 'error');
        addLog(`图片获取失败 ${url}，可能是CORS策略所致。`, 'error');
        throw e;
      }
    };

    for (const [index, page] of pages.entries()) {
      addLog(`正在处理第 ${index + 1} 页...`, 'info');
      let slide = pptx.addSlide();
      slide.addText(storyTitle || '我的故事绘本', { x: 0.5, y: 0.25, w: '90%', h: 0.5, fontSize: 18, bold: true });
      slide.addText(page.title || `第 ${index + 1} 页`, { x: 0.5, y: 0.8, w: '90%', h: 0.4, fontSize: 14 });
      
      if (page.image && page.status === 'success') {
        try {
          addLog(`正在转换第 ${index + 1} 页的图片...`, 'info');
          const imageBase64 = await toBase64(page.image);
          slide.addImage({ data: imageBase64, x: '10%', y: '25%', w: '80%', h: '45%' });
        } catch (error) {
           addLog(`无法添加第 ${index + 1} 页的图片: ${error.message}`, 'error');
        }
      }

      slide.addText(page.text, { x: '10%', y: '75%', w: '80%', h: '20%', fontSize: 12, align: 'left' });
    }

    const safeTitle = (storyTitle || 'storybook').replace(/[^a-z0-9\u4e00-\u9fa5]/gi, '_').toLowerCase();
    pptx.writeFile({ fileName: `${safeTitle}.pptx` })
      .then(fileName => {
        addLog(`PPTX文件已成功下载: ${fileName}`, 'success');
      })
      .catch(err => {
        addLog(`保存PPTX失败: ${err.message}`, 'error');
        console.error(err);
      });
  };

  const handleSaveAsHtml = async () => {
    if (pages.length === 0) {
      addLog('No pages available to save.', 'warning');
      return;
    }

    addLog('Preparing HTML file download...', 'info');
    const originalButtonText = '保存';
    const button = document.querySelector('.save-button');
    if (button) button.textContent = '处理中...';


    try {
      const toBase64 = async (url) => {
        try {
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`图片加载失败: ${response.statusText}`);
          }
          const blob = await response.blob();
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        } catch (e) {
          console.error(`获取图片 ${url} 时出现CORS或网络错误。`);
          addLog(`图片获取失败 ${url}，可能是CORS策略所致。`, 'error');
          throw e; // re-throw error
        }
      };

      const pagesWithBase64Images = await Promise.all(
        pages.map(async (page, index) => {
          let imageBase64 = null;
          if (page.image && page.status === 'success') {
            try {
              addLog(`正在转换第 ${index + 1} 页的图片...`, 'info');
              imageBase64 = await toBase64(page.image);
            } catch (error) {
              addLog(`无法转换第 ${index + 1} 页的图片: ${error.message}`, 'error');
            }
          }
          return { ...page, imageBase64 };
        })
      );

      const htmlContent = `
        <!DOCTYPE html>
        <html lang="zh-CN">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${storyTitle || '我的故事绘本'}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; background-color: #f0f2f5; color: #333; }
            .container { max-width: 800px; margin: auto; background: white; padding: 20px; box-shadow: 0 0 10px rgba(0,0,0,0.1); border-radius: 8px; }
            h1 { text-align: center; color: #444; }
            .page { margin-bottom: 40px; padding: 20px; border: 1px solid #ddd; border-radius: 8px; background: #fafafa; page-break-inside: avoid; }
            .page img { max-width: 100%; height: auto; display: block; margin: 0 auto 15px; border-radius: 4px; }
            .page p { text-align: justify; font-size: 1.1em; white-space: pre-wrap; }
            @media print {
              body { padding: 0; background-color: #fff; }
              .container { box-shadow: none; border: none; padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>${storyTitle || '我的故事绘本'}</h1>
            ${pagesWithBase64Images.map((page, index) => `
              <div class="page">
                <h2>${page.title ? `${index + 1}. ${page.title}` : `${index + 1}.`}</h2>
                ${page.imageBase64 ? `<img src="${page.imageBase64}" alt="第 ${index + 1} 页插图">` : '<p><em>图片加载失败或未生成</em></p>'}
                <p>${page.text.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
              </div>
            `).join('')}
          </div>
        </body>
        </html>
      `;

      const blob = new Blob([htmlContent], { type: 'text/html' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      const safeTitle = storyTitle.replace(/[^a-z0-9\u4e00-\u9fa5]/gi, '_').toLowerCase();
      link.download = `${safeTitle || 'storybook'}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      addLog('HTML file downloaded successfully!', 'success');
    } catch (error) {
      console.error('保存为HTML时出错:', error);
      setError('保存HTML失败: ' + error.message);
      addLog(`保存HTML失败: ${error.message}`, 'error');
    } finally {
      if (button) button.textContent = originalButtonText;
      setShowSaveOptions(false); // Close options menu
    }
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
          <h1>📚 AI Story Book Generator</h1>
          <p>Generate beautiful illustrated storybooks for your stories using AI technology</p>
        </header>
        <main className="auth-container">
          <div className="auth-form">
            <div className="auth-tabs">
              <button 
                className={authMode === 'login' ? 'active' : ''}
                onClick={() => setAuthMode('login')}
              >
                Login
              </button>
              <button 
                className={authMode === 'signup' ? 'active' : ''}
                onClick={() => setAuthMode('signup')}
              >
                Sign Up
              </button>
            </div>
            
            <div className="input-group">
              <input 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                placeholder="Email Address" 
                required
              />
              <input 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                placeholder="Password" 
                required
              />
            </div>
            
            <button 
              className="auth-button"
              onClick={authMode === 'login' ? handleLogin : handleSignUp}
            >
              {authMode === 'login' ? 'Login' : 'Sign Up'}
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
          <h1>📚 AI Story Book Generator</h1>
          <div className="user-info">
            <span>Welcome, {user.email}</span>
            <button onClick={handleLogout} className="btn btn-secondary">Logout</button>
          </div>
        </div>
      </header>
      
      <main className="main-content">
        <div className="story-input-section">
          <h2>Enter Your Story</h2>
          <div className="story-input">
            <textarea
              value={story}
              onChange={handleStoryChange}
              placeholder="Enter your story here...&#10;&#10;The system will automatically maintain text language consistency with your input, supporting Chinese, English, Japanese and other languages.&#10;&#10;Example: Once upon a time, there was a little rabbit who lived in a small hole in the forest. One day, the rabbit decided to go on an adventure to find the legendary Carrot Kingdom..."
              rows="8"
              disabled={loading}
            />
            
            {/* 字数计数显示 */}
            <div className="character-count">
              <span className={storyWordCount > 1800 ? 'count-warning' : storyWordCount > 1500 ? 'count-notice' : ''}>
                {storyWordCount}/2000 words
              </span>
              {storyWordCount > 1800 && (
                <span className="count-tip">
                  {storyWordCount >= 2000 ? ' - Word limit reached' : ` - ${2000 - storyWordCount} words remaining`}
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
                className="btn btn-primary"
              >
                {loading ? 'Generating...' : `Generate ${pageCount}-Page Book`}
              </button>
              <div className="save-container" ref={saveContainerRef}>
                <button
                  onClick={handleSave}
                  disabled={pages.length === 0 || loading}
                  className="btn btn-primary"
                >
                  Save
                </button>
                {showSaveOptions && (
                  <div className="save-options">
                    <button onClick={handleSaveAsHtml} className="btn-save-option">html</button>
                    <button onClick={handleSaveAsPptx} className="btn-save-option">pptx</button>
                  </div>
                )}
              </div>
              <button onClick={clearStory} disabled={loading} className="btn btn-secondary">
                Clear
              </button>
            </div>
          </div>
          
          {error && !showDebugWindow && <div className="error-message">{error}</div>}
        </div>

        {(loading || showDebugWindow) && (
          <div className="loading-section">
            <div className="loading-header">
              <div className="loading-info">
                {loading && <div className="loading-spinner"></div>}
                <p>
                  {loading ? 'Generating your story book, please wait...' : 
                   error ? 'Issues encountered during generation' : 
                   'Generation completed'}
                </p>
              </div>
              <div className="loading-controls">
                {loading ? (
                  <button 
                    onClick={handleAbort}
                    className="abort-button"
                  >
                    Stop Generation
                  </button>
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
                    placeholder="Enter story title..."
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
                      Save
                    </button>
                    <button 
                      onClick={handleCancelEditTitle}
                      className="title-cancel-button"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="title-display">
                  <h2 onClick={handleStartEditTitle} className="editable-title">
                    {storyTitle || 'Your Story Book'}
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
              {/* Show continue generation button if there are pending images */}
              {pages.some(page => !page.image || page.status === 'error') && !loading && (
                <button 
                  onClick={() => generateAllImages(pages, allCharacters, artStyle)} 
                  className="continue-generation-button"
                  disabled={loading}
                >
                  🎨 Continue Image Generation
                </button>
              )}
              <button onClick={clearStory} className="new-story-button">
                ✨ Create New Story
              </button>
            </div>
          </div>
        )}
      </main>
      
      <footer className="App-footer">
        <p>Powered by Taledraw Team, Version {appVersion}</p>
      </footer>
    </div>
  );
}

export default App;

