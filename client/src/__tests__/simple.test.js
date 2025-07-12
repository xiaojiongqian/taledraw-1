// Simple working tests
describe('Core Functionality Tests', () => {
  describe('StateManager Module', () => {
    let stateManager;
    
    beforeAll(async () => {
      // Import stateManager
      const module = await import('../stateManager');
      stateManager = module.default;
    });

    it('should export stateManager instance', () => {
      expect(stateManager).toBeDefined();
      expect(typeof stateManager.saveState).toBe('function');
      expect(typeof stateManager.restoreState).toBe('function');
    });

    it('should have version property', () => {
      expect(stateManager.VERSION).toBeDefined();
      expect(typeof stateManager.VERSION).toBe('string');
    });

    it('should handle basic state operations', () => {
      const testState = {
        userEmail: 'test@example.com',
        story: 'Test story',
        pages: []
      };
      
      // Should not throw when saving
      expect(() => {
        stateManager.saveState(testState);
      }).not.toThrow();
    });
  });

  describe('Logger Utility', () => {
    let safeLog;
    
    beforeAll(async () => {
      const module = await import('../utils/logger');
      safeLog = module.safeLog;
    });

    it('should export logger functions', () => {
      expect(safeLog).toBeDefined();
      expect(typeof safeLog.log).toBe('function');
      expect(typeof safeLog.debug).toBe('function');
      expect(typeof safeLog.error).toBe('function');
      expect(typeof safeLog.warn).toBe('function');
    });

    it('should handle basic logging without errors', () => {
      expect(() => {
        safeLog.log('Test message');
        safeLog.debug('Debug message');
        safeLog.error('Error message');
        safeLog.warn('Warning message');
      }).not.toThrow();
    });

    it('should provide environment info', () => {
      const envInfo = safeLog.env();
      expect(envInfo).toBeDefined();
      expect(envInfo).toHaveProperty('isDevelopment');
      expect(envInfo).toHaveProperty('nodeEnv');
      expect(envInfo).toHaveProperty('timestamp');
    });
  });

  describe('Component Imports', () => {
    it('should import ImagenModelSelector component', async () => {
      const module = await import('../components/ImagenModelSelector');
      expect(module.default).toBeDefined();
    });

    it('should import PageItem component', async () => {
      const module = await import('../components/PageItem');
      expect(module.default).toBeDefined();
    });
  });

  describe('Configuration', () => {
    it('should import config values', async () => {
      const module = await import('../config');
      expect(module.UTILS).toBeDefined();
      expect(module.STRIPE_CONFIG).toBeDefined();
    });
  });
});