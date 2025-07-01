import React from 'react';
import './PageSelector.css';

const PageSelector = ({ pageCount, onPageCountChange, disabled = false }) => {
  const handleSliderChange = (event) => {
    const value = parseInt(event.target.value);
    onPageCountChange(value);
  };

  const handleInputChange = (event) => {
    const value = parseInt(event.target.value);
    if (value >= 1 && value <= 20) {
      onPageCountChange(value);
    }
  };

  return (
    <div className="page-selector">
      <div className="page-selector-header">
        <label className="page-selector-label">
          故事页数
        </label>
        <div className="page-count-display">
          <input
            type="number"
            min="1"
            max="20"
            value={pageCount}
            onChange={handleInputChange}
            disabled={disabled}
            className="page-count-input"
          />
          <span className="page-unit">页</span>
        </div>
      </div>
      
      <div className="page-slider-container">
        <input
          type="range"
          min="1"
          max="20"
          value={pageCount}
          onChange={handleSliderChange}
          disabled={disabled}
          className="page-slider"
        />
        <div className="slider-labels">
          <span>1</span>
          <span>10</span>
          <span>20</span>
        </div>
      </div>
      
      <div className="page-info">
        <span className="page-description">
          {pageCount <= 5 && "简短故事，适合快速生成"}
          {pageCount > 5 && pageCount <= 10 && "标准长度，推荐选择"}
          {pageCount > 10 && pageCount <= 15 && "详细故事，内容丰富"}
          {pageCount > 15 && "长篇故事，需要更多时间生成"}
        </span>
      </div>
    </div>
  );
};

export default PageSelector; 