/** @type {import('next').NextConfig} */
const apiTarget = process.env.API_PROXY_TARGET || 'http://127.0.0.1:6080';

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${apiTarget}/api/:path*` },
      { source: '/graphql', destination: `${apiTarget}/graphql` },
    ];
  },
};

module.exports = nextConfig;
