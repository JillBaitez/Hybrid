import typescript from '@rollup/plugin-typescript';

// ES modules configuration (service worker, content script, storage)
const esModulesConfig = {
  input: {
    'core/sw': 'src/core/sw.ts',
    'core/cs': 'src/core/cs.ts',
    'storage/idb': 'src/storage/idb.ts',
    'core/dispatch': 'src/core/dispatch.ts',
    'core/dnr': 'src/core/dnr.ts',
    'host/iframe-factory': 'src/host/iframe-factory.ts'
  },
  output: {
    dir: 'dist',
    format: 'es',
    entryFileNames: '[name].js'
  },
  plugins: [
    typescript({ tsconfig: './tsconfig.json' })
  ]
};

// IIFE configuration for host off-screen document
const hostIifeConfig = {
  input: 'src/host/0h.ts',
  output: {
    file: 'dist/host/0h.js',
    format: 'iife'
  },
  plugins: [
    typescript({ tsconfig: './tsconfig.json' })
  ]
};

// IIFE configuration for pow off-screen document  
const powIifeConfig = {
  input: 'src/pow/0f.ts',
  output: {
    file: 'dist/pow/0f.js',
    format: 'iife'
  },
  plugins: [
    typescript({ tsconfig: './tsconfig.json' })
  ]
};

export default [esModulesConfig, hostIifeConfig, powIifeConfig];
