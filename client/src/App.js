import React, { useState, useEffect } from 'react';
import './App.css';
import { auth } from './firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";
import { generateTale } from './api';
import PageSelector from './components/PageSelector';
import AspectRatioSelector from './components/AspectRatioSelector';

function App() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [story, setStory] = useState('');
  const [pageCount, setPageCount] = useState(10); // 默认10页
  const [aspectRatio, setAspectRatio] = useState('16:9'); // 默认16:9
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'signup'

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
    });
    return () => unsubscribe();
  }, []);

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
      setPageCount(10); // 重置为默认值
      setAspectRatio('16:9'); // 重置为默认值
      setProgress('已登出');
    } catch (error) {
      setError("登出错误: " + error.message);
      console.error("Error logging out:", error);
    }
  };

  const handleStoryChange = (event) => {
    setStory(event.target.value);
    setError('');
  };

  const generateTaleFlow = async () => {
    if (!story.trim()) {
      setError('请输入故事内容');
      return;
    }

    setLoading(true);
    setError('');
    setProgress(`开始生成${pageCount}页故事绘本（${aspectRatio}比例）...`);
    setPages([]);

    try {
      // 使用新的返回格式，包含进度回调
      const result = await generateTale(story, pageCount, aspectRatio, (progress) => {
        // 可以在这里更新UI显示进度
        if (progress.step === 'generating_pages') {
          setProgress('正在分析故事并生成页面...');
        } else if (progress.step === 'generating_images') {
          setProgress(`正在生成图像... (${progress.current}/${progress.total})`);
        }
      });
      
      // 现在result包含pages和statistics
      setPages(result.pages);
      
      // 显示更详细的完成信息
      const successRate = result.statistics.successRate;
      if (successRate === 100) {
        setProgress('🎉 故事绘本生成完成！所有图像都生成成功');
      } else if (successRate >= 80) {
        setProgress(`✅ 故事绘本生成完成！成功率: ${successRate}% (${result.statistics.successCount}/${result.statistics.totalPages})`);
      } else {
        setProgress(`⚠️ 故事绘本生成完成，但部分图像生成失败。成功率: ${successRate}% (${result.statistics.successCount}/${result.statistics.totalPages})`);
      }
      
    } catch (error) {
      setError('生成故事绘本时出错: ' + error.message);
      console.error("Error generating tale:", error);
    } finally {
      setLoading(false);
    }
  };

  const clearStory = () => {
    setStory('');
    setPages([]);
    setPageCount(10); // 重置为默认值
    setAspectRatio('16:9'); // 重置为默认值
    setError('');
    setProgress('');
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
          <h2>📝 输入您的故事</h2>
          <div className="story-input">
            <textarea
              value={story}
              onChange={handleStoryChange}
              placeholder="在这里输入您的故事...&#10;&#10;系统会自动保持文字语言与输入一致，支持中文、英文、日文等多种语言。&#10;&#10;例如：从前有一只小兔子，它住在森林里的一个小洞里。有一天，小兔子决定去探险寻找传说中的胡萝卜王国..."
              rows="8"
              disabled={loading}
            />
            
            {/* 参数设置区域 */}
            <div className="story-settings">
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
            
            <div className="input-actions">
              <button 
                onClick={generateTaleFlow} 
                disabled={loading || !story.trim()}
                className="generate-button"
              >
                {loading ? '🎨 生成中...' : `🎨 生成${pageCount}页绘本`}
              </button>
              <button 
                onClick={clearStory}
                disabled={loading}
                className="clear-button"
              >
                🗑️ 清空
              </button>
            </div>
          </div>
          
          {error && <div className="error-message">{error}</div>}
          {progress && <div className="progress-message">{progress}</div>}
        </div>

        {loading && (
          <div className="loading-section">
            <div className="loading-spinner"></div>
            <p>正在生成您的故事绘本，请稍候...</p>
            <small>这可能需要几分钟时间</small>
          </div>
        )}

        {pages.length > 0 && (
          <div className="tale-display-section">
            <h2>📖 您的故事绘本</h2>
            
            {/* 生成统计信息 */}
            <div className="generation-stats">
              <div className="stats-item">
                <span className="stats-label">总页数:</span>
                <span className="stats-value">{pages.length}</span>
              </div>
              <div className="stats-item">
                <span className="stats-label">成功生成:</span>
                <span className="stats-value stats-success">{pages.filter(p => p.status === 'success').length}</span>
              </div>
              <div className="stats-item">
                <span className="stats-label">使用占位符:</span>
                <span className="stats-value stats-fallback">{pages.filter(p => p.isPlaceholder).length}</span>
              </div>
              <div className="stats-item">
                <span className="stats-label">成功率:</span>
                <span className="stats-value stats-rate">
                  {Math.round((pages.filter(p => p.status === 'success').length / pages.length) * 100)}%
                </span>
              </div>
            </div>
            
            <div className="tale-display">
              {pages.map((page, index) => (
                <div key={index} className={`page ${page.status || 'unknown'}`}>
                  <div className="page-header">
                    <div className="page-number">第 {index + 1} 页</div>
                    <div className="page-status">
                      {page.status === 'success' && !page.isPlaceholder && (
                        <span className="status-badge success">✅ 真实图像</span>
                      )}
                      {page.isPlaceholder && page.status === 'fallback' && (
                        <span className="status-badge fallback">⚠️ 占位符图像</span>
                      )}
                      {page.status === 'error' && (
                        <span className="status-badge error">❌ 生成失败</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="page-content">
                    <div className="page-text">
                      <p>{page.text}</p>
                    </div>
                    <div className="page-image">
                      {page.image ? (
                        <img 
                          src={page.image} 
                          alt={`第 ${index + 1} 页插图`}
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'block';
                          }}
                        />
                      ) : (
                        <div className="image-placeholder">
                          {page.error ? (
                            <div className="image-error">
                              <span>❌</span>
                              <p>图像生成失败</p>
                              <small>{page.error}</small>
                            </div>
                          ) : (
                            <div className="image-loading">
                              <span>🎨</span>
                              <p>图像生成中...</p>
                            </div>
                          )}
                        </div>
                      )}
                      <div className="image-error-fallback" style={{display: 'none'}}>
                        <span>🖼️</span>
                        <p>图像加载失败</p>
                      </div>
                    </div>
                  </div>
                  
                  {page.imagePrompt && (
                    <details className="image-prompt">
                      <summary>查看图像提示词</summary>
                      <p>{page.imagePrompt}</p>
                    </details>
                  )}
                  
                  {page.error && (
                    <div className="error-details">
                      <small>错误详情: {page.error}</small>
                    </div>
                  )}
                </div>
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

