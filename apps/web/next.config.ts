import path from 'node:path';

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  agentRules: false,
  reactCompiler: true,
  output: 'standalone',
  outputFileTracingRoot: path.join(import.meta.dirname, '../..'),
};

export default nextConfig;
