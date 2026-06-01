const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

if (!config.resolver.sourceExts.includes('html')) {
  config.resolver.sourceExts.push('html');
}

config.transformer = {
  ...config.transformer,
  babelTransformerPath: path.resolve(__dirname, 'transformers/htmlTransformer.js'),
};

module.exports = config;
