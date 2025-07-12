// Logger utility tests
import { safeLog } from '../../utils/logger';

// Save original console before it gets mocked by setup.js
const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info
};

describe('SafeLogger', () => {
  let consoleSpy;
  
  beforeAll(() => {
    // Restore original console methods
    global.console = {
      ...global.console,
      log: originalConsole.log,
      error: originalConsole.error,
      warn: originalConsole.warn,
      info: originalConsole.info
    };
  });
  
  beforeEach(() => {
    // Mock all console methods fresh each time
    consoleSpy = {
      log: jest.spyOn(console, 'log').mockImplementation(() => {}),
      error: jest.spyOn(console, 'error').mockImplementation(() => {}),
      warn: jest.spyOn(console, 'warn').mockImplementation(() => {}),
      info: jest.spyOn(console, 'info').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    // Restore console methods
    Object.values(consoleSpy).forEach(spy => spy.mockRestore());
  });

  describe('Development Environment', () => {
    beforeEach(() => {
      // Mock development environment
      process.env.NODE_ENV = 'development';
    });

    it('should log debug messages in development', () => {
      safeLog.debug('Test debug message', { data: 'test' });
      
      expect(consoleSpy.log).toHaveBeenCalledWith(
        '🔍 DEBUG: Test debug message',
        { data: 'test' }
      );
    });

    it('should log sensitive data in development', () => {
      const sensitiveData = {
        allCharacters: { hero: 'data' },
        password: 'secret123'
      };
      
      safeLog.sensitive('Character data', sensitiveData);
      
      expect(consoleSpy.log).toHaveBeenCalledWith(
        '🔒 SENSITIVE: Character data',
        sensitiveData
      );
    });

    it('should log all message types in development', () => {
      safeLog.log('Regular log');
      safeLog.error('Error message');
      safeLog.warn('Warning message');
      safeLog.info('Info message');
      
      expect(consoleSpy.log).toHaveBeenCalledWith('Regular log');
      expect(consoleSpy.error).toHaveBeenCalledWith('Error message');
      expect(consoleSpy.warn).toHaveBeenCalledWith('Warning message');
      expect(consoleSpy.info).toHaveBeenCalledWith('Info message');
    });
  });

  describe('Production Environment', () => {
    beforeEach(() => {
      // Mock production environment
      process.env.NODE_ENV = 'production';
    });

    it('should not log debug messages in production', () => {
      safeLog.debug('Test debug message');
      
      expect(consoleSpy.log).not.toHaveBeenCalled();
    });

    it('should not log sensitive data in production', () => {
      const sensitiveData = { allCharacters: { hero: 'data' } };
      
      safeLog.sensitive('Character data', sensitiveData);
      
      expect(consoleSpy.log).not.toHaveBeenCalled();
    });

    it('should sanitize sensitive data in production logs', () => {
      const dataWithSensitive = {
        normalData: 'safe',
        allCharacters: { hero: 'sensitive' },
        password: 'secret123'
      };
      
      safeLog.log('Test message', dataWithSensitive);
      
      expect(consoleSpy.log).toHaveBeenCalledWith(
        'Test message',
        {
          normalData: 'safe',
          allCharacters: '[SENSITIVE_DATA_HIDDEN]',
          password: '[SENSITIVE_DATA_HIDDEN]'
        }
      );
    });

    it('should sanitize error logs in production', () => {
      const errorWithSensitive = {
        message: 'Error occurred',
        apiKey: 'secret-key',
        stackTrace: 'stack trace'
      };
      
      safeLog.error('API Error', errorWithSensitive);
      
      expect(consoleSpy.error).toHaveBeenCalledWith(
        'API Error',
        {
          message: 'Error occurred',
          apiKey: '[SENSITIVE_DATA_HIDDEN]',
          stackTrace: 'stack trace'
        }
      );
    });
  });

  describe('Sensitive Data Detection', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('should detect sensitive keys', () => {
      const testData = {
        allCharacters: 'sensitive',
        password: 'sensitive',
        token: 'sensitive',
        apiKey: 'sensitive',
        secret: 'sensitive',
        credential: 'sensitive',
        normalField: 'safe'
      };
      
      safeLog.log('Test', testData);
      
      const logCall = consoleSpy.log.mock.calls[0][1];
      expect(logCall.allCharacters).toBe('[SENSITIVE_DATA_HIDDEN]');
      expect(logCall.password).toBe('[SENSITIVE_DATA_HIDDEN]');
      expect(logCall.token).toBe('[SENSITIVE_DATA_HIDDEN]');
      expect(logCall.apiKey).toBe('[SENSITIVE_DATA_HIDDEN]');
      expect(logCall.secret).toBe('[SENSITIVE_DATA_HIDDEN]');
      expect(logCall.credential).toBe('[SENSITIVE_DATA_HIDDEN]');
      expect(logCall.normalField).toBe('safe');
    });

    it('should detect case-insensitive sensitive keys', () => {
      const testData = {
        ALLCHARACTERS: 'sensitive',
        Password: 'sensitive',
        API_KEY: 'sensitive'
      };
      
      safeLog.log('Test', testData);
      
      const logCall = consoleSpy.log.mock.calls[0][1];
      expect(logCall.ALLCHARACTERS).toBe('[SENSITIVE_DATA_HIDDEN]');
      expect(logCall.Password).toBe('[SENSITIVE_DATA_HIDDEN]');
      expect(logCall.API_KEY).toBe('[SENSITIVE_DATA_HIDDEN]');
    });

    it('should handle nested sensitive data', () => {
      const testData = {
        user: {
          name: 'John',
          password: 'secret'
        },
        config: {
          apiKey: 'secret-key'
        }
      };
      
      safeLog.log('Test', testData);
      
      const logCall = consoleSpy.log.mock.calls[0][1];
      expect(logCall.user).toBe('[SENSITIVE_DATA_HIDDEN]');
      expect(logCall.config).toBe('[SENSITIVE_DATA_HIDDEN]');
    });

    it('should preserve non-sensitive data types', () => {
      const testData = {
        string: 'text',
        number: 42,
        boolean: true,
        array: [1, 2, 3],
        nullValue: null,
        undefinedValue: undefined
      };
      
      safeLog.log('Test', testData);
      
      const logCall = consoleSpy.log.mock.calls[0][1];
      expect(logCall).toEqual(testData);
    });
  });

  describe('Environment Information', () => {
    it('should return correct environment info', () => {
      const envInfo = safeLog.env();
      
      expect(envInfo).toHaveProperty('isDevelopment');
      expect(envInfo).toHaveProperty('nodeEnv');
      expect(envInfo).toHaveProperty('timestamp');
      expect(typeof envInfo.isDevelopment).toBe('boolean');
      expect(typeof envInfo.nodeEnv).toBe('string');
      expect(typeof envInfo.timestamp).toBe('string');
    });

    it('should return valid ISO timestamp', () => {
      const envInfo = safeLog.env();
      const timestamp = new Date(envInfo.timestamp);
      
      expect(timestamp).toBeInstanceOf(Date);
      expect(timestamp.getTime()).not.toBeNaN();
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('should handle null and undefined arguments', () => {
      expect(() => {
        safeLog.log('Test with null', null);
        safeLog.log('Test with undefined', undefined);
        safeLog.error('Error with null', null);
      }).not.toThrow();
    });

    it('should handle circular references in objects', () => {
      const circular = { name: 'test' };
      circular.self = circular;
      
      expect(() => {
        safeLog.log('Circular reference test', circular);
      }).not.toThrow();
    });

    it('should handle very large objects', () => {
      const largeObject = {};
      for (let i = 0; i < 1000; i++) {
        largeObject[`key${i}`] = `value${i}`;
      }
      
      expect(() => {
        safeLog.log('Large object test', largeObject);
      }).not.toThrow();
    });

    it('should handle objects with prototype pollution attempts', () => {
      const maliciousData = {
        '__proto__': { malicious: true },
        'constructor': { prototype: { hacked: true } },
        normalData: 'safe'
      };
      
      expect(() => {
        safeLog.log('Security test', maliciousData);
      }).not.toThrow();
      
      // Should not affect the global Object prototype
      expect(Object.prototype.malicious).toBeUndefined();
      expect(Object.prototype.hacked).toBeUndefined();
    });

    it('should handle arrays with sensitive data', () => {
      const arrayWithSensitive = [
        'safe data',
        { password: 'secret' },
        { apiKey: 'key' }
      ];
      
      safeLog.log('Array test', arrayWithSensitive);
      
      const logCall = consoleSpy.log.mock.calls[0][1];
      expect(logCall[0]).toBe('safe data');
      expect(logCall[1]).toBe('[SENSITIVE_DATA_HIDDEN]');
      expect(logCall[2]).toBe('[SENSITIVE_DATA_HIDDEN]');
    });

    it('should handle mixed argument types', () => {
      const mixedArgs = [
        'string arg',
        42,
        { sensitiveData: 'secret' },
        null,
        ['array', 'data']
      ];
      
      expect(() => {
        safeLog.log('Mixed args test', ...mixedArgs);
      }).not.toThrow();
    });

    it('should handle empty objects and arrays', () => {
      expect(() => {
        safeLog.log('Empty object', {});
        safeLog.log('Empty array', []);
        safeLog.log('Empty string', '');
      }).not.toThrow();
    });
  });

  describe('Performance', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('should handle multiple rapid log calls efficiently', () => {
      const start = performance.now();
      
      for (let i = 0; i < 100; i++) {
        safeLog.log(`Log message ${i}`, { 
          index: i, 
          password: 'secret',
          data: new Array(10).fill(`data${i}`)
        });
      }
      
      const end = performance.now();
      const duration = end - start;
      
      // Should complete within reasonable time (less than 1 second)
      expect(duration).toBeLessThan(1000);
      expect(consoleSpy.log).toHaveBeenCalledTimes(100);
    });
  });

  describe('Logger Instance Methods', () => {
    it('should maintain consistent API across all log levels', () => {
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

    it('should handle methods being called without arguments', () => {
      expect(() => {
        safeLog.log();
        safeLog.debug();
        safeLog.info();
        safeLog.warn();
        safeLog.error();
      }).not.toThrow();
    });
  });
});