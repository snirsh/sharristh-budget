const { PrismaPlugin } = require('@prisma/nextjs-monorepo-workaround-plugin')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compress: true,
  poweredByHeader: false,
  output: 'standalone',
  transpilePackages: ['@sfam/api', '@sfam/db', '@sfam/domain', '@sfam/scraper'],
  typescript: {
    ignoreBuildErrors: true,
  },
  serverExternalPackages: [
    'prisma',
    'israeli-bank-scrapers',
    'puppeteer',
    'puppeteer-core',
    'bufferutil',
    'utf-8-validate',
    'ws',
    '@prisma/client',
    '@prisma/engines',
    'prisma',
  ],
  webpack: (config, { isServer, nextRuntime }) => {
    if (isServer) {
      // Add Prisma monorepo workaround plugin
      config.plugins = [...config.plugins, new PrismaPlugin()]

      // Don't bundle native modules on server side
      config.externals = config.externals || [];
      config.externals.push({
        bufferutil: 'commonjs bufferutil',
        'utf-8-validate': 'commonjs utf-8-validate',
      });
    }

    // Exclude heavy packages from Edge runtime (middleware)
    if (nextRuntime === 'edge') {
      config.externals = config.externals || [];
      if (Array.isArray(config.externals)) {
        config.externals.push(
          '@prisma/client',
          '@prisma/engines',
          '@sfam/db',
          '@sfam/api',
          '@sfam/domain',
          '@sfam/scraper',
        );
      }
    }

    // Suppress known third-party dependency warnings from puppeteer/israeli-bank-scrapers
    config.ignoreWarnings = [
      // Ignore "Critical dependency" warnings from puppeteer dependencies
      /Critical dependency: the request of a dependency is an expression/,
      /Critical dependency: require function is used in a way in which dependencies cannot be statically extracted/,
    ];

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
      {
        // Cache static assets aggressively
        source: '/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Cache API responses for 5 minutes with stale-while-revalidate
        source: '/api/trpc/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=300, stale-while-revalidate=600',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;

