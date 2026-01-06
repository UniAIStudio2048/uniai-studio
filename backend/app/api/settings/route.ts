import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { handleOPTIONS, withCors } from '@/lib/cors';

// Handle CORS preflight
export async function OPTIONS() {
  return handleOPTIONS();
}

// GET /api/settings?key=xxx
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const key = searchParams.get('key');

    if (!key) {
      return withCors(NextResponse.json(
        { error: 'Setting key is required' },
        { status: 400 }
      ));
    }

    const results = await query<any[]>(
      'SELECT setting_key, setting_value FROM settings WHERE setting_key = ?',
      [key]
    );

    if (results.length === 0) {
      return withCors(NextResponse.json({ key, value: null }));
    }

    return withCors(NextResponse.json({
      key: results[0].setting_key,
      value: results[0].setting_value,
    }));
  } catch (error: any) {
    console.error('[API Error] GET /api/settings', {
      key: request.nextUrl.searchParams.get('key'),
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
    return withCors(NextResponse.json(
      { error: 'Failed to get setting' },
      { status: 500 }
    ));
  }
}

// POST /api/settings
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { key, value } = body;

    if (!key) {
      return withCors(NextResponse.json(
        { error: 'Setting key is required' },
        { status: 400 }
      ));
    }

    // 使用 ON DUPLICATE KEY UPDATE 来插入或更新
    await query(
      `INSERT INTO settings (setting_key, setting_value)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE setting_value = ?`,
      [key, value, value]
    );

    return withCors(NextResponse.json({ success: true, key, value }));
  } catch (error: any) {
    console.error('[API Error] POST /api/settings', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
    return withCors(NextResponse.json(
      { error: 'Failed to save setting' },
      { status: 500 }
    ));
  }
}
