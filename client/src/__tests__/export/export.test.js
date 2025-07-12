import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import App from '../../App';
import { generateTaleStream, generateImageWithImagen } from '../../api';
import { onAuthStateChanged } from 'firebase/auth';
import stateManager from '../../stateManager';
import PptxGenJS from 'pptxgenjs';

// Mock dependencies
jest.mock('../../api');
jest.mock('firebase/auth');
jest.mock('../../stateManager');
jest.mock('pptxgenjs');

// Mock components
jest.mock('../../components/CheckoutButton', () => {
  return function MockCheckoutButton() {
    return <div data-testid="checkout-button">Checkout Button</div>;
  };
});

jest.mock('react-toastify', () => ({
  ToastContainer: () => <div data-testid="toast-container"></div>,
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  }
}));

const mockUser = {
  email: 'test@example.com',
  uid: '123',
  getIdToken: jest.fn(() => Promise.resolve('mock-token'))
};

const renderApp = () => {
  return render(
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );
};

// Helper to setup complete story with images
const setupCompleteStoryWithImages = async () => {
  const mockStream = {
    on: jest.fn((event, callback) => {
      if (event === 'data') {
        callback(JSON.stringify({
          type: 'story_title',
          data: 'Export Test Story'
        }));
        callback(JSON.stringify({
          type: 'page',
          data: {
            pageNumber: 1,
            text: 'First page of the story',
            imagePrompt: 'Beautiful landscape'
          }
        }));
        callback(JSON.stringify({
          type: 'page',
          data: {
            pageNumber: 2,
            text: 'Second page with more content',
            imagePrompt: 'Character portrait'
          }
        }));
        callback(JSON.stringify({
          type: 'page',
          data: {
            pageNumber: 3,
            text: 'Final page conclusion',
            imagePrompt: 'Epic ending scene'
          }
        }));
        callback(JSON.stringify({
          type: 'complete',
          data: { message: 'Story generation complete' }
        }));
      }
      if (event === 'end') callback();
      return mockStream;
    }),
    destroy: jest.fn()
  };

  generateTaleStream.mockResolvedValue(mockStream);
  
  // Mock different image URLs for each page
  generateImageWithImagen
    .mockResolvedValueOnce({
      success: true,
      imageUrl: 'https://example.com/image1.png',
      width: 1024,
      height: 1024
    })
    .mockResolvedValueOnce({
      success: true,
      imageUrl: 'https://example.com/image2.png',
      width: 1920,
      height: 1080
    })
    .mockResolvedValueOnce({
      success: true,
      imageUrl: 'https://example.com/image3.png',
      width: 768,
      height: 1024
    });
};

