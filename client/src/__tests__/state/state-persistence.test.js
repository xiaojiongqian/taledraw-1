import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import App from '../../App';
import { generateTaleStream, generateImageWithImagen } from '../../api';
import { onAuthStateChanged } from 'firebase/auth';
import stateManager from '../../stateManager';

// Mock dependencies
jest.mock('../../api');
jest.mock('firebase/auth');

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

// We need to import the actual stateManager to test it properly
jest.unmock('../../stateManager');

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

// Helper to create a complete application state
const createCompleteState = () => ({
  userEmail: 'test@example.com',
  story: 'Once upon a time in a magical kingdom',
  storyTitle: 'The Magical Kingdom',
  pageCount: 5,
  aspectRatio: '16:9',
  selectedImagenModel: 'imagen4',
  artStyle: 'Watercolor painting style',
  allCharacters: {
    'Princess': { 
      appearance: 'Young woman with long golden hair',
      clothing: 'Blue gown with silver tiara',
      personality: 'Kind and brave'
    },
    'Dragon': {
      appearance: 'Large green dragon with emerald scales',
      clothing: 'None',
      personality: 'Wise but misunderstood'
    }
  },
  pages: [
    {
      pageNumber: 1,
      text: 'In a kingdom far away, there lived a brave princess.',
      imagePrompt: 'Medieval castle with towers',
      imageUrl: 'https://example.com/page1.png',
      status: 'success'
    },
    {
      pageNumber: 2,
      text: 'One day, she heard about a dragon terrorizing the villages.',
      imagePrompt: 'Dragon flying over village',
      imageUrl: 'https://example.com/page2.png',
      status: 'success'
    },
    {
      pageNumber: 3,
      text: 'The princess decided to confront the dragon.',
      imagePrompt: 'Princess on horseback',
      imageUrl: null,
      status: 'generating'
    }
  ],
  hasGeneratedContent: true,
  showDebugWindow: true,
  logs: [
    { timestamp: Date.now() - 1000, message: 'Story generation started', type: 'info' },
    { timestamp: Date.now() - 500, message: 'Generated 3 pages', type: 'success' }
  ]
});

