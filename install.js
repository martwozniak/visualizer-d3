#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🎨 D3.js Visualizer Plugin Installer');
console.log('====================================');
console.log();

rl.question('Enter the full path to your Obsidian vault: ', (vaultPath) => {
  if (!vaultPath) {
    console.error('❌ Vault path is required');
    process.exit(1);
  }

  const pluginDir = path.join(vaultPath, '.obsidian', 'plugins', 'visualizer-d3');
  
  try {
    // Create plugin directory if it doesn't exist
    if (!fs.existsSync(pluginDir)) {
      fs.mkdirSync(pluginDir, { recursive: true });
      console.log('✅ Created plugin directory');
    }

    // Copy required files
    const filesToCopy = ['main.js', 'manifest.json', 'styles.css'];
    
    for (const file of filesToCopy) {
      const sourcePath = path.join(__dirname, file);
      const destPath = path.join(pluginDir, file);
      
      if (fs.existsSync(sourcePath)) {
        fs.copyFileSync(sourcePath, destPath);
        console.log(`✅ Copied ${file}`);
      } else {
        console.warn(`⚠️  ${file} not found, skipping`);
      }
    }

    console.log();
    console.log('🎉 Installation complete!');
    console.log();
    console.log('Next steps:');
    console.log('1. Restart Obsidian');
    console.log('2. Go to Settings > Community Plugins');
    console.log('3. Enable "D3.js Visualizer"');
    console.log('4. Start creating visualizations with d3 code blocks!');
    console.log();
    console.log('📖 Documentation: https://github.com/your-repo/visualizer-d3');
    
  } catch (error) {
    console.error('❌ Installation failed:', error.message);
    process.exit(1);
  }
  
  rl.close();
});