import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { uploadToS3Input, getStorageConfig } from '@/lib/storage';
import { query } from '@/lib/db';
import { handleOPTIONS, withCors } from '@/lib/cors';

// App Router 不支持传统 config，需要使用下面的方式
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Handle CORS preflight
export async function OPTIONS() {
  return handleOPTIONS();
}

export async function POST(request: NextRequest) {
  try {
    console.log('Upload request received');
    
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      console.log('No file in request');
      return withCors(NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      ));
    }

    console.log('File received:', file.name, 'Type:', file.type, 'Size:', file.size);

    // 验证文件类型
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/bmp'];
    if (!allowedTypes.includes(file.type)) {
      console.log('Invalid file type:', file.type);
      return withCors(NextResponse.json(
        { error: `File type ${file.type} is not allowed.` },
        { status: 400 }
      ));
    }

    // 验证文件大小 (10MB)
    if (file.size > 10 * 1024 * 1024) {
      return withCors(NextResponse.json(
        { error: 'File size must be less than 10MB' },
        { status: 400 }
      ));
    }

    // 转换为 Buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const imageId = uuidv4();
    const format = file.type.split('/')[1];

    // 检查对象存储配置
    const storageConfig = await getStorageConfig();
    
    if (storageConfig.enabled && storageConfig.external && storageConfig.bucket) {
      // 使用对象存储 - 上传到 input 文件夹
      console.log('Using object storage (input folder)');
      const url = await uploadToS3Input(buffer, file.name, file.type);
      
      if (url) {
        const storagePath = url.split('/').slice(3).join('/');
        
        // 保存到数据库
        await query(
          `INSERT INTO images (id, filename, url, storage_path, size, format)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [imageId, file.name, url, storagePath, file.size, format]
        );

        return withCors(NextResponse.json({
          id: imageId,
          url,
          filename: file.name,
          size: file.size,
          format,
          mode: 'url',
        }));
      }
    }

    // 未配置对象存储，使用 base64
    console.log('Using base64 mode');
    const base64 = buffer.toString('base64');
    const dataUrl = `data:${file.type};base64,${base64}`;

    // 保存到数据库（不存 base64，只存元数据）
    await query(
      `INSERT INTO images (id, filename, url, storage_path, size, format)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [imageId, file.name, 'base64', 'local', file.size, format]
    );

    return withCors(NextResponse.json({
      id: imageId,
      url: dataUrl,
      filename: file.name,
      size: file.size,
      format,
      mode: 'base64',
    }));
  } catch (error) {
    console.error('Upload error:', error);
    return withCors(NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    ));
  }
}
