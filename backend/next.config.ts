import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
    proxyClientMaxBodySize: '50mb',
  },
  // 允许更大的请求体
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'objectstorageapi.bja.sealos.run',
      },
      {
        protocol: 'https',
        hostname: 'files.closeai.fans',
      },
    ],
  },
  // 配置 CORS 头
  async headers() {
    return [
      {
        // 应用到所有 API 路由
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-Api-Key',
          },
          {
            key: 'Access-Control-Max-Age',
            value: '86400',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
