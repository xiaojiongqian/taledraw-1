const path = require('path');
const webpack = require('webpack');

module.exports = function override(config, env) {
  // 原有的别名配置
  config.resolve.alias = {
    ...config.resolve.alias,
    '@': path.resolve(__dirname, 'src'),
  };

  // 添加对 "node:" 协议的支持
  config.resolve.extensionAlias = {
    ...config.resolve.extensionAlias,
    '.js': ['.js', '.ts', '.tsx'],
    '.mjs': ['.mjs', '.mts']
  };

  // 处理 node: 协议的模块
  config.resolve.fallback = {
    ...config.resolve.fallback,
    "https": require.resolve("https-browserify"),
    "http": require.resolve("stream-http"),
    "url": require.resolve("url/"),
    "buffer": require.resolve("buffer/"),
    "util": require.resolve("util/"),
    "stream": require.resolve("stream-browserify"),
    "fs": false,
    "net": false,
    "tls": false
  };

  // 添加专门的插件来处理 node: 协议
  config.plugins.push(
    new webpack.NormalModuleReplacementPlugin(
      /^node:(.*)$/,
      (resource) => {
        const module = resource.request.replace(/^node:/, '');
        switch (module) {
          case 'fs':
            resource.request = 'fs';
            break;
          case 'https':
            resource.request = 'https-browserify';
            break;
          case 'http':
            resource.request = 'stream-http';
            break;
          case 'url':
            resource.request = 'url';
            break;
          case 'buffer':
            resource.request = 'buffer';
            break;
          case 'util':
            resource.request = 'util';
            break;
          case 'stream':
            resource.request = 'stream-browserify';
            break;
          default:
            resource.request = module;
        }
      }
    )
  );

  // 替换 node: 协议的导入
  config.module.rules.push({
    test: /\.m?js$/,
    resolve: {
      fullySpecified: false,
    },
  });

  return config;
}; 