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

// Helper to setup initial state with generated story and images
const setupCompleteStory = async () => {
  const mockStream = {
    on: jest.fn((event, callback) => {
      if (event === 'data') {
        callback(JSON.stringify({
          type: 'story_title',
          data: 'Editable Story'
        }));
        callback(JSON.stringify({
          type: 'page',
          data: {
            pageNumber: 1,
            text: 'Once upon a time in a magical forest',
            imagePrompt: 'A magical forest with tall trees'
          }
        }));
        callback(JSON.stringify({
          type: 'page',
          data: {
            pageNumber: 2,
            text: 'The hero began their journey',
            imagePrompt: 'A brave hero setting out on adventure'
          }
        }));
        callback(JSON.stringify({
          type: 'all_characters',
          data: {
            'Hero': { 
              appearance: 'Young adventurer with brown hair',
              clothing: 'Green tunic and leather boots',
              personality: 'Brave and curious'
            }
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
  generateImageWithImagen.mockResolvedValue({
    success: true,
    imageUrl: 'https://example.com/generated-image.png'
  });
};

describe('Interactive Editing Features', () => {
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

  describe('Title Editing', () => {
    beforeEach(async () => {
      await setupCompleteStory();
    });

    it('should allow editing story title', async () => {
      renderApp();

      // Generate story
      const storyInput = await screen.findByPlaceholderText(/Enter your story here/i);
      await userEvent.type(storyInput, 'Test story');
      await userEvent.click(screen.getByRole('button', { name: /Generate Tale/i }));

      // Wait for story generation
      await waitFor(() => {
        expect(screen.getByText('Editable Story')).toBeInTheDocument();
      });

      // Click on title to edit
      const titleElement = screen.getByText('Editable Story');
      await userEvent.click(titleElement);

      // Should show edit input
      const titleInput = await screen.findByDisplayValue('Editable Story');
      await userEvent.clear(titleInput);
      await userEvent.type(titleInput, 'My Amazing Adventure');

      // Save changes
      fireEvent.blur(titleInput);

      // Title should be updated
      await waitFor(() => {
        expect(screen.getByText('My Amazing Adventure')).toBeInTheDocument();
        expect(screen.queryByDisplayValue('Editable Story')).not.toBeInTheDocument();
      });

      // Should save state
      expect(stateManager.saveState).toHaveBeenCalledWith(
        expect.objectContaining({
          storyTitle: 'My Amazing Adventure'
        })
      );
    });

    it('should cancel title editing on Escape key', async () => {
      renderApp();

      // Generate story
      const storyInput = await screen.findByPlaceholderText(/Enter your story here/i);
      await userEvent.type(storyInput, 'Test story');
      await userEvent.click(screen.getByRole('button', { name: /Generate Tale/i }));

      await waitFor(() => {
        expect(screen.getByText('Editable Story')).toBeInTheDocument();
      });

      // Start editing
      const titleElement = screen.getByText('Editable Story');
      await userEvent.click(titleElement);

      const titleInput = await screen.findByDisplayValue('Editable Story');
      await userEvent.clear(titleInput);
      await userEvent.type(titleInput, 'Changed Title');

      // Press Escape
      fireEvent.keyDown(titleInput, { key: 'Escape', code: 'Escape' });

      // Should revert to original title
      await waitFor(() => {
        expect(screen.getByText('Editable Story')).toBeInTheDocument();
        expect(screen.queryByText('Changed Title')).not.toBeInTheDocument();
      });
    });
  });

  describe('Page Text Editing', () => {
    beforeEach(async () => {
      await setupCompleteStory();
    });

    it('should allow editing page text content', async () => {
      renderApp();

      // Generate story
      const storyInput = await screen.findByPlaceholderText(/Enter your story here/i);
      await userEvent.type(storyInput, 'Test story');
      await userEvent.click(screen.getByRole('button', { name: /Generate Tale/i }));

      await waitFor(() => {
        expect(screen.getByText(/Once upon a time in a magical forest/)).toBeInTheDocument();
      });

      // Find edit button for first page
      const editButtons = await screen.findAllByRole('button', { name: /Edit Text/i });
      await userEvent.click(editButtons[0]);

      // Should show text editor
      const textEditor = await screen.findByDisplayValue(/Once upon a time in a magical forest/);
      await userEvent.clear(textEditor);
      await userEvent.type(textEditor, 'In a land far, far away');

      // Save changes
      const saveButton = screen.getByRole('button', { name: /Save/i });
      await userEvent.click(saveButton);

      // Text should be updated
      await waitFor(() => {
        expect(screen.getByText(/In a land far, far away/)).toBeInTheDocument();
        expect(screen.queryByText(/Once upon a time in a magical forest/)).not.toBeInTheDocument();
      });
    });

    it('should validate text length limits', async () => {
      renderApp();

      // Generate story
      const storyInput = await screen.findByPlaceholderText(/Enter your story here/i);
      await userEvent.type(storyInput, 'Test story');
      await userEvent.click(screen.getByRole('button', { name: /Generate Tale/i }));

      await waitFor(() => {
        expect(screen.getByText(/Once upon a time in a magical forest/)).toBeInTheDocument();
      });

      // Edit first page
      const editButtons = await screen.findAllByRole('button', { name: /Edit Text/i });
      await userEvent.click(editButtons[0]);

      const textEditor = await screen.findByDisplayValue(/Once upon a time in a magical forest/);
      const longText = 'a'.repeat(501); // Assuming 500 char limit per page
      await userEvent.clear(textEditor);
      await userEvent.type(textEditor, longText);

      // Should show character count warning
      expect(screen.getByText(/501 \/ 500/)).toBeInTheDocument();
      expect(screen.getByText(/501 \/ 500/)).toHaveClass('char-limit-exceeded');
    });
  });

  describe('Image Prompt Editing', () => {
    beforeEach(async () => {
      await setupCompleteStory();
    });

    it('should allow editing image prompts', async () => {
      renderApp();

      // Generate story and images
      const storyInput = await screen.findByPlaceholderText(/Enter your story here/i);
      await userEvent.type(storyInput, 'Test story');
      await userEvent.click(screen.getByRole('button', { name: /Generate Tale/i }));

      await waitFor(() => {
        expect(screen.getByText('Editable Story')).toBeInTheDocument();
      });

      // Generate images
      await userEvent.click(await screen.findByRole('button', { name: /Generate Images/i }));

      await waitFor(() => {
        expect(generateImageWithImagen).toHaveBeenCalledTimes(2);
      });

      // Edit prompt for first page
      const editPromptButtons = await screen.findAllByRole('button', { name: /Edit Prompt/i });
      await userEvent.click(editPromptButtons[0]);

      const promptEditor = await screen.findByDisplayValue(/A magical forest with tall trees/);
      await userEvent.clear(promptEditor);
      await userEvent.type(promptEditor, 'An enchanted forest at twilight with glowing mushrooms');

      // Save and regenerate
      const saveButton = screen.getByRole('button', { name: /Save & Regenerate/i });
      await userEvent.click(saveButton);

      // Should regenerate with new prompt
      await waitFor(() => {
        expect(generateImageWithImagen).toHaveBeenLastCalledWith(
          expect.objectContaining({
            prompt: expect.stringContaining('An enchanted forest at twilight with glowing mushrooms')
          }),
          'mock-token'
        );
      });
    });

    it('should show prompt preview before regeneration', async () => {
      renderApp();

      // Generate story and images
      const storyInput = await screen.findByPlaceholderText(/Enter your story here/i);
      await userEvent.type(storyInput, 'Test story');
      await userEvent.click(screen.getByRole('button', { name: /Generate Tale/i }));

      await waitFor(() => {
        expect(screen.getByText('Editable Story')).toBeInTheDocument();
      });

      await userEvent.click(await screen.findByRole('button', { name: /Generate Images/i }));

      // Edit prompt
      const editPromptButtons = await screen.findAllByRole('button', { name: /Edit Prompt/i });
      await userEvent.click(editPromptButtons[0]);

      const promptEditor = await screen.findByDisplayValue(/A magical forest with tall trees/);
      await userEvent.clear(promptEditor);
      await userEvent.type(promptEditor, 'New prompt description');

      // Should show preview
      expect(screen.getByText(/Preview:/)).toBeInTheDocument();
      expect(screen.getByText(/New prompt description/)).toBeInTheDocument();
    });
  });

  describe('Character Editing', () => {
    beforeEach(async () => {
      await setupCompleteStory();
    });

    it('should allow editing character descriptions', async () => {
      renderApp();

      // Generate story
      const storyInput = await screen.findByPlaceholderText(/Enter your story here/i);
      await userEvent.type(storyInput, 'Test story');
      await userEvent.click(screen.getByRole('button', { name: /Generate Tale/i }));

      await waitFor(() => {
        expect(screen.getByText(/Characters:/)).toBeInTheDocument();
        expect(screen.getByText(/Hero/)).toBeInTheDocument();
      });

      // Edit character
      const editCharButton = await screen.findByRole('button', { name: /Edit Hero/i });
      await userEvent.click(editCharButton);

      // Edit appearance
      const appearanceInput = await screen.findByLabelText(/Appearance:/i);
      await userEvent.clear(appearanceInput);
      await userEvent.type(appearanceInput, 'Tall adventurer with red hair');

      // Edit clothing
      const clothingInput = await screen.findByLabelText(/Clothing:/i);
      await userEvent.clear(clothingInput);
      await userEvent.type(clothingInput, 'Blue cloak and silver armor');

      // Save changes
      const saveButton = screen.getByRole('button', { name: /Save Character/i });
      await userEvent.click(saveButton);

      // Should update character info
      await waitFor(() => {
        expect(stateManager.saveState).toHaveBeenCalledWith(
          expect.objectContaining({
            allCharacters: expect.objectContaining({
              'Hero': expect.objectContaining({
                appearance: 'Tall adventurer with red hair',
                clothing: 'Blue cloak and silver armor'
              })
            })
          })
        );
      });
    });

    it('should add new characters', async () => {
      renderApp();

      // Generate story
      const storyInput = await screen.findByPlaceholderText(/Enter your story here/i);
      await userEvent.type(storyInput, 'Test story');
      await userEvent.click(screen.getByRole('button', { name: /Generate Tale/i }));

      await waitFor(() => {
        expect(screen.getByText(/Characters:/)).toBeInTheDocument();
      });

      // Add new character
      const addCharButton = await screen.findByRole('button', { name: /Add Character/i });
      await userEvent.click(addCharButton);

      // Fill in character details
      const nameInput = await screen.findByLabelText(/Character Name:/i);
      await userEvent.type(nameInput, 'Wizard');

      const appearanceInput = await screen.findByLabelText(/Appearance:/i);
      await userEvent.type(appearanceInput, 'Old man with long white beard');

      const clothingInput = await screen.findByLabelText(/Clothing:/i);
      await userEvent.type(clothingInput, 'Purple robes with stars');

      const personalityInput = await screen.findByLabelText(/Personality:/i);
      await userEvent.type(personalityInput, 'Wise and mysterious');

      // Save new character
      const saveButton = screen.getByRole('button', { name: /Add/i });
      await userEvent.click(saveButton);

      // Should show new character
      await waitFor(() => {
        expect(screen.getByText(/Wizard/)).toBeInTheDocument();
      });
    });

    it('should delete characters', async () => {
      renderApp();

      // Generate story
      const storyInput = await screen.findByPlaceholderText(/Enter your story here/i);
      await userEvent.type(storyInput, 'Test story');
      await userEvent.click(screen.getByRole('button', { name: /Generate Tale/i }));

      await waitFor(() => {
        expect(screen.getByText(/Hero/)).toBeInTheDocument();
      });

      // Delete character
      const deleteButton = await screen.findByRole('button', { name: /Delete Hero/i });
      await userEvent.click(deleteButton);

      // Confirm deletion
      const confirmButton = await screen.findByRole('button', { name: /Confirm Delete/i });
      await userEvent.click(confirmButton);

      // Character should be removed
      await waitFor(() => {
        expect(screen.queryByText(/Hero/)).not.toBeInTheDocument();
      });
    });
  });

  describe('Real-time Preview', () => {
    beforeEach(async () => {
      await setupCompleteStory();
    });

    it('should show live preview while editing', async () => {
      renderApp();

      // Generate story
      const storyInput = await screen.findByPlaceholderText(/Enter your story here/i);
      await userEvent.type(storyInput, 'Test story');
      await userEvent.click(screen.getByRole('button', { name: /Generate Tale/i }));

      await waitFor(() => {
        expect(screen.getByText(/Once upon a time in a magical forest/)).toBeInTheDocument();
      });

      // Edit page text
      const editButtons = await screen.findAllByRole('button', { name: /Edit Text/i });
      await userEvent.click(editButtons[0]);

      const textEditor = await screen.findByDisplayValue(/Once upon a time in a magical forest/);
      
      // Type new text
      await userEvent.clear(textEditor);
      await userEvent.type(textEditor, 'Preview text in real time');

      // Should show preview
      expect(screen.getByText(/Preview:/)).toBeInTheDocument();
      expect(screen.getByText(/Preview text in real time/)).toBeInTheDocument();
    });
  });

  describe('Workflow Panel', () => {
    it('should display generation workflow logs', async () => {
      await setupCompleteStory();
      renderApp();

      // Open workflow panel
      const workflowButton = await screen.findByRole('button', { name: /Workflow/i });
      await userEvent.click(workflowButton);

      // Should show workflow panel
      expect(screen.getByText(/Generation Logs/)).toBeInTheDocument();

      // Generate story
      const storyInput = screen.getByPlaceholderText(/Enter your story here/i);
      await userEvent.type(storyInput, 'Test story');
      await userEvent.click(screen.getByRole('button', { name: /Generate Tale/i }));

      // Should show log entries
      await waitFor(() => {
        expect(screen.getByText(/Starting story generation/i)).toBeInTheDocument();
        expect(screen.getByText(/Story generation complete/i)).toBeInTheDocument();
      });
    });

    it('should allow pausing generation from workflow panel', async () => {
      const mockStream = {
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            // Simulate slow generation
            let count = 0;
            const interval = setInterval(() => {
              if (count < 5) {
                callback(JSON.stringify({
                  type: 'page',
                  data: {
                    pageNumber: count + 1,
                    text: `Page ${count + 1}`,
                    imagePrompt: `Prompt ${count + 1}`
                  }
                }));
                count++;
              }
            }, 500);
            
            mockStream.destroy.mockImplementation(() => {
              clearInterval(interval);
            });
          }
          return mockStream;
        }),
        destroy: jest.fn()
      };

      generateTaleStream.mockResolvedValue(mockStream);
      renderApp();

      // Open workflow panel
      const workflowButton = await screen.findByRole('button', { name: /Workflow/i });
      await userEvent.click(workflowButton);

      // Start generation
      const storyInput = screen.getByPlaceholderText(/Enter your story here/i);
      await userEvent.type(storyInput, 'Test story');
      await userEvent.click(screen.getByRole('button', { name: /Generate Tale/i }));

      // Should show pause button in workflow panel
      const pauseButton = await screen.findByRole('button', { name: /Pause/i });
      await userEvent.click(pauseButton);

      // Should pause generation
      expect(mockStream.destroy).toHaveBeenCalled();
    });

    it('should show generation status in workflow panel', async () => {
      await setupCompleteStory();
      renderApp();

      // Open workflow panel
      const workflowButton = await screen.findByRole('button', { name: /Workflow/i });
      await userEvent.click(workflowButton);

      // Should show idle status initially
      expect(screen.getByText(/Status: Idle/i)).toBeInTheDocument();

      // Start generation
      const storyInput = screen.getByPlaceholderText(/Enter your story here/i);
      await userEvent.type(storyInput, 'Test story');
      await userEvent.click(screen.getByRole('button', { name: /Generate Tale/i }));

      // Should show generating status
      await waitFor(() => {
        expect(screen.getByText(/Status: Generating/i)).toBeInTheDocument();
      });

      // After completion
      await waitFor(() => {
        expect(screen.getByText(/Status: Complete/i)).toBeInTheDocument();
      });
    });
  });

  describe('Image Viewing', () => {
    beforeEach(async () => {
      await setupCompleteStory();
    });

    it('should support fullscreen image viewing', async () => {
      renderApp();

      // Generate story and images
      const storyInput = await screen.findByPlaceholderText(/Enter your story here/i);
      await userEvent.type(storyInput, 'Test story');
      await userEvent.click(screen.getByRole('button', { name: /Generate Tale/i }));

      await waitFor(() => {
        expect(screen.getByText('Editable Story')).toBeInTheDocument();
      });

      await userEvent.click(await screen.findByRole('button', { name: /Generate Images/i }));

      await waitFor(() => {
        const images = screen.getAllByRole('img');
        expect(images).toHaveLength(2);
      });

      // Click on first image
      const images = screen.getAllByRole('img');
      await userEvent.click(images[0]);

      // Should show fullscreen viewer
      expect(screen.getByTestId('fullscreen-viewer')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Close/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Download/i })).toBeInTheDocument();
    });

    it('should allow image download', async () => {
      // Mock URL.createObjectURL
      const mockUrl = 'blob:mock-url';
      global.URL.createObjectURL = jest.fn(() => mockUrl);

      // Mock fetch for image download
      global.fetch = jest.fn(() =>
        Promise.resolve({
          blob: () => Promise.resolve(new Blob(['image data'], { type: 'image/png' }))
        })
      );

      // Mock link click
      const mockClick = jest.fn();
      jest.spyOn(document, 'createElement').mockImplementation((tagName) => {
        if (tagName === 'a') {
          return { click: mockClick, setAttribute: jest.fn() };
        }
        return document.createElement(tagName);
      });

      renderApp();

      // Generate story and images
      const storyInput = await screen.findByPlaceholderText(/Enter your story here/i);
      await userEvent.type(storyInput, 'Test story');
      await userEvent.click(screen.getByRole('button', { name: /Generate Tale/i }));

      await waitFor(() => {
        expect(screen.getByText('Editable Story')).toBeInTheDocument();
      });

      await userEvent.click(await screen.findByRole('button', { name: /Generate Images/i }));

      await waitFor(() => {
        const images = screen.getAllByRole('img');
        expect(images).toHaveLength(2);
      });

      // Open fullscreen viewer
      const images = screen.getAllByRole('img');
      await userEvent.click(images[0]);

      // Click download
      const downloadButton = screen.getByRole('button', { name: /Download/i });
      await userEvent.click(downloadButton);

      // Should trigger download
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('https://example.com/generated-image.png');
        expect(mockClick).toHaveBeenCalled();
      });
    });
  });

  describe('Undo/Redo Functionality', () => {
    beforeEach(async () => {
      await setupCompleteStory();
    });

    it('should support undo for text edits', async () => {
      renderApp();

      // Generate story
      const storyInput = await screen.findByPlaceholderText(/Enter your story here/i);
      await userEvent.type(storyInput, 'Test story');
      await userEvent.click(screen.getByRole('button', { name: /Generate Tale/i }));

      await waitFor(() => {
        expect(screen.getByText(/Once upon a time in a magical forest/)).toBeInTheDocument();
      });

      // Edit text
      const editButtons = await screen.findAllByRole('button', { name: /Edit Text/i });
      await userEvent.click(editButtons[0]);

      const textEditor = await screen.findByDisplayValue(/Once upon a time in a magical forest/);
      const originalText = textEditor.value;
      
      await userEvent.clear(textEditor);
      await userEvent.type(textEditor, 'New text content');

      const saveButton = screen.getByRole('button', { name: /Save/i });
      await userEvent.click(saveButton);

      // Verify change
      await waitFor(() => {
        expect(screen.getByText(/New text content/)).toBeInTheDocument();
      });

      // Undo
      const undoButton = await screen.findByRole('button', { name: /Undo/i });
      await userEvent.click(undoButton);

      // Should revert to original
      await waitFor(() => {
        expect(screen.getByText(originalText)).toBeInTheDocument();
        expect(screen.queryByText(/New text content/)).not.toBeInTheDocument();
      });
    });

    it('should support redo after undo', async () => {
      renderApp();

      // Generate story
      const storyInput = await screen.findByPlaceholderText(/Enter your story here/i);
      await userEvent.type(storyInput, 'Test story');
      await userEvent.click(screen.getByRole('button', { name: /Generate Tale/i }));

      await waitFor(() => {
        expect(screen.getByText(/Once upon a time in a magical forest/)).toBeInTheDocument();
      });

      // Make edit
      const editButtons = await screen.findAllByRole('button', { name: /Edit Text/i });
      await userEvent.click(editButtons[0]);

      const textEditor = await screen.findByDisplayValue(/Once upon a time in a magical forest/);
      await userEvent.clear(textEditor);
      await userEvent.type(textEditor, 'Edited text');

      const saveButton = screen.getByRole('button', { name: /Save/i });
      await userEvent.click(saveButton);

      // Undo
      const undoButton = await screen.findByRole('button', { name: /Undo/i });
      await userEvent.click(undoButton);

      // Redo
      const redoButton = await screen.findByRole('button', { name: /Redo/i });
      await userEvent.click(redoButton);

      // Should show edited text again
      await waitFor(() => {
        expect(screen.getByText(/Edited text/)).toBeInTheDocument();
      });
    });
  });
});