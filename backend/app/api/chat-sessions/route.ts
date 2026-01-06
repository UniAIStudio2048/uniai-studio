import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { withCors, handleOPTIONS } from '@/lib/cors';
import { v4 as uuidv4 } from 'uuid';

// Handle CORS preflight
export async function OPTIONS() {
  return handleOPTIONS();
}

// 上下文压缩阈值（消息数量）
const CONTEXT_COMPRESSION_THRESHOLD = 20;
// 保留最近消息数量（压缩时保留）
const KEEP_RECENT_MESSAGES = 6;

// GET /api/chat-sessions - 获取所有会话或单个会话的消息
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    // 先清理过期的会话
    await query('DELETE FROM zimage_chat_sessions WHERE expires_at < NOW()');

    if (sessionId) {
      // 获取单个会话的消息
      const messages = await query<any[]>(
        `SELECT id, role, content, images, token_count, created_at 
         FROM zimage_chat_messages 
         WHERE session_id = ? 
         ORDER BY created_at ASC`,
        [sessionId]
      );

      const session = await query<any[]>(
        'SELECT id, title, summary, message_count, created_at, updated_at FROM zimage_chat_sessions WHERE id = ?',
        [sessionId]
      );

      return withCors(NextResponse.json({
        success: true,
        session: session[0] || null,
        messages: messages.map(m => ({
          id: m.id,
          role: m.role,
          content: m.content,
          images: m.images ? JSON.parse(m.images) : undefined,
          tokenCount: m.token_count,
          createdAt: m.created_at,
        })),
      }));
    } else {
      // 获取所有会话列表
      const sessions = await query<any[]>(
        `SELECT id, title, summary, message_count, created_at, updated_at, expires_at 
         FROM zimage_chat_sessions 
         ORDER BY updated_at DESC 
         LIMIT 50`
      );

      return withCors(NextResponse.json({
        success: true,
        sessions: sessions.map(s => ({
          id: s.id,
          title: s.title,
          summary: s.summary,
          messageCount: s.message_count,
          createdAt: s.created_at,
          updatedAt: s.updated_at,
          expiresAt: s.expires_at,
        })),
      }));
    }
  } catch (error) {
    console.error('Get chat sessions error:', error);
    return withCors(NextResponse.json(
      { error: '获取对话失败' },
      { status: 500 }
    ));
  }
}

// POST /api/chat-sessions - 创建会话或添加消息
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, sessionId, message, title } = body;

    if (action === 'create') {
      // 创建新会话
      const newId = uuidv4();
      await query(
        `INSERT INTO zimage_chat_sessions (id, title, expires_at) 
         VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 10 DAY))`,
        [newId, title || 'AI 对话']
      );

      return withCors(NextResponse.json({
        success: true,
        sessionId: newId,
      }));
    } else if (action === 'addMessage') {
      // 添加消息到会话
      if (!sessionId || !message) {
        return withCors(NextResponse.json(
          { error: '缺少必要参数' },
          { status: 400 }
        ));
      }

      // 简单的 token 估算（中文约 2 字符/token，英文约 4 字符/token）
      const tokenCount = Math.ceil(message.content.length / 2);

      await query(
        `INSERT INTO zimage_chat_messages (session_id, role, content, images, token_count) 
         VALUES (?, ?, ?, ?, ?)`,
        [
          sessionId,
          message.role,
          message.content,
          message.images ? JSON.stringify(message.images) : null,
          tokenCount,
        ]
      );

      // 更新会话消息计数和过期时间
      await query(
        `UPDATE zimage_chat_sessions 
         SET message_count = message_count + 1, 
             expires_at = DATE_ADD(NOW(), INTERVAL 10 DAY)
         WHERE id = ?`,
        [sessionId]
      );

      // 检查是否需要上下文压缩
      const countResult = await query<any[]>(
        'SELECT COUNT(*) as count FROM zimage_chat_messages WHERE session_id = ?',
        [sessionId]
      );
      const messageCount = countResult[0]?.count || 0;

      let needsCompression = false;
      if (messageCount > CONTEXT_COMPRESSION_THRESHOLD) {
        needsCompression = true;
      }

      return withCors(NextResponse.json({
        success: true,
        needsCompression,
        messageCount,
      }));
    } else if (action === 'updateTitle') {
      // 更新会话标题
      await query(
        'UPDATE zimage_chat_sessions SET title = ? WHERE id = ?',
        [title, sessionId]
      );

      return withCors(NextResponse.json({ success: true }));
    }

    return withCors(NextResponse.json(
      { error: '未知操作' },
      { status: 400 }
    ));
  } catch (error) {
    console.error('Chat session error:', error);
    return withCors(NextResponse.json(
      { error: '操作失败' },
      { status: 500 }
    ));
  }
}

