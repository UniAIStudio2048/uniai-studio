import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { handleOPTIONS, withCors } from '@/lib/cors';

// Handle CORS preflight
export async function OPTIONS() {
  return handleOPTIONS();
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const health: any = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {
      database: 'unknown',
    },
  };

  // 检查数据库连接
  try {
    await query('SELECT 1');
    health.checks.database = 'healthy';
  } catch (error: any) {
    health.checks.database = 'unhealthy';
    health.status = 'degraded';
    console.error('[Health Check] Database check failed:', error.message);
  }

  // 计算响应时间
  health.responseTime = `${Date.now() - startTime}ms`;

  const statusCode = health.status === 'healthy' ? 200 : 503;

  return withCors(NextResponse.json(health, { status: statusCode }));
}
