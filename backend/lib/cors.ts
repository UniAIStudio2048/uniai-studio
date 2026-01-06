import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 获取动态 CORS headers
export function getCorsHeaders(origin: string = '*') {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-Api-Key',
    'Access-Control-Max-Age': '86400',
  };
}

// 静态 CORS headers（用于向后兼容）
export const corsHeaders = getCorsHeaders('*');

// Handle OPTIONS request for CORS preflight
export function handleOPTIONS(request?: NextRequest) {
  const origin = request?.headers.get('origin') || '*';
  const headers = getCorsHeaders(origin);
  
  const response = new NextResponse(null, {
    status: 204,
    headers,
  });

  return response;
}

// Add CORS headers to response
export function withCors(response: NextResponse, origin: string = '*') {
  const headers = getCorsHeaders(origin);
  
  // 设置所有 CORS headers
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}