describe('Export Functionality', () => {
  let mockPptx;
  let mockSlide;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock auth state
    onAuthStateChanged.mockImplementation((authInstance, callback) => {
      callback(mockUser);
      return jest.fn();
    });

    // Mock stateManager
    stateManager.saveState.mockReturnValue(true);
    stateManager.restoreState.mockReturnValue(null);
    stateManager.clearState.mockImplementation(() => {});

    // Mock PptxGenJS
    mockSlide = {
      addText: jest.fn(),
      addImage: jest.fn(),
      addShape: jest.fn()
    };

    mockPptx = {
      defineLayout: jest.fn(),
      layout: 'LAYOUT_WIDE',
      addSlide: jest.fn(() => mockSlide),
      save: jest.fn(() => Promise.resolve('mock-pptx-file')),
      write: jest.fn((type) => Promise.resolve(new Blob(['mock-pptx'], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' })))
    };

    PptxGenJS.mockImplementation(() => mockPptx);

    // Mock fetch for image download
    global.fetch = jest.fn((url) => {
      const imageData = {
        'https://example.com/image1.png': 'data:image/png;base64,image1data',
        'https://example.com/image2.png': 'data:image/png;base64,image2data',
        'https://example.com/image3.png': 'data:image/png;base64,image3data'
      };
      
      return Promise.resolve({
        blob: () => Promise.resolve(new Blob([imageData[url] || 'mock-image'], { type: 'image/png' }))
      });
    });
  });

  describe('Export Options Display', () => {
    it('should show export options after story generation', async () => {
      await setupCompleteStoryWithImages();
      renderApp();

      // Generate story
      const storyInput = await screen.findByPlaceholderText(/Enter your story here/i);
      await userEvent.type(storyInput, 'Test story for export');
      await userEvent.click(screen.getByRole('button', { name: /Generate Tale/i }));

      await waitFor(() => {
        expect(screen.getByText('Export Test Story')).toBeInTheDocument();
      });

      // Save button should be available
      const saveButton = await screen.findByRole('button', { name: /Save Tale/i });
      expect(saveButton).toBeInTheDocument();
    });

    it('should display export format options on save click', async () => {
      await setupCompleteStoryWithImages();
      renderApp();

      // Generate story
      const storyInput = await screen.findByPlaceholderText(/Enter your story here/i);
      await userEvent.type(storyInput, 'Test story');
      await userEvent.click(screen.getByRole('button', { name: /Generate Tale/i }));

      await waitFor(() => {
        expect(screen.getByText('Export Test Story')).toBeInTheDocument();
      });

      // Click save button
      const saveButton = await screen.findByRole('button', { name: /Save Tale/i });
      await userEvent.click(saveButton);

      // Should show export options
      expect(screen.getByText(/Save as HTML/i)).toBeInTheDocument();
      expect(screen.getByText(/Save as PowerPoint/i)).toBeInTheDocument();
    });
  });

  describe('HTML Export', () => {
    beforeEach(async () => {
      await setupCompleteStoryWithImages();
    });

    it('should export story as HTML with embedded images', async () => {
      // Mock URL.createObjectURL and link click
      const mockUrl = 'blob:mock-html-url';
      global.URL.createObjectURL = jest.fn(() => mockUrl);
      
      const mockClick = jest.fn();
      const mockSetAttribute = jest.fn();
      jest.spyOn(document, 'createElement').mockImplementation((tagName) => {
        if (tagName === 'a') {
          return { 
            click: mockClick, 
            setAttribute: mockSetAttribute,
            href: '',
            download: ''
          };
        }
        return document.createElement(tagName);
      });

      renderApp();

      // Generate story and images
      const storyInput = await screen.findByPlaceholderText(/Enter your story here/i);
      await userEvent.type(storyInput, 'Test story');
      await userEvent.click(screen.getByRole('button', { name: /Generate Tale/i }));

      await waitFor(() => {
        expect(screen.getByText('Export Test Story')).toBeInTheDocument();
      });

      // Generate images
      await userEvent.click(await screen.findByRole('button', { name: /Generate Images/i }));

      await waitFor(() => {
        expect(generateImageWithImagen).toHaveBeenCalledTimes(3);
      });

      // Open save options
      const saveButton = await screen.findByRole('button', { name: /Save Tale/i });
      await userEvent.click(saveButton);

      // Click HTML export
      const htmlButton = screen.getByText(/Save as HTML/i);
      await userEvent.click(htmlButton);

      // Should create and download HTML file
      await waitFor(() => {
        expect(global.URL.createObjectURL).toHaveBeenCalled();
        expect(mockClick).toHaveBeenCalled();
        
        // Verify the link attributes
        const setAttributeCalls = mockSetAttribute.mock.calls;
        const hrefCall = setAttributeCalls.find(call => call[0] === 'href');
        const downloadCall = setAttributeCalls.find(call => call[0] === 'download');
        
        expect(hrefCall[1]).toBe(mockUrl);
        expect(downloadCall[1]).toMatch(/Export_Test_Story.*\.html/);
      });
    });

    it('should include all story content in HTML export', async () => {
      let capturedHtmlContent = '';
      
      // Capture the HTML content
      global.URL.createObjectURL = jest.fn((blob) => {
        const reader = new FileReader();
        reader.onload = () => {
          capturedHtmlContent = reader.result;
        };
        reader.readAsText(blob);
        return 'blob:mock-url';
      });

      renderApp();

      // Generate complete story
      const storyInput = await screen.findByPlaceholderText(/Enter your story here/i);
      await userEvent.type(storyInput, 'Test story');
      await userEvent.click(screen.getByRole('button', { name: /Generate Tale/i }));

      await waitFor(() => {
        expect(screen.getByText('Export Test Story')).toBeInTheDocument();
      });

      await userEvent.click(await screen.findByRole('button', { name: /Generate Images/i }));

      // Export as HTML
      const saveButton = await screen.findByRole('button', { name: /Save Tale/i });
      await userEvent.click(saveButton);
      await userEvent.click(screen.getByText(/Save as HTML/i));

      // Wait for content to be captured
      await waitFor(() => {
        expect(capturedHtmlContent).toContain('Export Test Story');
        expect(capturedHtmlContent).toContain('First page of the story');
        expect(capturedHtmlContent).toContain('Second page with more content');
        expect(capturedHtmlContent).toContain('Final page conclusion');
        expect(capturedHtmlContent).toContain('data:image/png;base64');
      });
    });

    it('should handle HTML export without images', async () => {
      renderApp();

      // Generate story without images
      const storyInput = await screen.findByPlaceholderText(/Enter your story here/i);
      await userEvent.type(storyInput, 'Test story');
      await userEvent.click(screen.getByRole('button', { name: /Generate Tale/i }));

      await waitFor(() => {
        expect(screen.getByText('Export Test Story')).toBeInTheDocument();
      });

      // Export without generating images
      const saveButton = await screen.findByRole('button', { name: /Save Tale/i });
      await userEvent.click(saveButton);
      await userEvent.click(screen.getByText(/Save as HTML/i));

      // Should still export successfully
      await waitFor(() => {
        expect(global.URL.createObjectURL).toHaveBeenCalled();
      });
    });
  });

  describe('PowerPoint Export', () => {
    beforeEach(async () => {
      await setupCompleteStoryWithImages();
    });

    it('should export story as PowerPoint presentation', async () => {
      renderApp();

      // Generate complete story with images
      const storyInput = await screen.findByPlaceholderText(/Enter your story here/i);
      await userEvent.type(storyInput, 'Test story');
      await userEvent.click(screen.getByRole('button', { name: /Generate Tale/i }));

      await waitFor(() => {
        expect(screen.getByText('Export Test Story')).toBeInTheDocument();
      });

      await userEvent.click(await screen.findByRole('button', { name: /Generate Images/i }));

      await waitFor(() => {
        expect(generateImageWithImagen).toHaveBeenCalledTimes(3);
      });

      // Export as PowerPoint
      const saveButton = await screen.findByRole('button', { name: /Save Tale/i });
      await userEvent.click(saveButton);
      await userEvent.click(screen.getByText(/Save as PowerPoint/i));

      // Verify PPTX creation
      await waitFor(() => {
        expect(PptxGenJS).toHaveBeenCalled();
        expect(mockPptx.defineLayout).toHaveBeenCalled();
        expect(mockPptx.addSlide).toHaveBeenCalledTimes(4); // Title + 3 content slides
      });
    });

    it('should create title slide with story metadata', async () => {
      renderApp();

      // Generate story
      const storyInput = await screen.findByPlaceholderText(/Enter your story here/i);
      await userEvent.type(storyInput, 'Test story');
      await userEvent.click(screen.getByRole('button', { name: /Generate Tale/i }));

      await waitFor(() => {
        expect(screen.getByText('Export Test Story')).toBeInTheDocument();
      });

      // Export as PowerPoint
      const saveButton = await screen.findByRole('button', { name: /Save Tale/i });
      await userEvent.click(saveButton);
      await userEvent.click(screen.getByText(/Save as PowerPoint/i));

      // Verify title slide
      await waitFor(() => {
        const firstSlideCall = mockPptx.addSlide.mock.calls[0];
        expect(firstSlideCall).toBeDefined();
        
        // Check title slide content
        expect(mockSlide.addText).toHaveBeenCalledWith(
          'Export Test Story',
          expect.objectContaining({
            fontSize: expect.any(Number),
            bold: true
          })
        );
      });
    });

    it('should handle different image aspect ratios intelligently', async () => {
      renderApp();

      // Generate story with images
      const storyInput = await screen.findByPlaceholderText(/Enter your story here/i);
      await userEvent.type(storyInput, 'Test story');
      await userEvent.click(screen.getByRole('button', { name: /Generate Tale/i }));

      await waitFor(() => {
        expect(screen.getByText('Export Test Story')).toBeInTheDocument();
      });

      await userEvent.click(await screen.findByRole('button', { name: /Generate Images/i }));

      await waitFor(() => {
        expect(generateImageWithImagen).toHaveBeenCalledTimes(3);
      });

      // Export as PowerPoint
      const saveButton = await screen.findByRole('button', { name: /Save Tale/i });
      await userEvent.click(saveButton);
      await userEvent.click(screen.getByText(/Save as PowerPoint/i));

      // Verify image handling for different aspect ratios
      await waitFor(() => {
        // Should have called addImage for each page
        const imageCallsCount = mockSlide.addImage.mock.calls.length;
        expect(imageCallsCount).toBeGreaterThanOrEqual(3);
        
        // Check that images maintain aspect ratio
        mockSlide.addImage.mock.calls.forEach(call => {
          const imageConfig = call[0];
          expect(imageConfig).toHaveProperty('sizing');
          expect(imageConfig.sizing).toHaveProperty('type', 'contain');
        });
      });
    });

    it('should adapt text size based on content length', async () => {
      // Override mock to have varying text lengths
      const mockStreamWithLongText = {
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            callback(JSON.stringify({
              type: 'page',
              data: {
                pageNumber: 1,
                text: 'Short text',
                imagePrompt: 'Image 1'
              }
            }));
            callback(JSON.stringify({
              type: 'page',
              data: {
                pageNumber: 2,
                text: 'This is a much longer text that should trigger the dynamic font size adjustment feature to ensure all content fits nicely on the slide without overflow',
                imagePrompt: 'Image 2'
              }
            }));
          }
          if (event === 'end') callback();
          return mockStreamWithLongText;
        }),
        destroy: jest.fn()
      };

      generateTaleStream.mockResolvedValue(mockStreamWithLongText);
      renderApp();

      // Generate story
      const storyInput = await screen.findByPlaceholderText(/Enter your story here/i);
      await userEvent.type(storyInput, 'Test story');
      await userEvent.click(screen.getByRole('button', { name: /Generate Tale/i }));

      await waitFor(() => {
        expect(screen.getByText(/Short text/)).toBeInTheDocument();
      });

      // Export as PowerPoint
      const saveButton = await screen.findByRole('button', { name: /Save Tale/i });
      await userEvent.click(saveButton);
      await userEvent.click(screen.getByText(/Save as PowerPoint/i));

      // Verify dynamic font sizing
      await waitFor(() => {
        const textCalls = mockSlide.addText.mock.calls;
        
        // Find calls for different text lengths
        const shortTextCall = textCalls.find(call => call[0].includes('Short text'));
        const longTextCall = textCalls.find(call => call[0].includes('much longer text'));
        
        if (shortTextCall && longTextCall) {
          // Long text should have smaller font size
          expect(longTextCall[1].fontSize).toBeLessThan(shortTextCall[1].fontSize);
        }
      });
    });

    it('should handle PPTX export errors gracefully', async () => {
      mockPptx.write.mockRejectedValue(new Error('Export failed'));

      renderApp();

      // Generate story
      const storyInput = await screen.findByPlaceholderText(/Enter your story here/i);
      await userEvent.type(storyInput, 'Test story');
      await userEvent.click(screen.getByRole('button', { name: /Generate Tale/i }));

      await waitFor(() => {
        expect(screen.getByText('Export Test Story')).toBeInTheDocument();
      });

      // Try to export
      const saveButton = await screen.findByRole('button', { name: /Save Tale/i });
      await userEvent.click(saveButton);
      await userEvent.click(screen.getByText(/Save as PowerPoint/i));

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/Failed to export as PowerPoint/i)).toBeInTheDocument();
      });
    });
  });

  describe('Export Progress and Feedback', () => {
    beforeEach(async () => {
      await setupCompleteStoryWithImages();
    });

    it('should show export progress indicator', async () => {
      // Delay PPTX generation
      mockPptx.write.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(new Blob(['pptx'])), 1000))
      );

      renderApp();

      // Generate story with images
      const storyInput = await screen.findByPlaceholderText(/Enter your story here/i);
      await userEvent.type(storyInput, 'Test story');
      await userEvent.click(screen.getByRole('button', { name: /Generate Tale/i }));

      await waitFor(() => {
        expect(screen.getByText('Export Test Story')).toBeInTheDocument();
      });

      await userEvent.click(await screen.findByRole('button', { name: /Generate Images/i }));

      // Start export
      const saveButton = await screen.findByRole('button', { name: /Save Tale/i });
      await userEvent.click(saveButton);
      await userEvent.click(screen.getByText(/Save as PowerPoint/i));

      // Should show progress
      expect(screen.getByText(/Exporting.../i)).toBeInTheDocument();

      // Progress should disappear after completion
      await waitFor(() => {
        expect(screen.queryByText(/Exporting.../i)).not.toBeInTheDocument();
      }, { timeout: 2000 });
    });

    it('should show success message after export', async () => {
      renderApp();

      // Generate story
      const storyInput = await screen.findByPlaceholderText(/Enter your story here/i);
      await userEvent.type(storyInput, 'Test story');
      await userEvent.click(screen.getByRole('button', { name: /Generate Tale/i }));

      await waitFor(() => {
        expect(screen.getByText('Export Test Story')).toBeInTheDocument();
      });

      // Export
      const saveButton = await screen.findByRole('button', { name: /Save Tale/i });
      await userEvent.click(saveButton);
      await userEvent.click(screen.getByText(/Save as HTML/i));

      // Should show success message
      await waitFor(() => {
        expect(screen.getByText(/Successfully exported/i)).toBeInTheDocument();
      });
    });
  });

  describe('Export with Missing Images', () => {
    it('should handle export when some images failed to generate', async () => {
      await setupCompleteStoryWithImages();
      
      // Override to simulate one failed image
      generateImageWithImagen
        .mockReset()
        .mockResolvedValueOnce({
          success: true,
          imageUrl: 'https://example.com/image1.png'
        })
        .mockResolvedValueOnce({
          success: false,
          error: 'Generation failed'
        })
        .mockResolvedValueOnce({
          success: true,
          imageUrl: 'https://example.com/image3.png'
        });

      renderApp();

      // Generate story and images
      const storyInput = await screen.findByPlaceholderText(/Enter your story here/i);
      await userEvent.type(storyInput, 'Test story');
      await userEvent.click(screen.getByRole('button', { name: /Generate Tale/i }));

      await waitFor(() => {
        expect(screen.getByText('Export Test Story')).toBeInTheDocument();
      });

      await userEvent.click(await screen.findByRole('button', { name: /Generate Images/i }));

      // Export as PPTX
      const saveButton = await screen.findByRole('button', { name: /Save Tale/i });
      await userEvent.click(saveButton);
      await userEvent.click(screen.getByText(/Save as PowerPoint/i));

      // Should complete export with placeholder for missing image
      await waitFor(() => {
        expect(mockPptx.write).toHaveBeenCalled();
        
        // Verify that slides were created for all pages
        expect(mockPptx.addSlide).toHaveBeenCalledTimes(4); // Title + 3 pages
      });
    });
  });

  describe('Filename Generation', () => {
    it('should generate appropriate filenames for exports', async () => {
      await setupCompleteStoryWithImages();
      
      const mockSetAttribute = jest.fn();
      jest.spyOn(document, 'createElement').mockImplementation((tagName) => {
        if (tagName === 'a') {
          return { 
            click: jest.fn(), 
            setAttribute: mockSetAttribute,
            href: '',
            download: ''
          };
        }
        return document.createElement(tagName);
      });

      renderApp();

      // Generate story with special characters in title
      const storyInput = await screen.findByPlaceholderText(/Enter your story here/i);
      await userEvent.type(storyInput, 'Test story');
      await userEvent.click(screen.getByRole('button', { name: /Generate Tale/i }));

      await waitFor(() => {
        expect(screen.getByText('Export Test Story')).toBeInTheDocument();
      });

      // Export as HTML
      const saveButton = await screen.findByRole('button', { name: /Save Tale/i });
      await userEvent.click(saveButton);
      await userEvent.click(screen.getByText(/Save as HTML/i));

      // Check filename format
      await waitFor(() => {
        const downloadCall = mockSetAttribute.mock.calls.find(call => call[0] === 'download');
        expect(downloadCall[1]).toMatch(/Export_Test_Story_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.html/);
      });
    });

    it('should sanitize special characters in filenames', async () => {
      // Setup story with special characters
      const mockStreamSpecial = {
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            callback(JSON.stringify({
              type: 'story_title',
              data: 'My Story: Part 2 / The "Adventure"'
            }));
            callback(JSON.stringify({
              type: 'complete',
              data: { message: 'Complete' }
            }));
          }
          if (event === 'end') callback();
          return mockStreamSpecial;
        }),
        destroy: jest.fn()
      };

      generateTaleStream.mockResolvedValue(mockStreamSpecial);
      
      const mockSetAttribute = jest.fn();
      jest.spyOn(document, 'createElement').mockImplementation((tagName) => {
        if (tagName === 'a') {
          return { 
            click: jest.fn(), 
            setAttribute: mockSetAttribute,
            href: '',
            download: ''
          };
        }
        return document.createElement(tagName);
      });

      renderApp();

      // Generate story
      const storyInput = await screen.findByPlaceholderText(/Enter your story here/i);
      await userEvent.type(storyInput, 'Test story');
      await userEvent.click(screen.getByRole('button', { name: /Generate Tale/i }));

      await waitFor(() => {
        expect(screen.getByText('My Story: Part 2 / The "Adventure"')).toBeInTheDocument();
      });

      // Export
      const saveButton = await screen.findByRole('button', { name: /Save Tale/i });
      await userEvent.click(saveButton);
      await userEvent.click(screen.getByText(/Save as HTML/i));

      // Check sanitized filename
      await waitFor(() => {
        const downloadCall = mockSetAttribute.mock.calls.find(call => call[0] === 'download');
        expect(downloadCall[1]).toMatch(/My_Story_Part_2_The_Adventure_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.html/);
        expect(downloadCall[1]).not.toContain(':');
        expect(downloadCall[1]).not.toContain('/');
        expect(downloadCall[1]).not.toContain('"');
      });
    });
  });
});