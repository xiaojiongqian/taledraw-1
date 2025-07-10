import React from 'react';
import './ImagenModelSelector.css';

const ImagenModelSelector = ({ selectedModel, onModelChange, disabled = false }) => {
  const modelOptions = [
    {
      value: 'imagen4-fast',
      label: 'Imagen4-fast',
      description: 'Fast generation'
    },
    {
      value: 'imagen4',
      label: 'Imagen4',
      description: 'High quality'
    },
    {
      value: 'imagen3',
      label: 'Imagen3',
      description: 'Standard quality'
    }
  ];

  const handleModelChange = (event) => {
    if (!disabled) {
      onModelChange(event.target.value);
    }
  };

  const selectedOption = modelOptions.find(option => option.value === selectedModel);

  return (
    <div className="imagen-model-selector">
      <h3 className="selector-title">AI Model</h3>
      
      <div className="model-select-container">
        <select 
          value={selectedModel}
          onChange={handleModelChange}
          disabled={disabled}
          className="model-select"
          title={selectedOption ? selectedOption.description : ''}
        >
          {modelOptions.map((option) => (
            <option key={option.value} value={option.value} title={option.description}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default ImagenModelSelector; 