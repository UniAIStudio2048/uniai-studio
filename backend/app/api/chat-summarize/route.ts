import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { withCors, handleOPTIONS } from '@/lib/cors';

// Handle CORS preflight
export async function OPTIONS() {
  return handleOPTIONS();
}

// POST /api/chat-summarize - 总结对话上下文
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages } = body;

    if (!messages || messages.length === 0) {
      return withCors(NextResponse.json(
        { error: '请提供需要总结的消息' },
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
    const apiUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';

    // 构建总结请求
    const conversationText = messages
      .filter((m: any) => m.role !== 'summary')
      .map((m: any) => `${m.role === 'user' ? '用户' : 'AI'}: ${m.content}`)
      .join('\n\n');

    const requestBody = {
      model: 'qwen-plus',
      messages: [
        {
          role: 'system',
          content: `你是一个对话总结助手。请将以下对话总结成简洁的摘要，保留关键信息：
1. 用户的核心需求和偏好
2. AI 已经提供的重要建议或提示词
3. 对话中确定的风格、主题等关键信息

总结应该简洁但信息完整，以便在后续对话中作为上下文参考。请用第三人称描述。`
        },
        {
          role: 'user',
          content: `请总结以下对话：\n\n${conversationText}`
        }
      ],
      max_tokens: 500,
      temperature: 0.3,
    };

    console.log('Calling Qwen API for context summarization...');

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
        { error: `总结失败: ${response.status}` },
        { status: 500 }
      ));
    }

    const result = await response.json();
    const summary = result.choices?.[0]?.message?.content;

    if (!summary) {
      return withCors(NextResponse.json(
        { error: '未能生成总结' },
        { status: 500 }
      ));
    }

    console.log('Context summary generated');

    return withCors(NextResponse.json({
      success: true,
      summary: summary,
    }));

  } catch (error) {
    console.error('Summarize error:', error);
    return withCors(NextResponse.json(
      { error: '总结失败' },
      { status: 500 }
    ));
  }
}
