import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { query } from '@/lib/db';
import { handleOPTIONS, withCors } from '@/lib/cors';

// Handle CORS preflight
export async function OPTIONS() {
  return handleOPTIONS();
}

// GET /api/favorites - 获取收藏列表
export async function GET() {
  try {
    const favorites = await query<any[]>(
      `SELECT id, url, prompt, filename, created_at
       FROM favorites
       ORDER BY created_at DESC
       LIMIT 100`
    );

    return withCors(NextResponse.json({ favorites }));
  } catch (error) {
    console.error('Get favorites error:', error);
    return withCors(NextResponse.json(
      { error: 'Failed to get favorites' },
      { status: 500 }
    ));
  }
}

// POST /api/favorites - 添加收藏
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, prompt, filename } = body;

    if (!url) {
      return withCors(NextResponse.json(
        { error: 'Image URL is required' },
        { status: 400 }
      ));
    }

    // 检查是否已收藏（根据 URL）
    const existingFavorites = await query<any[]>(
      'SELECT id FROM favorites WHERE url = ?',
      [url]
    );

    if (existingFavorites.length > 0) {
      return withCors(NextResponse.json(
        { error: 'Image already favorited', alreadyFavorited: true },
        { status: 400 }
      ));
    }

    const favoriteId = uuidv4();

    await query(
      'INSERT INTO favorites (id, url, prompt, filename) VALUES (?, ?, ?, ?)',
      [favoriteId, url, prompt || '', filename || `image_${Date.now()}.png`]
    );

    return withCors(NextResponse.json({ success: true, id: favoriteId }));
  } catch (error) {
    console.error('Add favorite error:', error);
    return withCors(NextResponse.json(
      { error: 'Failed to add favorite' },
      { status: 500 }
    ));
  }
}
