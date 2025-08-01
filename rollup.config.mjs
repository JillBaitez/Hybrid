import typescript from '@rollup/plugin-typescript';
import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';

// Custom plugin to copy static files with directory creation
function copyFiles(files) {
  return {
    name: 'copy-files',
    generateBundle() {
      files.forEach(({ src, dest }) => {
        const destDir = dirname(dest);
        if (!existsSync(destDir)) {
          mkdirSync(destDir, { recursive: true });
        }
        copyFileSync(src, dest);
        console.log(`Copied ${src} → ${dest}`);
      });
    }
  };
}

// ES modules configuration (service worker, content script, storage)
const esModulesConfig = {
  input: {
    'core/sw': 'src/core/sw.ts',
    'content/cs': 'src/content/cs.ts',
    'core/dnr': 'src/core/dnr.ts',
    'utils/token-extractor': 'src/utils/token-extractor.ts',
    'storage/secure-token-store': 'src/storage/secure-token-store.ts',
    'core/token-refresh-manager': 'src/core/token-refresh-manager.ts',
    'providers/provider-registry': 'src/providers/provider-registry.ts',
    'core/simple-message-bus': 'src/core/simple-message-bus.ts',
    'bus/index': 'src/bus/index.ts',
    'bus/UniversalBus': 'src/bus/UniversalBus.ts',
    'bus/Environment': 'src/bus/Environment.ts',
    'bus/Serializer': 'src/bus/Serializer.ts',
  },
  output: {
    dir: 'dist',
    format: 'es',
    entryFileNames: '[name].js'
  },
  plugins: [
    typescript({ tsconfig: './tsconfig.json' }),
    copyFiles([
      // Session layer files for manifest web_accessible_resources
      { src: 'src/content/nj-engine.js', dest: 'dist/session-layer/nj-engine.js' },
      { src: 'src/content/nj-engine.css', dest: 'dist/session-layer/nj-engine.css' },
      { src: 'src/content/nj-engine.html', dest: 'dist/session-layer/nj-engine.html' },
      
      // Provider configuration files
      { src: 'src/providers/chatgpt.json', dest: 'dist/providers/chatgpt.json' },
      { src: 'src/providers/claude.json', dest: 'dist/providers/claude.json' },
      { src: 'src/providers/gemini.json', dest: 'dist/providers/gemini.json' },
      
      // DNR rules
      { src: 'src/rules/chatgpt.json', dest: 'dist/rules/chatgpt.json' },
      { src: 'src/rules/claude.json', dest: 'dist/rules/claude.json' },
      { src: 'src/rules/gemini.json', dest: 'dist/rules/gemini.json' },
      
      // OS HTML files
      { src: 'src/OS/0h.html', dest: 'dist/OS/0h.html' },
      { src: 'src/OS/0f.html', dest: 'dist/OS/0f.html' },
      
      // Static assets
      { src: 'popup.html', dest: 'dist/popup.html' },
      { src: 'popup.js', dest: 'dist/popup.js' },
      { src: 'manifest.json', dest: 'dist/manifest.json' }
    ])
  ]
};

// IIFE configuration for OS off-screen documents
const osHostConfig = {
  input: 'src/OS/0h.ts',
  output: {
    file: 'dist/OS/0h.js',
    format: 'iife'
  },
  plugins: [
    typescript({ tsconfig: './tsconfig.json' })
  ]
};

const osPowConfig = {
  input: 'src/OS/0f.ts',
  output: {
    file: 'dist/OS/0f.js',
    format: 'iife'
  },
  plugins: [
    typescript({ tsconfig: './tsconfig.json' })
  ]
};

export default [esModulesConfig, osHostConfig, osPowConfig];

