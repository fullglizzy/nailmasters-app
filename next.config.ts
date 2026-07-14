import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
  // serverActions is top-level in Next.js 16 (was experimental in 15)
  serverActions: {
    bodySizeLimit: '100mb',
  },
  // standalone для Docker
  output: 'standalone',
};

export default nextConfig;
