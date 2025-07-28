import { build } from 'esbuild';

const shared = {
  target: 'chrome120',
  format: 'esm',
  bundle: true,
  minify: true,
  sourcemap: false,
  splitting: false,
  treeShaking: true,
  external: [],
};

await Promise.all([
  // Service Worker
  build({
    ...shared,
    entryPoints: ['src/sw.ts'],
    outfile: 'dist/sw.js',
    platform: 'node',
  }),

  // Offscreen Document
  build({
    ...shared,
    entryPoints: ['src/offscreen.html'],
    outdir: 'dist',
    loader: { '.html': 'copy' },
  }),
]);

console.log('✅ Build complete – dist/ ready for manifest.');
