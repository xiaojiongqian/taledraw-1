module.exports = {
  extends: ['../.eslintrc.js'],
  rules: {
    'no-unused-vars': ['warn', { 
      'argsIgnorePattern': '^_',
      'varsIgnorePattern': '^(mockUser|testStoryData|waitFor|isValidTaleStructure|cleanup|expect|axios|FormData|beforeEach|mockTaleData|testImagePrompts|wrapped|largeStory|stats|admin)$'
    }],
    'no-undef': 'warn', // 测试文件中可能有全局变量
    'no-prototype-builtins': 'off', // 测试文件中可能需要直接使用 hasOwnProperty
  },
  env: {
    mocha: true, // 添加 Mocha 测试环境
    jest: true,  // 添加 Jest 测试环境
  },
  globals: {
    'isValidTaleStructure': 'readonly', // 声明全局函数
  }
}; 