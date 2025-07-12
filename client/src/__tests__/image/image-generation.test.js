import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import App from '../../App';
import { generateTaleStream, generateImageWithImagen } from '../../api';
import { onAuthStateChanged } from 'firebase/auth';
import stateManager from '../../stateManager';

// Mock dependencies
jest.mock('../../api');
jest.mock('firebase/auth');
jest.mock('../../stateManager');

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

// Helper to setup initial state with generated story
const setupGeneratedStory = async () => {
  const mockStream = {
    on: jest.fn((event, callback) => {
      if (event === 'data') {
        callback(JSON.stringify({
          type: 'story_title',
          data: 'Test Story'
        }));
        callback(JSON.stringify({
          type: 'page',
          data: {
            pageNumber: 1,
            text: 'Page 1 content',
            imagePrompt: 'A beautiful landscape'
          }
        }));
        callback(JSON.stringify({
          type: 'page',
          data: {
            pageNumber: 2,
            text: 'Page 2 content',
            imagePrompt: 'A character portrait'
          }
        }));
        callback(JSON.stringify({
          type: 'all_characters',
          data: {
            'Hero': { appearance: 'Brave warrior' },
            'Villain': { appearance: 'Dark sorcerer' }
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
};

describe('Image Generation with Multiple Models', () => {
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
  });

  describe('Model Selection', () => {
    it('should display all available image models', async () => {
      renderApp();

      await waitFor(() => {
        expect(screen.getByText('Imagen4-fast')).toBeInTheDocument();
        expect(screen.getByText('Imagen4')).toBeInTheDocument();
        expect(screen.getByText('Imagen3')).toBeInTheDocument();
      });
    });

    it('should have Imagen4-fast as default model', async () => {
      renderApp();

      const defaultModel = await screen.findByText('Imagen4-fast');
      expect(defaultModel.parentElement).toHaveClass('selected');
    });

    it('should allow model selection before generation', async () => {
      renderApp();

      const imagen3Button = await screen.findByText('Imagen3');
      await userEvent.click(imagen3Button);

      expect(imagen3Button.parentElement).toHaveClass('selected');
      
      // Verify other models are not selected
      expect(screen.getByText('Imagen4-fast').parentElement).not.toHaveClass('selected');
      expect(screen.getByText('Imagen4').parentElement).not.toHaveClass('selected');
    });
  });

  describe('Image Generation Process', () => {
    it('should generate images with selected model', async () => {
      await setupGeneratedStory();
      generateImageWithImagen.mockResolvedValue({
        success: true,
        imageUrl: 'https://example.com/generated-image.png',
        model: 'imagen4-fast'
      });

      renderApp();

      // Generate story first
      const storyInput = await screen.findByPlaceholderText(/Enter your story here/i);
      await userEvent.type(storyInput, 'Test story');
      await userEvent.click(screen.getByRole('button', { name: /Generate Tale/i }));

      // Wait for story generation to complete
      await waitFor(() => {
        expect(screen.getByText('Test Story')).toBeInTheDocument();
      });

      // Generate images button should appear
      const generateImagesButton = await screen.findByRole('button', { name: /Generate Images/i });
      await userEvent.click(generateImagesButton);

      // Should call image generation API with correct model
      await waitFor(() => {
        expect(generateImageWithImagen).toHaveBeenCalledWith(
          expect.objectContaining({
            model: 'imagen4-fast',
            prompt: expect.any(String),
            aspectRatio: '1:1'
          }),
          'mock-token'
        );
      });
    });

    it('should generate images with different models', async () => {
      await setupGeneratedStory();
      
      const models = ['imagen4-fast', 'imagen4', 'imagen3'];
      
      for (const model of models) {
        jest.clearAllMocks();
        generateImageWithImagen.mockResolvedValue({
          success: true,
          imageUrl: `https://example.com/${model}-image.png`,
          model: model
        });

        const { unmount } = renderApp();

        // Select model
        const modelButton = await screen.findByText(model === 'imagen4-fast' ? 'Imagen4-fast' : 
                                                   model === 'imagen4' ? 'Imagen4' : 'Imagen3');
        await userEvent.click(modelButton);

        // Generate story
        const storyInput = screen.getByPlaceholderText(/Enter your story here/i);
        await userEvent.type(storyInput, 'Test story');
        await userEvent.click(screen.getByRole('button', { name: /Generate Tale/i }));

        await waitFor(() => {
          expect(screen.getByText('Test Story')).toBeInTheDocument();
        });

        // Generate images
        const generateImagesButton = await screen.findByRole('button', { name: /Generate Images/i });
        await userEvent.click(generateImagesButton);

        // Verify correct model was used
        await waitFor(() => {
          expect(generateImageWithImagen).toHaveBeenCalledWith(
            expect.objectContaining({
              model: model
            }),
            'mock-token'
          );
        });

        unmount();
      }
    });

    it('should handle different aspect ratios with each model', async () => {
      await setupGeneratedStory();
      generateImageWithImagen.mockResolvedValue({
        success: true,
        imageUrl: 'https://example.com/image.png'
      });

      renderApp();

      // Select 16:9 aspect ratio
      const ratio16_9 = await screen.findByText('16:9');
      await userEvent.click(ratio16_9);

      // Select Imagen4 model
      const imagen4Button = screen.getByText('Imagen4');
      await userEvent.click(imagen4Button);

      // Generate story
      const storyInput = screen.getByPlaceholderText(/Enter your story here/i);
      await userEvent.type(storyInput, 'Test story');
      await userEvent.click(screen.getByRole('button', { name: /Generate Tale/i }));

      await waitFor(() => {
        expect(screen.getByText('Test Story')).toBeInTheDocument();
      });

      // Generate images
      const generateImagesButton = await screen.findByRole('button', { name: /Generate Images/i });
      await userEvent.click(generateImagesButton);

      // Verify aspect ratio and model
      await waitFor(() => {
        expect(generateImageWithImagen).toHaveBeenCalledWith(
          expect.objectContaining({
            model: 'imagen4',
            aspectRatio: '16:9'
          }),
          'mock-token'
        );
      });
    });
  });

  describe('Image Generation Failure Handling', () => {
    beforeEach(async () => {
      await setupGeneratedStory();
    });

    it('should handle content safety failures', async () => {
      generateImageWithImagen.mockResolvedValue({
        success: false,
        error: 'Content safety violation',
        reason: 'SAFETY_FILTER',
        model: 'imagen4-fast'
      });

      renderApp();

      // Generate story
      const storyInput = await screen.findByPlaceholderText(/Enter your story here/i);
      await userEvent.type(storyInput, 'Test story');
      await userEvent.click(screen.getByRole('button', { name: /Generate Tale/i }));

      await waitFor(() => {
        expect(screen.getByText('Test Story')).toBeInTheDocument();
      });

      // Generate images
      const generateImagesButton = await screen.findByRole('button', { name: /Generate Images/i });
      await userEvent.click(generateImagesButton);

      // Should show safety error
      await waitFor(() => {
        expect(screen.getByText(/Content safety violation/i)).toBeInTheDocument();
      });
    });

    it('should handle model-specific failures', async () => {
      const modelFailures = [
        { model: 'imagen4-fast', error: 'Model temporarily unavailable' },
        { model: 'imagen4', error: 'Quota exceeded for Imagen4' },
        { model: 'imagen3', error: 'Imagen3 deprecated, please use newer model' }
      ];

      for (const { model, error } of modelFailures) {
        jest.clearAllMocks();
        generateImageWithImagen.mockResolvedValue({
          success: false,
          error: error,
          model: model
        });

        const { unmount } = renderApp();

        // Select model
        const modelButton = await screen.findByText(
          model === 'imagen4-fast' ? 'Imagen4-fast' : 
          model === 'imagen4' ? 'Imagen4' : 'Imagen3'
        );
        await userEvent.click(modelButton);

        // Generate story
        const storyInput = screen.getByPlaceholderText(/Enter your story here/i);
        await userEvent.type(storyInput, 'Test story');
        await userEvent.click(screen.getByRole('button', { name: /Generate Tale/i }));

        await waitFor(() => {
          expect(screen.getByText('Test Story')).toBeInTheDocument();
        });

        // Generate images
        const generateImagesButton = await screen.findByRole('button', { name: /Generate Images/i });
        await userEvent.click(generateImagesButton);

        // Should show model-specific error
        await waitFor(() => {
          expect(screen.getByText(new RegExp(error, 'i'))).toBeInTheDocument();
        });

        unmount();
      }
    });

    it('should allow retry with different model after failure', async () => {
      // First attempt fails with imagen4-fast
      generateImageWithImagen.mockResolvedValueOnce({
        success: false,
        error: 'Generation failed',
        model: 'imagen4-fast'
      });

      // Second attempt succeeds with imagen3
      generateImageWithImagen.mockResolvedValueOnce({
        success: true,
        imageUrl: 'https://example.com/success.png',
        model: 'imagen3'
      });

      renderApp();

      // Generate story
      const storyInput = await screen.findByPlaceholderText(/Enter your story here/i);
      await userEvent.type(storyInput, 'Test story');
      await userEvent.click(screen.getByRole('button', { name: /Generate Tale/i }));

      await waitFor(() => {
        expect(screen.getByText('Test Story')).toBeInTheDocument();
      });

      // First attempt with default model
      const generateImagesButton = await screen.findByRole('button', { name: /Generate Images/i });
      await userEvent.click(generateImagesButton);

      await waitFor(() => {
        expect(screen.getByText(/Generation failed/i)).toBeInTheDocument();
      });

      // Switch to Imagen3
      const imagen3Button = screen.getByText('Imagen3');
      await userEvent.click(imagen3Button);

      // Retry generation
      const retryButton = await screen.findByRole('button', { name: /Retry/i });
      await userEvent.click(retryButton);

      // Should succeed with new model
      await waitFor(() => {
        expect(generateImageWithImagen).toHaveBeenLastCalledWith(
          expect.objectContaining({
            model: 'imagen3'
          }),
          'mock-token'
        );
      });
    });
  });

  describe('Batch Image Generation', () => {
    beforeEach(async () => {
      await setupGeneratedStory();
    });

    it('should generate images for all pages', async () => {
      generateImageWithImagen.mockResolvedValue({
        success: true,
        imageUrl: 'https://example.com/image.png'
      });

      renderApp();

      // Generate story
      const storyInput = await screen.findByPlaceholderText(/Enter your story here/i);
      await userEvent.type(storyInput, 'Test story');
      await userEvent.click(screen.getByRole('button', { name: /Generate Tale/i }));

      await waitFor(() => {
        expect(screen.getByText('Test Story')).toBeInTheDocument();
      });

      // Generate images
      const generateImagesButton = await screen.findByRole('button', { name: /Generate Images/i });
      await userEvent.click(generateImagesButton);

      // Should generate images for both pages
      await waitFor(() => {
        expect(generateImageWithImagen).toHaveBeenCalledTimes(2);
      });

      // Verify prompts for each page
      expect(generateImageWithImagen).toHaveBeenNthCalledWith(1,
        expect.objectContaining({
          prompt: expect.stringContaining('A beautiful landscape')
        }),
        'mock-token'
      );

      expect(generateImageWithImagen).toHaveBeenNthCalledWith(2,
        expect.objectContaining({
          prompt: expect.stringContaining('A character portrait')
        }),
        'mock-token'
      );
    });

    it('should show progress during batch generation', async () => {
      let resolveFirst, resolveSecond;
      const firstPromise = new Promise(resolve => { resolveFirst = resolve; });
      const secondPromise = new Promise(resolve => { resolveSecond = resolve; });

      generateImageWithImagen
        .mockReturnValueOnce(firstPromise)
        .mockReturnValueOnce(secondPromise);

      renderApp();

      // Generate story
      const storyInput = await screen.findByPlaceholderText(/Enter your story here/i);
      await userEvent.type(storyInput, 'Test story');
      await userEvent.click(screen.getByRole('button', { name: /Generate Tale/i }));

      await waitFor(() => {
        expect(screen.getByText('Test Story')).toBeInTheDocument();
      });

      // Start image generation
      const generateImagesButton = await screen.findByRole('button', { name: /Generate Images/i });
      await userEvent.click(generateImagesButton);

      // Should show progress
      await waitFor(() => {
        expect(screen.getByText(/Generating images: 0\/2/i)).toBeInTheDocument();
      });

      // Complete first image
      resolveFirst({ success: true, imageUrl: 'https://example.com/1.png' });

      await waitFor(() => {
        expect(screen.getByText(/Generating images: 1\/2/i)).toBeInTheDocument();
      });

      // Complete second image
      resolveSecond({ success: true, imageUrl: 'https://example.com/2.png' });

      await waitFor(() => {
        expect(screen.queryByText(/Generating images:/i)).not.toBeInTheDocument();
      });
    });

    it('should handle partial failures in batch generation', async () => {
      generateImageWithImagen
        .mockResolvedValueOnce({ success: true, imageUrl: 'https://example.com/1.png' })
        .mockResolvedValueOnce({ success: false, error: 'Safety filter triggered' });

      renderApp();

      // Generate story
      const storyInput = await screen.findByPlaceholderText(/Enter your story here/i);
      await userEvent.type(storyInput, 'Test story');
      await userEvent.click(screen.getByRole('button', { name: /Generate Tale/i }));

      await waitFor(() => {
        expect(screen.getByText('Test Story')).toBeInTheDocument();
      });

      // Generate images
      const generateImagesButton = await screen.findByRole('button', { name: /Generate Images/i });
      await userEvent.click(generateImagesButton);

      // Should show partial success message
      await waitFor(() => {
        expect(screen.getByText(/1 of 2 images generated successfully/i)).toBeInTheDocument();
      });

      // Failed page should show error state
      expect(screen.getByText(/Safety filter triggered/i)).toBeInTheDocument();
    });
  });

  describe('Single Page Regeneration', () => {
    beforeEach(async () => {
      await setupGeneratedStory();
      generateImageWithImagen.mockResolvedValue({
        success: true,
        imageUrl: 'https://example.com/image.png'
      });
    });

    it('should allow regeneration of individual page images', async () => {
      renderApp();

      // Generate story and images
      const storyInput = await screen.findByPlaceholderText(/Enter your story here/i);
      await userEvent.type(storyInput, 'Test story');
      await userEvent.click(screen.getByRole('button', { name: /Generate Tale/i }));

      await waitFor(() => {
        expect(screen.getByText('Test Story')).toBeInTheDocument();
      });

      await userEvent.click(await screen.findByRole('button', { name: /Generate Images/i }));

      // Wait for initial generation
      await waitFor(() => {
        expect(generateImageWithImagen).toHaveBeenCalledTimes(2);
      });

      jest.clearAllMocks();

      // Find regenerate button for first page
      const regenerateButtons = await screen.findAllByRole('button', { name: /Regenerate/i });
      await userEvent.click(regenerateButtons[0]);

      // Should only regenerate one image
      await waitFor(() => {
        expect(generateImageWithImagen).toHaveBeenCalledTimes(1);
        expect(generateImageWithImagen).toHaveBeenCalledWith(
          expect.objectContaining({
            prompt: expect.stringContaining('A beautiful landscape')
          }),
          'mock-token'
        );
      });
    });

    it('should allow prompt editing before regeneration', async () => {
      renderApp();

      // Generate story and images
      const storyInput = await screen.findByPlaceholderText(/Enter your story here/i);
      await userEvent.type(storyInput, 'Test story');
      await userEvent.click(screen.getByRole('button', { name: /Generate Tale/i }));

      await waitFor(() => {
        expect(screen.getByText('Test Story')).toBeInTheDocument();
      });

      await userEvent.click(await screen.findByRole('button', { name: /Generate Images/i }));

      // Wait for initial generation
      await waitFor(() => {
        expect(generateImageWithImagen).toHaveBeenCalledTimes(2);
      });

      // Edit prompt for first page
      const editButtons = await screen.findAllByRole('button', { name: /Edit Prompt/i });
      await userEvent.click(editButtons[0]);

      const promptInput = await screen.findByDisplayValue(/A beautiful landscape/i);
      await userEvent.clear(promptInput);
      await userEvent.type(promptInput, 'A magical forest at sunset');

      // Save and regenerate
      const saveButton = screen.getByRole('button', { name: /Save/i });
      await userEvent.click(saveButton);

      jest.clearAllMocks();

      const regenerateButton = screen.getByRole('button', { name: /Regenerate/i });
      await userEvent.click(regenerateButton);

      // Should use updated prompt
      await waitFor(() => {
        expect(generateImageWithImagen).toHaveBeenCalledWith(
          expect.objectContaining({
            prompt: expect.stringContaining('A magical forest at sunset')
          }),
          'mock-token'
        );
      });
    });
  });

  describe('Model Performance Tracking', () => {
    it('should track generation time for each model', async () => {
      await setupGeneratedStory();
      
      // Mock different response times for models
      generateImageWithImagen
        .mockImplementation((params) => {
          const delay = params.model === 'imagen4-fast' ? 100 : 
                       params.model === 'imagen4' ? 300 : 500;
          return new Promise(resolve => {
            setTimeout(() => {
              resolve({
                success: true,
                imageUrl: `https://example.com/${params.model}.png`,
                generationTime: delay
              });
            }, delay);
          });
        });

      renderApp();

      // Test with Imagen4-fast
      const storyInput = await screen.findByPlaceholderText(/Enter your story here/i);
      await userEvent.type(storyInput, 'Test story');
      await userEvent.click(screen.getByRole('button', { name: /Generate Tale/i }));

      await waitFor(() => {
        expect(screen.getByText('Test Story')).toBeInTheDocument();
      });

      const generateImagesButton = await screen.findByRole('button', { name: /Generate Images/i });
      await userEvent.click(generateImagesButton);

      // Should show generation time
      await waitFor(() => {
        expect(screen.getByText(/Generation time: \d+ms/i)).toBeInTheDocument();
      }, { timeout: 2000 });
    });
  });

  describe('Advanced Image Generation Settings', () => {
    beforeEach(async () => {
      await setupGeneratedStory();
    });

    it('should support negative prompts', async () => {
      generateImageWithImagen.mockResolvedValue({
        success: true,
        imageUrl: 'https://example.com/image.png'
      });

      renderApp();

      // Generate story
      const storyInput = await screen.findByPlaceholderText(/Enter your story here/i);
      await userEvent.type(storyInput, 'Test story');
      await userEvent.click(screen.getByRole('button', { name: /Generate Tale/i }));

      await waitFor(() => {
        expect(screen.getByText('Test Story')).toBeInTheDocument();
      });

      // Open advanced settings
      const advancedButton = await screen.findByRole('button', { name: /Advanced Settings/i });
      await userEvent.click(advancedButton);

      // Add negative prompt
      const negativePromptInput = await screen.findByPlaceholderText(/Negative prompt/i);
      await userEvent.type(negativePromptInput, 'violence, gore, scary');

      // Generate images
      const generateImagesButton = screen.getByRole('button', { name: /Generate Images/i });
      await userEvent.click(generateImagesButton);

      // Should include negative prompt
      await waitFor(() => {
        expect(generateImageWithImagen).toHaveBeenCalledWith(
          expect.objectContaining({
            negativePrompt: 'violence, gore, scary'
          }),
          'mock-token'
        );
      });
    });

    it('should support safety filter levels', async () => {
      generateImageWithImagen.mockResolvedValue({
        success: true,
        imageUrl: 'https://example.com/image.png'
      });

      renderApp();

      // Generate story
      const storyInput = await screen.findByPlaceholderText(/Enter your story here/i);
      await userEvent.type(storyInput, 'Test story');
      await userEvent.click(screen.getByRole('button', { name: /Generate Tale/i }));

      await waitFor(() => {
        expect(screen.getByText('Test Story')).toBeInTheDocument();
      });

      // Open advanced settings
      const advancedButton = await screen.findByRole('button', { name: /Advanced Settings/i });
      await userEvent.click(advancedButton);

      // Change safety level
      const safetySelect = await screen.findByLabelText(/Safety Level/i);
      await userEvent.selectOptions(safetySelect, 'strict');

      // Generate images
      const generateImagesButton = screen.getByRole('button', { name: /Generate Images/i });
      await userEvent.click(generateImagesButton);

      // Should include safety level
      await waitFor(() => {
        expect(generateImageWithImagen).toHaveBeenCalledWith(
          expect.objectContaining({
            safetyFilterLevel: 'strict'
          }),
          'mock-token'
        );
      });
    });
  });
});