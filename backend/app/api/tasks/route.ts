import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { query } from '@/lib/db';
import { handleOPTIONS, withCors } from '@/lib/cors';
import { deleteFromS3ByUrl } from '@/lib/storage';

// 保留天数配置
const RETENTION_DAYS = 20;

// 后台清理过期任务（异步执行，不阻塞响应）
async function cleanupOldTasksBackground() {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);
    const cutoffDateStr = cutoffDate.toISOString().slice(0, 19).replace('T', ' ');

    // 获取要删除的任务
    const oldTasks = await query<any[]>(
      `SELECT id, result_images FROM tasks WHERE created_at < ? LIMIT 10`,
      [cutoffDateStr]
    );

    if (oldTasks.length === 0) return;

    // 删除 S3 中的图片
    for (const task of oldTasks) {
      if (task.result_images) {
        try {
          const images = JSON.parse(task.result_images);
          for (const imageUrl of images) {
            if (imageUrl && typeof imageUrl === 'string' && imageUrl.includes('http')) {
              await deleteFromS3ByUrl(imageUrl);
            }
          }
        } catch (e) {
          // 忽略解析错误
        }
      }
    }

    // 删除数据库记录
    const taskIds = oldTasks.map(t => t.id);
    if (taskIds.length > 0) {
      await query(
        `DELETE FROM tasks WHERE id IN (${taskIds.map(() => '?').join(',')})`,
        taskIds
      );
      console.log(`[Auto Cleanup] Deleted ${taskIds.length} old tasks`);
    }
  } catch (error) {
    console.error('[Auto Cleanup] Error:', error);
  }
}

// Handle CORS preflight
export async function OPTIONS() {
  return handleOPTIONS();
}

// GET /api/tasks - 获取任务列表（排除 Z-Image 任务）
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '50');

    // 异步触发后台清理（不等待完成）
    cleanupOldTasksBackground();

    // 查询最近 RETENTION_DAYS 天的任务，排除 Z-Image 模型的任务
    const tasks = await query<any[]>(
      `SELECT t.*, i.url as result_image_url, i.filename as result_image_filename
       FROM tasks t
       LEFT JOIN images i ON t.result_image_id = i.id
       WHERE t.created_at >= DATE_SUB(NOW(), INTERVAL ${RETENTION_DAYS} DAY)
         AND (t.model IS NULL OR t.model != 'z-image-turbo')
       ORDER BY t.created_at DESC
       LIMIT ${limit}`
    );

    // 解析 result_images JSON 字段
    const parsedTasks = tasks.map(task => ({
      ...task,
      result_images: task.result_images ? JSON.parse(task.result_images) : []
    }));

    return withCors(NextResponse.json({ tasks: parsedTasks }));
  } catch (error) {
    console.error('Get tasks error:', error);
    return withCors(NextResponse.json(
      { error: 'Failed to get tasks' },
      { status: 500 }
    ));
  }
}

// POST /api/tasks - 创建新任务
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, resolution = '2K', batchCount = 1, imageId } = body;

    if (!prompt || prompt.length === 0) {
      return withCors(NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      ));
    }

    if (prompt.length > 500) {
      return withCors(NextResponse.json(
        { error: 'Prompt must be less than 500 characters' },
        { status: 400 }
      ));
    }

    const taskId = uuidv4();

    await query(
      `INSERT INTO tasks (id, prompt, status, resolution, batch_count)
       VALUES (?, ?, 'pending', ?, ?)`,
      [taskId, prompt, resolution, batchCount]
    );

    return withCors(NextResponse.json({
      taskId,
      status: 'pending',
      prompt,
      resolution,
      batchCount,
    }));
  } catch (error) {
    console.error('Create task error:', error);
    return withCors(NextResponse.json(
      { error: 'Failed to create task' },
      { status: 500 }
    ));
  }
}
