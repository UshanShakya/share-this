const fs = require('fs');
const path = require('path');

module.exports = function withIosWidget(config, options) {
  const projectRoot = config._internal?.projectRoot || process.cwd();
  
  // Source folder: widget/ios
  const srcDir = path.join(projectRoot, 'widget/ios');
  // Destination folder: targets/widget (expected by @bacons/apple-targets)
  const destDir = path.join(projectRoot, 'targets/widget');

  // Copy files recursively
  const copyFolderRecursiveSync = (src, dest) => {
    if (!fs.existsSync(src)) return;
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      
      if (entry.isDirectory()) {
        copyFolderRecursiveSync(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  };

  if (fs.existsSync(srcDir)) {
    copyFolderRecursiveSync(srcDir, destDir);
    console.log(`[withIosWidget] Copied widget/ios -> targets/widget`);
  } else {
    console.warn(`[withIosWidget] Source directory widget/ios not found`);
  }

  // Load the @bacons/apple-targets config plugin
  let appleTargetsPlugin;
  try {
    appleTargetsPlugin = require('@bacons/apple-targets').default;
  } catch (err) {
    console.warn('[withIosWidget] @bacons/apple-targets not found in node_modules, skipping target generation.');
    return config;
  }

  return appleTargetsPlugin(config, options);
};