// PUT /api/chat-sessions - 压缩上下文
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, summary } = body;

    if (!sessionId) {
      return withCors(NextResponse.json(
        { error: '缺少会话ID' },
        { status: 400 }
      ));
    }

    // 获取所有消息
    const messages = await query<any[]>(
      `SELECT id, role, content FROM zimage_chat_messages 
       WHERE session_id = ? 
       ORDER BY created_at ASC`,
      [sessionId]
    );

    if (messages.length <= KEEP_RECENT_MESSAGES) {
      return withCors(NextResponse.json({
        success: true,
        message: '消息数量不足，无需压缩',
      }));
    }

    // 保留最近的消息
    const messagesToKeep = messages.slice(-KEEP_RECENT_MESSAGES);
    const messagesToRemove = messages.slice(0, -KEEP_RECENT_MESSAGES);

    // 删除旧消息
    const idsToRemove = messagesToRemove.map(m => m.id);
    if (idsToRemove.length > 0) {
      await query(
        `DELETE FROM zimage_chat_messages WHERE id IN (${idsToRemove.map(() => '?').join(',')})`,
        idsToRemove
      );
    }

    // 如果提供了总结，添加总结消息
    if (summary) {
      await query(
        `INSERT INTO zimage_chat_messages (session_id, role, content, token_count) 
         VALUES (?, 'summary', ?, ?)`,
        [sessionId, summary, Math.ceil(summary.length / 2)]
      );

      // 更新会话的总结
      await query(
        'UPDATE zimage_chat_sessions SET summary = ? WHERE id = ?',
        [summary, sessionId]
      );
    }

    // 更新消息计数
    const countResult = await query<any[]>(
      'SELECT COUNT(*) as count FROM zimage_chat_messages WHERE session_id = ?',
      [sessionId]
    );
    await query(
      'UPDATE zimage_chat_sessions SET message_count = ? WHERE id = ?',
      [countResult[0]?.count || 0, sessionId]
    );

    return withCors(NextResponse.json({
      success: true,
      removedCount: idsToRemove.length,
      keptCount: messagesToKeep.length,
    }));
  } catch (error) {
    console.error('Compress context error:', error);
    return withCors(NextResponse.json(
      { error: '压缩上下文失败' },
      { status: 500 }
    ));
  }
}

// DELETE /api/chat-sessions - 删除会话
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const clearAll = searchParams.get('clearAll');

    if (clearAll === 'true') {
      // 清空所有会话
      await query('DELETE FROM zimage_chat_sessions');
      return withCors(NextResponse.json({
        success: true,
        message: '已清空所有对话',
      }));
    }

    if (!sessionId) {
      return withCors(NextResponse.json(
        { error: '缺少会话ID' },
        { status: 400 }
      ));
    }

    await query('DELETE FROM zimage_chat_sessions WHERE id = ?', [sessionId]);

    return withCors(NextResponse.json({
      success: true,
      message: '删除成功',
    }));
  } catch (error) {
    console.error('Delete session error:', error);
    return withCors(NextResponse.json(
      { error: '删除失败' },
      { status: 500 }
    ));
  }
}
