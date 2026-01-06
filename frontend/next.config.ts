import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: [
    'https://smweptdziigq.sealosbja.site',
  ],
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
      {
        protocol: 'https',
        hostname: 'webstatic.aiproxy.vip',
      },
      {
        protocol: 'https',
        hostname: '*.sealos.run',
      },
      {
        protocol: 'https',
        hostname: 'cdn3.dmiapi.com',
      },
      {
        protocol: 'https',
        hostname: '*.dmiapi.com',
      },
    ],
  },
  // 代理后端 API 请求
  // 生产环境不使用 rewrites，直接访问后端公网地址
  // 开发环境通过环境变量 BACKEND_URL 配置后端地址（默认 localhost:4001）
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL;

    // 如果未设置 BACKEND_URL（生产环境），不进行 rewrite
    if (!backendUrl) {
      return [];
    }

    // 开发环境使用 rewrite 代理
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
