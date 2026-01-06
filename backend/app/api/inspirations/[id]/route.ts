import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { handleOPTIONS, withCors } from '@/lib/cors';

// Handle CORS preflight
export async function OPTIONS() {
  return handleOPTIONS();
}

// 更新单个灵感
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { title, prompt, tags, image_url } = body;

    if (!title || !prompt) {
      return withCors(NextResponse.json({ error: '标题和提示词不能为空' }, { status: 400 }));
    }

    await query(
      'UPDATE inspirations SET title = ?, prompt = ?, tags = ?, image_url = ? WHERE id = ?',
      [title, prompt, tags || '', image_url || '', id]
    );

    return withCors(NextResponse.json({ success: true }));
  } catch (error) {
    console.error('更新灵感失败:', error);
    return withCors(NextResponse.json({ error: '更新灵感失败' }, { status: 500 }));
  }
}
