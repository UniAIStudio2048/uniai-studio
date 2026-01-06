import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getStorageConfig, createS3Client } from '@/lib/storage';
import { GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import { handleOPTIONS, withCors } from '@/lib/cors';

// Handle CORS preflight
export async function OPTIONS() {
  return handleOPTIONS();
}

// 获取所有灵感
export async function GET() {
  try {
    const inspirations = await query<any[]>(
      'SELECT * FROM inspirations ORDER BY sort_order ASC, created_at DESC'
    );

    return withCors(NextResponse.json({ inspirations }));
  } catch (error) {
    console.error('获取灵感列表失败:', error);
    return withCors(NextResponse.json({ error: '获取灵感列表失败' }, { status: 500 }));
  }
}

// 添加新灵感
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, prompt, tags, image_url } = body;

    if (!title || !prompt) {
      return withCors(NextResponse.json({ error: '标题和提示词不能为空' }, { status: 400 }));
    }

    const id = uuidv4();

    // 获取当前最大的sort_order，新灵感的sort_order设置为最大值+1，这样新灵感会排在最后
    const maxSortResult = await query<any[]>(
      'SELECT MAX(sort_order) as max_sort FROM inspirations'
    );
    const maxSort = maxSortResult[0]?.max_sort || 0;
    const newSortOrder = maxSort + 1;

    await query(
      'INSERT INTO inspirations (id, title, prompt, tags, image_url, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
      [id, title, prompt, tags || '', image_url || '', newSortOrder]
    );

    return withCors(NextResponse.json({
      success: true,
      inspiration: { id, title, prompt, tags, image_url, sort_order: newSortOrder }
    }));
  } catch (error) {
    console.error('添加灵感失败:', error);
    return withCors(NextResponse.json({ error: '添加灵感失败' }, { status: 500 }));
  }
}

// 删除灵感
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return withCors(NextResponse.json({ error: '缺少 ID' }, { status: 400 }));
    }

    await query('DELETE FROM inspirations WHERE id = ?', [id]);

    return withCors(NextResponse.json({ success: true }));
  } catch (error) {
    console.error('删除灵感失败:', error);
    return withCors(NextResponse.json({ error: '删除灵感失败' }, { status: 500 }));
  }
}

// 更新排序
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, sort_order } = body;

    if (!id || sort_order === undefined) {
      return withCors(NextResponse.json({ error: '缺少参数' }, { status: 400 }));
    }

    await query('UPDATE inspirations SET sort_order = ? WHERE id = ?', [sort_order, id]);

    return withCors(NextResponse.json({ success: true }));
  } catch (error) {
    console.error('更新排序失败:', error);
    return withCors(NextResponse.json({ error: '更新排序失败' }, { status: 500 }));
  }
}
