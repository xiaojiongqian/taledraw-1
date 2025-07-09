// 安全日志工具 - 防止在生产环境泄露敏感信息

// 检查是否为开发环境
const isDevelopment = process.env.NODE_ENV === 'development';

// 安全日志级别
const LOG_LEVELS = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug'
};

// 敏感数据标记（这些数据只在开发环境输出）
const SENSITIVE_KEYS = [
  'allCharacters',
  'password',
  'token',
  'apiKey',
  'secret',
  'credential'
];

// 检查是否为敏感数据
const isSensitiveData = (key, data) => {
  if (typeof key === 'string' && SENSITIVE_KEYS.some(sensitive => 
    key.toLowerCase().includes(sensitive.toLowerCase())
  )) {
    return true;
  }
  
  if (typeof data === 'object' && data !== null) {
    return Object.keys(data).some(objKey => 
      SENSITIVE_KEYS.some(sensitive => 
        objKey.toLowerCase().includes(sensitive.toLowerCase())
      )
    );
  }
  
  return false;
};

// 清理敏感数据
const sanitizeData = (data) => {
  if (typeof data !== 'object' || data === null) {
    return data;
  }
  
  const sanitized = { ...data };
  Object.keys(sanitized).forEach(key => {
    if (isSensitiveData(key, sanitized[key])) {
      sanitized[key] = '[SENSITIVE_DATA_HIDDEN]';
    }
  });
  
  return sanitized;
};

// 安全日志类
class SafeLogger {
  // 生产环境安全的日志方法
  log(message, ...args) {
    if (isDevelopment) {
      console.log(message, ...args);
    } else {
      // 生产环境只输出非敏感信息
      const sanitizedArgs = args.map(arg => 
        typeof arg === 'object' ? sanitizeData(arg) : arg
      );
      console.log(message, ...sanitizedArgs);
    }
  }

  // 开发环境专用的调试日志
  debug(message, ...args) {
    if (isDevelopment) {
      console.log(`🔍 DEBUG: ${message}`, ...args);
    }
    // 生产环境完全不输出debug信息
  }

  // 敏感数据专用日志（仅开发环境）
  sensitive(message, data) {
    if (isDevelopment) {
      console.log(`🔒 SENSITIVE: ${message}`, data);
    }
    // 生产环境完全不输出敏感数据
  }

  // 错误日志（生产环境也需要，但清理敏感信息）
  error(message, ...args) {
    if (isDevelopment) {
      console.error(message, ...args);
    } else {
      const sanitizedArgs = args.map(arg => 
        typeof arg === 'object' ? sanitizeData(arg) : arg
      );
      console.error(message, ...sanitizedArgs);
    }
  }

  // 警告日志（生产环境也需要，但清理敏感信息）
  warn(message, ...args) {
    if (isDevelopment) {
      console.warn(message, ...args);
    } else {
      const sanitizedArgs = args.map(arg => 
        typeof arg === 'object' ? sanitizeData(arg) : arg
      );
      console.warn(message, ...sanitizedArgs);
    }
  }

  // 信息日志（清理敏感信息后输出）
  info(message, ...args) {
    if (isDevelopment) {
      console.info(message, ...args);
    } else {
      const sanitizedArgs = args.map(arg => 
        typeof arg === 'object' ? sanitizeData(arg) : arg
      );
      console.info(message, ...sanitizedArgs);
    }
  }

  // 获取环境信息
  getEnvironmentInfo() {
    return {
      isDevelopment,
      nodeEnv: process.env.NODE_ENV,
      timestamp: new Date().toISOString()
    };
  }
}

// 创建全局实例
const logger = new SafeLogger();

// 便捷方法
export const safeLog = {
  // 常规日志
  log: (message, ...args) => logger.log(message, ...args),
  
  // 开发环境调试
  debug: (message, ...args) => logger.debug(message, ...args),
  
  // 敏感数据（仅开发环境）
  sensitive: (message, data) => logger.sensitive(message, data),
  
  // 错误日志
  error: (message, ...args) => logger.error(message, ...args),
  
  // 警告日志
  warn: (message, ...args) => logger.warn(message, ...args),
  
  // 信息日志
  info: (message, ...args) => logger.info(message, ...args),
  
  // 环境信息
  env: () => logger.getEnvironmentInfo()
};

export default logger; 