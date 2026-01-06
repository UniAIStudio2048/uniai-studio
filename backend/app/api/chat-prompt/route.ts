import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { withCors, handleOPTIONS } from '@/lib/cors';

// Handle CORS preflight
export async function OPTIONS() {
  return handleOPTIONS();
}

// POST /api/chat-prompt - AI 对话生成提示词（支持图片）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, systemPrompt, imageUrls = [] } = body;

    if (!messages || messages.length === 0) {
      return withCors(NextResponse.json(
        { error: '请提供对话消息' },
        { status: 400 }
      ));
    }

    // 获取 API Key
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

    // 使用 Qwen 模型进行对话
    const apiUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';

    // 检查是否有图片
    const hasImages = imageUrls.length > 0 || messages.some((msg: any) => msg.images && msg.images.length > 0);

    // 构建系统提示
    const systemMessage = systemPrompt 
      ? `你是一个专业的AI图像生成提示词助手。用户将与你对话，请根据用户的描述生成适合AI图像生成的提示词。

你的职责：
1. 理解用户想要生成的图像内容
2. 如果用户上传了图片，请分析图片内容并结合用户需求
3. 询问必要的细节（如风格、场景、光线、色调等）
4. 生成详细、具体的英文提示词
5. 提示词应包含：主体描述、场景环境、艺术风格、光线效果、色彩搭配等

用户自定义的脚本要求：
${systemPrompt}

请用中文与用户对话，但生成的提示词使用英文。当你生成最终提示词时，请用【提示词】标注。`
      : `你是一个专业的AI图像生成提示词助手。用户将与你对话，请根据用户的描述生成适合AI图像生成的提示词。

你的职责：
1. 理解用户想要生成的图像内容
2. 如果用户上传了图片，请分析图片内容并结合用户需求
3. 询问必要的细节（如风格、场景、光线、色调等）
4. 生成详细、具体的英文提示词
5. 提示词应包含：主体描述、场景环境、艺术风格、光线效果、色彩搭配等

请用中文与用户对话，但生成的提示词使用英文。当你生成最终提示词时，请用【提示词】标注。`;

    // 构建消息列表
    const formattedMessages: any[] = [];
    
    // 添加系统消息（如果有图片，需要使用不同的格式）
    if (hasImages) {
      formattedMessages.push({
        role: 'system',
        content: systemMessage
      });
    } else {
      formattedMessages.push({
        role: 'system',
        content: systemMessage
      });
    }

    // 转换用户消息
    for (const msg of messages) {
      if (msg.images && msg.images.length > 0) {
        // 有图片的消息，使用多模态格式
        const content: any[] = [];
        for (const imgUrl of msg.images) {
          content.push({
            type: 'image_url',
            image_url: { url: imgUrl }
          });
        }
        content.push({
          type: 'text',
          text: msg.content || '请描述这张图片并生成提示词'
        });
        formattedMessages.push({
          role: msg.role,
          content: content
        });
      } else {
        // 纯文本消息
        formattedMessages.push({
          role: msg.role,
          content: msg.content
        });
      }
    }

    const requestBody = {
      model: hasImages ? 'qwen-vl-plus' : 'qwen-plus',  // 有图片时使用视觉模型
      messages: formattedMessages,
      max_tokens: 1500,
      temperature: 0.8,
    };

    console.log(`Calling Qwen API for chat prompt (model: ${requestBody.model}, hasImages: ${hasImages})...`);

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
      console.error('Qwen API error:', response.status, errorText);
      return withCors(NextResponse.json(
        { error: `API调用失败: ${response.status}` },
        { status: 500 }
      ));
    }

    const result = await response.json();
    const reply = result.choices?.[0]?.message?.content;

    if (!reply) {
      return withCors(NextResponse.json(
        { error: '未能获取回复' },
        { status: 500 }
      ));
    }

    console.log('Chat prompt response received');

    return withCors(NextResponse.json({
      success: true,
      reply: reply,
    }));

  } catch (error) {
    console.error('Chat prompt error:', error);
    return withCors(NextResponse.json(
      { error: 'AI对话失败' },
      { status: 500 }
    ));
  }
}
