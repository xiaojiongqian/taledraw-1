// StateManager unit tests
import stateManager from '../stateManager';

describe('StateManager', () => {
  const mockState = {
    userEmail: 'test@example.com',
    story: 'Test story content',
    storyTitle: 'Test Title',
    pageCount: 5,
    aspectRatio: '1:1',
    selectedImagenModel: 'imagen4-fast',
    artStyle: 'Children\'s book style',
    allCharacters: {
      'Hero': {
        appearance: 'Young brave knight',
        clothing: 'Silver armor',
        personality: 'Courageous and kind'
      }
    },
    pages: [
      {
        id: 'page_1',
        title: 'Chapter 1',
        text: 'Once upon a time...',
        imagePrompt: 'A brave knight in a forest',
        image: 'https://example.com/image1.jpg',
        status: 'success'
      }
    ],
    storyWordCount: 20,
    generatedResult: { success: true },
    isGenerating: false
  };

  const mockUIState = {
    userEmail: 'test@example.com',
    showDebugWindow: true
  };

  // Create localStorage mock
  const localStorageMock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset localStorage mock
    localStorageMock.getItem.mockReturnValue(null);
    localStorageMock.setItem.mockImplementation(() => {});
    localStorageMock.removeItem.mockImplementation(() => {});
    localStorageMock.clear.mockImplementation(() => {});
    
    // Replace global localStorage with our mock
    Object.defineProperty(global, 'localStorage', {
      value: localStorageMock,
      writable: true
    });
    
    // Reset the stateManager instance state
    stateManager.VERSION = '1.0.0';
  });

  describe('saveState', () => {
    it('should save state to localStorage successfully', () => {
      const result = stateManager.saveState(mockState);
      
      expect(result).toBe(true);
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'taledraw_app_state',
        expect.any(String)
      );
      
      const savedData = JSON.parse(localStorage.setItem.mock.calls[0][1]);
      expect(savedData.userEmail).toBe('test@example.com');
      expect(savedData.story).toBe('Test story content');
      expect(savedData.hasGeneratedContent).toBe(true);
      expect(savedData.version).toBe('1.0.0');
      expect(savedData.timestamp).toBeGreaterThan(0);
    });

    it('should handle saving empty pages array', () => {
      const stateWithoutPages = { ...mockState, pages: [] };
      const result = stateManager.saveState(stateWithoutPages);
      
      expect(result).toBe(true);
      const savedData = JSON.parse(localStorage.setItem.mock.calls[0][1]);
      expect(savedData.hasGeneratedContent).toBe(false);
    });

    it('should sanitize corrupted text content', () => {
      const corruptedState = {
        ...mockState,
        story: 'Test story with \uFFFD corrupted \x01 characters',
        storyTitle: 'Title with \x08 control chars'
      };
      
      const result = stateManager.saveState(corruptedState);
      expect(result).toBe(true);
      
      const savedData = JSON.parse(localStorage.setItem.mock.calls[0][1]);
      expect(savedData.story).toBe('Test story with  corrupted  characters');
      expect(savedData.storyTitle).toBe('Title with  control chars');
    });

    it('should handle localStorage errors gracefully', () => {
      localStorage.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });
      
      const result = stateManager.saveState(mockState);
      expect(result).toBe(false);
    });
  });

  describe('restoreState', () => {
    it('should restore valid state from localStorage', () => {
      // Setup saved state
      const savedState = {
        version: '1.0.0',
        timestamp: Date.now(),
        ...mockState,
        hasGeneratedContent: true
      };
      localStorage.getItem.mockReturnValue(JSON.stringify(savedState));
      
      const restoredState = stateManager.restoreState();
      
      expect(localStorage.getItem).toHaveBeenCalledWith('taledraw_app_state');
      expect(restoredState).toEqual(savedState);
    });

    it('should return null when no saved state exists', () => {
      localStorage.getItem.mockReturnValue(null);
      
      const result = stateManager.restoreState();
      expect(result).toBeNull();
    });

    it('should clear and return null for expired state', () => {
      const expiredState = {
        version: '1.0.0',
        timestamp: Date.now() - (25 * 60 * 60 * 1000), // 25 hours ago
        ...mockState
      };
      localStorage.getItem.mockReturnValue(JSON.stringify(expiredState));
      
      const result = stateManager.restoreState();
      
      expect(result).toBeNull();
      expect(localStorage.removeItem).toHaveBeenCalledWith('taledraw_app_state');
    });

    it('should clear and return null for version mismatch', () => {
      const oldVersionState = {
        version: '0.9.0',
        timestamp: Date.now(),
        ...mockState
      };
      localStorage.getItem.mockReturnValue(JSON.stringify(oldVersionState));
      
      const result = stateManager.restoreState();
      
      expect(result).toBeNull();
      expect(localStorage.removeItem).toHaveBeenCalledWith('taledraw_app_state');
    });

    it('should handle JSON parse errors', () => {
      localStorage.getItem.mockReturnValue('invalid json data');
      
      const result = stateManager.restoreState();
      
      expect(result).toBeNull();
      expect(localStorage.removeItem).toHaveBeenCalledWith('taledraw_app_state');
    });

    it('should sanitize corrupted text during restore', () => {
      const corruptedState = {
        version: '1.0.0',
        timestamp: Date.now(),
        story: 'Story with \uFFFD corrupted text',
        storyTitle: 'Title with \x01 control chars'
      };
      localStorage.getItem.mockReturnValue(JSON.stringify(corruptedState));
      
      const result = stateManager.restoreState();
      
      expect(result.story).toBe('Story with  corrupted text');
      expect(result.storyTitle).toBe('Title with  control chars');
    });
  });

  describe('UI State Management', () => {
    it('should save UI state successfully', () => {
      const result = stateManager.saveUIState(mockUIState);
      
      expect(result).toBe(true);
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'taledraw_ui_state',
        expect.any(String)
      );
      
      const savedData = JSON.parse(localStorage.setItem.mock.calls[0][1]);
      expect(savedData.userEmail).toBe('test@example.com');
      expect(savedData.showDebugWindow).toBe(true);
      expect(savedData.version).toBe('1.0.0');
    });

    it('should restore UI state successfully', () => {
      const savedUIState = {
        version: '1.0.0',
        timestamp: Date.now(),
        ...mockUIState
      };
      localStorage.getItem.mockReturnValue(JSON.stringify(savedUIState));
      
      const result = stateManager.restoreUIState();
      
      expect(result).toEqual(savedUIState);
    });

    it('should clear UI state', () => {
      stateManager.clearUIState();
      expect(localStorage.removeItem).toHaveBeenCalledWith('taledraw_ui_state');
    });
  });

  describe('Utility Methods', () => {
    it('should check if persisted state exists', () => {
      localStorage.getItem.mockReturnValue('some data');
      expect(stateManager.hasPersistedState()).toBe(true);
      
      localStorage.getItem.mockReturnValue(null);
      expect(stateManager.hasPersistedState()).toBe(false);
    });

    it('should get state info', () => {
      const savedState = {
        version: '1.0.0',
        timestamp: Date.now(),
        userEmail: 'test@example.com',
        storyTitle: 'Test Story',
        pageCount: 5,
        hasGeneratedContent: true
      };
      localStorage.getItem.mockReturnValue(JSON.stringify(savedState));
      
      const info = stateManager.getStateInfo();
      
      expect(info).toEqual({
        timestamp: savedState.timestamp,
        userEmail: 'test@example.com',
        storyTitle: 'Test Story',
        pageCount: 5,
        hasGeneratedContent: true
      });
    });

    it('should return null for invalid state info', () => {
      localStorage.getItem.mockReturnValue('invalid json');
      const info = stateManager.getStateInfo();
      expect(info).toBeNull();
    });

    it('should clean corrupted data', () => {
      const corruptedData = {
        version: '1.0.0',
        data: {
          story: 'Text with \uFFFD corruption',
          nested: {
            text: 'More \x01 corrupted text'
          }
        }
      };
      localStorage.getItem.mockReturnValue(JSON.stringify(corruptedData));
      
      const result = stateManager.cleanCorruptedData();
      
      expect(result).toBe(true);
      expect(localStorage.setItem).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle localStorage access errors in hasPersistedState', () => {
      localStorage.getItem.mockImplementation(() => {
        throw new Error('Storage access denied');
      });
      
      const result = stateManager.hasPersistedState();
      expect(result).toBe(false);
    });

    it('should handle errors in clearState gracefully', () => {
      localStorage.removeItem.mockImplementation(() => {
        throw new Error('Cannot remove item');
      });
      
      // Should not throw error
      stateManager.clearState();
      expect(localStorage.removeItem).toHaveBeenCalledWith('taledraw_app_state');
    });

    it('should handle complex object cleaning', () => {
      const complexObject = {
        version: '1.0.0',
        nested: {
          deep: {
            text: 'Text with \uFFFD \x01 corruption',
            array: ['item1', 'item2 \x08 corrupted']
          }
        }
      };
      localStorage.getItem.mockReturnValue(JSON.stringify(complexObject));
      
      const result = stateManager.cleanCorruptedData();
      expect(result).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined values in state', () => {
      const stateWithUndefined = {
        ...mockState,
        story: undefined,
        pages: undefined
      };
      
      const result = stateManager.saveState(stateWithUndefined);
      expect(result).toBe(true);
    });

    it('should handle very large state objects', () => {
      const largeState = {
        ...mockState,
        pages: new Array(100).fill(null).map((_, i) => ({
          id: `page_${i}`,
          title: `Page ${i}`,
          text: 'Lorem ipsum '.repeat(100),
          imagePrompt: 'A detailed scene description '.repeat(10)
        }))
      };
      
      const result = stateManager.saveState(largeState);
      expect(result).toBe(true);
    });

    it('should handle circular references safely', () => {
      const circularState = { ...mockState };
      circularState.self = circularState; // Create circular reference
      
      // This should not throw, but the circular reference will be ignored
      expect(() => stateManager.saveState(circularState)).not.toThrow();
    });
  });
});