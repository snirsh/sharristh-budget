/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compress: true,
  poweredByHeader: false,
  transpilePackages: ['@sfam/api', '@sfam/db', '@sfam/domain', '@sfam/scraper'],
  typescript: {
    ignoreBuildErrors: true,
  },
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
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;

