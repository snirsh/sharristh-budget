import { defineConfig } from 'tsdown';

const isProduction = process.env.NODE_ENV === 'production' || process.env.CI === 'true';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: isProduction,
  clean: true,
});
