import React from 'react';
import './AspectRatioSelector.css';

const AspectRatioSelector = ({ aspectRatio, onAspectRatioChange, disabled = false }) => {
  const ratioOptions = [
    {
      value: '1:1',
      label: '1:1',
      width: 24,
      height: 24
    },
    {
      value: '9:16',
      label: '9:16',
      width: 18,
      height: 32
    },
    {
      value: '16:9',
      label: '16:9',
      width: 32,
      height: 18
    },
    {
      value: '3:4',
      label: '3:4',
      width: 21,
      height: 28
    },
    {
      value: '4:3',
      label: '4:3',
      width: 28,
      height: 21
    }
  ];

  const handleRatioChange = (value) => {
    if (!disabled) {
      onAspectRatioChange(value);
    }
  };

  return (
    <div className="aspect-ratio-selector">
      <h3 className="selector-title">Aspect ratio</h3>
      
      <div className="ratio-options">
        {ratioOptions.map((option) => (
          <div 
            key={option.value}
            className={`ratio-option ${aspectRatio === option.value ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
            onClick={() => handleRatioChange(option.value)}
          >
            <div className="ratio-preview">
              <div 
                className="preview-box"
                style={{
                  width: `${option.width}px`,
                  height: `${option.height}px`
                }}
              ></div>
            </div>
            
            <div className="ratio-label">
              {option.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AspectRatioSelector; 