/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@sharristh/api', '@sharristh/db', '@sharristh/domain'],
  serverExternalPackages: ['@prisma/client'],
};

module.exports = nextConfig;

