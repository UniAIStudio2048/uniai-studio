'use client';

import { useAppStore } from '@/lib/store';
import { X, Plus, Search, Trash2, Flame, Wand2, Download, Edit2, Tag, ChevronDown } from 'lucide-react';
import Image from 'next/image';
import { useState, useRef, useEffect } from 'react';
import { uploadImage, getInspirations, addInspiration as apiAddInspiration, updateInspiration, deleteInspiration, importInspirations, updateInspirationOrder, batchUpdateInspirationOrder } from '@/lib/api';
import type { Inspiration } from '@/types';
import { useIsMobile } from '@/lib/useIsMobile';

// 移除固定的分类列表，直接从灵感中提取

export default function InspirationModal() {
  const { 
    showInspirationModal, 
    setShowInspirationModal, 
    inspirations, 
    setInspirations,
    addInspiration, 
    removeInspiration,
    setPrompt 
  } = useAppStore();
  
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [importing, setImporting] = useState(false);
  const [loading, setLoading] = useState(false);

  // 编辑灵感表单
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editPrompt, setEditPrompt] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editImageUrl, setEditImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 动态生成分类列表（从现有灵感中提取唯一标签）
  const categories = (() => {
    const allCategory = { name: '全部', count: inspirations.length };

    // 提取所有唯一的标签
    const tagSet = new Set<string>();
    inspirations.forEach((insp: Inspiration) => {
      if (insp.tags && insp.tags.trim()) {
        tagSet.add(insp.tags);
      }
    });

    const existingCategories = Array.from(tagSet).map(tag => ({
      name: tag,
      count: inspirations.filter((i: Inspiration) => i.tags === tag).length
    }));

    return [allCategory, ...existingCategories];
  })();

  // 提取所有可用的标签供编辑使用
  const availableTags = categories.filter(c => c.name !== '全部').map(c => c.name);

  // 拖拽状态
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const autoScrollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMobileHook = useIsMobile();
  const [mounted, setMounted] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  
  // 客户端挂载后才应用移动端样式，避免 hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);
  
  const isMobile = mounted ? isMobileHook : false;

  // 加载灵感列表
  const loadInspirations = async () => {
    setLoading(true);
    try {
      const data = await getInspirations();
      if (data.inspirations) {
        setInspirations(data.inspirations);
      }
    } catch (error) {
      console.error('加载灵感失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 从存储桶导入
  const handleImport = async () => {
    if (importing) return;
    setImporting(true);
    try {
      const result = await importInspirations();
      alert(result.message || '导入完成');
      // 重新加载列表
      await loadInspirations();
    } catch (error) {
      console.error('导入失败:', error);
      alert('导入失败');
    } finally {
      setImporting(false);
    }
  };

  // 首次打开时加载
  useEffect(() => {
    if (showInspirationModal && inspirations.length === 0) {
      loadInspirations();
    }
  }, [showInspirationModal]);

  // 所有 Hooks 必须在提前返回之前调用
  if (!showInspirationModal) return null;

  const filteredInspirations = inspirations.filter((insp: Inspiration) => {
    const matchCategory = selectedCategory === 'all' || insp.tags === selectedCategory;
    const matchSearch = !searchQuery ||
      insp.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchSearch;
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const result = await uploadImage(file);
      setEditImageUrl(result.url);
    } catch (error) {
      console.error('Upload failed:', error);
      alert('图片上传失败');
    } finally {
      setUploading(false);
    }
  };

  const handleEdit = (insp: any) => {
    setEditingId(insp.id);
    setEditTitle(insp.title);
    setEditPrompt(insp.prompt);
    setEditCategory(insp.tags || '');
    setEditImageUrl(insp.image_url);
  };

  const handleSaveEdit = async () => {
    if (!editTitle.trim() || !editPrompt.trim()) {
      alert('请填写标题和提示词');
      return;
    }

    if (!editingId) return;

    try {
      // 调用后端API更新
      await updateInspiration(editingId, {
        title: editTitle,
        prompt: editPrompt,
        tags: editCategory,
        image_url: editImageUrl,
      });

      // 重新加载列表
      await loadInspirations();
      // 重置表单
      setEditingId(null);
      setEditTitle('');
      setEditPrompt('');
      setEditCategory('portrait');
      setEditImageUrl('');
    } catch (error) {
      console.error('更新灵感失败:', error);
      alert('更新失败');
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditTitle('');
    setEditPrompt('');
    setEditCategory('');
    setEditImageUrl('');
  };

  const handleUsePrompt = (prompt: string) => {
    setPrompt(prompt);
    setShowInspirationModal(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm('确定要删除这个灵感吗？')) {
      try {
        await deleteInspiration(id);
        removeInspiration(id);
      } catch (error) {
        console.error('删除失败:', error);
        alert('删除失败');
      }
    }
  };

  // 拖拽开始
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  // 拖拽经过
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }

    // 自动滚动逻辑
    const container = scrollContainerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const scrollThreshold = 100; // 距离边缘多少像素开始滚动
    const scrollSpeed = 10;

    const mouseY = e.clientY - rect.top;

    // 清除之前的滚动
    if (autoScrollIntervalRef.current) {
      clearInterval(autoScrollIntervalRef.current);
      autoScrollIntervalRef.current = null;
    }

    // 向上滚动
    if (mouseY < scrollThreshold && mouseY > 0) {
      autoScrollIntervalRef.current = setInterval(() => {
        if (container.scrollTop > 0) {
          container.scrollTop -= scrollSpeed;
        }
      }, 16);
    }
    // 向下滚动
    else if (mouseY > rect.height - scrollThreshold && mouseY < rect.height) {
      autoScrollIntervalRef.current = setInterval(() => {
        if (container.scrollTop < container.scrollHeight - container.clientHeight) {
          container.scrollTop += scrollSpeed;
        }
      }, 16);
    }
  };

  // 拖拽结束
  const handleDragEnd = () => {
    if (autoScrollIntervalRef.current) {
      clearInterval(autoScrollIntervalRef.current);
      autoScrollIntervalRef.current = null;
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // 放置
  const handleDrop = async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();

    if (draggedIndex === null || draggedIndex === dropIndex) {
      handleDragEnd();
      return;
    }

    const newInspirations = [...filteredInspirations];
    const draggedItem = newInspirations[draggedIndex];

    // 移除拖拽项
    newInspirations.splice(draggedIndex, 1);
    // 插入到新位置
    newInspirations.splice(dropIndex, 0, draggedItem);

    // 只更新受影响的项的排序（从小索引到大索引之间的所有项）
    const minIndex = Math.min(draggedIndex, dropIndex);
    const maxIndex = Math.max(draggedIndex, dropIndex);

    try {
      // 批量更新受影响的项（一次API调用）
      const updates = [];
      for (let i = minIndex; i <= maxIndex; i++) {
        updates.push({
          id: newInspirations[i].id,
          sort_order: i + 1
        });
      }

      // 使用批量更新API
      await batchUpdateInspirationOrder(updates);
      await loadInspirations();
    } catch (error) {
      console.error('排序失败:', error);
      alert('排序失败');
    }

    handleDragEnd();
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setShowInspirationModal(false);
        }
      }}
    >
      <div
        className={`bg-zinc-900 rounded-lg border border-zinc-800 flex flex-col overflow-hidden ${
          isMobile 
            ? 'w-full h-full rounded-none' 
            : 'w-full max-w-6xl h-[85vh]'
        }`}
      >
        {/* 头部 */}
        <div className={`flex items-center justify-between border-b border-zinc-800 ${
          isMobile ? 'p-3 flex-wrap gap-2' : 'p-4'
        }`}>
          <h2 className={`font-semibold flex items-center gap-2 ${
            isMobile ? 'text-base' : 'text-xl'
          }`}>
            <Flame size={isMobile ? 20 : 24} className="text-orange-500" />
            全部灵感
          </h2>
          
          {/* 搜索框 */}
          {!isMobile && (
            <div className="flex-1 max-w-md mx-8">
              <div className="relative">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜索灵感名称或提示词"
                  className="w-full pl-10 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-yellow-500"
                />
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={handleImport}
              disabled={importing}
              className={`bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-700 rounded-lg text-sm flex items-center gap-2 transition-colors ${
                isMobile ? 'px-3 py-2' : 'px-4 py-2'
              }`}
            >
              <Download size={16} />
              {isMobile ? '导入' : (importing ? '导入中...' : '从存储桶导入')}
            </button>
            <button
              onClick={() => setShowInspirationModal(false)}
              className="text-zinc-400 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          {/* 移动端搜索框 */}
          {isMobile && (
            <div className="w-full">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜索灵感"
                  className="w-full pl-9 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-yellow-500"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* 左侧分类 - 移动端用下拉菜单 */}
          {isMobile ? (
            <div className="w-24 flex-shrink-0 border-r border-zinc-800 overflow-y-auto">
              {categories.map((cat) => (
                <button
                  key={cat.name}
                  onClick={() => setSelectedCategory(cat.name === '全部' ? 'all' : cat.name)}
                  className={`w-full text-left px-2 py-2.5 flex items-center justify-between transition-colors ${
                    (selectedCategory === 'all' && cat.name === '全部') || (selectedCategory === cat.name)
                      ? 'bg-yellow-600 text-white'
                      : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                  }`}
                >
                  <span className="text-xs truncate flex-1">{cat.name}</span>
                  <span className="text-[10px] bg-zinc-700 px-1.5 py-0.5 rounded-full ml-1">
                    {cat.count}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="w-56 border-r border-zinc-800 p-4 overflow-y-auto">
              {categories.map((cat) => (
                <button
                  key={cat.name}
                  onClick={() => setSelectedCategory(cat.name === '全部' ? 'all' : cat.name)}
                  className={`w-full text-left px-3 py-2 rounded-lg mb-1 flex items-center justify-between transition-colors ${
                    (selectedCategory === 'all' && cat.name === '全部') || (selectedCategory === cat.name)
                      ? 'bg-yellow-600 text-white'
                      : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                  }`}
                >
                  <span className="text-sm truncate">{cat.name}</span>
                  <span className="text-xs bg-zinc-700 px-2 py-0.5 rounded-full">
                    {cat.count}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* 右侧内容 */}
          <div ref={scrollContainerRef} className={`flex-1 overflow-y-auto ${
            isMobile ? 'p-2' : 'p-4'
          }`}>

            {/* 灵感网格 */}
            <div className={`grid gap-3 ${
              isMobile ? 'grid-cols-2' : 'grid-cols-4'
            }`}>
              {filteredInspirations.map((insp: Inspiration, idx: number) => {
                const canDrag = selectedCategory === 'all';
                return (
                  <div
                    key={insp.id}
                    draggable={canDrag}
                    onDragStart={canDrag ? (e) => handleDragStart(e, idx) : undefined}
                    onDragOver={canDrag ? (e) => handleDragOver(e, idx) : undefined}
                    onDragEnd={canDrag ? handleDragEnd : undefined}
                    onDrop={canDrag ? (e) => handleDrop(e, idx) : undefined}
                    className={`bg-zinc-800 rounded-lg overflow-hidden group transition-all ${
                      canDrag ? 'cursor-move' : 'cursor-default'
                    } ${
                      draggedIndex === idx ? 'opacity-50 scale-95' : ''
                    } ${
                      dragOverIndex === idx ? 'ring-2 ring-yellow-500' : ''
                    }`}
                  >
                  {/* 图片 */}
                  <div className="aspect-square relative bg-zinc-700">
                    {insp.image_url ? (
                      (() => {
                        // 提取真正的 data URL（如果URL中包含data:image）
                        const dataUrlMatch = insp.image_url.match(/data:image[^"]+/);
                        const actualUrl = dataUrlMatch ? dataUrlMatch[0] : insp.image_url;
                        const isDataUrl = actualUrl.startsWith('data:image');

                        return isDataUrl ? (
                          // data URL 使用普通 img 标签
                          <img
                            src={actualUrl}
                            alt={insp.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          // HTTP URL 使用 Next.js Image 组件
                          <Image src={actualUrl} alt={insp.title} fill className="object-cover" />
                        );
                      })()
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-500">
                        无图片
                      </div>
                    )}
                    {/* 序号角标 */}
                    <div className="absolute top-2 left-2 w-6 h-6 bg-yellow-500 text-black text-sm font-bold rounded-full flex items-center justify-center">
                      {idx + 1}
                    </div>
                  </div>
                  
                  {/* 信息 */}
                  <div className="p-3">
                    <div className="flex items-start justify-between mb-1">
                      <h4 className="font-semibold text-sm truncate flex-1">{insp.title}</h4>
                      {insp.tags && (
                        <span className="ml-2 px-2 py-0.5 bg-purple-600 text-white text-[10px] rounded-full whitespace-nowrap">
                          {insp.tags}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400 line-clamp-2 mb-3">
                      {insp.prompt}
                    </p>

                    {/* 操作按钮 */}
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleUsePrompt(insp.prompt)}
                        className={`flex-1 bg-yellow-600 hover:bg-yellow-500 rounded text-xs flex items-center justify-center gap-1 transition-colors ${
                          isMobile ? 'py-2' : 'py-1.5'
                        }`}
                      >
                        <Wand2 size={12} />
                        使用
                      </button>
                      {!isMobile && (
                        <>
                          <button
                            onClick={() => handleEdit(insp)}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-xs transition-colors"
                            title="编辑"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            onClick={() => handleDelete(insp.id)}
                            className="px-3 py-1.5 bg-zinc-700 hover:bg-red-600 rounded text-xs transition-colors"
                            title="删除"
                          >
                            <Trash2 size={12} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                );
              })}
            </div>

            {filteredInspirations.length === 0 && (
              <div className="text-center text-zinc-500 py-20">
                <Flame size={48} className="mx-auto mb-4 opacity-30" />
                <p>暂无灵感</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 编辑模态框 */}
      {editingId && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60]">
          <div className="bg-zinc-900 rounded-lg w-full max-w-2xl border border-zinc-800 p-6">
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Edit2 size={20} />
              编辑灵感
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">标题 *</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-yellow-500"
                  placeholder="输入灵感标题"
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">标签</label>
                <input
                  type="text"
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-yellow-500"
                  placeholder="输入标签或从下方选择"
                />
                {availableTags.length > 0 && (
                  <div className="mt-3">
                    <div className="text-xs text-zinc-500 mb-2">已有标签：</div>
                    <div className="flex flex-wrap gap-2">
                      {availableTags.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => setEditCategory(tag)}
                          className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
                            editCategory === tag
                              ? 'bg-purple-600 text-white'
                              : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                          }`}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">提示词 *</label>
                <textarea
                  value={editPrompt}
                  onChange={(e) => setEditPrompt(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-yellow-500 resize-none"
                  placeholder="输入完整的提示词"
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">封面图片 URL</label>
                <div className="flex gap-3">
                  {editImageUrl && (
                    <div className="relative w-24 h-24 rounded-lg overflow-hidden flex-shrink-0">
                      <img src={editImageUrl.match(/data:image[^"]+/)?.[0] || editImageUrl} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="flex-1">
                    <input
                      type="text"
                      value={editImageUrl}
                      onChange={(e) => setEditImageUrl(e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-yellow-500"
                      placeholder="图片URL"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={handleCancelEdit}
                className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 rounded-lg text-sm transition-colors"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
