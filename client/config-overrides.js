const webpack = require('webpack');

module.exports = function override(config, env) {
  // 添加一个新的插件来处理所有 'node:' 前缀的模块
  config.plugins.push(
    new webpack.NormalModuleReplacementPlugin(
      /^node:/,
      (resource) => {
        resource.request = require.resolve('./src/mock.js');
      }
    )
  );

  // 为那些没有 'node:' 前缀的模块保留回退，以防万一
  if (!config.resolve) {
    config.resolve = {};
  }
  if (!config.resolve.fallback) {
    config.resolve.fallback = {};
  }
  Object.assign(config.resolve.fallback, {
    "fs": false,
    "path": require.resolve("path-browserify"), // 'path' 最好有一个polyfill
    "os": false,
    "stream": false,
    "crypto": false
  });

  return config;
}; 