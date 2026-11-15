import path from 'node:path';

import { withTailwindMerge } from '@tailwind-merge/next';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  agentRules: false,
  devIndicators: false,
  reactCompiler: true,
  productionBrowserSourceMaps: true,
  allowedDevOrigins: ['127.0.0.1'],
  output: 'standalone',
  outputFileTracingRoot: path.join(import.meta.dirname, '../..'),
  experimental: {
    validateRSCRequestHeaders: false,
    turbopackScopeHoisting: false,
    turbopackFileSystemCacheForBuild: false,
  },
  headers: () =>
    Promise.resolve([
      {
        source: '/:path*',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
        ],
      },
    ]),
};

export default withTailwindMerge(nextConfig);
