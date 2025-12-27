import { defineConfig } from 'tsup';

export default defineConfig((options) => ({
  entry: ['src/index.ts', 'src/schemas.ts'],
  format: ['cjs', 'esm'],
  dts: !options.watch, // Skip DTS in watch mode for faster rebuilds
  splitting: false,
  sourcemap: true,
  clean: true,
}));

