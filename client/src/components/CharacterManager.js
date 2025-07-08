import React, { useState, useRef } from 'react';
import './CharacterManager.css';
import { extractCharacter, generateCharacterAvatar } from '../api';

const CharacterManager = ({ story, character, onCharacterChange, disabled = false }) => {
  const [isExtracting, setIsExtracting] = useState(false);
  const [isGeneratingAvatar, setIsGeneratingAvatar] = useState(false); // Control character avatar generation state
  const [extractionError, setExtractionError] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false); // Control advanced settings display
  const [isExpanded, setIsExpanded] = useState(false); // Control character settings expand/collapse
  const fileInputRef = useRef(null);

  // Auto extract character
  const handleExtractCharacter = async () => {
    if (!story.trim()) {
      setExtractionError('Please enter story content first');
      return;
    }

    setIsExtracting(true);
    setExtractionError('');

    try {
      const data = await extractCharacter(story.trim());
      
      // Update character info, keeping existing reference image and fidelity
      onCharacterChange({
        ...character,
        name: data.name || 'Protagonist',
        description: data.description || '',
        isAutoExtracted: true
      });

    } catch (error) {
      console.error('Character extraction error:', error);
      setExtractionError(error.message || 'Character extraction failed');
    } finally {
      setIsExtracting(false);
    }
  };

  // Generate character avatar
  const handleGenerateAvatar = async () => {
    if (!character.name || !character.description) {
      setExtractionError('Please enter character name and description first');
      return;
    }

    setIsGeneratingAvatar(true);
    setExtractionError('');

    try {
      const result = await generateCharacterAvatar(
        character.name,
        character.description,
        '', // Remove negative prompt parameter
        character.referenceImage,
        character.fidelity || 50
      );
      
      // Update character info, add generated avatar
      onCharacterChange({
        ...character,
        avatarImage: result.imageUrl,
        avatarPrompt: result.prompt,
        avatarGeneratedAt: result.generatedAt
      });

              console.log('Character avatar generated successfully:', result);

    } catch (error) {
      console.error('Character avatar generation error:', error);
      setExtractionError(error.message || 'Character avatar generation failed');
    } finally {
      setIsGeneratingAvatar(false);
    }
  };

  // Handle reference image upload
  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
          // Check file type and size
    if (!file.type.startsWith('image/')) {
      setExtractionError('Please select an image file');
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      setExtractionError('Image size cannot exceed 5MB');
      return;
    }

      // Create FileReader to preview image
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

  // Remove reference image
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

  // Update character name
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

  // Update fidelity
  const handleFidelityChange = (event) => {
    onCharacterChange({
      ...character,
      fidelity: parseInt(event.target.value)
    });
  };

  return (
    <div className="character-manager">
      {/* Character settings title and expand/collapse button */}
      <div className="character-header">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="character-toggle"
          disabled={disabled}
        >
          <span className={`toggle-icon ${isExpanded ? 'expanded' : ''}`}>▶</span>
          Character Settings
        </button>
      </div>

      {isExpanded && (
        <div className="character-expanded-content">
          {extractionError && (
            <div className="error-message">{extractionError}</div>
          )}

          <div className="character-content">
            {/* Left side: Character info editing */}
            <div className="character-form">
              {/* Character basic info group */}
              <div className="character-basic-group">
                {/* Character name */}
                <div className="form-group">
                  <label className="form-label">Character Name</label>
                  <input
                    type="text"
                    value={character.name || ''}
                    onChange={handleNameChange}
                    placeholder="Main character name"
                    disabled={disabled}
                    className="character-input"
                  />
                </div>

                {/* Character description */}
                <div className="form-group">
                  <label className="form-label">Appearance Description</label>
                  <textarea
                    value={character.description || ''}
                    onChange={handleDescriptionChange}
                    placeholder="Describe the character's appearance, clothing, etc..."
                    disabled={disabled}
                    className="character-textarea"
                    rows="1"
                  />
                </div>

                {/* Auto extract button */}
                <div className="extract-section">
                  <button
                    type="button"
                    onClick={handleExtractCharacter}
                    disabled={disabled || isExtracting || !story.trim()}
                    className="extract-button"
                  >
                    {isExtracting ? 'Extracting...' : '(1) Auto Extract'}
                  </button>
                  <span className="extract-hint">Automatically generate character info based on story content</span>
                </div>
              </div>

              {/* Advanced settings collapsible area */}
              <div className="advanced-settings">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="advanced-toggle"
                  disabled={disabled}
                >
                  <span className={`toggle-icon ${showAdvanced ? 'expanded' : ''}`}>▶</span>
                  Advanced Settings
                </button>

                {showAdvanced && (
                  <div className="advanced-content">
                    {/* Reference image upload */}
                    <div className="form-group">
                      <label className="form-label">Reference Image</label>
                      <div className="image-upload-section">
                        {character.referenceImagePreview ? (
                          <div className="image-preview">
                            <img 
                              src={character.referenceImagePreview} 
                              alt="Character reference image"
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
                                <span className="upload-text">Upload Reference Image</span>
                                <span className="upload-hint">Supports JPG, PNG, WebP format, max 5MB</span>
                              </div>
                            </label>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Fidelity settings */}
                    <div className="form-group">
                      <label className="form-label">
                        Reference Image Fidelity
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
                          <span>Creative Priority</span>
                          <span>Balanced</span>
                          <span>Strict Adherence</span>
                        </div>
                      </div>
                      {character.referenceImage && (
                        <div className="fidelity-description">
                          <span className="fidelity-info">
                            {character.fidelity <= 30 && "Allow more creative variations"}
                            {character.fidelity > 30 && character.fidelity <= 70 && "Balance creativity with reference"}
                            {character.fidelity > 70 && "Strictly follow reference image"}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right side: Character avatar preview */}
            <div className="character-preview">
              <div className="preview-header">Character Avatar</div>
              <div className="character-avatar">
                {character.avatarImage ? (
                  // Show generated character avatar
                  <div className="avatar-generated">
                    <img 
                      src={character.avatarImage} 
                      alt={character.name || 'Character Avatar'}
                      className="avatar-image"
                    />
                    <div className="avatar-info">
                      <div className="avatar-name">{character.name || 'Character'}</div>
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
                  // Show character info placeholder
                  <div className="avatar-placeholder">
                    <span className="avatar-icon">👤</span>
                    <div className="avatar-info">
                      <div className="avatar-name">{character.name || 'Character'}</div>
                      <div className="avatar-desc">
                        {character.description ? 
                          `${character.description.substring(0, 60)}${character.description.length > 60 ? '...' : ''}` : 
                          'No description'
                        }
                      </div>
                    </div>
                  </div>
                ) : (
                  // Empty state
                  <div className="avatar-empty">
                    <span className="empty-icon">None</span>
                    <span className="empty-text">Show after extracting character</span>
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
                {isGeneratingAvatar ? 'Generating...' : '(2) Generate Character Avatar'}
              </button>
            </div>
          </div>

          {character.isAutoExtracted && (
            <div className="auto-extracted-note">
              ✨ Character information auto-extracted, you can continue editing
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CharacterManager; 