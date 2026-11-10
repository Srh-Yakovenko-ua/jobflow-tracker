import path from 'node:path';

import { withTailwindMerge } from '@tailwind-merge/next';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  agentRules: false,
  reactCompiler: true,
  allowedDevOrigins: ['127.0.0.1'],
  output: 'standalone',
  outputFileTracingRoot: path.join(import.meta.dirname, '../..'),
  headers: () =>
    Promise.resolve([
      {
        source: '/:path*',
        headers: [{ key: 'Cross-Origin-Opener-Policy', value: 'same-origin' }],
      },
    ]),
};

export default withTailwindMerge(nextConfig);
