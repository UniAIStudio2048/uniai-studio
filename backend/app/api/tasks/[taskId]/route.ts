import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { handleOPTIONS, withCors } from '@/lib/cors';

// Handle CORS preflight
export async function OPTIONS() {
  return handleOPTIONS();
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;

    const results = await query<any[]>(
      `SELECT t.*, i.url as result_image_url, i.filename as result_image_filename
       FROM tasks t
       LEFT JOIN images i ON t.result_image_id = i.id
       WHERE t.id = ?`,
      [taskId]
    );

    if (results.length === 0) {
      return withCors(NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      ));
    }

    return withCors(NextResponse.json(results[0]));
  } catch (error) {
    console.error('Get task error:', error);
    return withCors(NextResponse.json(
      { error: 'Failed to get task' },
      { status: 500 }
    ));
  }
}
