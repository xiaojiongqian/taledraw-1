// PageItem component tests
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import PageItem from '../../components/PageItem';

// Mock the logger
jest.mock('../../utils/logger', () => ({
  safeLog: {
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

describe('PageItem', () => {
  const mockPage = {
    id: 'page_1',
    title: 'Chapter 1',
    text: 'Once upon a time in a magical forest...',
    imagePrompt: 'A magical forest with tall trees and sunlight',
    image: 'https://example.com/image1.jpg',
    status: 'success',
    model: 'imagen4-fast'
  };

  const mockAllCharacters = {
    'Hero': {
      appearance: 'Young brave knight',
      clothing: 'Silver armor',
      personality: 'Courageous and kind'
    }
  };

  const defaultProps = {
    page: mockPage,
    index: 0,
    allCharacters: mockAllCharacters,
    onRegenerateImage: jest.fn(),
    onUpdatePrompt: jest.fn(),
    onUpdateText: jest.fn(),
    onUpdateTitle: jest.fn(),
    onImageClick: jest.fn(),
    isGenerating: false
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render page with all elements', () => {
      render(<PageItem {...defaultProps} />);
      
      expect(screen.getByText('1. Chapter 1')).toBeInTheDocument();
      expect(screen.getByText('Once upon a time in a magical forest...')).toBeInTheDocument();
      expect(screen.getByText('Generated Successfully')).toBeInTheDocument();
      expect(screen.getByRole('img')).toBeInTheDocument();
    });

    it('should render page without title', () => {
      const pageWithoutTitle = { ...mockPage, title: '' };
      render(<PageItem {...defaultProps} page={pageWithoutTitle} />);
      
      expect(screen.getByText('1.')).toBeInTheDocument();
    });

    it('should render different status badges correctly', () => {
      const statuses = [
        { status: 'pending', text: 'Ready to Generate' },
        { status: 'generating', text: 'Generating...' },
        { status: 'error', text: 'Generation Failed' },
        { status: 'success', text: 'Generated Successfully' }
      ];

      statuses.forEach(({ status, text }) => {
        const pageWithStatus = { ...mockPage, status };
        const { rerender } = render(<PageItem {...defaultProps} page={pageWithStatus} />);
        
        // For error status, check specifically in the status badge
        if (status === 'error') {
          const statusBadge = screen.getByText(text, { selector: '.status-badge' });
          expect(statusBadge).toBeInTheDocument();
        } else {
          expect(screen.getByText(text)).toBeInTheDocument();
        }
        
        // Clean up for next iteration
        rerender(<div />);
      });
    });
  });

  describe('Image Handling', () => {
    it('should call onImageClick when image is clicked', () => {
      render(<PageItem {...defaultProps} />);
      
      const image = screen.getByRole('img');
      fireEvent.click(image);
      
      expect(defaultProps.onImageClick).toHaveBeenCalledTimes(1);
    });

    it('should not call onImageClick when image has error', () => {
      const pageWithImageError = { ...mockPage, image: null };
      render(<PageItem {...defaultProps} page={pageWithImageError} />);
      
      // Should show pending state instead of image
      expect(screen.getByText('Waiting to generate')).toBeInTheDocument();
      expect(defaultProps.onImageClick).not.toHaveBeenCalled();
    });

    it('should not call onImageClick when image load fails', () => {
      render(<PageItem {...defaultProps} />);
      
      const image = screen.getByRole('img');
      fireEvent.error(image);
      
      // Should show reload button instead of allowing click
      expect(screen.getByText('Reload Image')).toBeInTheDocument();
      
      // Click the image after error - should not trigger onImageClick
      fireEvent.click(image);
      expect(defaultProps.onImageClick).not.toHaveBeenCalled();
    });

    it('should show regenerate button when image fails', () => {
      const pageWithError = { 
        ...mockPage, 
        status: 'error',
        errorType: 'safety_filter',
        errorDetails: 'Content filtered'
      };
      render(<PageItem {...defaultProps} page={pageWithError} />);
      
      expect(screen.getByText('Regenerate')).toBeInTheDocument();
      expect(screen.getByText('Content Filtered')).toBeInTheDocument();
    });

    it('should handle image load error', () => {
      render(<PageItem {...defaultProps} />);
      
      const image = screen.getByRole('img');
      fireEvent.error(image);
      
      // Should trigger reload functionality
      expect(screen.getByText('Reload Image')).toBeInTheDocument();
    });
  });

  describe('Text Editing', () => {
    it('should enter text edit mode when text is clicked', () => {
      render(<PageItem {...defaultProps} />);
      
      const textElement = screen.getByText('Once upon a time in a magical forest...');
      fireEvent.click(textElement);
      
      expect(screen.getByRole('textbox')).toBeInTheDocument();
      expect(screen.getByText('Save')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('should save text changes', () => {
      render(<PageItem {...defaultProps} />);
      
      const textElement = screen.getByText('Once upon a time in a magical forest...');
      fireEvent.click(textElement);
      
      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: 'New story text' } });
      
      const saveButton = screen.getByText('Save');
      fireEvent.click(saveButton);
      
      expect(defaultProps.onUpdateText).toHaveBeenCalledWith(0, 'New story text');
    });

    it('should cancel text editing', () => {
      render(<PageItem {...defaultProps} />);
      
      const textElement = screen.getByText('Once upon a time in a magical forest...');
      fireEvent.click(textElement);
      
      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: 'New story text' } });
      
      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);
      
      expect(defaultProps.onUpdateText).not.toHaveBeenCalled();
      expect(screen.getByText('Once upon a time in a magical forest...')).toBeInTheDocument();
    });

    it('should handle keyboard shortcuts in text editing', () => {
      render(<PageItem {...defaultProps} />);
      
      const textElement = screen.getByText('Once upon a time in a magical forest...');
      fireEvent.click(textElement);
      
      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: 'New story text' } });
      
      // Test Ctrl+Enter to save
      fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true });
      expect(defaultProps.onUpdateText).toHaveBeenCalledWith(0, 'New story text');
    });
  });

  describe('Title Editing', () => {
    it('should enter title edit mode when title is clicked', () => {
      render(<PageItem {...defaultProps} />);
      
      const titleElement = screen.getByText('1. Chapter 1');
      fireEvent.click(titleElement);
      
      expect(screen.getByDisplayValue('Chapter 1')).toBeInTheDocument();
    });

    it('should save title changes', () => {
      render(<PageItem {...defaultProps} />);
      
      const titleElement = screen.getByText('1. Chapter 1');
      fireEvent.click(titleElement);
      
      const input = screen.getByDisplayValue('Chapter 1');
      fireEvent.change(input, { target: { value: 'New Chapter Title' } });
      
      const saveButton = screen.getByText('Save');
      fireEvent.click(saveButton);
      
      expect(defaultProps.onUpdateTitle).toHaveBeenCalledWith(0, 'New Chapter Title');
    });

    it('should handle Enter key to save title', () => {
      render(<PageItem {...defaultProps} />);
      
      const titleElement = screen.getByText('1. Chapter 1');
      fireEvent.click(titleElement);
      
      const input = screen.getByDisplayValue('Chapter 1');
      fireEvent.change(input, { target: { value: 'New Title' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      
      expect(defaultProps.onUpdateTitle).toHaveBeenCalledWith(0, 'New Title');
    });
  });

  describe('Prompt Editing', () => {
    it('should show prompt section when expanded', () => {
      render(<PageItem {...defaultProps} />);
      
      const promptButton = screen.getByText('Prompt');
      fireEvent.click(promptButton);
      
      expect(screen.getByDisplayValue('A magical forest with tall trees and sunlight')).toBeInTheDocument();
      expect(screen.getByText('Save and Regenerate')).toBeInTheDocument();
    });

    it('should save prompt and regenerate image', () => {
      render(<PageItem {...defaultProps} />);
      
      const promptButton = screen.getByText('Prompt');
      fireEvent.click(promptButton);
      
      const textarea = screen.getByDisplayValue('A magical forest with tall trees and sunlight');
      fireEvent.change(textarea, { target: { value: 'New prompt text' } });
      
      const saveButton = screen.getByText('Save and Regenerate');
      fireEvent.click(saveButton);
      
      expect(defaultProps.onUpdatePrompt).toHaveBeenCalledWith(0, 'New prompt text');
      expect(defaultProps.onRegenerateImage).toHaveBeenCalledWith(0, 'New prompt text');
    });

    it('should collapse prompt section when cancelled', () => {
      render(<PageItem {...defaultProps} />);
      
      const promptButton = screen.getByText('Prompt');
      fireEvent.click(promptButton);
      
      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);
      
      expect(screen.queryByDisplayValue('A magical forest with tall trees and sunlight')).not.toBeInTheDocument();
      expect(screen.getByText('Prompt')).toBeInTheDocument();
    });
  });

  describe('Generation States', () => {
    it('should show generating spinner when generating', () => {
      const generatingPage = { ...mockPage, status: 'generating' };
      render(<PageItem {...defaultProps} page={generatingPage} />);
      
      expect(screen.getByText('Generating image...')).toBeInTheDocument();
      expect(screen.getByText('Please wait, creating beautiful illustrations for you')).toBeInTheDocument();
    });

    it('should show regenerating spinner when regenerating', () => {
      const regeneratingPage = { ...mockPage, status: 'regenerating' };
      render(<PageItem {...defaultProps} page={regeneratingPage} />);
      
      expect(screen.getByText('Regenerating...')).toBeInTheDocument();
      expect(screen.getByText('Please wait')).toBeInTheDocument();
    });

    it('should disable regenerate button when generating', () => {
      const errorPage = { ...mockPage, status: 'error' };
      render(<PageItem {...defaultProps} page={errorPage} isGenerating={true} />);
      
      const regenerateButton = screen.getByText('Regenerate');
      expect(regenerateButton).toBeDisabled();
    });
  });

  describe('Error Handling', () => {
    it('should display different error types correctly', () => {
      const errorTypes = [
        { errorType: 'safety_filter', icon: '🛡️', text: 'Content Filtered' },
        { errorType: 'timeout', icon: '⏱️', text: 'Generation Timeout' },
        { errorType: 'quota', icon: '📊', text: 'API Quota Exceeded' },
        { errorType: 'auth', icon: '🔐', text: 'Authentication Error' }
      ];

      errorTypes.forEach(({ errorType, icon, text }) => {
        const errorPage = { 
          ...mockPage, 
          status: 'error', 
          errorType,
          errorDetails: 'Error details'
        };
        
        const { rerender } = render(<PageItem {...defaultProps} page={errorPage} />);
        
        expect(screen.getByText(text)).toBeInTheDocument();
        expect(screen.getByText(icon)).toBeInTheDocument();
        
        rerender(<div />);
      });
    });

    it('should show model information in error state', () => {
      const errorPage = { 
        ...mockPage, 
        status: 'error',
        model: 'imagen4-fast',
        errorType: 'timeout'
      };
      render(<PageItem {...defaultProps} page={errorPage} />);
      
      expect(screen.getByText('Model: Imagen 4 Fast')).toBeInTheDocument();
    });
  });

  describe('Image Viewer Integration', () => {
    it('should call onImageClick callback when image is clicked', () => {
      render(<PageItem {...defaultProps} />);
      
      const image = screen.getByRole('img');
      fireEvent.click(image);
      
      expect(defaultProps.onImageClick).toHaveBeenCalledTimes(1);
    });

    it('should not call onImageClick when image is not available', () => {
      const pageWithoutImage = { ...mockPage, image: null };
      render(<PageItem {...defaultProps} page={pageWithoutImage} />);
      
      // Should show pending state, no image to click
      expect(screen.getByText('Waiting to generate')).toBeInTheDocument();
      expect(defaultProps.onImageClick).not.toHaveBeenCalled();
    });

    it('should not call onImageClick when image load error occurs', () => {
      render(<PageItem {...defaultProps} />);
      
      const image = screen.getByRole('img');
      fireEvent.error(image);
      
      // Image should show error state
      expect(screen.getByText('Reload Image')).toBeInTheDocument();
      
      // Clicking on failed image should not trigger onImageClick
      fireEvent.click(image);
      expect(defaultProps.onImageClick).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', () => {
      render(<PageItem {...defaultProps} />);
      
      const image = screen.getByRole('img');
      expect(image).toHaveAttribute('alt', '1. Illustration');
      expect(image).toHaveAttribute('title', 'Click to open in new window');
    });

    it('should have clickable elements with proper titles', () => {
      render(<PageItem {...defaultProps} />);
      
      const textElement = screen.getByTitle('Click to edit text');
      expect(textElement).toBeInTheDocument();
      
      const titleElement = screen.getByTitle('Click to edit title');
      expect(titleElement).toBeInTheDocument();
    });
  });
});