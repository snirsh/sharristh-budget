/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@sfam/api', '@sfam/db', '@sfam/domain', '@sfam/scraper'],
  serverExternalPackages: [
    '@prisma/client',
    'israeli-bank-scrapers',
    'puppeteer',
    'puppeteer-core',
    'bufferutil',
    'utf-8-validate',
    'ws',
  ],
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Don't bundle native modules on server side
      config.externals = config.externals || [];
      config.externals.push({
        bufferutil: 'commonjs bufferutil',
        'utf-8-validate': 'commonjs utf-8-validate',
      });
    }
    return config;
  },
};

module.exports = nextConfig;

