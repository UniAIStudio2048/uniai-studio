import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { handleOPTIONS, withCors } from '@/lib/cors';

// Handle CORS preflight
export async function OPTIONS() {
  return handleOPTIONS();
}

// DELETE /api/favorites/:imageId - 取消收藏
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ imageId: string }> }
) {
  try {
    const { imageId } = await params;

    // imageId 可以是收藏记录的 ID 或 URL（URL 进行 URL 解码）
    const decodedUrl = decodeURIComponent(imageId);
    
    // 先尝试按 ID 删除，然后尝试按 URL 删除
    const result = await query(
      'DELETE FROM favorites WHERE id = ? OR url = ?',
      [imageId, decodedUrl]
    );

    return withCors(NextResponse.json({ success: true }));
  } catch (error) {
    console.error('Delete favorite error:', error);
    return withCors(NextResponse.json(
      { error: 'Failed to delete favorite' },
      { status: 500 }
    ));
  }
}

// GET /api/favorites/:imageId - 检查图片是否已收藏
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ imageId: string }> }
) {
  try {
    const { imageId } = await params;
    const decodedUrl = decodeURIComponent(imageId);

    const favorites = await query<any[]>(
      'SELECT id FROM favorites WHERE url = ?',
      [decodedUrl]
    );

    return withCors(NextResponse.json({
      isFavorited: favorites.length > 0,
      id: favorites.length > 0 ? favorites[0].id : null
    }));
  } catch (error) {
    console.error('Check favorite error:', error);
    return withCors(NextResponse.json(
      { error: 'Failed to check favorite' },
      { status: 500 }
    ));
  }
}
