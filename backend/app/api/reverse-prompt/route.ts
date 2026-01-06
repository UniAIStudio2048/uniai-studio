import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { withCors, handleOPTIONS } from '@/lib/cors';

// 预设脚本模板
const PRESET_SCRIPTS: Record<string, string> = {
  'default': '请详细描述这张图片的内容，包括主体、场景、风格、光线、色调、构图等细节，用于AI图像生成的提示词。请用英文输出。',
  'portrait': '请分析这张人像照片，详细描述人物的外貌特征（发型、肤色、表情、服装）、姿势、背景环境、光线效果和整体风格。请用英文输出，格式适合作为AI图像生成的提示词。',
  'landscape': '请描述这张风景图片，包括自然元素（天空、云、山、水、植物等）、季节氛围、时间段（日出/日落/夜晚）、色彩搭配和艺术风格。请用英文输出。',
  'product': '请分析这张产品图片，描述产品的外观、材质、颜色、摆放角度、背景环境和光线效果。请用英文输出，适合作为电商或广告图片的AI生成提示词。',
  'anime': '请将这张图片转换为动漫/插画风格的描述，包括角色特征、画风（如日系动漫、赛博朋克、水彩等）、场景元素和整体氛围。请用英文输出。',
  'artistic': '请从艺术角度分析这张图片，描述其艺术风格（如印象派、极简主义、超现实主义等）、色彩运用、构图技巧和情感表达。请用英文输出。',
  'chinese': '请详细描述这张图片的内容，包括主体、场景、风格、光线、色调、构图等细节。请用中文输出，作为AI图像生成的提示词。',
};

// Handle CORS preflight
export async function OPTIONS() {
  return handleOPTIONS();
}

// POST /api/reverse-prompt - 反推提示词（支持多图）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageUrl, imageUrls, preset = 'default', customPrompt } = body;

    // 支持单图和多图
    const urls: string[] = imageUrls || (imageUrl ? [imageUrl] : []);

    if (urls.length === 0) {
      return withCors(NextResponse.json(
        { error: '请提供图片URL' },
        { status: 400 }
      ));
    }

    // 获取 API Key（使用与 Z-Image 相同的 DashScope API Key）
    const apiKeyResults = await query<any[]>(
      'SELECT setting_value FROM settings WHERE setting_key = ?',
      ['zimage_api_key']
    );

    if (apiKeyResults.length === 0 || !apiKeyResults[0].setting_value) {
      return withCors(NextResponse.json(
        { error: '请先配置 DashScope API Key' },
        { status: 400 }
      ));
    }

    const apiKey = apiKeyResults[0].setting_value;

    // 使用自定义提示或预设脚本
    const systemPrompt = customPrompt || PRESET_SCRIPTS[preset] || PRESET_SCRIPTS['default'];

    // 调用 Qwen-VL API（使用 OpenAI 兼容模式）
    const apiUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
    
    // 构建多图内容
    const content: any[] = [];
    urls.forEach((url, index) => {
      content.push({
        type: 'image_url',
        image_url: { url: url }
      });
    });
    content.push({
      type: 'text',
      text: systemPrompt
    });

    const requestBody = {
      model: 'qwen-vl-plus',
      messages: [
        {
          role: 'user',
          content: content
        }
      ],
      max_tokens: 1500,
    };

    console.log(`Calling Qwen-VL API for reverse prompt with ${urls.length} images...`);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Qwen-VL API error:', response.status, errorText);
      return withCors(NextResponse.json(
        { error: `API调用失败: ${response.status}` },
        { status: 500 }
      ));
    }

    const result = await response.json();
    const generatedPrompt = result.choices?.[0]?.message?.content;

    if (!generatedPrompt) {
      return withCors(NextResponse.json(
        { error: '未能生成提示词' },
        { status: 500 }
      ));
    }

    console.log('Reverse prompt generated successfully');

    return withCors(NextResponse.json({
      success: true,
      prompt: generatedPrompt,
      preset: preset,
      imageCount: urls.length,
    }));

  } catch (error) {
    console.error('Reverse prompt error:', error);
    return withCors(NextResponse.json(
      { error: '反推提示词失败' },
      { status: 500 }
    ));
  }
}

// GET /api/reverse-prompt/presets - 获取预设脚本列表
export async function GET() {
  const presets = Object.entries(PRESET_SCRIPTS).map(([key, value]) => ({
    id: key,
    name: getPresetName(key),
    prompt: value,
  }));

  return withCors(NextResponse.json({ presets }));
}

function getPresetName(key: string): string {
  const names: Record<string, string> = {
    'default': '通用描述',
    'portrait': '人像照片',
    'landscape': '风景图片',
    'product': '产品图片',
    'anime': '动漫/插画',
    'artistic': '艺术风格',
    'chinese': '中文输出',
  };
  return names[key] || key;
}
