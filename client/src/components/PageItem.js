import React, { useState, useEffect } from 'react';
import './PageItem.css';

const PageItem = ({ 
  page, 
  index, 
  allCharacters,
  onRegenerateImage, 
  onUpdatePrompt, 
  isGenerating 
}) => {
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState(page.imagePrompt || '');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);

  // 同步页面提示词变化到本地编辑状态
  useEffect(() => {
    setEditedPrompt(page.imagePrompt || '');
  }, [page.imagePrompt]);

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

  const getStatusText = () => {
    switch (page.status) {
      case 'success':
        return '生成成功';
      case 'error':
        return '生成失败';
      case 'generating':
      case 'regenerating':
        return '生成中...';
      default:
        return '未知状态';
    }
  };

  return (
    <div className={`page-item ${page.status || 'unknown'}`}>
      <div className="page-header">
        <div className="page-number">
          {page.title ? `${index + 1}. ${page.title}` : `${index + 1}.`}
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
          {page.status === 'regenerating' ? (
            <div className="image-generating">
              <div className="generating-message-box">
                <div className="loading-spinner"></div>
                <p className="generating-title">正在重新生成...</p>
                <small className="generating-subtitle">请稍候</small>
              </div>
            </div>
          ) : page.status === 'generating' ? (
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
                  onClick={handleSaveAndRegenerate}
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
                alt={`${index + 1}. 插图`}
                onError={(e) => {
                  console.error('Image load failed:', e.target.src);
                }}
              />
              <div className="image-overlay">
                <button 
                  className="regenerate-overlay-button"
                  onClick={handleSaveAndRegenerate}
                  disabled={isGenerating}
                  title="重新生成图像"
                >
                  {isGenerating ? '生成中...' : '重新生成'}
                </button>
              </div>
            </div>
          ) : (
            <div className="image-pending">
              <div className="pending-message-box">
                <p className="pending-title">等待生成</p>
                <button 
                  className="regenerate-button"
                  onClick={handleSaveAndRegenerate}
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
              onClick={handleExpandClick}
            >
              {isExpanded ? '收起提示词' : '提示词'}
            </button>
          </div>
          
          {isExpanded && (
            <div className="prompt-content">
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
                    className="btn btn-primary"
                    onClick={handleSaveAndRegenerate}
                    disabled={isGenerating}
                  >
                    保存并重新生成
                  </button>
                  <button 
                    className="btn btn-secondary"
                    onClick={handleCancelEdit}
                  >
                    取消
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
              {page.sceneType && <span className="scene-type">场景: {page.sceneType}</span>}
              {page.sceneCharacters && page.sceneCharacters.length > 0 && (
                <span className="scene-characters"> | 角色: {page.sceneCharacters.join(', ')}</span>
              )}
            </small>
          </div>

          {isDetailsExpanded && (
            <div className="details-content" style={{ marginTop: '8px', paddingLeft: '24px', borderLeft: '2px solid #f0f0f0', marginLeft: '4px'}}>
              {page.scenePrompt && (
                <div className="prompt-display" style={{ marginBottom: '12px' }}>
                  <strong style={{ display: 'block', marginBottom: '4px', color: '#333' }}>场景提示词:</strong>
                  <p style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '0.9em', color: '#666' }}>{page.scenePrompt}</p>
                </div>
              )}

              {page.sceneCharacters && page.sceneCharacters.length > 0 && (
                <div className="character-details">
                  <strong style={{ display: 'block', marginBottom: '8px', color: '#333' }}>角色详情:</strong>
                  {page.sceneCharacters.map(characterName => {
                    const character = allCharacters[characterName];
                    if (!character) {
                      return (
                        <div key={characterName} style={{ marginBottom: '8px' }}>
                          <p style={{ margin: 0, fontWeight: 'bold', color: '#555' }}>{characterName}</p>
                          <p style={{ margin: 0, fontSize: '0.9em', color: '#888' }}>未找到详细描述。</p>
                        </div>
                      );
                    }
                    return (
                      <div key={characterName} style={{ marginBottom: '12px', paddingLeft: '12px' }}>
                        <p style={{ margin: 0, fontWeight: 'bold', color: '#555' }}>{characterName}</p>
                        <ul style={{ margin: 0, paddingLeft: '20px', listStyleType: 'disc' }}>
                          {character.appearance && <li style={{ fontSize: '0.9em', color: '#666' }}><strong>外貌:</strong> {character.appearance}</li>}
                          {character.clothing && <li style={{ fontSize: '0.9em', color: '#666' }}><strong>衣着:</strong> {character.clothing}</li>}
                          {character.personality && <li style={{ fontSize: '0.9em', color: '#666' }}><strong>性格:</strong> {character.personality}</li>}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              )}
              
              {(!page.scenePrompt && (!page.sceneCharacters || page.sceneCharacters.length === 0)) && (
                  <p style={{ margin: 0, color: '#888', fontSize: '0.9em' }}>无可用提示词或角色详情。</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PageItem; 