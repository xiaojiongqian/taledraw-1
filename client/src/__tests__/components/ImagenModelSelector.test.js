// ImagenModelSelector component tests
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ImagenModelSelector from '../../components/ImagenModelSelector';

describe('ImagenModelSelector', () => {
  const defaultProps = {
    selectedModel: 'imagen4-fast',
    onModelChange: jest.fn(),
    disabled: false
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render with default props', () => {
    render(<ImagenModelSelector {...defaultProps} />);
    
    expect(screen.getByText('AI Model')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Imagen4-fast')).toBeInTheDocument();
  });

  it('should render all model options', () => {
    render(<ImagenModelSelector {...defaultProps} />);
    
    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
    
    // Check if all options are present
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(3);
    
    expect(screen.getByText('Imagen4-fast')).toBeInTheDocument();
    expect(screen.getByText('Imagen4')).toBeInTheDocument();
    expect(screen.getByText('Imagen3')).toBeInTheDocument();
  });

  it('should display correct selected model', () => {
    render(<ImagenModelSelector {...defaultProps} selectedModel="imagen4" />);
    
    const select = screen.getByRole('combobox');
    expect(select.value).toBe('imagen4');
  });

  it('should call onModelChange when selection changes', () => {
    const mockOnModelChange = jest.fn();
    render(
      <ImagenModelSelector 
        {...defaultProps} 
        onModelChange={mockOnModelChange} 
      />
    );
    
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'imagen3' } });
    
    expect(mockOnModelChange).toHaveBeenCalledWith('imagen3');
    expect(mockOnModelChange).toHaveBeenCalledTimes(1);
  });

  it('should not call onModelChange when disabled', () => {
    const mockOnModelChange = jest.fn();
    render(
      <ImagenModelSelector 
        {...defaultProps} 
        onModelChange={mockOnModelChange}
        disabled={true}
      />
    );
    
    const select = screen.getByRole('combobox');
    expect(select).toBeDisabled();
    
    // Try to change the value (should not work when disabled)
    fireEvent.change(select, { target: { value: 'imagen3' } });
    expect(mockOnModelChange).not.toHaveBeenCalled();
  });

  it('should display correct tooltips/descriptions', () => {
    render(<ImagenModelSelector {...defaultProps} />);
    
    const select = screen.getByRole('combobox');
    
    // Check if title attribute is set correctly for the selected option
    expect(select).toHaveAttribute('title', 'Fast generation');
    
    // Check option titles
    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveAttribute('title', 'Fast generation');
    expect(options[1]).toHaveAttribute('title', 'High quality');
    expect(options[2]).toHaveAttribute('title', 'Standard quality');
  });

  it('should handle all model options correctly', () => {
    const modelOptions = [
      { value: 'imagen4-fast', label: 'Imagen4-fast', description: 'Fast generation' },
      { value: 'imagen4', label: 'Imagen4', description: 'High quality' },
      { value: 'imagen3', label: 'Imagen3', description: 'Standard quality' }
    ];

    const mockOnModelChange = jest.fn();

    modelOptions.forEach(option => {
      mockOnModelChange.mockClear();
      
      render(
        <ImagenModelSelector 
          selectedModel={option.value}
          onModelChange={mockOnModelChange}
          disabled={false}
        />
      );
      
      expect(screen.getByDisplayValue(option.label)).toBeInTheDocument();
      
      // Test changing to a different model
      const select = screen.getByRole('combobox');
      const differentModel = modelOptions.find(m => m.value !== option.value);
      
      fireEvent.change(select, { target: { value: differentModel.value } });
      expect(mockOnModelChange).toHaveBeenCalledWith(differentModel.value);
      
      // Clean up for next iteration
      screen.getByRole('combobox').parentElement.remove();
    });
  });

  it('should maintain accessibility attributes', () => {
    render(<ImagenModelSelector {...defaultProps} />);
    
    const select = screen.getByRole('combobox');
    expect(select).toHaveAttribute('aria-expanded', 'false');
    
    // Check if it has proper labeling
    expect(screen.getByText('AI Model')).toBeInTheDocument();
  });

  it('should handle rapid model changes', () => {
    const mockOnModelChange = jest.fn();
    render(
      <ImagenModelSelector 
        {...defaultProps} 
        onModelChange={mockOnModelChange} 
      />
    );
    
    const select = screen.getByRole('combobox');
    
    // Simulate rapid changes
    fireEvent.change(select, { target: { value: 'imagen3' } });
    fireEvent.change(select, { target: { value: 'imagen4' } });
    fireEvent.change(select, { target: { value: 'imagen4-fast' } });
    
    expect(mockOnModelChange).toHaveBeenCalledTimes(3);
    expect(mockOnModelChange).toHaveBeenNthCalledWith(1, 'imagen3');
    expect(mockOnModelChange).toHaveBeenNthCalledWith(2, 'imagen4');
    expect(mockOnModelChange).toHaveBeenNthCalledWith(3, 'imagen4-fast');
  });

  it('should handle edge cases gracefully', () => {
    // Test with invalid selectedModel
    const { rerender } = render(
      <ImagenModelSelector 
        selectedModel="invalid-model"
        onModelChange={jest.fn()}
        disabled={false}
      />
    );
    
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    
    // Test with null onModelChange
    rerender(
      <ImagenModelSelector 
        selectedModel="imagen4-fast"
        onModelChange={null}
        disabled={false}
      />
    );
    
    const select = screen.getByRole('combobox');
    expect(() => {
      fireEvent.change(select, { target: { value: 'imagen3' } });
    }).not.toThrow();
  });

  it('should apply correct CSS classes', () => {
    render(<ImagenModelSelector {...defaultProps} />);
    
    expect(screen.getByText('AI Model').closest('.imagen-model-selector')).toBeInTheDocument();
    expect(screen.getByRole('combobox').closest('.model-select-container')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveClass('model-select');
  });

  it('should update tooltip when selection changes', () => {
    const mockOnModelChange = jest.fn();
    const { rerender } = render(
      <ImagenModelSelector 
        selectedModel="imagen4-fast"
        onModelChange={mockOnModelChange}
        disabled={false}
      />
    );
    
    let select = screen.getByRole('combobox');
    expect(select).toHaveAttribute('title', 'Fast generation');
    
    // Simulate external state change
    rerender(
      <ImagenModelSelector 
        selectedModel="imagen4"
        onModelChange={mockOnModelChange}
        disabled={false}
      />
    );
    
    select = screen.getByRole('combobox');
    expect(select).toHaveAttribute('title', 'High quality');
  });
});