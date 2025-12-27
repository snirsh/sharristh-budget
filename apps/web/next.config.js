/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@sfam/api', '@sfam/db', '@sfam/domain'],
  serverExternalPackages: ['@prisma/client'],
};

module.exports = nextConfig;

