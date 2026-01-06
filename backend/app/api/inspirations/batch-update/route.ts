import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { handleOPTIONS, withCors } from '@/lib/cors';

// Handle CORS preflight
export async function OPTIONS() {
  return handleOPTIONS();
}

// 批量更新排序
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { updates } = body; // updates: [{id, sort_order}, ...]

    if (!updates || !Array.isArray(updates)) {
      return withCors(NextResponse.json({ error: '缺少参数' }, { status: 400 }));
    }

    // 使用事务批量更新
    for (const item of updates) {
      await query('UPDATE inspirations SET sort_order = ? WHERE id = ?', [item.sort_order, item.id]);
    }

    return withCors(NextResponse.json({ success: true, updated: updates.length }));
  } catch (error) {
    console.error('批量更新排序失败:', error);
    return withCors(NextResponse.json({ error: '批量更新排序失败' }, { status: 500 }));
  }
}
