import { defineConfig } from 'tsup';

export default defineConfig((options) => ({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: !options.watch, // Skip DTS in watch mode for faster rebuilds
  splitting: false,
  sourcemap: true,
  clean: true,
  external: [
    '@prisma/client',
    '@sfam/db',
    '@sfam/domain',
    '@sfam/scraper',
  ],
  skipNodeModulesBundle: true,
  treeshake: true,
}));

