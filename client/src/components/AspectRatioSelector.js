import React from 'react';
import './AspectRatioSelector.css';

const AspectRatioSelector = ({ aspectRatio, onAspectRatioChange, disabled = false }) => {
  const ratioOptions = [
    {
      value: '16:9',
      label: '16:9',
      description: '横屏',
      preview: 'landscape'
    },
    {
      value: '9:16', 
      label: '9:16',
      description: '竖屏',
      preview: 'portrait'
    }
  ];

  const handleRatioChange = (value) => {
    if (!disabled) {
      onAspectRatioChange(value);
    }
  };

  return (
    <div className="aspect-ratio-selector">
      <div className="aspect-ratio-header">
        <label className="aspect-ratio-label">
          图片比例
        </label>
        <div className="current-ratio">
          {aspectRatio}
        </div>
      </div>
      
      <div className="ratio-options">
        {ratioOptions.map((option) => (
          <div 
            key={option.value}
            className={`ratio-option ${aspectRatio === option.value ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
            onClick={() => handleRatioChange(option.value)}
          >
            <div className="ratio-preview">
              <div className={`preview-box ${option.preview}`}></div>
            </div>
            
            <div className="ratio-info">
              <div className="ratio-label">
                {option.label}
              </div>
              <div className="ratio-description">
                {option.description}
              </div>
            </div>
            
            {aspectRatio === option.value && (
              <div className="selected-indicator">✓</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AspectRatioSelector; 