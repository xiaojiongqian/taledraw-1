import React from 'react';
import './PageSelector.css';

const PageSelector = ({ pageCount, onPageCountChange, disabled = false }) => {
  const handleSliderChange = (event) => {
    const value = parseInt(event.target.value);
    onPageCountChange(value);
  };

  return (
    <div className="page-selector">
      <h3 className="selector-title">Pages</h3>
      
      <div className="slider-container">
        <input
          type="range"
          min="1"
          max="30"
          value={pageCount}
          onChange={handleSliderChange}
          disabled={disabled}
          className="page-slider"
        />
        <div className="value-display">
          {pageCount}
        </div>
      </div>
    </div>
  );
};

export default PageSelector; 