import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  external: ['@prisma/client', '@sfam/db', '@sfam/domain', '@sfam/scraper', 'next/cache'],
});

