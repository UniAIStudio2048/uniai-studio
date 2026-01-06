import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { handleOPTIONS, withCors } from '@/lib/cors';

// Handle CORS preflight
export async function OPTIONS() {
  return handleOPTIONS();
}

// GET /api/removebg/account - 代理检查 remove.bg 账户额度
export async function GET(request: NextRequest) {
  try {
    // 从数据库获取 remove.bg API Key
    const results = await query<any[]>(
      'SELECT setting_value FROM settings WHERE setting_key = ?',
      ['removebg_api_key']
    );

    if (results.length === 0 || !results[0].setting_value) {
      return withCors(NextResponse.json(
        { error: 'remove.bg API Key 未配置' },
        { status: 400 }
      ));
    }

    const apiKey = results[0].setting_value;

    // 代理请求到 remove.bg API
    const response = await fetch('https://api.remove.bg/v1.0/account', {
      headers: {
        'X-Api-Key': apiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return withCors(NextResponse.json(
        { error: `remove.bg API 错误: ${response.status}`, details: errorText },
        { status: response.status }
      ));
    }

    const data = await response.json();
    return withCors(NextResponse.json(data));
  } catch (error) {
    console.error('remove.bg account check error:', error);
    return withCors(NextResponse.json(
      { error: '检查账户额度失败' },
      { status: 500 }
    ));
  }
}

// POST /api/removebg/account - 使用提供的 API Key 检查额度（用于保存前验证）
export async function POST(request: NextRequest) {
  try {
    const { apiKey } = await request.json();

    if (!apiKey) {
      return withCors(NextResponse.json(
        { error: 'API Key 不能为空' },
        { status: 400 }
      ));
    }

    // 代理请求到 remove.bg API
    const response = await fetch('https://api.remove.bg/v1.0/account', {
      headers: {
        'X-Api-Key': apiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return withCors(NextResponse.json(
        { error: `API Key 无效或已过期`, details: errorText },
        { status: response.status }
      ));
    }

    const data = await response.json();
    return withCors(NextResponse.json(data));
  } catch (error) {
    console.error('remove.bg account check error:', error);
    return withCors(NextResponse.json(
      { error: '检查账户额度失败' },
      { status: 500 }
    ));
  }
}
