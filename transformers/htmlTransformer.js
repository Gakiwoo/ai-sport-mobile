const fs = require('fs');
const upstream = require('@expo/metro-config/babel-transformer');

/**
 * Metro transformer: import .html as default-exported string (for WebView source).
 */
module.exports.transform = async function transform(props) {
  const { filename, options } = props;
  let { src } = props;

  if (filename.endsWith('.html')) {
    const html = fs.readFileSync(filename, 'utf8');
    src = `export default ${JSON.stringify(html)};`;
  }

  return upstream.transform({
    ...props,
    src,
    filename: filename.endsWith('.html') ? `${filename}.js` : filename,
    options,
  });
};
