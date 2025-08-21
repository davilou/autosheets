import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Desabilitar ESLint durante o build
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // TypeScript configurado para mostrar erros
  typescript: {
    ignoreBuildErrors: false,
  },
  
  // ... existing code ...
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
