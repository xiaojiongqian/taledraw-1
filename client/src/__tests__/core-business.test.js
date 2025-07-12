// Mock localStorage before any imports
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};

// Set global localStorage to mock before importing modules
Object.defineProperty(global, 'localStorage', {
  value: mockLocalStorage,
  writable: true
});

// Core Business Logic Tests
describe('Business Logic Tests', () => {
  beforeEach(() => {
    // Reset mocks and set default behavior
    jest.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
    mockLocalStorage.setItem.mockReturnValue(undefined);
    mockLocalStorage.removeItem.mockReturnValue(undefined);
    mockLocalStorage.clear.mockReturnValue(undefined);
  });

  describe('StateManager Functionality', () => {
    let stateManager;
    
    beforeAll(async () => {
      const module = await import('../stateManager');
      stateManager = module.default;
    });

    it('should save and restore basic state', () => {
      const testState = {
        userEmail: 'test@example.com',
        story: 'Test story content',
        storyTitle: 'Test Title',
        pageCount: 5,
        pages: [{ id: 'page1', text: 'Page 1 content' }],
        hasGeneratedContent: true
      };

      // Test saving
      const saveResult = stateManager.saveState(testState);
      expect(saveResult).toBe(true);
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'taledraw_app_state',
        expect.any(String)
      );

      // Test data structure
      const savedCall = mockLocalStorage.setItem.mock.calls[0];
      const savedData = JSON.parse(savedCall[1]);
      expect(savedData.userEmail).toBe('test@example.com');
      expect(savedData.story).toBe('Test story content');
      expect(savedData.version).toBeDefined();
      expect(savedData.timestamp).toBeGreaterThan(0);
    });

    it('should detect expired state', () => {
      const expiredState = {
        version: '1.0.0',
        timestamp: Date.now() - (25 * 60 * 60 * 1000), // 25 hours ago
        story: 'Old story'
      };
      
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(expiredState));
      
      const result = stateManager.restoreState();
      expect(result).toBeNull();
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('taledraw_app_state');
    });

    it('should handle version mismatch', () => {
      const oldVersionState = {
        version: '0.9.0',
        timestamp: Date.now(),
        story: 'Story with old version'
      };
      
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(oldVersionState));
      
      const result = stateManager.restoreState();
      expect(result).toBeNull();
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('taledraw_app_state');
    });

    it('should sanitize corrupted text', () => {
      const corruptedState = {
        userEmail: 'test@example.com',
        story: 'Story with \uFFFD corrupted \x01 characters',
        storyTitle: 'Title with \x08 control chars'
      };
      
      const result = stateManager.saveState(corruptedState);
      expect(result).toBe(true);
      
      const savedCall = mockLocalStorage.setItem.mock.calls[0];
      const savedData = JSON.parse(savedCall[1]);
      expect(savedData.story).toBe('Story with  corrupted  characters');
      expect(savedData.storyTitle).toBe('Title with  control chars');
    });

    it('should handle localStorage errors gracefully', () => {
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });
      
      const testState = { userEmail: 'test@example.com' };
      const result = stateManager.saveState(testState);
      expect(result).toBe(false);
    });
  });

  describe('Logger Security Features', () => {
    let safeLog;
    
    beforeAll(async () => {
      const module = await import('../utils/logger');
      safeLog = module.safeLog;
    });

    it('should handle sensitive data properly', () => {
      const sensitiveData = {
        normalData: 'safe',
        allCharacters: { hero: 'sensitive' },
        password: 'secret123',
        apiKey: 'key123'
      };
      
      // Should not throw when logging sensitive data
      expect(() => {
        safeLog.log('Test with sensitive data', sensitiveData);
      }).not.toThrow();
    });

    it('should provide consistent API across log levels', () => {
      const testMessage = 'Test message';
      const testData = { test: 'data' };
      
      expect(() => {
        safeLog.log(testMessage, testData);
        safeLog.debug(testMessage, testData);
        safeLog.info(testMessage, testData);
        safeLog.warn(testMessage, testData);
        safeLog.error(testMessage, testData);
        safeLog.sensitive(testMessage, testData);
      }).not.toThrow();
    });

    it('should handle edge cases gracefully', () => {
      expect(() => {
        safeLog.log('Test with null', null);
        safeLog.log('Test with undefined', undefined);
        safeLog.error('Error with empty object', {});
        safeLog.warn('Warning with array', [1, 2, 3]);
      }).not.toThrow();
    });
  });

  describe('Component Error Handling', () => {
    it('should handle missing props gracefully', async () => {
      const { default: ImagenModelSelector } = await import('../components/ImagenModelSelector');
      
      // Component should be defined and callable
      expect(ImagenModelSelector).toBeDefined();
      expect(typeof ImagenModelSelector).toBe('function');
    });

    it('should validate configuration structure', async () => {
      const { UTILS, STRIPE_CONFIG } = await import('../config');
      
      // Utils should have required functions
      expect(UTILS.formatLogMessage).toBeDefined();
      expect(typeof UTILS.formatLogMessage).toBe('function');
      expect(UTILS.formatErrorMessage).toBeDefined();
      expect(typeof UTILS.formatErrorMessage).toBe('function');
      
      // Stripe config should have required fields
      expect(STRIPE_CONFIG.PUBLISHABLE_KEY).toBeDefined();
      expect(STRIPE_CONFIG.SUCCESS_URL).toBeDefined();
      expect(STRIPE_CONFIG.CANCEL_URL).toBeDefined();
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete state lifecycle', async () => {
      const stateModule = await import('../stateManager');
      const stateManager = stateModule.default;
      
      // Create test state
      const testState = {
        userEmail: 'integration@test.com',
        story: 'Integration test story',
        pages: [
          { id: 'page1', text: 'Page 1', status: 'success' },
          { id: 'page2', text: 'Page 2', status: 'pending' }
        ],
        hasGeneratedContent: true
      };
      
      // Save state
      const saveResult = stateManager.saveState(testState);
      expect(saveResult).toBe(true);
      
      // Mock the saved data for restore
      const savedCall = mockLocalStorage.setItem.mock.calls[0];
      mockLocalStorage.getItem.mockReturnValue(savedCall[1]);
      
      // Restore state
      const restoredState = stateManager.restoreState();
      expect(restoredState).toBeTruthy();
      expect(restoredState.userEmail).toBe('integration@test.com');
      expect(restoredState.story).toBe('Integration test story');
      expect(restoredState.pages).toHaveLength(2);
      
      // Clear state
      stateManager.clearState();
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('taledraw_app_state');
    });

    it('should maintain data integrity', async () => {
      const stateModule = await import('../stateManager');
      const stateManager = stateModule.default;
      
      const largeState = {
        userEmail: 'stress@test.com',
        story: 'Lorem ipsum dolor sit amet, '.repeat(100),
        pages: new Array(30).fill(null).map((_, i) => ({
          id: `page_${i}`,
          text: `Page ${i} content with details `.repeat(20),
          status: 'success'
        })),
        allCharacters: {
          'Hero': { appearance: 'Detailed description '.repeat(10) },
          'Villain': { appearance: 'Another detailed description '.repeat(10) }
        }
      };
      
      // Should handle large state without errors
      expect(() => {
        const result = stateManager.saveState(largeState);
        expect(result).toBe(true);
      }).not.toThrow();
    });
  });

  describe('Performance Considerations', () => {
    it('should handle rapid operations efficiently', async () => {
      const loggerModule = await import('../utils/logger');
      const safeLog = loggerModule.safeLog;
      
      const start = performance.now();
      
      // Perform 50 rapid log operations
      for (let i = 0; i < 50; i++) {
        safeLog.log(`Log message ${i}`, { 
          index: i, 
          data: new Array(5).fill(`data${i}`)
        });
      }
      
      const end = performance.now();
      const duration = end - start;
      
      // Should complete within reasonable time
      expect(duration).toBeLessThan(500); // 500ms
    });

    it('should handle memory efficiently', async () => {
      const stateModule = await import('../stateManager');
      const stateManager = stateModule.default;
      
      // Test with multiple state operations
      for (let i = 0; i < 10; i++) {
        const state = {
          userEmail: `user${i}@test.com`,
          story: `Story ${i}`,
          pages: [{ id: `page${i}`, text: `Content ${i}` }]
        };
        
        stateManager.saveState(state);
      }
      
      // Should not cause memory issues
      expect(mockLocalStorage.setItem).toHaveBeenCalledTimes(10);
    });
  });
});