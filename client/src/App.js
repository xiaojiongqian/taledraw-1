import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { auth } from './firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";
import { generateTaleStream, generateImageWithImagen } from './api';
import PageSelector from './components/PageSelector';
import AspectRatioSelector from './components/AspectRatioSelector';
import PageItem from './components/PageItem';
import PptxGenJS from 'pptxgenjs';
import stateManager from './stateManager';

function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true); // 认证加载状态
  const appVersion = process.env.REACT_APP_VERSION || 'v0.2.2';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [story, setStory] = useState('');
  const [storyTitle, setStoryTitle] = useState(''); // Auto-generated story title
  const [pageCount, setPageCount] = useState(10); // Default 10 pages
  const [aspectRatio, setAspectRatio] = useState('1:1'); // Default 1:1
  const [artStyle, setArtStyle] = useState('Children\'s picture book illustration style'); // Art style state
  const [allCharacters, setAllCharacters] = useState({}); // All characters info state
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'signup'
  const [logs, setLogs] = useState([]); // Generation process logs

  const abortControllerRef = useRef(null); // Use ref to continuously track AbortController
  const [showDebugWindow, setShowDebugWindow] = useState(false); // Debug window display state
  const [isEditingTitle, setIsEditingTitle] = useState(false); // Title editing state
  const [editedTitle, setEditedTitle] = useState(''); // Currently edited title
  const [showSaveOptions, setShowSaveOptions] = useState(false); // Save options
  // Log ID counter removed - now using timestamp-based unique IDs
  const logsContentRef = useRef(null); // Log content reference
  const saveContainerRef = useRef(null); // Ref for the save container
  const [storyWordCount, setStoryWordCount] = useState(0); // Word count state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedResult, setGeneratedResult] = useState(null);
  // State restoration related
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState('');
  const [hasRestoredState, setHasRestoredState] = useState(false);



  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      const previousUser = user;
      setUser(user);
      setAuthLoading(false); // 认证状态确定后设置加载完成
      
      if (user) {
        // If new user logs in, reset restoration state flag
        if (!hasRestoredState || (previousUser && previousUser.email !== user.email)) {
          setHasRestoredState(false);
          await restoreStateForUser(user);
          setHasRestoredState(true);
        }
      } else {
        // User logs out, reset restoration state flag
        setHasRestoredState(false);
      }
    });
    return () => unsubscribe();
  }, [hasRestoredState]);

  // Auto scroll logs to bottom
  useEffect(() => {
    if (logsContentRef.current) {
      logsContentRef.current.scrollTop = logsContentRef.current.scrollHeight;
    }
  }, [logs]);

  // Save UI state when showDebugWindow or logs change
  useEffect(() => {
    if (user && hasRestoredState) {
      saveCurrentUIState();
    }
  }, [showDebugWindow, logs, user, hasRestoredState]);

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

  // Multilingual word count function
  function countWords(text) {
    // Match all CJK characters (Chinese, Japanese, Korean)
    const cjk = text.match(/[\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]/g) || [];
    // Match all non-CJK words (including Arabic, English, etc.)
    const nonCjk = text
      .replace(/[\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    return cjk.length + nonCjk.length;
  }

  // Generate unique page ID
  function generatePageId(index) {
    return `page_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Restore state for user
  const restoreStateForUser = async (user) => {
    try {
      const savedState = stateManager.restoreState();
      if (!savedState) {
        console.log('No saved state found');
        // 仍然尝试恢复UI状态
        await restoreUIStateForUser(user);
        return;
      }

      // Check if saved state belongs to current user
      if (savedState.userEmail !== user.email) {
        console.log('Saved state does not belong to current user, clearing old data');
        stateManager.clearState();
        stateManager.clearUIState();
        return;
      }

      // Only restore if there is generated content
      if (!savedState.hasGeneratedContent) {
        console.log('No generated content to restore');
        // 仍然尝试恢复UI状态
        await restoreUIStateForUser(user);
        return;
      }

      setIsRestoring(true);
      setRestoreProgress('Restoring your storybook state...');

      // Restore basic state
      setStory(savedState.story || '');
      setStoryTitle(savedState.storyTitle || '');
      setPageCount(savedState.pageCount || 10);
      setAspectRatio(savedState.aspectRatio || '1:1');
      setArtStyle(savedState.artStyle || '');
      setAllCharacters(savedState.allCharacters || {});
      setStoryWordCount(savedState.storyWordCount || 0);
      setGeneratedResult(savedState.generatedResult || null);
      
      // Debug logging for allCharacters
      console.log('🔍 Debug - Restoring allCharacters:', savedState.allCharacters);
      console.log('🔍 Debug - allCharacters keys:', Object.keys(savedState.allCharacters || {}));
      console.log('🔍 Debug - allCharacters count:', Object.keys(savedState.allCharacters || {}).length);
      
      addLog(`Restored character data: ${Object.keys(savedState.allCharacters || {}).length} characters found`, 'info');

      // Restore page state (keep images initially)
      const restoredPages = (savedState.pages || []).map((page, index) => ({
        ...page,
        // 确保每个页面都有唯一的ID
        id: page.id || generatePageId(index),
        // 保持原有图片，如果存在的话
        image: page.image || null,
        status: page.image ? 'success' : 'pending'
      }));
      setPages(restoredPages);

      // Restore UI state first
      await restoreUIStateForUser(user);

      // Restore images if available
      if (restoredPages.length > 0) {
        await restoreImagesFromState(restoredPages);
      }

      setRestoreProgress('State restoration completed!');
      addLog('Successfully restored previous storybook state', 'success');
    } catch (error) {
      console.error('Failed to restore state:', error);
      setRestoreProgress('State restoration failed');
      addLog('Failed to restore state: ' + error.message, 'error');
    } finally {
      setIsRestoring(false);
      // Delay clearing progress info
      setTimeout(() => {
        setRestoreProgress('');
      }, 3000);
    }
  };

  // Clean up old UI state data with incompatible format
  const cleanupOldUIState = () => {
    try {
      const savedUIState = stateManager.restoreUIState();
      if (savedUIState && savedUIState.logs) {
        // If old UI state contains logs, clear it to avoid React key conflicts
        console.log('Cleaning up old UI state data with incompatible log format');
        stateManager.clearUIState();
      }
    } catch (error) {
      console.error('Failed to cleanup old UI state:', error);
      // Clear UI state on error to be safe
      stateManager.clearUIState();
    }
  };

  // Restore UI state for user
  const restoreUIStateForUser = async (user) => {
    try {
      // Clean up old incompatible data first
      cleanupOldUIState();
      
      const savedUIState = stateManager.restoreUIState();
      if (!savedUIState) {
        // UI state intentionally not saved for fresh start - this is normal
        return;
      }

      // Check if saved UI state belongs to current user
      if (savedUIState.userEmail !== user.email) {
        console.log('Saved UI state does not belong to current user, clearing old UI data');
        stateManager.clearUIState();
        return;
      }

      // Restore UI state (only showDebugWindow now)
      // Note: Logs are NOT restored on page refresh to reduce complexity
      // and prevent potential key conflicts. Fresh logs will be created on new operations.
      setShowDebugWindow(savedUIState.showDebugWindow || false);
      setLogs([]); // Always start with empty logs on page refresh
      
      console.log('Successfully restored UI state (logs cleared for fresh start)');
    } catch (error) {
      console.error('Failed to restore UI state:', error);
      // Clear UI state on error to be safe
      stateManager.clearUIState();
    }
  };

  // Save current UI state
  const saveCurrentUIState = () => {
    if (!user) return;
    
    const uiStateToSave = {
      userEmail: user.email,
      showDebugWindow: showDebugWindow
      // Don't save logs to avoid React key conflicts from old ID system
      // logs: logs
    };
    
    stateManager.saveUIState(uiStateToSave);
  };

  // Restore images from saved state
  const restoreImagesFromState = async (pages) => {
    setRestoreProgress('Restoring images...');
    
    const updatedPages = [...pages];
    let restoredCount = 0;
    
    for (let i = 0; i < updatedPages.length; i++) {
      const page = updatedPages[i];
      
      if (page.image) {
        // Trust the saved image URL - if it's in storage, it should work
        updatedPages[i] = {
          ...page,
          image: page.image,
          status: 'success'
        };
        restoredCount++;
        addLog(`Page ${i + 1} image restored successfully`, 'success');
      } else {
        updatedPages[i] = {
          ...page,
          status: 'pending'
        };
        addLog(`Page ${i + 1} ready for image generation`, 'info');
      }
      
      // Update page state in real-time
      setPages([...updatedPages]);
    }
    
    setRestoreProgress(`Image restoration completed (${restoredCount}/${updatedPages.length} images restored)`);
  };

  // Save current state
  const saveCurrentState = () => {
    if (user) {
      const currentState = {
        userEmail: user.email,
        story,
        storyTitle,
        pageCount,
        aspectRatio,
        artStyle,
        allCharacters,
        pages,
        storyWordCount,
        generatedResult,
        isGenerating
      };
      
      stateManager.saveState(currentState);
    }
  };

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
      setLogs([]); // Clear logs
      setShowDebugWindow(false); // Hide debug window
      setHasRestoredState(false); // Reset restoration state flag
      stateManager.clearState(); // Clear persistent state
      stateManager.clearUIState(); // Clear UI state
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
    // Truncate when word limit exceeded
    if (currentCount > wordLimit) {
      // Gradually truncate until within limit
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

  // Add log function - React Strict Mode safe
  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    // Use performance.now() for more precise timing + random + counter for guaranteed uniqueness
    const uniqueId = `${performance.now()}_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
    const newLog = {
      id: uniqueId,
      timestamp,
      message,
      type
    };
    setLogs(prevLogs => {
      // Check if this exact log already exists (React Strict Mode duplicate prevention)
      const isDuplicate = prevLogs.some(log => 
        log.message === message && 
        log.type === type && 
        Math.abs(performance.now() - parseFloat(log.id.split('_')[0])) < 1000 // Within 1 second
      );
      if (isDuplicate) {
        return prevLogs; // Don't add duplicate
      }
      return [...prevLogs, newLog];
    });
  };

  // Clear logs function
  const clearLogs = () => {
    setLogs([]);
    addLog('Logs cleared', 'info');
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

    // Create new AbortController
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setIsGenerating(true);
    setShowDebugWindow(true); // Auto show debug window
    setPages([]);
    setGeneratedResult(null);
    setStoryTitle('');
    setArtStyle('');
    setAllCharacters({});
    setError(null);
    setLogs([]); // Clear old logs
    addLog('Starting story generation...', 'info');

    try {
              const taleData = await generateTaleStream(story, pageCount, aspectRatio, (progress) => {
        if (progress.log) {
          // Use 'llm' type for LLM-related logs
          const logType = progress.step === 'connecting' || progress.step === 'analyzing' ? 'llm' : 'info';
          addLog(progress.log, logType);
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
      setPages(taleData.pages.map((p, index) => ({ 
        ...p, 
        id: generatePageId(index), 
        image: null, 
        status: 'pending' 
      })));
      setGeneratedResult(taleData);
      setError(null); // 清除错误状态，表明故事生成成功
      addLog('Story structure generation completed, starting automatic image generation...', 'success');
      
      // Save current state
      setTimeout(() => {
        saveCurrentState();
      }, 1000);
      
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
          artStyleData,
          (message, type) => {
            // Add log with appropriate type for image generation
            addLog(message, type === 'image' ? 'image' : type);
          }
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
      
      // Save state after completion
      setTimeout(() => {
        saveCurrentState();
      }, 1000);
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
    setStoryTitle(''); // Clear story title
    setIsEditingTitle(false); // Reset title editing state
    setEditedTitle(''); // Clear edited title
    setPages([]);
    setPageCount(10); // Reset to default value
    setAspectRatio('1:1'); // Reset to default value
    setError('');
    setProgress('');
    setLoading(false); // Reset loading state
    setIsGenerating(false); // Reset generation state
    setLogs([]); // Clear logs
    setShowDebugWindow(false); // Hide debug window
    stateManager.clearState(); // Clear persistent state
    stateManager.clearUIState(); // Clear UI state
  };

  // Regenerate single page image
  const regeneratePageImage = async (pageIndex, customPrompt = null) => {
    // Check if user is authenticated
    if (!user) {
      setError('Please log in to use AI generation features');
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
        artStyle,         // artStyle
        (message, type) => {
          // Add log with appropriate type for image generation
          addLog(message, type === 'image' ? 'image' : type);
        }
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
      
      // Save state
      setTimeout(() => {
        saveCurrentState();
      }, 1000);

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

  // Update page prompt
  const updatePagePrompt = (pageIndex, newPrompt) => {
    const updatedPages = [...pages];
    updatedPages[pageIndex] = {
      ...updatedPages[pageIndex],
      imagePrompt: newPrompt
    };
    setPages(updatedPages);
  };

  // Update page text
  const updatePageText = (pageIndex, newText) => {
    const updatedPages = [...pages];
    updatedPages[pageIndex] = {
      ...updatedPages[pageIndex],
      text: newText
    };
    setPages(updatedPages);
    
    // Save state
    setTimeout(() => {
      saveCurrentState();
    }, 100);
  };

  // Update page title
  const updatePageTitle = (pageIndex, newTitle) => {
    const updatedPages = [...pages];
    updatedPages[pageIndex] = {
      ...updatedPages[pageIndex],
      title: newTitle
    };
    setPages(updatedPages);
    
    // Save state
    setTimeout(() => {
      saveCurrentState();
    }, 100);
  };

  // Start editing title
  const handleStartEditTitle = () => {
    setEditedTitle(storyTitle || 'Your Story Book');
    setIsEditingTitle(true);
  };

  // Save title
  const handleSaveTitle = () => {
    setStoryTitle(editedTitle.trim() || 'Your Story Book');
    setIsEditingTitle(false);
    
    // Save state
    setTimeout(() => {
      saveCurrentState();
    }, 500);
  };

  // Cancel editing title
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
    
    // 检查PptxGenJS是否可用
    if (typeof PptxGenJS === 'undefined') {
      addLog('PPTX library not loaded. Please refresh the page and try again.', 'error');
      return;
    }
    
    const startTime = Date.now();
    addLog('Preparing PPTX file download...', 'info');
    console.log('PPTX library check passed');
    setShowSaveOptions(false);
    setShowDebugWindow(true); // Auto show debug window

    try {
      let pptx = new PptxGenJS();
      pptx.title = storyTitle || 'My Story Book';
      console.log('PPTX object created');

      // 简化的PPTX处理逻辑
      for (const [index, page] of pages.entries()) {
        addLog(`Processing page ${index + 1}...`, 'info');
        let slide = pptx.addSlide();
        slide.addText(storyTitle || 'My Story Book', { x: 0.5, y: 0.25, w: '90%', h: 0.5, fontSize: 18, bold: true });
        slide.addText(page.title || `Page ${index + 1}`, { x: 0.5, y: 0.8, w: '90%', h: 0.4, fontSize: 14 });
        
        if (page.image && page.status === 'success') {
          try {
            // 直接使用图片URL
            slide.addImage({ path: page.image, x: '10%', y: '25%', w: '80%', h: '45%' });
            addLog(`Added image for page ${index + 1}`, 'info');
            console.log(`Image added for page ${index + 1}:`, page.image);
          } catch (error) {
            addLog(`Unable to add image for page ${index + 1}: ${error.message}`, 'warning');
            console.warn(`Image error for page ${index + 1}:`, error);
          }
        }

        slide.addText(page.text, { x: '10%', y: '75%', w: '80%', h: '20%', fontSize: 12, align: 'left' });
        console.log(`Page ${index + 1} processed`);
      }

      const safeTitle = (storyTitle || 'storybook').replace(/[^a-z0-9\u4e00-\u9fa5]/gi, '_').toLowerCase();
      const fileName = `${safeTitle}.pptx`;
      
      addLog('Generating PPTX file...', 'info');
      console.log('Starting PPTX generation with filename:', fileName);
      
      // 使用Promise包装PPTX生成
      return new Promise((resolve, reject) => {
        try {
          pptx.writeFile({ fileName: fileName })
            .then(generatedFileName => {
              const endTime = Date.now();
              const processingTime = ((endTime - startTime) / 1000).toFixed(1);
              console.log('PPTX generated successfully:', generatedFileName);
              addLog(`PPTX file download initiated! (${processingTime}s)`, 'success');
              console.log('If PPTX download did not start, check browser download settings');
              
              resolve(generatedFileName);
            })
            .catch(err => {
              console.error('PPTX generation error:', err);
              addLog(`Failed to generate PPTX: ${err.message}`, 'error');
              reject(err);
            });
        } catch (syncError) {
          console.error('PPTX writeFile error:', syncError);
          addLog(`PPTX generation failed: ${syncError.message}`, 'error');
          reject(syncError);
        }
      });
      
    } catch (error) {
      console.error('PPTX setup error:', error);
      addLog(`PPTX generation failed: ${error.message}`, 'error');
    }
  };

  const handleSaveAsHtml = async () => {
    if (pages.length === 0) {
      addLog('No pages available to save.', 'warning');
      return;
    }
    setShowSaveOptions(false);
    setShowDebugWindow(true); // Auto show debug window

    // 基本浏览器兼容性检查
    if (!window.Blob || !URL.createObjectURL) {
      addLog('Your browser does not support file download. Please try a modern browser.', 'error');
      return;
    }

    const startTime = Date.now();
    addLog('Preparing HTML file download...', 'info');
    console.log('Browser download support check passed');

    // ✅ 重要说明：这是系统中唯一使用Base64的场景
    // 根据opt_base64_bin.md文档：HTML导出需要Base64嵌入以实现完全离线查看
    // 数据流：二进制WebP图像 → 临时Base64转换 → HTML嵌入 → 用完即丢
    console.log('HTML Export: Starting temporary Base64 conversion for offline viewing');

    // 在外部声明变量，以便在catch块中访问
    let htmlContent = '';
    
    try {
      // ✅ 临时Base64转换 - 从二进制WebP转换为Base64（仅用于HTML嵌入）
      addLog('Converting images to Base64 format for offline HTML viewing...', 'info');
      
      const cleanText = (text) => {
        if (!text) return '';
        return text.replace(/\uFFFD/g, '').replace(/[\x00-\x08\x0E-\x1F\x7F]/g, '').replace(/</g, "&lt;").replace(/>/g, "&gt;");
      };

      // ✅ 临时Base64转换函数 - 优先使用页面缓存，用完即丢
      const convertImageToBase64 = async (imageUrl, pageIndex) => {
        return new Promise((resolve, reject) => {
          if (!imageUrl) {
            resolve(null);
            return;
          }
          
          let hasResolved = false;
          const resolveOnce = (value) => {
            if (!hasResolved) {
              hasResolved = true;
              resolve(value);
            }
          };
          
          // 方法1：使用Fetch API获取图片数据（绕过Canvas CORS限制）
          const tryFromFetch = async () => {
            console.log(`HTML Export: Fetching binary WebP image ${pageIndex + 1} for Base64 conversion...`);
            
            const response = await fetch(imageUrl);
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const blob = await response.blob();
            console.log(`Image ${pageIndex + 1} fetched successfully, size: ${Math.round(blob.size / 1024)}KB`);
            
            // ✅ 将二进制Blob临时转换为Base64 dataURL
            const dataURL = await new Promise((blobResolve, blobReject) => {
              const reader = new FileReader();
              reader.onload = () => {
                const result = reader.result;
                console.log(`HTML Export: Image ${pageIndex + 1} converted to Base64, size: ${Math.round(result.length / 1024)}KB (temporary)`);
                blobResolve(result);
              };
              reader.onerror = () => {
                console.warn(`Failed to read blob for image ${pageIndex + 1}`);
                blobReject(new Error('Failed to read blob'));
              };
              reader.readAsDataURL(blob);
            });
            
            // ✅ 成功获取临时Base64 dataURL
            resolveOnce(dataURL);
            return true;
          };
          
          // 方法2：创建新的Image对象加载（备用方案）
          const tryFromNetwork = () => {
            console.log(`Loading image ${pageIndex + 1} from network...`);
            const img = new Image();
            
            // 设置CORS
            img.crossOrigin = 'anonymous';
            
            img.onload = () => {
              try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                ctx.drawImage(img, 0, 0);
                
                const dataURL = canvas.toDataURL('image/webp', 0.9);
                console.log(`Image ${pageIndex + 1} converted from network, size: ${Math.round(dataURL.length / 1024)}KB`);
                resolveOnce(dataURL);
              } catch (error) {
                console.warn(`Failed to convert image ${pageIndex + 1} from network:`, error);
                resolveOnce(imageUrl);
              }
            };
            
            img.onerror = (error) => {
              console.warn(`Failed to load image ${pageIndex + 1} from network:`, error);
              
              // 尝试不使用CORS
              if (img.crossOrigin === 'anonymous') {
                console.log(`Retrying image ${pageIndex + 1} without CORS...`);
                const retryImg = new Image();
                retryImg.onload = () => {
                  try {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    canvas.width = retryImg.naturalWidth;
                    canvas.height = retryImg.naturalHeight;
                    ctx.drawImage(retryImg, 0, 0);
                    const dataURL = canvas.toDataURL('image/webp', 0.9);
                    console.log(`Image ${pageIndex + 1} converted without CORS, size: ${Math.round(dataURL.length / 1024)}KB`);
                    resolveOnce(dataURL);
                  } catch (canvasError) {
                    console.warn(`Canvas conversion failed for image ${pageIndex + 1}:`, canvasError);
                    resolveOnce(imageUrl);
                  }
                };
                retryImg.onerror = () => {
                  console.warn(`Retry also failed for image ${pageIndex + 1}`);
                  resolveOnce(imageUrl);
                };
                retryImg.src = imageUrl;
              } else {
                resolveOnce(imageUrl);
              }
            };
            
            img.src = imageUrl;
          };
          
          // 设置超时
          setTimeout(() => {
            if (!hasResolved) {
              console.warn(`Image ${pageIndex + 1} conversion timeout after 30s:`, imageUrl);
              resolveOnce(imageUrl);
            }
          }, 30000);
          
          // 首先尝试Fetch API获取，如果失败再尝试Canvas方法
          tryFromFetch().then(() => {
            console.log(`Fetch method completed successfully for image ${pageIndex + 1}`);
          }).catch((error) => {
            console.warn(`Fetch failed for image ${pageIndex + 1}:`, error);
            // Fetch失败，尝试Canvas方法
            if (!hasResolved) {
              console.log(`Trying Canvas method for image ${pageIndex + 1}...`);
              tryFromNetwork();
            }
          });
        });
      };

      // 转换所有图片 - 并行处理提高效率
      const pagesWithBase64 = [];
      const totalImages = pages.filter(page => page.image && page.status === 'success').length;
      
      if (totalImages > 0) {
        addLog(`Converting ${totalImages} images to embedded Base64 format...`, 'info');
        console.log(`HTML Export: Processing ${totalImages} binary WebP images for temporary Base64 embedding`);
        
        // 顺序处理所有图片转换（避免并发问题）
        for (let i = 0; i < pages.length; i++) {
          const page = pages[i];
          
          if (page.image && page.status === 'success') {
            addLog(`Converting image ${i + 1}...`, 'info');
            
            try {
              // ✅ 临时Base64转换：二进制WebP → Base64 → HTML嵌入
              const base64Image = await convertImageToBase64(page.image, i);
              
              // 检查是否成功转换为Base64
              if (base64Image && base64Image.startsWith('data:image/')) {
                addLog(`Image ${i + 1} embedded successfully`, 'success');
                console.log(`HTML Export: Image ${i + 1} temporarily converted to Base64 for embedding`);
                pagesWithBase64.push({ ...page, base64Image, isEmbedded: true });
              } else {
                addLog(`Image ${i + 1} will be linked (not embedded)`, 'warning');
                console.log(`HTML Export: Image ${i + 1} Base64 conversion failed, will use URL link`);
                pagesWithBase64.push({ ...page, base64Image, isEmbedded: false });
              }
            } catch (error) {
              console.error(`Failed to process image ${i + 1}:`, error);
              addLog(`Image ${i + 1} conversion failed: ${error.message}`, 'error');
              pagesWithBase64.push(page);
            }
            
            // 添加小延迟避免请求过于频繁
            if (i < pages.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          } else {
            pagesWithBase64.push(page);
          }
        }
        
        // ✅ 统计临时Base64转换效果
        const embeddedCount = pagesWithBase64.filter(page => page.isEmbedded).length;
        const linkedCount = totalImages - embeddedCount;
        
        if (embeddedCount > 0) {
          addLog(`${embeddedCount} images embedded successfully` + (linkedCount > 0 ? `, ${linkedCount} images will be linked` : ''), 'success');
          console.log(`HTML Export: ${embeddedCount} images temporarily converted to Base64 for offline viewing`);
        } else if (linkedCount > 0) {
          addLog(`All ${linkedCount} images will be linked (not embedded)`, 'warning');
          console.log(`HTML Export: All images will use URL links (no Base64 conversion)`);
        }
      } else {
        console.log('HTML Export: No images to process for Base64 conversion');
      }

      // 构建HTML内容
      addLog('Building HTML content...', 'info');
      
      // 生成HTML内容
      const embeddedImages = pagesWithBase64.filter(page => page.isEmbedded).length;
      const linkedImages = pagesWithBase64.filter(page => page.base64Image && !page.isEmbedded).length;
      
      htmlContent = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${cleanText(storyTitle) || 'My Story Book'}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; background-color: #f0f2f5; color: #333; }
    .container { max-width: 800px; margin: auto; background: white; padding: 20px; box-shadow: 0 0 10px rgba(0,0,0,0.1); border-radius: 8px; }
    h1 { text-align: center; color: #444; }
    .page { margin-bottom: 40px; padding: 20px; border: 1px solid #ddd; border-radius: 8px; background: #fafafa; page-break-inside: avoid; }
    .page img { max-width: 100%; height: auto; display: block; margin: 0 auto 15px; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .page p { text-align: justify; font-size: 1.1em; white-space: pre-wrap; }
            .missing-image { text-align: center; color: var(--gray-color); font-style: italic; background: var(--gray-color-light); padding: 20px; border-radius: 4px; margin: 0 auto 15px; }
    @media print {
      body { padding: 0; background-color: #fff; }
      .container { box-shadow: none; border: none; padding: 0; }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>${cleanText(storyTitle) || 'My Story Book'}</h1>
    ${pagesWithBase64.map((page, index) => `
      <div class="page">
        <h2>${page.title ? `${index + 1}. ${cleanText(page.title)}` : `${index + 1}.`}</h2>
        ${page.base64Image ? 
          `<img src="${page.base64Image}" alt="Page ${index + 1} illustration" loading="lazy">` : 
          `<div class="missing-image">Image not available</div>`
        }
        <p>${cleanText(page.text)}</p>
      </div>
    `).join('')}
  </div>
</body>
</html>`;

      addLog('Creating download file...', 'info');
      
      // 计算文件大小
      const fileSizeBytes = new Blob([htmlContent], { type: 'text/html' }).size;
      const fileSizeMB = (fileSizeBytes / (1024 * 1024)).toFixed(2);
      console.log('HTML content length:', htmlContent.length, 'bytes');
      console.log('File size:', fileSizeMB, 'MB');
      
      // 根据文件大小提供反馈
      if (fileSizeBytes > 50 * 1024 * 1024) { // 50MB
        addLog(`Warning: Large file size (${fileSizeMB}MB) may cause download issues`, 'warning');
      } else if (fileSizeBytes > 10 * 1024 * 1024) { // 10MB
        addLog(`Generated file size: ${fileSizeMB}MB`, 'info');
      } else {
        addLog(`Generated file size: ${fileSizeMB}MB`, 'success');
      }
      
      // 创建文件名
      const safeTitle = (storyTitle || 'storybook').replace(/[^a-z0-9\u4e00-\u9fa5]/gi, '_').toLowerCase();
      const fileName = `${safeTitle || 'storybook'}.html`;
      
      // 尝试多种下载方法
      addLog('Attempting to trigger download...', 'info');
      
      // 方法1: 标准的Blob + URL下载
      try {
        const blob = new Blob([htmlContent], { type: 'text/html; charset=utf-8' });
        console.log('Blob created, size:', blob.size);
        
        const url = URL.createObjectURL(blob);
        console.log('Object URL created:', url);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.style.display = 'none';
        
        // 添加到DOM并点击
        document.body.appendChild(link);
        console.log('Link added to DOM');
        
        // 尝试触发点击事件
        const clickEvent = new MouseEvent('click', {
          view: window,
          bubbles: true,
          cancelable: true
        });
        
        link.dispatchEvent(clickEvent);
        console.log('Click event dispatched');
        
        // 稍后清理
        setTimeout(() => {
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          console.log('Link cleaned up');
        }, 1000);
        
        const endTime = Date.now();
        const processingTime = ((endTime - startTime) / 1000).toFixed(1);
        
        // ✅ Base64内存清理说明
        console.log('HTML Export: Base64 conversion completed, temporary data will be garbage collected');
        console.log('HTML Export: All Base64 strings are now embedded in HTML and original variables freed');
        
        // 生成详细的成功信息
        let successMessage = `HTML file download initiated! (${processingTime}s)`;
        if (embeddedImages > 0 && linkedImages === 0) {
          successMessage += ` - All ${embeddedImages} images embedded, no internet required`;
        } else if (embeddedImages > 0 && linkedImages > 0) {
          successMessage += ` - ${embeddedImages} images embedded, ${linkedImages} require internet`;
        } else if (linkedImages > 0) {
          successMessage += ` - ${linkedImages} images require internet connection`;
        }
        
        addLog(successMessage, 'success');
        console.log('If download did not start, check browser download settings or popup blockers');
        
        // 如果有链接图片，提供额外提示
        if (linkedImages > 0) {
          addLog(`💡 Tip: Some images need internet connection to display properly`, 'info');
        }
        
      } catch (blobError) {
        console.error('Blob download method failed:', blobError);
        throw blobError;
      }
      
    } catch (error) {
      console.error('Error saving as HTML:', error);
      setError('Failed to save HTML: ' + error.message);
      addLog(`Failed to save HTML: ${error.message}`, 'error');
      
      // 提供备用方案 - 在新窗口中打开HTML内容
      try {
        addLog('Trying fallback method: opening in new window...', 'info');
        const newWindow = window.open('', '_blank');
        if (newWindow) {
          newWindow.document.write(htmlContent);
          newWindow.document.close();
          addLog('HTML content opened in new window. You can save it manually (Ctrl+S)', 'info');
        } else {
          addLog('Popup blocked. Please allow popups and try again, or check browser download settings', 'warning');
        }
      } catch (fallbackError) {
        console.error('Fallback method also failed:', fallbackError);
        addLog('All download methods failed. Please check browser settings and try again', 'error');
      }
    } finally {
      setShowSaveOptions(false);
    }
  };



  // 在 useEffect 中初始化 storyWordCount
  useEffect(() => {
    setStoryWordCount(countWords(story));
  }, []);

  // 定期保存状态 - 防止意外刷新导致状态丢失
  useEffect(() => {
    const saveInterval = setInterval(() => {
      if (user && (pages.length > 0 || story.trim())) {
        saveCurrentState();
      }
    }, 30000); // 每30秒保存一次

    return () => clearInterval(saveInterval);
  }, [user, pages, story, storyTitle, pageCount, aspectRatio, artStyle, allCharacters, storyWordCount, generatedResult, isGenerating]);

  // 页面卸载时保存状态
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (user && (pages.length > 0 || story.trim())) {
        saveCurrentState();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [user, pages, story, storyTitle, pageCount, aspectRatio, artStyle, allCharacters, storyWordCount, generatedResult, isGenerating]);

  // 初始化时检查并准备状态恢复
  useEffect(() => {
    const initializeApp = async () => {
      // 一次性清理：清理旧的localStorage数据以解决React key冲突问题
      const OLD_DATA_CLEANUP_KEY = 'taledraw_old_data_cleaned_v1';
      if (!localStorage.getItem(OLD_DATA_CLEANUP_KEY)) {
        console.log('Performing one-time cleanup of old localStorage data...');
        localStorage.clear();
        localStorage.setItem(OLD_DATA_CLEANUP_KEY, 'true');
        console.log('Old localStorage data cleaned up');
      }
      
      // 先清理可能存在的乱码数据
      stateManager.cleanCorruptedData();
      
      // 检查是否有保存的状态
      const stateInfo = stateManager.getStateInfo();
      if (stateInfo && stateInfo.hasGeneratedContent) {
        console.log('Found saved state, will restore after authentication');
        // 设置认证加载状态，让用户知道正在加载
        setAuthLoading(true);
      }
    };

    initializeApp();
  }, []);



  // 认证加载状态 - 显示加载界面而不是登录界面
  if (authLoading) {
    return (
      <div className="App">
        <header className="App-header">
          <h1>📚 AI Story Book Generator</h1>
          <p>Generate beautiful illustrated storybooks for your stories using AI technology</p>
        </header>
        <main className="auth-container">
          <div className="auth-form">
            <div className="loading-spinner"></div>
            <p>Loading...</p>
          </div>
        </main>
      </div>
    );
  }

  // 登录/注册界面
  if (!user) {
    return (
      <div className="App">
        <header className="App-header">
          <h1>
            <img className="app-icon" src="/icon-mono.svg" alt="Tale Draw Icon" width="40" height="40" />
            Tale Draw - Story Book Generator
          </h1>
        </header>
        <main className="auth-container">
          <div className="auth-form">
            <div className="auth-welcome">
              <p className="auth-description">Generate beautiful illustrated storybooks for your stories using AI technology</p>
            </div>
            
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
          <h1>
            <img className="app-icon" src="/icon-mono.svg" alt="Tale Draw Icon" width="40" height="40" />
            Tale Draw - Story Book Generator
          </h1>
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
            
            {/* Word count display */}
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
            
            {/* Parameter settings area */}
            <div className="story-settings">
              {/* Basic settings combination */}
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
              
              {/* Debug Info Button - 只在有日志内容且调试窗口关闭时显示 */}
              {!showDebugWindow && logs.length > 0 && (
                <button 
                  className="debug-info-button"
                  onClick={() => setShowDebugWindow(true)}
                  title="Show operation logs"
                >
                  <span className="info-icon">ⓘ</span>
                </button>
              )}
            </div>
          </div>
          
          {error && !showDebugWindow && <div className="error-message">{error}</div>}
        </div>

        {(loading || showDebugWindow || isRestoring) && (
          <div className="loading-section">
            <div className="loading-header">
              <div className="loading-info">
                {(loading || isRestoring) && <div className="loading-spinner"></div>}
                <p>
                  {isRestoring ? restoreProgress || 'Restoring storybook state...' :
                   loading ? 'Generating your story book, please wait...' : 
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
                ) : !isRestoring ? (
                  <>
                    <button 
                      onClick={clearLogs}
                      className="clear-logs-button"
                      title="Clear logs"
                    >
                      ⌫
                    </button>
                    <button 
                      onClick={() => setShowDebugWindow(false)}
                      className="close-debug-button"
                      title="Close logs"
                    >
                      ×
                    </button>
                  </>
                ) : null}
              </div>
            </div>
            
            {/* Generation logs display area */}
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
                  key={page.id || `page_${index}`}
                  page={page}
                  index={index}
                  allCharacters={allCharacters}
                  onRegenerateImage={regeneratePageImage}
                  onUpdatePrompt={updatePagePrompt}
                  onUpdateText={updatePageText}
                  onUpdateTitle={updatePageTitle}
                  isGenerating={loading && progress.includes(`${index + 1}`)}
                />
              ))}
            </div>
            
            <div className="tale-actions">
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

