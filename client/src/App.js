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
  const [character, setCharacter] = useState({
    name: '',
    description: '',
    referenceImage: null,
    referenceImagePreview: null,
    fidelity: 50,
    isAutoExtracted: false
  }); // Character state
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
  const logIdCounter = useRef(0); // Log ID counter
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
      setCharacter(savedState.character || {
        name: '',
        description: '',
        referenceImage: null,
        referenceImagePreview: null,
        fidelity: 50,
        isAutoExtracted: false
      });
      setStoryWordCount(savedState.storyWordCount || 0);
      setGeneratedResult(savedState.generatedResult || null);

      // Restore page state (keep images initially)
      const restoredPages = (savedState.pages || []).map(page => ({
        ...page,
        // 保持原有图片，如果存在的话
        image: page.image || null,
        status: page.image ? 'success' : 'pending'
      }));
      setPages(restoredPages);

      // Verify and redownload images if needed
      if (restoredPages.length > 0) {
        await verifyAndRedownloadImages(restoredPages);
      }

      // Restore UI state
      await restoreUIStateForUser(user);

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

  // Restore UI state for user
  const restoreUIStateForUser = async (user) => {
    try {
      const savedUIState = stateManager.restoreUIState();
      if (!savedUIState) {
        console.log('No saved UI state found');
        return;
      }

      // Check if saved UI state belongs to current user
      if (savedUIState.userEmail !== user.email) {
        console.log('Saved UI state does not belong to current user, clearing old UI data');
        stateManager.clearUIState();
        return;
      }

      // Restore UI state
      setShowDebugWindow(savedUIState.showDebugWindow || false);
      setLogs(savedUIState.logs || []);
      
      console.log('Successfully restored UI state');
    } catch (error) {
      console.error('Failed to restore UI state:', error);
    }
  };

  // Save current UI state
  const saveCurrentUIState = () => {
    if (!user) return;
    
    const uiStateToSave = {
      userEmail: user.email,
      showDebugWindow: showDebugWindow,
      logs: logs
    };
    
    stateManager.saveUIState(uiStateToSave);
  };

  // Verify and redownload images if needed
  const verifyAndRedownloadImages = async (pages) => {
    setRestoreProgress('Verifying images...');
    
    const updatedPages = [...pages];
    let verifiedCount = 0;
    
    for (let i = 0; i < updatedPages.length; i++) {
      const page = updatedPages[i];
      
      if (page.image) {
        try {
          setRestoreProgress(`Verifying image ${i + 1}/${updatedPages.length}...`);
          
          // Create a lightweight image element to test loading
          const img = new Image();
          const loadPromise = new Promise((resolve, reject) => {
            img.onload = () => resolve(true);
            img.onerror = () => reject(false);
            img.src = page.image;
          });
          
          // Wait for image to load or fail (with timeout)
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 5000)
          );
          
          await Promise.race([loadPromise, timeoutPromise]);
          
          // Image loads successfully, keep it
          updatedPages[i] = {
            ...page,
            image: page.image,
            status: 'success'
          };
          verifiedCount++;
          addLog(`Page ${i + 1} image verified successfully`, 'success');
        } catch (error) {
          console.log(`Page ${i + 1} image verification failed, but keeping URL:`, error);
          // Keep the image URL but mark as completed (let user decide to regenerate)
          updatedPages[i] = {
            ...page,
            image: page.image,
            status: 'success'
          };
          verifiedCount++;
          addLog(`Page ${i + 1} image kept (may need regeneration)`, 'warning');
        }
      } else {
        updatedPages[i] = {
          ...page,
          status: 'pending'
        };
        addLog(`Page ${i + 1} has no image URL`, 'warning');
      }
      
      // Update page state in real-time
      setPages([...updatedPages]);
    }
    
    setRestoreProgress(`Image verification completed (${verifiedCount}/${updatedPages.length})`);
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
        character,
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
      setCharacter({
        name: '',
        description: '',
        referenceImage: null,
        referenceImagePreview: null,
        fidelity: 50,
        isAutoExtracted: false
      }); // Reset character state
      setLogs([]); // Clear logs
      logIdCounter.current = 0; // Reset log counter
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

  // Add log function
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
    logIdCounter.current = 0; // Reset log counter
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
    setCharacter({
      name: '',
      description: '',
      referenceImage: null,
      referenceImagePreview: null,
      fidelity: 50,
      isAutoExtracted: false
    }); // Reset character state
    setError('');
    setProgress('');
    setLoading(false); // Reset loading state
    setIsGenerating(false); // Reset generation state
    setLogs([]); // Clear logs
    logIdCounter.current = 0; // Reset log counter
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
    addLog('Preparing PPTX file download...', 'info');
    setShowSaveOptions(false);

    let pptx = new PptxGenJS();
    pptx.title = storyTitle || 'My Story Book';

    // Helper function to fetch and convert image to Base64
    const toBase64 = async (url) => {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Image loading failed: ${response.statusText}`);
        }
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } catch (e) {
        console.error(`CORS or network error when getting image ${url}.`, 'error');
        addLog(`Image retrieval failed ${url}, possibly due to CORS policy.`, 'error');
        throw e;
      }
    };

    for (const [index, page] of pages.entries()) {
      addLog(`Processing page ${index + 1}...`, 'info');
      let slide = pptx.addSlide();
      slide.addText(storyTitle || 'My Story Book', { x: 0.5, y: 0.25, w: '90%', h: 0.5, fontSize: 18, bold: true });
      slide.addText(page.title || `Page ${index + 1}`, { x: 0.5, y: 0.8, w: '90%', h: 0.4, fontSize: 14 });
      
      if (page.image && page.status === 'success') {
        try {
          addLog(`Converting image for page ${index + 1}...`, 'info');
          const imageBase64 = await toBase64(page.image);
          slide.addImage({ data: imageBase64, x: '10%', y: '25%', w: '80%', h: '45%' });
        } catch (error) {
           addLog(`Unable to add image for page ${index + 1}: ${error.message}`, 'error');
        }
      }

      slide.addText(page.text, { x: '10%', y: '75%', w: '80%', h: '20%', fontSize: 12, align: 'left' });
    }

    const safeTitle = (storyTitle || 'storybook').replace(/[^a-z0-9\u4e00-\u9fa5]/gi, '_').toLowerCase();
    pptx.writeFile({ fileName: `${safeTitle}.pptx` })
      .then(fileName => {
        addLog(`PPTX file downloaded successfully: ${fileName}`, 'success');
      })
      .catch(err => {
        addLog(`Failed to save PPTX: ${err.message}`, 'error');
        console.error(err);
      });
  };

  const handleSaveAsHtml = async () => {
    if (pages.length === 0) {
      addLog('No pages available to save.', 'warning');
      return;
    }

    addLog('Preparing HTML file download...', 'info');
    const originalButtonText = 'Save';
    const button = document.querySelector('.save-button');
    if (button) button.textContent = 'Processing...';


    try {
      const toBase64 = async (url) => {
        try {
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`Image loading failed: ${response.statusText}`);
          }
          const blob = await response.blob();
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        } catch (e) {
          console.error(`CORS or network error when getting image ${url}.`);
          addLog(`Image retrieval failed ${url}, possibly due to CORS policy.`, 'error');
          throw e; // re-throw error
        }
      };

      const pagesWithBase64Images = await Promise.all(
        pages.map(async (page, index) => {
          let imageBase64 = null;
          if (page.image && page.status === 'success') {
            try {
              addLog(`Converting image for page ${index + 1}...`, 'info');
              imageBase64 = await toBase64(page.image);
            } catch (error) {
              addLog(`Unable to convert image for page ${index + 1}: ${error.message}`, 'error');
            }
          }
          return { ...page, imageBase64 };
        })
      );

      // 确保所有文本内容都正确编码
      const cleanText = (text) => {
        if (!text) return '';
        // 移除乱码字符并进行HTML转义
        return text.replace(/\uFFFD/g, '').replace(/[\x00-\x08\x0E-\x1F\x7F]/g, '').replace(/</g, "&lt;").replace(/>/g, "&gt;");
      };

      const htmlContent = `
        <!DOCTYPE html>
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
            <h1>${cleanText(storyTitle) || 'My Story Book'}</h1>
            ${pagesWithBase64Images.map((page, index) => `
              <div class="page">
                <h2>${page.title ? `${index + 1}. ${cleanText(page.title)}` : `${index + 1}.`}</h2>
                ${page.imageBase64 ? `<img src="${page.imageBase64}" alt="Page ${index + 1} illustration">` : '<p><em>Image loading failed or not generated</em></p>'}
                <p>${cleanText(page.text)}</p>
              </div>
            `).join('')}
          </div>
        </body>
        </html>
      `;

      // 确保Blob使用正确的编码
      const blob = new Blob([htmlContent], { type: 'text/html; charset=utf-8' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      const safeTitle = (storyTitle || 'storybook').replace(/[^a-z0-9\u4e00-\u9fa5]/gi, '_').toLowerCase();
      link.download = `${safeTitle || 'storybook'}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      addLog('HTML file downloaded successfully!', 'success');
    } catch (error) {
      console.error('Error saving as HTML:', error);
      setError('Failed to save HTML: ' + error.message);
      addLog(`Failed to save HTML: ${error.message}`, 'error');
    } finally {
      if (button) button.textContent = originalButtonText;
      setShowSaveOptions(false); // Close options menu
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
  }, [user, pages, story, storyTitle, pageCount, aspectRatio, artStyle, allCharacters, character, storyWordCount, generatedResult, isGenerating]);

  // 页面卸载时保存状态
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (user && (pages.length > 0 || story.trim())) {
        saveCurrentState();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [user, pages, story, storyTitle, pageCount, aspectRatio, artStyle, allCharacters, character, storyWordCount, generatedResult, isGenerating]);

  // 初始化时检查并准备状态恢复
  useEffect(() => {
    const initializeApp = async () => {
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
              
              {/* Character settings separate area */}
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
                  <button 
                    onClick={() => setShowDebugWindow(false)}
                    className="close-debug-button"
                  >
                    ×
                  </button>
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

