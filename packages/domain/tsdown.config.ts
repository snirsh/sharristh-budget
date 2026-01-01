import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts', 'src/schemas.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
});

