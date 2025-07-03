import React, { useState, useEffect } from 'react';
import './PageItem.css';

const PageItem = ({ 
  page, 
  index, 
  onRegenerateImage, 
  onUpdatePrompt, 
  isGenerating 
}) => {
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState(page.imagePrompt || '');
  const [isExpanded, setIsExpanded] = useState(false);

  // 同步页面提示词变化到本地编辑状态
  useEffect(() => {
    setEditedPrompt(page.imagePrompt || '');
  }, [page.imagePrompt]);

  const handleSavePrompt = () => {
    if (editedPrompt.trim() !== page.imagePrompt) {
      onUpdatePrompt(index, editedPrompt.trim());
    }
    setIsEditingPrompt(false);
  };

  const handleCancelEdit = () => {
    setEditedPrompt(page.imagePrompt || '');
    setIsEditingPrompt(false);
  };

  const handleRegenerate = () => {
    const finalPrompt = isEditingPrompt ? editedPrompt.trim() : page.imagePrompt;
    onRegenerateImage(index, finalPrompt);
    if (isEditingPrompt) {
      setIsEditingPrompt(false);
    }
  };

  const handleSaveAndRegenerate = () => {
    // 先保存提示词到状态中
    if (isEditingPrompt && editedPrompt.trim() !== page.imagePrompt) {
      onUpdatePrompt(index, editedPrompt.trim());
    }
    // 然后重新生成
    const finalPrompt = isEditingPrompt ? editedPrompt.trim() : page.imagePrompt;
    onRegenerateImage(index, finalPrompt);
    if (isEditingPrompt) {
      setIsEditingPrompt(false);
    }
  };

  const getStatusText = () => {
    switch (page.status) {
      case 'success':
        return '生成成功';
      case 'error':
        return '生成失败';
      case 'generating':
        return '生成中...';
      default:
        return '未知状态';
    }
  };

  return (
    <div className={`page-item ${page.status || 'unknown'}`}>
      <div className="page-header">
        <div className="page-number">
          {page.title ? `第 ${index + 1} 页: ${page.title}` : `第 ${index + 1} 页`}
        </div>
        <div className="page-status">
          <span className={`status-badge ${page.status || 'unknown'}`}>
            {getStatusText()}
          </span>
        </div>
      </div>
      
      <div className="page-content">
        <div className="page-text">
          <p>{page.text}</p>
        </div>
        
        <div className="page-image">
          {page.status === 'generating' ? (
            <div className="image-generating">
              <div className="generating-message-box">
                <div className="loading-spinner"></div>
                <p className="generating-title">正在生成图像...</p>
                <small className="generating-subtitle">请稍候，正在为您生成精美插图</small>
              </div>
            </div>
          ) : page.status === 'error' ? (
            <div className="image-error">
              <div className="error-message-box">
                <p className="error-title">生成失败</p>
                <p className="error-detail">{page.error}</p>
                <button 
                  className="regenerate-button"
                  onClick={handleRegenerate}
                  disabled={isGenerating}
                >
                  重新生成
                </button>
              </div>
            </div>
          ) : page.image ? (
            <div className="image-container">
              <img 
                src={page.image} 
                alt={`第 ${index + 1} 页插图`}
                onError={(e) => {
                  console.error('Image load failed:', e.target.src);
                }}
              />
              <div className="image-overlay">
                <button 
                  className="regenerate-overlay-button"
                  onClick={handleRegenerate}
                  disabled={isGenerating}
                  title="重新生成图像"
                >
                  重新生成
                </button>
              </div>
            </div>
          ) : (
            <div className="image-pending">
              <div className="pending-message-box">
                <p className="pending-title">等待生成</p>
                <button 
                  className="regenerate-button"
                  onClick={handleRegenerate}
                  disabled={isGenerating}
                >
                  生成图像
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
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? '收起' : '展开'} 提示词
            </button>
            {isExpanded && (
              <button 
                className="edit-button"
                onClick={() => setIsEditingPrompt(!isEditingPrompt)}
              >
                {isEditingPrompt ? '取消' : '编辑'}
              </button>
            )}
          </div>
          
          {isExpanded && (
            <div className="prompt-content">
              {isEditingPrompt ? (
                <div className="prompt-editor">
                  <textarea
                    value={editedPrompt}
                    onChange={(e) => setEditedPrompt(e.target.value)}
                    rows={4}
                    placeholder="输入图像生成提示词..."
                    className="prompt-textarea"
                  />
                  <div className="editor-actions">
                    <button 
                      className="save-button"
                      onClick={handleSavePrompt}
                    >
                      保存
                    </button>
                    <button 
                      className="cancel-button"
                      onClick={handleCancelEdit}
                    >
                      取消
                    </button>
                    <button 
                      className="regenerate-with-prompt-button"
                      onClick={handleSaveAndRegenerate}
                      disabled={isGenerating}
                    >
                      保存并重新生成
                    </button>
                  </div>
                </div>
              ) : (
                <div className="prompt-display">
                  <p>{page.imagePrompt}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      
      {(page.mainCharacter || page.sceneType || page.sceneCharacters) && (
        <div className="character-info">
          <small>
            {page.sceneType && <span className="scene-type">场景: {page.sceneType}</span>}
            {page.sceneCharacters && page.sceneCharacters.length > 0 && (
              <span className="scene-characters"> | 角色: {page.sceneCharacters.join(', ')}</span>
            )}
            {page.mainCharacter && !page.sceneType && (
              <span>角色: {page.mainCharacter} ({page.characterType})</span>
            )}
          </small>
        </div>
      )}
    </div>
  );
};

export default PageItem; 