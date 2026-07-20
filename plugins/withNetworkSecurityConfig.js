/**
 * Expo Config Plugin: 注入 Android Network Security Configuration
 *
 * 功能：
 * 1. 将 network_security_config.xml 复制到 android/app/src/main/res/xml/
 * 2. 在 AndroidManifest.xml 中注册 android:networkSecurityConfig 属性
 *
 * 使用方式（app.json）：
 *   "plugins": ["./plugins/withNetworkSecurityConfig"]
 */
const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withNetworkSecurityConfig(config) {
  // Step 1: 复制 XML 文件到 Android 资源目录
  config = withDangerousMod(config, [
    'android',
    async (modConfig) => {
      const xmlSource = path.join(__dirname, 'network_security_config.xml');
      const xmlDest = path.join(
        modConfig.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'res',
        'xml',
        'network_security_config.xml'
      );

      // 确保目标目录存在
      const destDir = path.dirname(xmlDest);
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }

      fs.copyFileSync(xmlSource, xmlDest);
      console.log('[NetworkSecurityConfig] Copied network_security_config.xml');
      return modConfig;
    },
  ]);

  // Step 2: 在 AndroidManifest.xml 中注册 networkSecurityConfig
  config = withAndroidManifest(config, (modConfig) => {
    const manifest = modConfig.modResults;
    const application = manifest.manifest.application?.[0];

    if (application) {
      application.$['android:networkSecurityConfig'] =
        '@xml/network_security_config';
      console.log('[NetworkSecurityConfig] Registered in AndroidManifest.xml');
    }

    return modConfig;
  });

  return config;
};
