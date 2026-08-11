const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// Watch the monorepo root so Metro picks up changes in packages/
config.watchFolders = [monorepoRoot];

// Let Metro resolve modules from the monorepo root node_modules and packages
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Alias @ai-sport/core to the package source
config.resolver.alias = {
  '@ai-sport/core': path.resolve(monorepoRoot, 'packages/ai-sport-core/src'),
};

if (!config.resolver.sourceExts.includes('html')) {
  config.resolver.sourceExts.push('html');
}

config.transformer = {
  ...config.transformer,
  babelTransformerPath: path.resolve(__dirname, 'transformers/htmlTransformer.js'),
};

module.exports = config;
