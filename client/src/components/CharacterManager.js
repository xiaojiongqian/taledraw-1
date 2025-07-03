import React, { useState, useRef } from 'react';
import './CharacterManager.css';
import { extractCharacter, generateCharacterAvatar } from '../api';

const CharacterManager = ({ story, character, onCharacterChange, disabled = false }) => {
  const [isExtracting, setIsExtracting] = useState(false);
  const [isGeneratingAvatar, setIsGeneratingAvatar] = useState(false); // 控制角色形象生成状态
  const [extractionError, setExtractionError] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false); // 控制高级设置显示
  const [isExpanded, setIsExpanded] = useState(false); // 控制角色设置展开/收缩
  const fileInputRef = useRef(null);

  // 自动提取角色
  const handleExtractCharacter = async () => {
    if (!story.trim()) {
      setExtractionError('请先输入故事内容');
      return;
    }

    setIsExtracting(true);
    setExtractionError('');

    try {
      const data = await extractCharacter(story.trim());
      
      // 更新角色信息，保留现有的参考图片和遵循度
      onCharacterChange({
        ...character,
        name: data.name || '主角',
        description: data.description || '',
        isAutoExtracted: true
      });

    } catch (error) {
      console.error('角色提取错误:', error);
      setExtractionError(error.message || '角色提取失败');
    } finally {
      setIsExtracting(false);
    }
  };

  // 生成角色形象
  const handleGenerateAvatar = async () => {
    if (!character.name || !character.description) {
      setExtractionError('请先输入角色名称和描述');
      return;
    }

    setIsGeneratingAvatar(true);
    setExtractionError('');

    try {
      const result = await generateCharacterAvatar(
        character.name,
        character.description,
        '', // 移除负向提示参数
        character.referenceImage,
        character.fidelity || 50
      );
      
      // 更新角色信息，添加生成的形象
      onCharacterChange({
        ...character,
        avatarImage: result.imageUrl,
        avatarPrompt: result.prompt,
        avatarGeneratedAt: result.generatedAt
      });

      console.log('角色形象生成成功:', result);

    } catch (error) {
      console.error('角色形象生成错误:', error);
      setExtractionError(error.message || '角色形象生成失败');
    } finally {
      setIsGeneratingAvatar(false);
    }
  };

  // 处理参考图片上传
  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      // 检查文件类型和大小
      if (!file.type.startsWith('image/')) {
        setExtractionError('请选择图片文件');
        return;
      }

      if (file.size > 5 * 1024 * 1024) { // 5MB限制
        setExtractionError('图片大小不能超过5MB');
        return;
      }

      // 创建FileReader来预览图片
      const reader = new FileReader();
      reader.onload = (e) => {
        onCharacterChange({
          ...character,
          referenceImage: file,
          referenceImagePreview: e.target.result
        });
        setExtractionError('');
      };
      reader.readAsDataURL(file);
    }
  };

  // 删除参考图片
  const handleRemoveImage = () => {
    onCharacterChange({
      ...character,
      referenceImage: null,
      referenceImagePreview: null
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 更新角色名称
  const handleNameChange = (event) => {
    onCharacterChange({
      ...character,
      name: event.target.value
    });
  };

  // 更新角色描述
  const handleDescriptionChange = (event) => {
    onCharacterChange({
      ...character,
      description: event.target.value
    });
  };

  // 更新遵循度
  const handleFidelityChange = (event) => {
    onCharacterChange({
      ...character,
      fidelity: parseInt(event.target.value)
    });
  };

  return (
    <div className="character-manager">
      {/* 角色设置标题和展开/收缩按钮 */}
      <div className="character-header">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="character-toggle"
          disabled={disabled}
        >
          <span className={`toggle-icon ${isExpanded ? 'expanded' : ''}`}>▶</span>
          角色设置
        </button>
      </div>

      {isExpanded && (
        <div className="character-expanded-content">
          {extractionError && (
            <div className="error-message">{extractionError}</div>
          )}

          <div className="character-content">
            {/* 左侧：角色信息编辑 */}
            <div className="character-form">
              {/* 角色基础信息组 */}
              <div className="character-basic-group">
                {/* 角色名称 */}
                <div className="form-group">
                  <label className="form-label">角色名称</label>
                  <input
                    type="text"
                    value={character.name || ''}
                    onChange={handleNameChange}
                    placeholder="主要角色名称"
                    disabled={disabled}
                    className="character-input"
                  />
                </div>

                {/* 角色描述 */}
                <div className="form-group">
                  <label className="form-label">形象描述</label>
                  <textarea
                    value={character.description || ''}
                    onChange={handleDescriptionChange}
                    placeholder="描述角色的外观特征、穿着等..."
                    disabled={disabled}
                    className="character-textarea"
                    rows="1"
                  />
                </div>

                {/* 自动提取按钮 */}
                <div className="extract-section">
                  <button
                    type="button"
                    onClick={handleExtractCharacter}
                    disabled={disabled || isExtracting || !story.trim()}
                    className="extract-button"
                  >
                    {isExtracting ? '提取中...' : '(1) 自动提取'}
                  </button>
                  <span className="extract-hint">基于故事内容自动生成角色信息</span>
                </div>
              </div>

              {/* 高级设置折叠区域 */}
              <div className="advanced-settings">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="advanced-toggle"
                  disabled={disabled}
                >
                  <span className={`toggle-icon ${showAdvanced ? 'expanded' : ''}`}>▶</span>
                  高级设置
                </button>

                {showAdvanced && (
                  <div className="advanced-content">
                    {/* 参考图片上传 */}
                    <div className="form-group">
                      <label className="form-label">参考图片</label>
                      <div className="image-upload-section">
                        {character.referenceImagePreview ? (
                          <div className="image-preview">
                            <img 
                              src={character.referenceImagePreview} 
                              alt="角色参考图片"
                              className="preview-image"
                            />
                            <button
                              type="button"
                              onClick={handleRemoveImage}
                              disabled={disabled}
                              className="remove-image-button"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div className="image-upload-area">
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept="image/*"
                              onChange={handleImageUpload}
                              disabled={disabled}
                              className="image-input"
                              id="character-image"
                            />
                            <label 
                              htmlFor="character-image" 
                              className={`image-upload-label ${disabled ? 'disabled' : ''}`}
                            >
                              <div className="upload-content">
                                <span className="upload-icon">📷</span>
                                <span className="upload-text">上传参考图片</span>
                                <span className="upload-hint">支持 JPG, PNG 格式，最大 5MB</span>
                              </div>
                            </label>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 遵循度设置 */}
                    <div className="form-group">
                      <label className="form-label">
                        参考图片遵循度
                        <span className="fidelity-value">{character.fidelity || 50}%</span>
                      </label>
                      <div className="fidelity-slider-container">
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={character.fidelity || 50}
                          onChange={handleFidelityChange}
                          disabled={disabled || !character.referenceImage}
                          className="fidelity-slider"
                        />
                        <div className="slider-labels">
                          <span>创意优先</span>
                          <span>平衡</span>
                          <span>严格遵循</span>
                        </div>
                      </div>
                      {character.referenceImage && (
                        <div className="fidelity-description">
                          <span className="fidelity-info">
                            {character.fidelity <= 30 && "允许更多创意变化"}
                            {character.fidelity > 30 && character.fidelity <= 70 && "平衡创意与参考"}
                            {character.fidelity > 70 && "严格遵循参考图片"}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 右侧：角色形象预览 */}
            <div className="character-preview">
              <div className="preview-header">角色形象</div>
              <div className="character-avatar">
                {character.avatarImage ? (
                  // 显示生成的角色形象
                  <div className="avatar-generated">
                    <img 
                      src={character.avatarImage} 
                      alt={character.name || '角色形象'}
                      className="avatar-image"
                    />
                    <div className="avatar-info">
                      <div className="avatar-name">{character.name || '角色'}</div>
                      <div className="avatar-timestamp">
                        {character.avatarGeneratedAt && new Date(character.avatarGeneratedAt).toLocaleString('zh-CN', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </div>
                  </div>
                ) : character.name || character.description ? (
                  // 显示角色信息占位符
                  <div className="avatar-placeholder">
                    <span className="avatar-icon">👤</span>
                    <div className="avatar-info">
                      <div className="avatar-name">{character.name || '角色'}</div>
                      <div className="avatar-desc">
                        {character.description ? 
                          `${character.description.substring(0, 60)}${character.description.length > 60 ? '...' : ''}` : 
                          '暂无描述'
                        }
                      </div>
                    </div>
                  </div>
                ) : (
                  // 空状态
                  <div className="avatar-empty">
                    <span className="empty-icon">暂无</span>
                    <span className="empty-text">提取角色后显示</span>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={handleGenerateAvatar}
                disabled={disabled || isGeneratingAvatar || !character.name || !character.description}
                className="generate-avatar-button"
              >
                <span className="generate-icon">✨</span>
                {isGeneratingAvatar ? '生成中...' : '(2) 生成角色形象'}
              </button>
            </div>
          </div>

          {character.isAutoExtracted && (
            <div className="auto-extracted-note">
              ✨ 已自动提取角色信息，您可以继续编辑
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CharacterManager; 