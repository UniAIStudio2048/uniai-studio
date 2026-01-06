import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { withCors, handleOPTIONS } from '@/lib/cors';

// Handle CORS preflight
export async function OPTIONS() {
  return handleOPTIONS();
}

// GET /api/zimage-presets - 获取所有预设脚本
export async function GET() {
  try {
    const presets = await query<any[]>(
      'SELECT id, name, icon, script, sort_order FROM zimage_presets ORDER BY sort_order ASC'
    );

    return withCors(NextResponse.json({
      success: true,
      presets: presets.map(p => ({
        id: p.id,
        name: p.name,
        icon: p.icon,
        script: p.script,
        sortOrder: p.sort_order,
      })),
    }));
  } catch (error) {
    console.error('Get presets error:', error);
    return withCors(NextResponse.json(
      { error: '获取预设列表失败' },
      { status: 500 }
    ));
  }
}

// POST /api/zimage-presets - 创建或更新预设脚本
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, icon, script, sortOrder } = body;

    if (!id || !name) {
      return withCors(NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      ));
    }

    // 使用 REPLACE INTO 实现 upsert
    await query(
      `INSERT INTO zimage_presets (id, name, icon, script, sort_order) 
       VALUES (?, ?, ?, ?, ?) 
       ON DUPLICATE KEY UPDATE name = VALUES(name), icon = VALUES(icon), script = VALUES(script), sort_order = VALUES(sort_order)`,
      [id, name, icon || '📝', script || '', sortOrder || 0]
    );

    return withCors(NextResponse.json({
      success: true,
      message: '保存成功',
    }));
  } catch (error) {
    console.error('Save preset error:', error);
    return withCors(NextResponse.json(
      { error: '保存预设失败' },
      { status: 500 }
    ));
  }
}

// DELETE /api/zimage-presets - 删除预设脚本
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return withCors(NextResponse.json(
        { error: '缺少预设ID' },
        { status: 400 }
      ));
    }

    await query('DELETE FROM zimage_presets WHERE id = ?', [id]);

    return withCors(NextResponse.json({
      success: true,
      message: '删除成功',
    }));
  } catch (error) {
    console.error('Delete preset error:', error);
    return withCors(NextResponse.json(
      { error: '删除预设失败' },
      { status: 500 }
    ));
  }
}

// PUT /api/zimage-presets - 批量更新预设（用于排序等）
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { presets } = body;

    if (!presets || !Array.isArray(presets)) {
      return withCors(NextResponse.json(
        { error: '缺少预设列表' },
        { status: 400 }
      ));
    }

    // 批量更新
    for (let i = 0; i < presets.length; i++) {
      const preset = presets[i];
      await query(
        `INSERT INTO zimage_presets (id, name, icon, script, sort_order) 
         VALUES (?, ?, ?, ?, ?) 
         ON DUPLICATE KEY UPDATE name = VALUES(name), icon = VALUES(icon), script = VALUES(script), sort_order = VALUES(sort_order)`,
        [preset.id, preset.name, preset.icon || '📝', preset.script || '', i]
      );
    }

    return withCors(NextResponse.json({
      success: true,
      message: '批量更新成功',
    }));
  } catch (error) {
    console.error('Batch update presets error:', error);
    return withCors(NextResponse.json(
      { error: '批量更新失败' },
      { status: 500 }
    ));
  }
}
