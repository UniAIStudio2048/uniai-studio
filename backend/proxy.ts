import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Next.js 16: 使用 proxy 替代 middleware
export function proxy(request: NextRequest) {
  // 获取请求来源，如果没有则使用通配符
  const origin = request.headers.get('origin') || '*';
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': origin, // 动态设置来源
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-Api-Key',
    'Access-Control-Max-Age': '86400',
  };

  // Handle preflight requests (OPTIONS)
  if (request.method === 'OPTIONS') {
    const preflightResponse = new NextResponse(null, {
      status: 204,
      headers: corsHeaders,
    });

    return preflightResponse;
  }

  // Handle actual requests
  const response = NextResponse.next();

  // 强制设置所有CORS headers
  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

export const config = {
  matcher: '/api/:path*',
};