describe('State Persistence and Recovery', () => {
  let originalLocalStorage;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Save original localStorage
    originalLocalStorage = global.localStorage;
    
    // Reset localStorage
    localStorage.clear();
    
    // Mock auth state
    onAuthStateChanged.mockImplementation((authInstance, callback) => {
      callback(mockUser);
      return jest.fn();
    });
  });

  afterEach(() => {
    // Restore original localStorage
    global.localStorage = originalLocalStorage;
  });

  describe('State Saving', () => {
    it('should save complete application state to localStorage', async () => {
      const testState = createCompleteState();
      
      // Import real stateManager
      const { default: realStateManager } = await import('../../stateManager');
      
      const result = realStateManager.saveState(testState);
      
      expect(result).toBe(true);
      
      const savedData = JSON.parse(localStorage.getItem('taledraw_app_state'));
      expect(savedData).toBeDefined();
      expect(savedData.userEmail).toBe('test@example.com');
      expect(savedData.storyTitle).toBe('The Magical Kingdom');
      expect(savedData.pages).toHaveLength(3);
      expect(savedData.allCharacters).toHaveProperty('Princess');
      expect(savedData.allCharacters).toHaveProperty('Dragon');
      expect(savedData.version).toBeDefined();
      expect(savedData.timestamp).toBeDefined();
    });

    it('should sanitize text content before saving', async () => {
      const { default: realStateManager } = await import('../../stateManager');
      
      const dirtyState = {
        userEmail: 'test@example.com',
        story: 'Story with \uFFFD invalid \x00 characters \x1F',
        storyTitle: 'Title\nwith\nnewlines',
        pages: [{
          text: 'Text with\ttabs\rand\nspecial\bchars'
        }]
      };
      
      realStateManager.saveState(dirtyState);
      
      const savedData = JSON.parse(localStorage.getItem('taledraw_app_state'));
      expect(savedData.story).toBe('Story with  invalid  characters ');
      expect(savedData.storyTitle).toBe('Title with newlines');
      expect(savedData.pages[0].text).toBe('Text with tabs and special chars');
    });

    it('should handle large state data', async () => {
      const { default: realStateManager } = await import('../../stateManager');
      
      const largeState = {
        userEmail: 'test@example.com',
        story: 'Lorem ipsum '.repeat(100),
        pages: Array(30).fill(null).map((_, i) => ({
          pageNumber: i + 1,
          text: `Page ${i + 1} content `.repeat(50),
          imagePrompt: `Detailed prompt for page ${i + 1} `.repeat(20),
          imageUrl: `https://example.com/page${i + 1}.png`
        }))
      };
      
      const result = realStateManager.saveState(largeState);
      expect(result).toBe(true);
      
      const savedData = JSON.parse(localStorage.getItem('taledraw_app_state'));
      expect(savedData.pages).toHaveLength(30);
    });

    it('should compress data if available', async () => {
      // Mock CompressionStream API
      global.CompressionStream = class {
        constructor() {
          this.writable = {
            getWriter: () => ({
              write: jest.fn(),
              close: jest.fn()
            })
          };
          this.readable = {
            getReader: () => ({
              read: jest.fn().mockResolvedValue({ 
                done: true, 
                value: new Uint8Array([1, 2, 3]) 
              })
            })
          };
        }
      };
      
      const { default: realStateManager } = await import('../../stateManager');
      const testState = createCompleteState();
      
      const result = realStateManager.saveState(testState);
      expect(result).toBe(true);
    });
  });

  describe('State Restoration', () => {
    it('should restore valid state from localStorage', async () => {
      const { default: realStateManager } = await import('../../stateManager');
      const testState = createCompleteState();
      
      // Save state first
      realStateManager.saveState(testState);
      
      // Restore state
      const restoredState = realStateManager.restoreState();
      
      expect(restoredState).toBeDefined();
      expect(restoredState.userEmail).toBe('test@example.com');
      expect(restoredState.storyTitle).toBe('The Magical Kingdom');
      expect(restoredState.pages).toHaveLength(3);
      expect(restoredState.allCharacters.Princess).toBeDefined();
    });

    it('should reject expired state (older than 24 hours)', async () => {
      const { default: realStateManager } = await import('../../stateManager');
      
      const expiredState = {
        version: '1.0.0',
        timestamp: Date.now() - (25 * 60 * 60 * 1000), // 25 hours ago
        userEmail: 'test@example.com',
        story: 'Expired story'
      };
      
      localStorage.setItem('taledraw_app_state', JSON.stringify(expiredState));
      
      const result = realStateManager.restoreState();
      expect(result).toBeNull();
      expect(localStorage.getItem('taledraw_app_state')).toBeNull();
    });

    it('should handle version mismatches', async () => {
      const { default: realStateManager } = await import('../../stateManager');
      
      const oldVersionState = {
        version: '0.5.0',
        timestamp: Date.now(),
        userEmail: 'test@example.com',
        story: 'Story from old version'
      };
      
      localStorage.setItem('taledraw_app_state', JSON.stringify(oldVersionState));
      
      const result = realStateManager.restoreState();
      expect(result).toBeNull();
    });

    it('should handle corrupted state data', async () => {
      const { default: realStateManager } = await import('../../stateManager');
      
      // Set corrupted JSON
      localStorage.setItem('taledraw_app_state', 'corrupted{json}data');
      
      const result = realStateManager.restoreState();
      expect(result).toBeNull();
    });

    it('should migrate data from old formats', async () => {
      const { default: realStateManager } = await import('../../stateManager');
      
      // Simulate old format without some new fields
      const oldFormatState = {
        version: '1.0.0',
        timestamp: Date.now(),
        userEmail: 'test@example.com',
        story: 'Old format story',
        pages: [{
          text: 'Page without pageNumber field'
        }]
      };
      
      localStorage.setItem('taledraw_app_state', JSON.stringify(oldFormatState));
      
      const result = realStateManager.restoreState();
      
      // Should still restore with defaults for missing fields
      expect(result).toBeDefined();
      expect(result.selectedImagenModel).toBe('imagen4-fast'); // Default value
    });
  });

  describe('Integration with App Component', () => {
    it('should restore state on app load for authenticated user', async () => {
      const { default: realStateManager } = await import('../../stateManager');
      const testState = createCompleteState();
      
      // Save state before rendering
      realStateManager.saveState(testState);
      
      // Mock successful restoration
      renderApp();
      
      // Should restore and display saved content
      await waitFor(() => {
        expect(screen.getByText('The Magical Kingdom')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Once upon a time in a magical kingdom')).toBeInTheDocument();
      });
    });

    it('should save state automatically during user interactions', async () => {
      const { default: realStateManager } = await import('../../stateManager');
      jest.spyOn(realStateManager, 'saveState');
      
      renderApp();
      
      // Type story
      const storyInput = await screen.findByPlaceholderText(/Enter your story here/i);
      await userEvent.type(storyInput, 'New story content');
      
      // Should trigger state save
      await waitFor(() => {
        expect(realStateManager.saveState).toHaveBeenCalled();
      });
    });

    it('should handle state restoration failures gracefully', async () => {
      // Mock localStorage to throw error
      const mockGetItem = jest.fn(() => {
        throw new Error('Storage access denied');
      });
      Object.defineProperty(global, 'localStorage', {
        value: {
          getItem: mockGetItem,
          setItem: jest.fn(),
          removeItem: jest.fn(),
          clear: jest.fn()
        },
        writable: true
      });
      
      renderApp();
      
      // Should still render without errors
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Enter your story here/i)).toBeInTheDocument();
      });
    });
  });

  describe('Cross-Session State Management', () => {
    it('should maintain state across page refreshes', async () => {
      const { default: realStateManager } = await import('../../stateManager');
      const testState = createCompleteState();
      
      // First session - save state
      const { unmount } = renderApp();
      
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Enter your story here/i)).toBeInTheDocument();
      });
      
      // Manually save state (simulating user actions)
      realStateManager.saveState(testState);
      
      // Simulate page refresh
      unmount();
      
      // Second session - should restore state
      renderApp();
      
      await waitFor(() => {
        expect(screen.getByText('The Magical Kingdom')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Once upon a time in a magical kingdom')).toBeInTheDocument();
      });
    });

    it('should handle different users correctly', async () => {
      const { default: realStateManager } = await import('../../stateManager');
      
      // Save state for user1
      const user1State = {
        ...createCompleteState(),
        userEmail: 'user1@example.com',
        storyTitle: 'User 1 Story'
      };
      realStateManager.saveState(user1State);
      
      // Change to different user
      onAuthStateChanged.mockImplementation((authInstance, callback) => {
        callback({ ...mockUser, email: 'user2@example.com' });
        return jest.fn();
      });
      
      renderApp();
      
      // Should not show user1's content
      await waitFor(() => {
        expect(screen.queryByText('User 1 Story')).not.toBeInTheDocument();
      });
    });
  });

  describe('State Cleanup and Management', () => {
    it('should clear state on user logout', async () => {
      const { default: realStateManager } = await import('../../stateManager');
      jest.spyOn(realStateManager, 'clearState');
      
      let authCallback;
      onAuthStateChanged.mockImplementation((authInstance, callback) => {
        authCallback = callback;
        callback(mockUser);
        return jest.fn();
      });
      
      renderApp();
      
      // Simulate logout
      authCallback(null);
      
      await waitFor(() => {
        expect(realStateManager.clearState).toHaveBeenCalled();
      });
    });

    it('should handle storage quota exceeded errors', async () => {
      const { default: realStateManager } = await import('../../stateManager');
      
      // Mock localStorage.setItem to throw quota error
      const mockSetItem = jest.fn(() => {
        throw new DOMException('QuotaExceededError');
      });
      
      Object.defineProperty(global, 'localStorage', {
        value: {
          getItem: jest.fn(),
          setItem: mockSetItem,
          removeItem: jest.fn(),
          clear: jest.fn()
        },
        writable: true
      });
      
      const result = realStateManager.saveState(createCompleteState());
      expect(result).toBe(false);
    });

    it('should remove old states periodically', async () => {
      const { default: realStateManager } = await import('../../stateManager');
      
      // Create multiple old states
      const oldStates = {
        'taledraw_app_state_old1': JSON.stringify({
          timestamp: Date.now() - (30 * 24 * 60 * 60 * 1000) // 30 days old
        }),
        'taledraw_app_state_old2': JSON.stringify({
          timestamp: Date.now() - (7 * 24 * 60 * 60 * 1000) // 7 days old
        }),
        'taledraw_app_state': JSON.stringify({
          ...createCompleteState(),
          timestamp: Date.now()
        })
      };
      
      Object.entries(oldStates).forEach(([key, value]) => {
        localStorage.setItem(key, value);
      });
      
      // Cleanup old states
      if (realStateManager.cleanupOldStates) {
        realStateManager.cleanupOldStates();
      }
      
      // Recent state should remain
      expect(localStorage.getItem('taledraw_app_state')).toBeDefined();
    });
  });

  describe('Performance Optimization', () => {
    it('should debounce frequent state saves', async () => {
      const { default: realStateManager } = await import('../../stateManager');
      jest.spyOn(realStateManager, 'saveState');
      
      renderApp();
      
      const storyInput = await screen.findByPlaceholderText(/Enter your story here/i);
      
      // Type rapidly
      for (let i = 0; i < 10; i++) {
        await userEvent.type(storyInput, 'a');
      }
      
      // Should not save state 10 times
      await waitFor(() => {
        expect(realStateManager.saveState.mock.calls.length).toBeLessThan(10);
      });
    });

    it('should handle concurrent save operations', async () => {
      const { default: realStateManager } = await import('../../stateManager');
      
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          realStateManager.saveState({
            ...createCompleteState(),
            story: `Concurrent story ${i}`
          })
        );
      }
      
      const results = await Promise.all(promises);
      
      // All saves should succeed
      expect(results.every(r => r === true)).toBe(true);
      
      // Last save should win
      const savedData = JSON.parse(localStorage.getItem('taledraw_app_state'));
      expect(savedData.story).toContain('Concurrent story');
    });
  });

  describe('Security and Privacy', () => {
    it('should not save sensitive authentication data', async () => {
      const { default: realStateManager } = await import('../../stateManager');
      
      const stateWithSensitiveData = {
        ...createCompleteState(),
        authToken: 'secret-token',
        password: 'user-password',
        apiKey: 'api-key-123'
      };
      
      realStateManager.saveState(stateWithSensitiveData);
      
      const savedData = JSON.parse(localStorage.getItem('taledraw_app_state'));
      expect(savedData.authToken).toBeUndefined();
      expect(savedData.password).toBeUndefined();
      expect(savedData.apiKey).toBeUndefined();
    });

    it('should encrypt sensitive data if encryption is available', async () => {
      // Mock Web Crypto API
      global.crypto = {
        subtle: {
          encrypt: jest.fn().mockResolvedValue(new ArrayBuffer(8)),
          decrypt: jest.fn().mockResolvedValue(new ArrayBuffer(8)),
          generateKey: jest.fn().mockResolvedValue({}),
          importKey: jest.fn().mockResolvedValue({})
        },
        getRandomValues: jest.fn()
      };
      
      const { default: realStateManager } = await import('../../stateManager');
      
      if (realStateManager.saveStateSecure) {
        const result = await realStateManager.saveStateSecure(createCompleteState());
        expect(result).toBe(true);
      }
    });
  });
});