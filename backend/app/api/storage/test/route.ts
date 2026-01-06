import { NextRequest, NextResponse } from 'next/server';
import { S3Client, ListBucketsCommand } from '@aws-sdk/client-s3';
import { handleOPTIONS, withCors } from '@/lib/cors';

// Handle CORS preflight
export async function OPTIONS() {
  return handleOPTIONS();
}

export async function POST(request: NextRequest) {
  try {
    const { external, bucket, accessKey, secretKey } = await request.json();

    if (!external || !bucket || !accessKey || !secretKey) {
      return withCors(NextResponse.json(
        { error: '请填写完整的配置信息' },
        { status: 400 }
      ));
    }

    const client = new S3Client({
      endpoint: `https://${external}`,
      region: 'us-east-1',
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
      },
      forcePathStyle: true,
    });

    // 测试连接
    const command = new ListBucketsCommand({});
    const response = await client.send(command);

    // 检查 bucket 是否存在
    const bucketExists = response.Buckets?.some(b => b.Name === bucket);

    if (!bucketExists) {
      return withCors(NextResponse.json(
        { error: `Bucket "${bucket}" 不存在` },
        { status: 400 }
      ));
    }

    return withCors(NextResponse.json({
      success: true,
      message: '连接成功',
      buckets: response.Buckets?.map(b => b.Name)
    }));
  } catch (error) {
    console.error('Storage test error:', error);
    return withCors(NextResponse.json(
      { error: '连接失败: ' + (error instanceof Error ? error.message : '未知错误') },
      { status: 500 }
    ));
  }
}
