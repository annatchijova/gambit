import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /**
   * Standalone output traces the exact server dependencies into
   * `.next/standalone`, so the Cloud Run runtime image ships a minimal
   * node_modules instead of the full install. See Dockerfile.
   */
  output: 'standalone',
};

export default nextConfig;
