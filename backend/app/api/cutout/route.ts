import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import https from 'https';
import { handleOPTIONS, withCors } from '@/lib/cors';

// Handle CORS preflight
export async function OPTIONS() {
  return handleOPTIONS();
}

// 支持的抠图服务
const CUTOUT_MODELS = {
  'remove.bg': 'remove.bg',
};

// 获取 remove.bg API Key
async function getRemoveBgKey(): Promise<string | null> {
  try {
    const results = await query<any[]>(
      'SELECT setting_value FROM settings WHERE setting_key = ?',
      ['removebg_api_key']
    );
    return results.length > 0 ? results[0].setting_value : null;
  } catch (error) {
    console.error('Failed to get remove.bg key:', error);
    return null;
  }
}

// 调用 remove.bg API
async function callRemoveBgAPI(
  imageData: Buffer,
  apiKey: string
): Promise<{ buffer: Buffer | null; error?: string; status?: number }> {
  return new Promise((resolve) => {
    const FormData = require('form-data');
    const form = new FormData();
    
    // 直接发送图片 buffer
    form.append('image_file', imageData, {
      filename: 'image.jpg',
      contentType: 'image/jpeg',
    });
    form.append('size', 'auto');

    const options = {
      method: 'POST',
      hostname: 'api.remove.bg',
      path: '/v1.0/removebg',
      headers: {
        'X-Api-Key': apiKey,
        ...form.getHeaders(),
      },
    };

    const req = https.request(options, (res) => {
      const chunks: Buffer[] = [];

      res.on('data', (chunk) => {
        chunks.push(chunk);
      });

      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        
        if (res.statusCode === 200) {
          console.log(`remove.bg returned ${buffer.length} bytes`);
          resolve({ buffer });
        } else {
          const errorMsg = buffer.toString();
          console.error(`remove.bg error (${res.statusCode}):`, errorMsg);
          
          if (res.statusCode === 403) {
            resolve({ buffer: null, error: 'API Key 无效或没有额度', status: 403 });
          } else if (res.statusCode === 402) {
            resolve({ buffer: null, error: 'API 额度不足，请充值', status: 402 });
          } else if (res.statusCode === 400) {
            resolve({ buffer: null, error: `图片格式错误: ${errorMsg}`, status: 400 });
          } else {
            resolve({ buffer: null, error: `API 错误 (${res.statusCode}): ${errorMsg}`, status: res.statusCode });
          }
        }
      });
    });

    req.on('error', (error) => {
      console.error('remove.bg request failed:', error);
      resolve({ buffer: null, error: `请求失败: ${error.message}` });
    });

    form.pipe(req);
  });
}

// GET /api/cutout - 获取可用模型列表
export async function GET(request: NextRequest) {
  const removeBgKey = await getRemoveBgKey();
  
  const availableModels = [{
    id: 'remove.bg',
    name: 'remove.bg',
    available: !!removeBgKey,
  }];

  return withCors(NextResponse.json({
    models: availableModels,
    hasToken: !!removeBgKey,
  }));
}

// POST /api/cutout - 执行抠图
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const imageFile = formData.get('image') as File | null;

    if (!imageFile) {
      return withCors(NextResponse.json(
        { error: '请上传图片' },
        { status: 400 }
      ));
    }

    // 获取 remove.bg API Key
    const apiKey = await getRemoveBgKey();
    if (!apiKey) {
      return withCors(NextResponse.json(
        { error: '请先在设置中配置 remove.bg API Key' },
        { status: 400 }
      ));
    }

    // 读取图片数据
    const imageBuffer = Buffer.from(await imageFile.arrayBuffer());
    console.log('Processing cutout with remove.bg');

    const result = await callRemoveBgAPI(imageBuffer, apiKey);

    if (!result.buffer) {
      return withCors(NextResponse.json(
        { error: result.error || '抠图处理失败' },
        { status: result.status || 500 }
      ));
    }

    // 返回处理后的图片
    const base64Image = result.buffer.toString('base64');
    const mimeType = 'image/png';

    return withCors(NextResponse.json({
      success: true,
      image: `data:${mimeType};base64,${base64Image}`,
    }));
  } catch (error) {
    console.error('Cutout error:', error);
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    return withCors(NextResponse.json(
      { error: `抠图处理失败: ${errorMessage}` },
      { status: 500 }
    ));
  }
}
