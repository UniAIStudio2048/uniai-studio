import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getStorageConfig, createS3Client } from '@/lib/storage';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import { handleOPTIONS, withCors } from '@/lib/cors';

// Handle CORS preflight
export async function OPTIONS() {
  return handleOPTIONS();
}

// 从存储桶导入 inspirations.json
export async function POST() {
  try {
    const config = await getStorageConfig();
    
    if (!config.enabled) {
      return withCors(NextResponse.json({ error: '存储未配置' }, { status: 400 }));
    }
    
    const client = createS3Client(config);
    
    // 读取 JSON 文件
    const command = new GetObjectCommand({
      Bucket: config.bucket,
      Key: '灵感中心/inspirations.json',
    });
    
    const response = await client.send(command);
    const jsonString = await response.Body?.transformToString('utf-8');
    
    if (!jsonString) {
      return withCors(NextResponse.json({ error: '无法读取 JSON 文件' }, { status: 500 }));
    }
    
    const data = JSON.parse(jsonString);
    
    // 解析 JSON 数据并导入数据库
    let imported = 0;
    let skipped = 0;
    
    // 假设 JSON 格式为数组 [{ title, prompt, tags, image }]
    const items = Array.isArray(data) ? data : (data.inspirations || data.items || []);
    
    for (const item of items) {
      try {
        // 检查是否已存在（通过 title 或 prompt 判断）
        const existing = await query<any[]>(
          'SELECT id FROM inspirations WHERE title = ? OR prompt = ?',
          [item.title || '', item.prompt || '']
        );
        
        if (existing.length > 0) {
          skipped++;
          continue;
        }
        
        const id = uuidv4();
        
        // 构建图片 URL - 假设图片在 灵感中心 文件夹下
        let imageUrl = '';
        if (item.image) {
          // 如果 image 是完整 URL
          if (item.image.startsWith('http')) {
            imageUrl = item.image;
          } else {
            // 如果是相对路径，构建完整 URL
            imageUrl = `https://${config.external}/${config.bucket}/灵感中心/${item.image}`;
          }
        } else if (item.image_url) {
          imageUrl = item.image_url;
        }
        
        await query(
          'INSERT INTO inspirations (id, title, prompt, tags, image_url) VALUES (?, ?, ?, ?, ?)',
          [
            id,
            item.title || item.name || '未命名灵感',
            item.prompt || item.description || '',
            item.tags || item.category || '',
            imageUrl
          ]
        );
        
        imported++;
      } catch (err) {
        console.error('导入单条记录失败:', err);
        skipped++;
      }
    }
    
    return withCors(NextResponse.json({
      success: true,
      message: `导入完成：成功 ${imported} 条，跳过 ${skipped} 条`,
      imported,
      skipped,
      total: items.length
    }));
  } catch (error) {
    console.error('导入灵感失败:', error);
    return withCors(NextResponse.json({ error: '导入失败: ' + (error as Error).message }, { status: 500 }));
  }
}
