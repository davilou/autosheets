import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === 'development';

const nextConfig: NextConfig = {
  // Configuração para Cloudflare Pages (apenas em produção)
  ...(isDev ? {} : {
    output: 'export',
    trailingSlash: true,
    images: {
      unoptimized: true
    }
  }),
  
  // Headers de segurança (funcionam em desenvolvimento)
  async headers() {
    return [
      {
        source: '/api/telegram/webhook',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: 'https://api.telegram.org',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'POST',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type',
          },
        ],
      },
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
