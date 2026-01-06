import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cleanupOldS3Files, deleteFromS3ByUrl } from '@/lib/storage';
import { handleOPTIONS, withCors } from '@/lib/cors';

// 保留天数配置
const RETENTION_DAYS = 20;

// Handle CORS preflight
export async function OPTIONS() {
  return handleOPTIONS();
}

// 清理过期的任务记录
async function cleanupOldTasks(): Promise<{ tasksDeleted: number; imagesDeleted: number }> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);
  const cutoffDateStr = cutoffDate.toISOString().slice(0, 19).replace('T', ' ');

  // 先获取要删除的任务及其图片 URL
  const oldTasks = await query<any[]>(
    `SELECT id, result_images FROM tasks WHERE created_at < ?`,
    [cutoffDateStr]
  );

  let imagesDeleted = 0;

  // 删除 S3 中的图片
  for (const task of oldTasks) {
    if (task.result_images) {
      try {
        const images = JSON.parse(task.result_images);
        for (const imageUrl of images) {
          if (imageUrl && typeof imageUrl === 'string' && imageUrl.includes('http')) {
            const deleted = await deleteFromS3ByUrl(imageUrl);
            if (deleted) imagesDeleted++;
          }
        }
      } catch (e) {
        console.error('Failed to parse result_images:', e);
      }
    }
  }

  // 删除数据库中的任务记录
  const result = await query(
    `DELETE FROM tasks WHERE created_at < ?`,
    [cutoffDateStr]
  ) as any;

  const tasksDeleted = result.affectedRows || oldTasks.length;

  return { tasksDeleted, imagesDeleted };
}

// 清理过期的图片记录
async function cleanupOldImages(): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);
  const cutoffDateStr = cutoffDate.toISOString().slice(0, 19).replace('T', ' ');

  // 获取要删除的图片
  const oldImages = await query<any[]>(
    `SELECT id, url FROM images WHERE created_at < ?`,
    [cutoffDateStr]
  );

  // 删除 S3 中的图片
  for (const image of oldImages) {
    if (image.url && image.url.includes('http')) {
      await deleteFromS3ByUrl(image.url);
    }
  }

  // 删除数据库记录
  const result = await query(
    `DELETE FROM images WHERE created_at < ?`,
    [cutoffDateStr]
  ) as any;

  return result.affectedRows || oldImages.length;
}

// POST /api/cleanup - 执行清理
export async function POST(request: NextRequest) {
  try {
    console.log(`Starting cleanup (retention: ${RETENTION_DAYS} days)...`);

    // 清理任务
    const { tasksDeleted, imagesDeleted: taskImagesDeleted } = await cleanupOldTasks();
    
    // 清理图片表
    const imagesDeleted = await cleanupOldImages();
    
    // 清理 S3 中的过期文件
    const s3Cleanup = await cleanupOldS3Files(RETENTION_DAYS);

    const result = {
      success: true,
      retentionDays: RETENTION_DAYS,
      tasksDeleted,
      taskImagesDeleted,
      imagesDeleted,
      s3FilesDeleted: s3Cleanup.deleted,
      s3Errors: s3Cleanup.errors,
      cleanedAt: new Date().toISOString(),
    };

    console.log('Cleanup completed:', result);

    return withCors(NextResponse.json(result));
  } catch (error) {
    console.error('Cleanup error:', error);
    return withCors(NextResponse.json(
      { error: 'Cleanup failed', details: String(error) },
      { status: 500 }
    ));
  }
}

// GET /api/cleanup - 获取清理状态/预览
export async function GET(request: NextRequest) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);
    const cutoffDateStr = cutoffDate.toISOString().slice(0, 19).replace('T', ' ');

    // 统计将被删除的记录数
    const taskCount = await query<any[]>(
      `SELECT COUNT(*) as count FROM tasks WHERE created_at < ?`,
      [cutoffDateStr]
    );

    const imageCount = await query<any[]>(
      `SELECT COUNT(*) as count FROM images WHERE created_at < ?`,
      [cutoffDateStr]
    );

    return withCors(NextResponse.json({
      retentionDays: RETENTION_DAYS,
      cutoffDate: cutoffDateStr,
      pendingDeletion: {
        tasks: taskCount[0]?.count || 0,
        images: imageCount[0]?.count || 0,
      },
      message: `${RETENTION_DAYS}天前的记录将被清理`,
    }));
  } catch (error) {
    console.error('Cleanup status error:', error);
    return withCors(NextResponse.json(
      { error: 'Failed to get cleanup status' },
      { status: 500 }
    ));
  }
}

