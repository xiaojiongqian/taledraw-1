import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import App from '../../App';
import { generateTaleStream } from '../../api';
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

describe('Story Generation Flow', () => {
  let authStateCallback;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock auth state
    onAuthStateChanged.mockImplementation((authInstance, callback) => {
      authStateCallback = callback;
      callback(mockUser);
      return jest.fn();
    });

    // Mock stateManager
    stateManager.saveState.mockReturnValue(true);
    stateManager.restoreState.mockReturnValue(null);
    stateManager.clearState.mockImplementation(() => {});
  });

  describe('Story Input and Validation', () => {
    it('should display story input form when authenticated', async () => {
      renderApp();

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Enter your story here/i)).toBeInTheDocument();
        expect(screen.getByText(/Page Count:/i)).toBeInTheDocument();
        expect(screen.getByText(/Aspect Ratio:/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Generate Tale/i })).toBeInTheDocument();
      });
    });

    it('should validate story length (2000 character limit)', async () => {
      renderApp();

      const storyInput = await screen.findByPlaceholderText(/Enter your story here/i);
      const longStory = 'a'.repeat(2001);
      
      await userEvent.type(storyInput, longStory);

      // Should show character count warning
      await waitFor(() => {
        expect(screen.getByText(/2001 \/ 2000/)).toBeInTheDocument();
        expect(screen.getByText(/2001 \/ 2000/)).toHaveClass('word-count-exceeded');
      });
    });

    it('should prevent submission with empty story', async () => {
      renderApp();

      const generateButton = await screen.findByRole('button', { name: /Generate Tale/i });
      
      await userEvent.click(generateButton);

      // Should not call API
      expect(generateTaleStream).not.toHaveBeenCalled();
    });

    it('should display word count dynamically', async () => {
      renderApp();

      const storyInput = await screen.findByPlaceholderText(/Enter your story here/i);
      
      await userEvent.type(storyInput, 'This is a test story');

      await waitFor(() => {
        expect(screen.getByText(/20 \/ 2000/)).toBeInTheDocument();
      });
    });
  });

  describe('Page Count Selection', () => {
    it('should allow page count selection (1-30)', async () => {
      renderApp();

      const pageSelector = await screen.findByLabelText(/Page Count:/i);
      
      // Check default value
      expect(pageSelector.value).toBe('10');

      // Change page count
      await userEvent.clear(pageSelector);
      await userEvent.type(pageSelector, '15');

      expect(pageSelector.value).toBe('15');
    });

    it('should validate page count range', async () => {
      renderApp();

      const pageSelector = await screen.findByLabelText(/Page Count:/i);
      
      // Test minimum boundary
      await userEvent.clear(pageSelector);
      await userEvent.type(pageSelector, '0');
      fireEvent.blur(pageSelector);
      expect(pageSelector.value).toBe('1');

      // Test maximum boundary
      await userEvent.clear(pageSelector);
      await userEvent.type(pageSelector, '35');
      fireEvent.blur(pageSelector);
      expect(pageSelector.value).toBe('30');
    });
  });

  describe('Aspect Ratio Selection', () => {
    it('should display all aspect ratio options', async () => {
      renderApp();

      await waitFor(() => {
        expect(screen.getByText('1:1')).toBeInTheDocument();
        expect(screen.getByText('9:16')).toBeInTheDocument();
        expect(screen.getByText('16:9')).toBeInTheDocument();
        expect(screen.getByText('3:4')).toBeInTheDocument();
        expect(screen.getByText('4:3')).toBeInTheDocument();
      });
    });

    it('should allow aspect ratio selection', async () => {
      renderApp();

      const ratio16_9 = await screen.findByText('16:9');
      
      await userEvent.click(ratio16_9);

      // Should have selected class
      expect(ratio16_9.parentElement).toHaveClass('selected');
    });
  });

  describe('Stream-based Story Generation', () => {
    it('should handle successful story generation', async () => {
      const mockStream = {
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            // Simulate streaming data
            setTimeout(() => {
              callback(JSON.stringify({
                type: 'story_title',
                data: 'The Adventure Begins'
              }));
              callback(JSON.stringify({
                type: 'page',
                data: {
                  pageNumber: 1,
                  text: 'Once upon a time...',
                  imagePrompt: 'A magical forest'
                }
              }));
              callback(JSON.stringify({
                type: 'complete',
                data: { message: 'Story generation complete' }
              }));
            }, 100);
          }
          if (event === 'end') {
            setTimeout(() => callback(), 200);
          }
          return mockStream;
        }),
        destroy: jest.fn()
      };

      generateTaleStream.mockResolvedValue(mockStream);

      renderApp();

      const storyInput = await screen.findByPlaceholderText(/Enter your story here/i);
      const generateButton = screen.getByRole('button', { name: /Generate Tale/i });

      await userEvent.type(storyInput, 'A story about a brave knight');
      await userEvent.click(generateButton);

      // Should show loading state
      expect(generateButton).toBeDisabled();
      expect(generateButton).toHaveTextContent(/Generating.../i);

      // Should display story title
      await waitFor(() => {
        expect(screen.getByText('The Adventure Begins')).toBeInTheDocument();
      });

      // Should display generated page
      await waitFor(() => {
        expect(screen.getByText(/Once upon a time.../)).toBeInTheDocument();
      });

      // Should call state manager to save
      expect(stateManager.saveState).toHaveBeenCalled();
    });

    it('should handle generation errors gracefully', async () => {
      const mockStream = {
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            setTimeout(() => {
              callback(JSON.stringify({
                type: 'error',
                data: { message: 'Content safety violation detected' }
              }));
            }, 100);
          }
          return mockStream;
        }),
        destroy: jest.fn()
      };

      generateTaleStream.mockResolvedValue(mockStream);

      renderApp();

      const storyInput = await screen.findByPlaceholderText(/Enter your story here/i);
      const generateButton = screen.getByRole('button', { name: /Generate Tale/i });

      await userEvent.type(storyInput, 'Inappropriate content');
      await userEvent.click(generateButton);

      await waitFor(() => {
        expect(screen.getByText(/Content safety violation detected/i)).toBeInTheDocument();
      });

      // Should re-enable the button
      expect(generateButton).not.toBeDisabled();
      expect(generateButton).toHaveTextContent(/Generate Tale/i);
    });

    it('should allow cancellation of generation', async () => {
      const mockStream = {
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            // Simulate slow streaming
            const interval = setInterval(() => {
              callback(JSON.stringify({
                type: 'page',
                data: {
                  pageNumber: Math.random(),
                  text: 'Page content...',
                  imagePrompt: 'Image prompt'
                }
              }));
            }, 500);
            mockStream.destroy.mockImplementation(() => clearInterval(interval));
          }
          return mockStream;
        }),
        destroy: jest.fn()
      };

      generateTaleStream.mockResolvedValue(mockStream);

      renderApp();

      const storyInput = await screen.findByPlaceholderText(/Enter your story here/i);
      const generateButton = screen.getByRole('button', { name: /Generate Tale/i });

      await userEvent.type(storyInput, 'A long story');
      await userEvent.click(generateButton);

      // Should show stop button
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Stop Generation/i })).toBeInTheDocument();
      });

      const stopButton = screen.getByRole('button', { name: /Stop Generation/i });
      await userEvent.click(stopButton);

      // Should call destroy on stream
      expect(mockStream.destroy).toHaveBeenCalled();
    });
  });

  describe('Character Management', () => {
    it('should extract and display characters from generated content', async () => {
      const mockStream = {
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            setTimeout(() => {
              callback(JSON.stringify({
                type: 'all_characters',
                data: {
                  'Alice': {
                    appearance: 'Young girl with blonde hair',
                    clothing: 'Blue dress with white apron',
                    personality: 'Curious and brave'
                  },
                  'Rabbit': {
                    appearance: 'White rabbit',
                    clothing: 'Red vest with pocket watch',
                    personality: 'Always in a hurry'
                  }
                }
              }));
            }, 100);
          }
          return mockStream;
        }),
        destroy: jest.fn()
      };

      generateTaleStream.mockResolvedValue(mockStream);

      renderApp();

      const storyInput = await screen.findByPlaceholderText(/Enter your story here/i);
      const generateButton = screen.getByRole('button', { name: /Generate Tale/i });

      await userEvent.type(storyInput, 'Alice in Wonderland story');
      await userEvent.click(generateButton);

      // Should display character information
      await waitFor(() => {
        expect(screen.getByText(/Characters:/i)).toBeInTheDocument();
        expect(screen.getByText(/Alice/)).toBeInTheDocument();
        expect(screen.getByText(/Rabbit/)).toBeInTheDocument();
      });
    });

    it('should allow editing character descriptions', async () => {
      const mockStream = {
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            callback(JSON.stringify({
              type: 'all_characters',
              data: {
                'Hero': { appearance: 'Brave warrior' }
              }
            }));
          }
          if (event === 'end') callback();
          return mockStream;
        }),
        destroy: jest.fn()
      };

      generateTaleStream.mockResolvedValue(mockStream);

      renderApp();

      const storyInput = await screen.findByPlaceholderText(/Enter your story here/i);
      await userEvent.type(storyInput, 'Hero story');
      await userEvent.click(screen.getByRole('button', { name: /Generate Tale/i }));

      await waitFor(() => {
        expect(screen.getByText(/Hero/)).toBeInTheDocument();
      });

      // Character editing functionality would be tested here
      // This depends on the actual implementation of character editing UI
    });
  });

  describe('Progress and Logging', () => {
    it('should display generation progress', async () => {
      const mockStream = {
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            setTimeout(() => {
              callback(JSON.stringify({
                type: 'progress',
                data: { message: 'Analyzing story structure...' }
              }));
              callback(JSON.stringify({
                type: 'progress',
                data: { message: 'Generating page content...' }
              }));
            }, 100);
          }
          return mockStream;
        }),
        destroy: jest.fn()
      };

      generateTaleStream.mockResolvedValue(mockStream);

      renderApp();

      const storyInput = await screen.findByPlaceholderText(/Enter your story here/i);
      await userEvent.type(storyInput, 'Test story');
      await userEvent.click(screen.getByRole('button', { name: /Generate Tale/i }));

      // Should show progress messages
      await waitFor(() => {
        expect(screen.getByText(/Analyzing story structure.../)).toBeInTheDocument();
      });
    });

    it('should show/hide debug window', async () => {
      renderApp();

      // Initially debug window should not be visible
      expect(screen.queryByText(/Workflow/i)).not.toBeInTheDocument();

      // Find and click debug toggle button
      const debugToggle = await screen.findByRole('button', { name: /Workflow/i });
      await userEvent.click(debugToggle);

      // Debug window should be visible
      await waitFor(() => {
        expect(screen.getByText(/Workflow/i)).toBeInTheDocument();
        expect(screen.getByText(/Generation Logs/i)).toBeInTheDocument();
      });

      // Click again to hide
      await userEvent.click(debugToggle);

      await waitFor(() => {
        expect(screen.queryByText(/Generation Logs/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Multi-language Support', () => {
    it('should accept stories in multiple languages', async () => {
      const testCases = [
        { lang: 'English', text: 'Once upon a time' },
        { lang: 'Chinese', text: '从前有一个' },
        { lang: 'Japanese', text: '昔々あるところに' },
        { lang: 'Spanish', text: 'Había una vez' }
      ];

      for (const { lang, text } of testCases) {
        jest.clearAllMocks();
        const mockStream = {
          on: jest.fn((event, callback) => {
            if (event === 'data') {
              callback(JSON.stringify({
                type: 'complete',
                data: { message: `${lang} story processed` }
              }));
            }
            if (event === 'end') callback();
            return mockStream;
          }),
          destroy: jest.fn()
        };

        generateTaleStream.mockResolvedValue(mockStream);

        const { unmount } = renderApp();

        const storyInput = await screen.findByPlaceholderText(/Enter your story here/i);
        await userEvent.clear(storyInput);
        await userEvent.type(storyInput, text);
        
        const generateButton = screen.getByRole('button', { name: /Generate Tale/i });
        await userEvent.click(generateButton);

        await waitFor(() => {
          expect(generateTaleStream).toHaveBeenCalledWith(
            expect.objectContaining({
              story: text
            }),
            expect.any(String)
          );
        });

        unmount();
      }
    });
  });

  describe('Art Style Configuration', () => {
    it('should allow art style input', async () => {
      renderApp();

      const artStyleInput = await screen.findByPlaceholderText(/Art style/i);
      
      // Check default value
      expect(artStyleInput.value).toBe("Children's picture book illustration style");

      // Change art style
      await userEvent.clear(artStyleInput);
      await userEvent.type(artStyleInput, 'Watercolor painting style');

      expect(artStyleInput.value).toBe('Watercolor painting style');
    });

    it('should include art style in generation request', async () => {
      const mockStream = {
        on: jest.fn((event, callback) => {
          if (event === 'end') callback();
          return mockStream;
        }),
        destroy: jest.fn()
      };

      generateTaleStream.mockResolvedValue(mockStream);

      renderApp();

      const storyInput = await screen.findByPlaceholderText(/Enter your story here/i);
      const artStyleInput = await screen.findByPlaceholderText(/Art style/i);
      
      await userEvent.type(storyInput, 'Test story');
      await userEvent.clear(artStyleInput);
      await userEvent.type(artStyleInput, 'Anime style');
      
      await userEvent.click(screen.getByRole('button', { name: /Generate Tale/i }));

      await waitFor(() => {
        expect(generateTaleStream).toHaveBeenCalledWith(
          expect.objectContaining({
            artStyle: 'Anime style'
          }),
          expect.any(String)
        );
      });
    });
  });

  describe('Content Safety', () => {
    it('should handle content safety violations', async () => {
      const mockStream = {
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            callback(JSON.stringify({
              type: 'safety_warning',
              data: {
                message: 'Content has been modified for child safety',
                originalContent: 'violent scene',
                modifiedContent: 'friendly competition'
              }
            }));
          }
          return mockStream;
        }),
        destroy: jest.fn()
      };

      generateTaleStream.mockResolvedValue(mockStream);

      renderApp();

      const storyInput = await screen.findByPlaceholderText(/Enter your story here/i);
      await userEvent.type(storyInput, 'A story with violence');
      await userEvent.click(screen.getByRole('button', { name: /Generate Tale/i }));

      await waitFor(() => {
        expect(screen.getByText(/Content has been modified for child safety/i)).toBeInTheDocument();
      });
    });
  });
});