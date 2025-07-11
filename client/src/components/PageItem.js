import React, { useState, useEffect, useRef } from 'react';
import './PageItem.css';
import { safeLog } from '../utils/logger';

const PageItem = ({ 
  page, 
  index, 
  allCharacters,
  onRegenerateImage, 
  onUpdatePrompt, 
  onUpdateText,
  onUpdateTitle,
  isGenerating 
}) => {
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState(page.imagePrompt || '');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);
  const [imageLoadError, setImageLoadError] = useState(false);
  const [isEditingText, setIsEditingText] = useState(false);
  const [editedText, setEditedText] = useState(page.text || '');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(page.title || '');

  const imageRef = useRef(null);

  // Sync page prompt changes to local edit state
  useEffect(() => {
    setEditedPrompt(page.imagePrompt || '');
  }, [page.imagePrompt]);

  // Sync page text changes to local edit state
  useEffect(() => {
    setEditedText(page.text || '');
  }, [page.text]);

  // Sync page title changes to local edit state
  useEffect(() => {
    setEditedTitle(page.title || '');
  }, [page.title]);

  // Reset image load error when image URL changes
  useEffect(() => {
    setImageLoadError(false);
  }, [page.image]);

  const handleExpandClick = () => {
    if (!isExpanded) {
      // Expanding: enter edit mode
      setIsEditingPrompt(true);
      setIsExpanded(true);
    } else {
      // Collapsing: is like a cancel action
      handleCancelEdit();
    }
  };

  const handleCancelEdit = () => {
    setEditedPrompt(page.imagePrompt || ''); // Revert changes
    setIsEditingPrompt(false);
    setIsExpanded(false); // Collapse the section
  };

  const handleSaveAndRegenerate = () => {
    // First, save the prompt to the state if it has changed
    if (editedPrompt.trim() !== page.imagePrompt) {
      onUpdatePrompt(index, editedPrompt.trim());
    }
    // Then, trigger regeneration with the potentially new prompt
    const finalPrompt = editedPrompt.trim();
    onRegenerateImage(index, finalPrompt);
    
    // Collapse the section after triggering
    setIsEditingPrompt(false);
    setIsExpanded(false);
  };

  const handleTextClick = () => {
    setIsEditingText(true);
  };

  const handleTextSave = () => {
    const newText = editedText.trim();
    if (newText !== page.text) {
      onUpdateText(index, newText);
    }
    setIsEditingText(false);
  };

  const handleTextCancel = () => {
    setEditedText(page.text || '');
    setIsEditingText(false);
  };

  const handleTextKeyDown = (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      handleTextSave();
    } else if (e.key === 'Escape') {
      handleTextCancel();
    }
  };

  const handleTitleClick = () => {
    setIsEditingTitle(true);
  };

  const handleTitleSave = () => {
    const newTitle = editedTitle.trim();
    if (newTitle !== page.title) {
      onUpdateTitle(index, newTitle);
    }
    setIsEditingTitle(false);
  };

  const handleTitleCancel = () => {
    setEditedTitle(page.title || '');
    setIsEditingTitle(false);
  };

  const handleTitleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleTitleSave();
    } else if (e.key === 'Escape') {
      handleTitleCancel();
    }
  };

  const handleImageClick = () => {
    if (page.image && !imageLoadError && imageRef.current) {
      const img = imageRef.current;
      const imageWidth = img.naturalWidth;
      const imageHeight = img.naturalHeight;
      
      if (imageWidth === 0 || imageHeight === 0) {
        // This can happen if the image is not fully loaded yet, though unlikely with this logic.
        // As a fallback, let's not open the window or use default dimensions.
        safeLog('Image dimensions are not yet available.');
        return;
      }

      const imageAspectRatio = imageWidth / imageHeight;
      
      // Calculate window size based on screen and image aspect ratio
      const screenWidth = window.screen.availWidth;
      const screenHeight = window.screen.availHeight;
      const maxWidth = Math.min(screenWidth * 0.9, 1200);
      const maxHeight = Math.min(screenHeight * 0.9, 900);
      
      let windowWidth, windowHeight;
      
      if (imageAspectRatio > 1) {
        // Landscape image
        windowWidth = maxWidth;
        windowHeight = windowWidth / imageAspectRatio;
        if (windowHeight > maxHeight) {
          windowHeight = maxHeight;
          windowWidth = windowHeight * imageAspectRatio;
        }
      } else {
        // Portrait or square image
        windowHeight = maxHeight;
        windowWidth = windowHeight * imageAspectRatio;
        if (windowWidth > maxWidth) {
          windowWidth = maxWidth;
          windowHeight = windowWidth / imageAspectRatio;
        }
      }
      
      // Center the window
      const left = (screenWidth - windowWidth) / 2;
      const top = (screenHeight - windowHeight) / 2;
      
      // Open window with calculated dimensions
      const newWindow = window.open('', '_blank', `width=${Math.round(windowWidth)},height=${Math.round(windowHeight)},left=${Math.round(left)},top=${Math.round(top)},scrollbars=no,resizable=yes,toolbar=no,location=no,status=no,menubar=no,titlebar=no,directories=no`);
      
      if (newWindow) {
        const imageName = `Page_${index + 1}_Illustration.png`;
        const pageTitle = page.title ? `${index + 1}. ${page.title}` : `Page ${index + 1}`;
        
        newWindow.document.write(`
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${pageTitle}</title>
            <style>
              * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
              }
              html, body {
                height: 100%;
                width: 100%;
                overflow: hidden;
                background: #000;
              }
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
                position: relative;
              }
              .image-container {
                position: absolute;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
              }
              .main-image {
                width: 100vw;
                height: 100vh;
                object-fit: contain;
                object-position: center;
              }
              .user-hint {
                position: fixed;
                bottom: 100px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 999;
                text-align: center;
                opacity: 0.9;
                transition: opacity 0.3s ease;
              }
              .user-hint:hover {
                opacity: 0.5;
              }
              .controls {
                position: fixed;
                bottom: 30px;
                left: 50%;
                transform: translateX(-50%);
                display: flex;
                gap: 16px;
                z-index: 1000;
                background: rgba(0, 0, 0, 0.2);
                padding: 12px 20px;
                border-radius: 25px;
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.1);
              }
              .btn {
                padding: 10px 20px;
                border: none;
                border-radius: 20px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 500;
                transition: all 0.2s ease;
                width: 80px;
                text-align: center;
              }
              .btn-save {
                background: var(--primary-color);
                color: white;
              }
              .btn-save:hover {
                background: var(--primary-color-dark);
              }
              .btn-close {
                background: rgba(255, 255, 255, 0.2);
                color: white;
              }
              .btn-close:hover {
                background: rgba(255, 255, 255, 0.3);
              }
              .hidden {
                opacity: 0;
                pointer-events: none;
              }
            </style>
          </head>
          <body>
            <div class="image-container">
              <img src="${page.image}" class="main-image" alt="Full screen image of ${pageTitle}">
            </div>
            
            <div class="user-hint">
              <p style="color: white; font-size: 13px;">Right-click or long-press to save the image.</p>
            </div>

            <div class="controls">
              <a id="saveBtn" href="${page.image}" download="${imageName}" class="btn btn-save">Save</a>
              <button id="closeBtn" class="btn btn-close">Close</button>
            </div>

            <script>
              document.getElementById('closeBtn').addEventListener('click', () => {
                window.close();
              });
              
              // In some browsers, programmatically closing a window only works if it was opened by a script.
              // We add a small delay to ensure the UI is responsive.
              setTimeout(() => {
                if(window.opener) {
                  // The window was opened by a script
                } else {
                  // Probably opened manually; hide the close button as it might not work.
                  // document.getElementById('closeBtn').style.display = 'none';
                }
              }, 500);

              // Auto-hide controls after a delay
              let timeout;
              const controls = document.querySelector('.controls');
              const hint = document.querySelector('.user-hint');
              
              function showControls() {
                controls.classList.remove('hidden');
                hint.classList.remove('hidden');
              }

              function hideControls() {
                controls.classList.add('hidden');
                hint.classList.add('hidden');
              }

              function resetTimer() {
                clearTimeout(timeout);
                showControls();
                timeout = setTimeout(hideControls, 3000); // Hide after 3 seconds of inactivity
              }

              document.addEventListener('mousemove', resetTimer);
              document.addEventListener('touchstart', resetTimer);
              document.addEventListener('click', resetTimer);
              resetTimer(); // Initial call
            </script>
          </body>
          </html>
        `);
          newWindow.document.close();
        }
      }
  };

  const handleImageLoadError = () => {
    setImageLoadError(true);
  };

  const handleReloadImage = () => {
    setImageLoadError(false);
    // Force reload by changing the image src with a cache-busting parameter
    const img = new Image();
    img.onload = () => {
      setImageLoadError(false);
    };
    img.onerror = () => {
      setImageLoadError(true);
    };
    img.src = page.image + '?reload=' + Date.now();
  };

  const getStatusText = () => {
    switch (page.status) {
      case 'success':
        return 'Generated Successfully';
      case 'error':
        return 'Generation Failed';
      case 'generating':
      case 'regenerating':
        return 'Generating...';
      case 'pending':
        return 'Ready to Generate';
      default:
        return 'Unknown Status';
    }
  };

  // 获取错误类型的显示文本
  const getErrorTypeText = (errorType) => {
    switch (errorType) {
      case 'safety_filter':
        return 'Content Filtered';
      case 'timeout':
        return 'Generation Timeout';
      case 'quota':
        return 'API Quota Exceeded';
      case 'auth':
        return 'Authentication Error';
      case 'permission':
        return 'Permission Denied';
      case 'server':
        return 'Server Error';
      default:
        return 'Generation Failed';
    }
  };

  // 获取错误类型的图标
  const getErrorIcon = (errorType) => {
    switch (errorType) {
      case 'safety_filter':
        return '🛡️';
      case 'timeout':
        return '⏱️';
      case 'quota':
        return '📊';
      case 'auth':
        return '🔐';
      case 'permission':
        return '🚫';
      case 'server':
        return '⚠️';
      default:
        return '❌';
    }
  };

  // 获取模型显示名称
  const getModelDisplayName = (model) => {
    switch (model) {
      case 'imagen4-fast':
        return 'Imagen 4 Fast';
      case 'imagen4':
        return 'Imagen 4';
      case 'imagen3':
        return 'Imagen 3';
      default:
        return model || 'Unknown Model';
    }
  };

  return (
    <div className={`page-item ${page.status || 'unknown'}`}>
      <div className="page-header">
        <div className="page-number">
          {isEditingTitle ? (
            <div className="title-editor">
              <input
                type="text"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                onKeyDown={handleTitleKeyDown}
                className="title-input"
                placeholder="Enter page title..."
                autoFocus
              />
              <div className="title-editor-actions">
                <button 
                  className="btn btn-primary title-save-btn"
                  onClick={handleTitleSave}
                >
                  Save
                </button>
                <button 
                  className="btn btn-secondary title-cancel-btn"
                  onClick={handleTitleCancel}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div
              className="editable-page-title"
              onClick={handleTitleClick}
              title="Click to edit title"
            >
              {page.title ? `${index + 1}. ${page.title}` : `${index + 1}.`}
            </div>
          )}
        </div>
        <div className="page-status">
          <span className={`status-badge ${page.status || 'unknown'}`}>
            {getStatusText()}
          </span>
        </div>
      </div>
      
      <div className="page-content">
        <div className="page-text">
          {isEditingText ? (
            <div className="text-editor">
              <textarea
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                onKeyDown={handleTextKeyDown}
                rows={4}
                className="text-textarea"
                placeholder="Enter page text..."
                autoFocus
              />
              <div className="text-editor-actions">
                <button 
                  className="btn btn-primary text-save-btn"
                  onClick={handleTextSave}
                >
                  Save
                </button>
                <button 
                  className="btn btn-secondary text-cancel-btn"
                  onClick={handleTextCancel}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p 
              className="editable-text"
              onClick={handleTextClick}
              title="Click to edit text"
            >
              {page.text}
            </p>
          )}
        </div>
        
        <div className="page-image">
          {page.status === 'regenerating' ? (
            <div className="image-generating">
              <div className="generating-message-box">
                <div className="loading-spinner"></div>
                <p className="generating-title">Regenerating...</p>
                <small className="generating-subtitle">Please wait</small>
              </div>
            </div>
          ) : page.status === 'generating' ? (
            <div className="image-generating">
              <div className="generating-message-box">
                <div className="loading-spinner"></div>
                <p className="generating-title">Generating image...</p>
                <small className="generating-subtitle">Please wait, creating beautiful illustrations for you</small>
              </div>
            </div>
          ) : page.status === 'error' ? (
            <div className="image-error">
              <div className="error-message-box">
                <div className="error-icon">{getErrorIcon(page.errorType)}</div>
                <p className="error-title">{getErrorTypeText(page.errorType)}</p>
                {page.errorDetails && (
                  <p className="error-detail">{page.errorDetails}</p>
                )}
                {page.model && (
                  <p className="error-model">Model: {getModelDisplayName(page.model)}</p>
                )}
                <button 
                  className="regenerate-button"
                  onClick={handleSaveAndRegenerate}
                  disabled={isGenerating}
                >
                  Regenerate
                </button>
              </div>
            </div>
          ) : page.image ? (
            <div className="image-container">
              {imageLoadError ? (
                <div className="image-load-error">
                  <div className="error-message-box">
                    <p className="error-title">Image Load Failed</p>
                    <p className="error-detail">Failed to load image. Please try reloading.</p>
                    <button 
                      className="reload-button"
                      onClick={handleReloadImage}
                    >
                      Reload Image
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <img 
                    ref={imageRef}
                    src={page.image} 
                    alt={`${index + 1}. Illustration`}
                    onClick={handleImageClick}
                    onError={handleImageLoadError}
                    className="clickable-image"
                    title="Click to open in new window"
                  />
                  {page.model && process.env.NODE_ENV === 'development' && (
                    <div className="image-model-badge">
                      {getModelDisplayName(page.model)}
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="image-pending">
              <div className="pending-message-box">
                <p className="pending-title">Waiting to generate</p>
                <button 
                  className="regenerate-button"
                  onClick={handleSaveAndRegenerate}
                  disabled={isGenerating}
                >
                  Generate Image
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {page.imagePrompt && (
        <div className="image-prompt-section">
          <div className="prompt-header">
            <button 
              className="expand-button"
              onClick={handleExpandClick}
            >
              {isExpanded ? 'Hide Prompt' : 'Prompt'}
            </button>
          </div>
          
          {isExpanded && (
            <div className="prompt-content">
              <div className="prompt-editor">
                <textarea
                  value={editedPrompt}
                  onChange={(e) => setEditedPrompt(e.target.value)}
                  rows={4}
                  placeholder="Enter image generation prompt..."
                  className="prompt-textarea"
                />
                <div className="editor-actions">
                  <button 
                    className="btn btn-primary"
                    onClick={handleSaveAndRegenerate}
                    disabled={isGenerating}
                  >
                    Save and Regenerate
                  </button>
                  <button 
                    className="btn btn-secondary"
                    onClick={handleCancelEdit}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* 只在开发环境显示Scene和Characters详情 */}
      {process.env.NODE_ENV === 'development' && (page.sceneType || (page.sceneCharacters && page.sceneCharacters.length > 0)) && (
        <div className="details-section">
          <div 
            className="details-header" 
            onClick={() => setIsDetailsExpanded(!isDetailsExpanded)}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '8px 0' }}
          >
            <small>
              {page.sceneType && <span className="scene-type">Scene: {page.sceneType}</span>}
              {page.sceneCharacters && page.sceneCharacters.length > 0 && (
                <span className="scene-characters"> | Characters: {page.sceneCharacters.join(', ')}</span>
              )}
            </small>
          </div>

          {isDetailsExpanded && (
            <div className="details-content" style={{ marginTop: '8px', paddingLeft: '24px', borderLeft: '2px solid #f0f0f0', marginLeft: '4px'}}>
              {page.scenePrompt && (
                <div className="prompt-display" style={{ marginBottom: '12px' }}>
                  <strong style={{ display: 'block', marginBottom: '4px', color: '#333' }}>Scene Prompt:</strong>
                  <p style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '0.9em', color: '#666' }}>{page.scenePrompt}</p>
                </div>
              )}

              {page.sceneCharacters && page.sceneCharacters.length > 0 && (
                <div className="character-details">
                  <strong style={{ display: 'block', marginBottom: '8px', color: '#333' }}>Character Details:</strong>
                  {page.sceneCharacters.map(characterName => {
                    // 尝试精确匹配和模糊匹配
                    let character = allCharacters[characterName];
                    
                    // 如果精确匹配失败，尝试模糊匹配
                    if (!character) {
                      const availableNames = Object.keys(allCharacters);
                      const fuzzyMatch = availableNames.find(name => 
                        name.includes(characterName) || 
                        characterName.includes(name) ||
                        name.toLowerCase().includes(characterName.toLowerCase()) ||
                        characterName.toLowerCase().includes(name.toLowerCase())
                      );
                      if (fuzzyMatch) {
                        character = allCharacters[fuzzyMatch];
                      }
                    }
                    
                    if (!character) {
                      return (
                        <div key={characterName} style={{ marginBottom: '12px', padding: '8px', background: '#f9f9f9', border: '1px solid #ddd', borderRadius: '4px' }}>
                          <h4 style={{ margin: '0 0 8px 0', color: '#666' }}>{characterName}</h4>
                          <div style={{ fontSize: '0.9em', color: '#999' }}>Character details not available</div>
                        </div>
                      );
                    }
                    return (
                      <div key={characterName} style={{ marginBottom: '12px', paddingLeft: '12px' }}>
                        <p style={{ margin: 0, fontWeight: 'bold', color: '#555' }}>{characterName}</p>
                        <ul style={{ margin: 0, paddingLeft: '20px', listStyleType: 'disc' }}>
                          {character.appearance && <li style={{ fontSize: '0.9em', color: '#666' }}><strong>Appearance:</strong> {character.appearance}</li>}
                          {character.clothing && <li style={{ fontSize: '0.9em', color: '#666' }}><strong>Clothing:</strong> {character.clothing}</li>}
                          {character.personality && <li style={{ fontSize: '0.9em', color: '#666' }}><strong>Personality:</strong> {character.personality}</li>}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              )}
              
              {(!page.scenePrompt && (!page.sceneCharacters || page.sceneCharacters.length === 0)) && (
                  <p style={{ margin: 0, color: '#888', fontSize: '0.9em' }}>No available prompts or character details.</p>
              )}
            </div>
          )}
        </div>
      )}

    </div>
  );
};

export default PageItem; 