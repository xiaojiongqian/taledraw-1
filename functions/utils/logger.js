// 安全日志工具 - Firebase Functions版本
// 防止在生产环境泄露敏感信息

// 动态检查是否为生产环境
const isProduction = () => process.env.NODE_ENV === 'production' || 
                           process.env.GCLOUD_PROJECT !== undefined;

// 敏感数据标记（这些数据只在开发环境输出）
const SENSITIVE_KEYS = [
  'allCharacters',
  'password',
  'token',
  'apiKey',
  'key',
  'secret',
  'credential',
  'auth',
  'authorization',
  'bearer'
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

// 安全日志类 - Firebase Functions版本
class FunctionsLogger {
  // 开发环境专用的调试日志
  debug(message, ...args) {
    if (!isProduction()) {
      console.log(`🔍 DEBUG: ${message}`, ...args);
    }
    // 生产环境完全不输出debug信息
  }

  // 敏感数据专用日志（仅开发环境）
  sensitive(message, data) {
    if (!isProduction()) {
      console.log(`🔒 SENSITIVE: ${message}`, data);
    }
    // 生产环境完全不输出敏感数据
  }

  // 常规信息日志（清理敏感信息）
  log(message, ...args) {
    if (!isProduction()) {
      console.log(message, ...args);
    } else {
      // 生产环境清理敏感信息
      const sanitizedArgs = args.map(arg => 
        typeof arg === 'object' ? sanitizeData(arg) : arg
      );
      console.log(message, ...sanitizedArgs);
    }
  }

  // 信息日志（清理敏感信息）
  info(message, ...args) {
    if (!isProduction()) {
      console.info(message, ...args);
    } else {
      const sanitizedArgs = args.map(arg => 
        typeof arg === 'object' ? sanitizeData(arg) : arg
      );
      console.info(message, ...sanitizedArgs);
    }
  }

  // 警告日志（清理敏感信息）
  warn(message, ...args) {
    if (!isProduction()) {
      console.warn(message, ...args);
    } else {
      const sanitizedArgs = args.map(arg => 
        typeof arg === 'object' ? sanitizeData(arg) : arg
      );
      console.warn(message, ...sanitizedArgs);
    }
  }

  // 错误日志（清理敏感信息）
  error(message, ...args) {
    if (!isProduction()) {
      console.error(message, ...args);
    } else {
      const sanitizedArgs = args.map(arg => 
        typeof arg === 'object' ? sanitizeData(arg) : arg
      );
      console.error(message, ...sanitizedArgs);
    }
  }

  // 获取环境信息
  getEnvironmentInfo() {
    return {
      isProduction: isProduction(),
      nodeEnv: process.env.NODE_ENV,
      gcloudProject: process.env.GCLOUD_PROJECT,
      timestamp: new Date().toISOString()
    };
  }
}

// 创建全局实例
const logger = new FunctionsLogger();

// 便捷方法
const functionsLog = {
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

module.exports = { functionsLog }; 