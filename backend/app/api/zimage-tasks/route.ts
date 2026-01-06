import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { handleOPTIONS, withCors } from '@/lib/cors';
import { deleteFromS3ByUrl } from '@/lib/storage';

// 保留天数配置
const RETENTION_DAYS = 20;

// 后台清理过期 Z-Image 任务（异步执行，不阻塞响应）
async function cleanupOldZImageTasksBackground() {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);
    const cutoffDateStr = cutoffDate.toISOString().slice(0, 19).replace('T', ' ');

    // 获取要删除的 Z-Image 任务
    const oldTasks = await query<any[]>(
      `SELECT id, result_images FROM tasks WHERE model = 'z-image-turbo' AND created_at < ? LIMIT 10`,
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
      console.log(`[Z-Image Auto Cleanup] Deleted ${taskIds.length} old tasks`);
    }
  } catch (error) {
    console.error('[Z-Image Auto Cleanup] Error:', error);
  }
}

// Handle CORS preflight
export async function OPTIONS() {
  return handleOPTIONS();
}

// GET /api/zimage-tasks - 获取 Z-Image 专用任务列表
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '50');

    // 异步触发后台清理（不等待完成）
    cleanupOldZImageTasksBackground();

    // 只查询 Z-Image 模型的任务，最近 RETENTION_DAYS 天
    const tasks = await query<any[]>(
      `SELECT t.*, i.url as result_image_url, i.filename as result_image_filename
       FROM tasks t
       LEFT JOIN images i ON t.result_image_id = i.id
       WHERE t.model = 'z-image-turbo' AND t.created_at >= DATE_SUB(NOW(), INTERVAL ${RETENTION_DAYS} DAY)
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
    console.error('Get Z-Image tasks error:', error);
    return withCors(NextResponse.json(
      { error: 'Failed to get Z-Image tasks' },
      { status: 500 }
    ));
  }
}

// DELETE /api/zimage-tasks - 清空所有或删除单个 Z-Image 任务
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const taskId = searchParams.get('taskId');
    const batchId = searchParams.get('batchId');

    // 删除单个任务
    if (taskId) {
      const task = await query<any[]>(
        `SELECT id, result_images FROM tasks WHERE id = ? AND model = 'z-image-turbo'`,
        [taskId]
      );

      if (task.length > 0 && task[0].result_images) {
        try {
          const images = JSON.parse(task[0].result_images);
          for (const imageUrl of images) {
            if (imageUrl && typeof imageUrl === 'string' && imageUrl.includes('http')) {
              await deleteFromS3ByUrl(imageUrl);
            }
          }
        } catch (e) {
          // 忽略解析错误
        }
      }

      await query(`DELETE FROM tasks WHERE id = ?`, [taskId]);
      return withCors(NextResponse.json({ success: true, message: 'Task deleted' }));
    }

    // 删除整个批次
    if (batchId) {
      const tasks = await query<any[]>(
        `SELECT id, result_images FROM tasks WHERE batch_id = ? AND model = 'z-image-turbo'`,
        [batchId]
      );

      for (const task of tasks) {
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

      await query(`DELETE FROM tasks WHERE batch_id = ?`, [batchId]);
      return withCors(NextResponse.json({ 
        success: true, 
        message: 'Batch deleted',
        deletedCount: tasks.length
      }));
    }

    // 清空所有任务
    const tasks = await query<any[]>(
      `SELECT id, result_images FROM tasks WHERE model = 'z-image-turbo'`
    );

    // 删除 S3 中的图片
    for (const task of tasks) {
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

    // 删除数据库中的任务
    await query(`DELETE FROM tasks WHERE model = 'z-image-turbo'`);

    return withCors(NextResponse.json({ 
      success: true, 
      message: 'All Z-Image tasks cleared',
      deletedCount: tasks.length
    }));
  } catch (error) {
    console.error('Delete Z-Image tasks error:', error);
    return withCors(NextResponse.json(
      { error: 'Failed to delete Z-Image tasks' },
      { status: 500 }
    ));
  }
}
