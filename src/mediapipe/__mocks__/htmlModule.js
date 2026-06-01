const fs = require('fs');
const path = require('path');

/** Jest：从磁盘读取 pose.html，与 Metro htmlTransformer 行为一致 */
module.exports = fs.readFileSync(
  path.resolve(__dirname, '../../../assets/mediapipe/pose.html'),
  'utf8',
);
