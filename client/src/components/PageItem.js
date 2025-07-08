import React, { useState, useEffect } from 'react';
import './PageItem.css';

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
    if (page.image && !imageLoadError) {
      // First, get image dimensions to calculate proper window aspect ratio
      const img = new Image();
      img.onload = function() {
        const imageWidth = this.naturalWidth;
        const imageHeight = this.naturalHeight;
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
                background: var(--primary-color-hover);
                transform: scale(1.05);
              }
              .btn-close {
                background: var(--gray-color);
                color: white;
              }
              .btn-close:hover {
                background: var(--gray-color-hover);
                transform: scale(1.05);
              }
            </style>
          </head>
          <body>
            <div class="image-container">
              <img src="${page.image}" alt="${pageTitle}" class="main-image" />
            </div>
            <div class="user-hint">
              <small style="color: rgba(255,255,255,0.8); background: rgba(0,0,0,0.3); padding: 4px 8px; border-radius: 12px; font-size: 11px;">
                💡 Double-click to toggle fullscreen
              </small>
            </div>
            <div class="controls">
              <button class="btn btn-save" onclick="downloadImage(event)" onmousedown="event.stopPropagation()" onmouseup="event.stopPropagation()">Save</button>
              <button class="btn btn-close" onclick="event.stopPropagation(); window.close()" onmousedown="event.stopPropagation()" onmouseup="event.stopPropagation()">Close</button>
            </div>
            
            <script>
              // Flag to prevent fullscreen during save operation
              let isSaving = false;
              
              // Initialize window without auto-fullscreen
              window.addEventListener('load', function() {
                // Hide scrollbars and force focus
                document.body.style.overflow = 'hidden';
                window.focus();
                
                // Optional: Try fullscreen after a longer delay to avoid conflicts
                // Note: Auto-fullscreen is now more conservative
                setTimeout(function() {
                  if (!document.querySelector('.controls').matches(':hover') && 
                      !isSaving && 
                      !isRightClickActive &&
                      !document.fullscreenElement) {
                    const elem = document.documentElement;
                    if (elem.requestFullscreen) {
                      elem.requestFullscreen().catch(function() {
                        // Fullscreen failed, that's ok
                        console.log('Auto-fullscreen not available or denied');
                      });
                    }
                  } else {
                    console.log('Auto-fullscreen skipped due to active operation');
                  }
                }, 2000); // Increased delay to 2 seconds
              });
              
              // Toggle fullscreen on double-click anywhere except buttons and controls
              document.addEventListener('dblclick', function(e) {
                // Don't trigger fullscreen if:
                // - Currently saving
                // - Right-click operation is active
                // - Double-clicking on buttons or control area
                // - Clicking on any interactive element
                if (isSaving || 
                    isRightClickActive ||
                    e.target.tagName === 'BUTTON' || 
                    e.target.closest('.controls') || 
                    e.target.closest('.user-hint') ||
                    e.target.closest('button') ||
                    e.target.classList.contains('btn')) {
                  console.log('Double-click ignored due to active operation or UI element');
                  return;
                }
                
                // Prevent event bubbling
                e.preventDefault();
                e.stopPropagation();
                
                // Check current fullscreen state and toggle accordingly
                if (document.fullscreenElement) {
                  // Currently in fullscreen, exit fullscreen
                  document.exitFullscreen().catch(function(err) {
                    console.log('Exit fullscreen failed:', err);
                  });
                  console.log('Exiting fullscreen via double-click');
                } else {
                  // Not in fullscreen, enter fullscreen
                  const elem = document.documentElement;
                  if (elem.requestFullscreen) {
                    elem.requestFullscreen().catch(function(err) {
                      console.log('Enter fullscreen failed:', err);
                    });
                    console.log('Entering fullscreen via double-click');
                  }
                }
              });
              
              async function downloadImage(event) {
                // Set saving flag to prevent fullscreen
                isSaving = true;
                
                // Prevent any event bubbling that might trigger fullscreen
                if (event) {
                  event.preventDefault();
                  event.stopPropagation();
                  event.stopImmediatePropagation();
                }
                
                try {
                  // Method 1: Try to get original cached image data (preserves original format)
                  const response = await fetch('${page.image}', { 
                    cache: 'force-cache'  // Force use of cache only
                  });
                  
                  if (!response.ok) {
                    throw new Error('Failed to get cached image');
                  }
                  
                  const blob = await response.blob();
                  
                  // Get original file extension from URL or blob type
                  const imageUrl = '${page.image}';
                  let fileExtension = 'png'; // default
                  
                  // Try to determine extension from blob type
                  if (blob.type === 'image/jpeg' || blob.type === 'image/jpg') {
                    fileExtension = 'jpg';
                  } else if (blob.type === 'image/png') {
                    fileExtension = 'png';
                  } else if (blob.type === 'image/webp') {
                    fileExtension = 'webp';
                  } else {
                    // Try to extract from URL
                    const urlExtMatch = imageUrl.match(/\\.(jpg|jpeg|png|webp|gif)(\\?|$)/i);
                    if (urlExtMatch) {
                      fileExtension = urlExtMatch[1].toLowerCase();
                      if (fileExtension === 'jpeg') fileExtension = 'jpg';
                    }
                  }
                  
                  // Update filename with correct extension
                  const baseFileName = '${imageName}'.replace(/\\.[^.]+$/, ''); // Remove extension
                  const finalFileName = baseFileName + '.' + fileExtension;
                  
                  // Create download link with original format
                  const url = window.URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = finalFileName;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  window.URL.revokeObjectURL(url);
                  
                  console.log(\`Image downloaded from cache with original format: \${blob.type} (\${fileExtension})\`);
                  console.log('Cache hit - no network request needed');
                  
                } catch (cacheError) {
                  console.warn('Cache-only download failed, trying Canvas method:', cacheError);
                  
                  try {
                    // Method 2: Canvas fallback (converts to PNG but works offline)
                    const imgElement = document.querySelector('.main-image');
                    
                    if (!imgElement || !imgElement.complete) {
                      throw new Error('Image not loaded in page');
                    }
                    
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    canvas.width = imgElement.naturalWidth;
                    canvas.height = imgElement.naturalHeight;
                    ctx.drawImage(imgElement, 0, 0);
                    
                    canvas.toBlob(function(blob) {
                      if (!blob) {
                        console.error('Canvas blob creation failed');
                        return;
                      }
                      
                      const url = window.URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = '${imageName}'; // Keep PNG extension for canvas method
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      window.URL.revokeObjectURL(url);
                      
                      console.log('Image downloaded via Canvas method (converted to PNG)');
                    }, 'image/png', 1.0);
                    
                  } catch (canvasError) {
                    console.warn('Canvas download also failed, using network fallback:', canvasError);
                    
                    // Method 3: Network fallback
                    try {
                      const response = await fetch('${page.image}');
                      if (!response.ok) {
                        throw new Error(\`Network response was not ok: \${response.statusText}\`);
                      }
                      const blob = await response.blob();
                      
                      const url = window.URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = '${imageName}';
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      window.URL.revokeObjectURL(url);
                      
                      console.log('Image downloaded via network request (last resort)');
                    } catch (fetchError) {
                      console.error('All download methods failed:', fetchError);
                      alert('Download failed. Please try right-clicking the image and selecting "Save Image As..."');
                    }
                  }
                } finally {
                  // Reset saving flag after a short delay
                  setTimeout(function() {
                    isSaving = false;
                  }, 500);
                }
              }
              
              // Prevent clicks on controls area from triggering fullscreen
              document.querySelector('.controls').addEventListener('click', function(e) {
                e.stopPropagation();
                e.preventDefault();
              });
              
              document.querySelector('.controls').addEventListener('mousedown', function(e) {
                e.stopPropagation();
              });
              
              document.querySelector('.controls').addEventListener('mouseup', function(e) {
                e.stopPropagation();
              });
              
              // Prevent clicks on hint area from triggering fullscreen
              document.querySelector('.user-hint').addEventListener('click', function(e) {
                e.stopPropagation();
              });
              
              document.querySelector('.user-hint').addEventListener('dblclick', function(e) {
                e.stopPropagation();
              });
              
              // Auto-hide hint after 5 seconds
              setTimeout(function() {
                const hint = document.querySelector('.user-hint');
                if (hint) {
                  hint.style.opacity = '0';
                  setTimeout(function() {
                    hint.style.display = 'none';
                  }, 300);
                }
              }, 5000);
              
              // Handle keyboard shortcuts
              document.addEventListener('keydown', function(e) {
                if (e.key === 'Escape') {
                  if (document.fullscreenElement) {
                    document.exitFullscreen();
                  } else {
                    window.close();
                  }
                }
                if (e.key === 'F11') {
                  e.preventDefault();
                  // Don't trigger F11 fullscreen during right-click operations
                  if (isRightClickActive || isSaving) {
                    console.log('F11 fullscreen blocked due to active operation');
                    return;
                  }
                  
                  if (!document.fullscreenElement) {
                    document.documentElement.requestFullscreen().catch(function(err) {
                      console.log('F11 enter fullscreen failed:', err);
                    });
                  } else {
                    document.exitFullscreen().catch(function(err) {
                      console.log('F11 exit fullscreen failed:', err);
                    });
                  }
                }
                if (e.key === 's' || e.key === 'S') {
                  e.preventDefault();
                  downloadImage();
                }
              });
              
              // Allow context menu for user convenience (right-click to save image, etc.)
              // Context menu is now enabled for better user experience
              
              // Flag to track right-click operations
              let isRightClickActive = false;
              
              // Handle right-click context menu
              document.addEventListener('contextmenu', function(e) {
                // Allow context menu but set flag to prevent conflicts
                isRightClickActive = true;
                console.log('Right-click context menu opened');
                
                // Reset flag after a delay
                setTimeout(function() {
                  isRightClickActive = false;
                  console.log('Right-click operation completed');
                }, 2000);
              });
              
              // Handle mouse events to prevent conflicts
              document.addEventListener('mousedown', function(e) {
                if (e.button === 2) { // Right mouse button
                  isRightClickActive = true;
                  console.log('Right mouse button pressed');
                }
              });
              
              document.addEventListener('mouseup', function(e) {
                if (e.button === 2) { // Right mouse button
                  // Keep the flag active a bit longer to prevent conflicts
                  setTimeout(function() {
                    isRightClickActive = false;
                  }, 1000);
                }
              });
              
              // Reset flags when document visibility changes (e.g., tab switch)
              document.addEventListener('visibilitychange', function() {
                if (document.hidden) {
                  // User switched away, reset states
                  isRightClickActive = false;
                  isSaving = false;
                  console.log('Document hidden, resetting operation flags');
                }
              });
              
              // Reset flags when window loses focus
              window.addEventListener('blur', function() {
                isRightClickActive = false;
                isSaving = false;
                console.log('Window lost focus, resetting operation flags');
              });
            </script>
          </body>
          </html>
        `);
        newWindow.document.close();
        }
      };
      
      // Set the image source to trigger the onload event
      img.src = page.image;
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
                <p className="error-title">Generation Failed</p>
                <p className="error-detail">{page.error}</p>
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
                <img 
                  src={page.image} 
                  alt={`${index + 1}. Illustration`}
                  onClick={handleImageClick}
                  onError={handleImageLoadError}
                  className="clickable-image"
                  title="Click to open in new window"
                />
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
      
      {(page.sceneType || (page.sceneCharacters && page.sceneCharacters.length > 0)) && (
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
                    const character = allCharacters[characterName];
                    if (!character) {
                      return (
                        <div key={characterName} style={{ marginBottom: '8px' }}>
                          <p style={{ margin: 0, fontWeight: 'bold', color: '#555' }}>{characterName}</p>
                          <p style={{ margin: 0, fontSize: '0.9em', color: '#888' }}>Detailed description not found.</p>
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