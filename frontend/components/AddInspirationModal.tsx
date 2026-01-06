'use client';

import { useAppStore } from '@/lib/store';
import { X, Plus, Image as ImageIcon, Edit2, Check } from 'lucide-react';
import Image from 'next/image';
import { useState, useRef } from 'react';
import { uploadImage, addInspiration as apiAddInspiration, updateInspiration as apiUpdateInspiration } from '@/lib/api';
import type { Inspiration } from '@/types';

const CATEGORIES = [
  { id: 'portrait', name: '人物肖像与写实摄影' },
  { id: 'architecture', name: '建筑室内空间设计' },
  { id: 'fashion', name: '人物换装' },
  { id: 'outdoor', name: '建筑室内空间建筑' },
  { id: 'editing', name: '图片编辑' },
];

export default function AddInspirationModal() {
  const { showAddInspirationModal, setShowAddInspirationModal, addInspiration, inspirations, updateInspiration } = useAppStore();

  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [tags, setTags] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editingTagName, setEditingTagName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!showAddInspirationModal) return null;

  // 从现有灵感中提取已有的标签
  const existingTags = (() => {
    const tagSet = new Set<string>();
    inspirations.forEach((insp: Inspiration) => {
      if (insp.tags && insp.tags.trim()) {
        tagSet.add(insp.tags);
      }
    });
    return Array.from(tagSet);
  })();

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    try {
      const result = await uploadImage(file);
      setImageUrl(result.url);
    } catch (error) {
      console.error('Upload failed:', error);
      alert('图片上传失败');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      alert('请输入标题');
      return;
    }
    if (!prompt.trim()) {
      alert('请输入提示词');
      return;
    }

    try {
      // 调用 API 保存到数据库
      const result = await apiAddInspiration({
        title: title.trim(),
        prompt: prompt.trim(),
        tags: tags.trim(),
        image_url: imageUrl,
      });

      if (result.inspiration) {
        addInspiration({
          id: result.inspiration.id,
          title: result.inspiration.title,
          prompt: result.inspiration.prompt,
          tags: result.inspiration.tags || '',
          image_url: result.inspiration.image_url || '',
          sort_order: result.inspiration.sort_order || 0,
          created_at: new Date().toISOString(),
        });
      }
      
      // 重置并关闭
      setTitle('');
      setPrompt('');
      setTags('');
      setImageUrl('');
      setShowAddInspirationModal(false);
    } catch (error) {
      console.error('添加灵感失败:', error);
      alert('添加失败');
    }
  };

  const handleClose = () => {
    setTitle('');
    setPrompt('');
    setTags('');
    setImageUrl('');
    setEditingTagId(null);
    setEditingTagName('');
    setShowAddInspirationModal(false);
  };

  const handleEditTag = (tagName: string) => {
    setEditingTagId(tagName);
    setEditingTagName(tagName);
  };

  const handleSaveTagEdit = async () => {
    if (!editingTagId || !editingTagName.trim()) return;

    // 更新所有使用该标签的灵感
    const inspirationsToUpdate = inspirations.filter((insp: Inspiration) => insp.tags === editingTagId);

    console.log('准备更新的灵感数量:', inspirationsToUpdate.length);
    console.log('旧标签:', editingTagId);
    console.log('新标签:', editingTagName.trim());

    if (inspirationsToUpdate.length === 0) {
      console.log('没有需要更新的灵感');
      setEditingTagId(null);
      setEditingTagName('');
      return;
    }

    // 批量更新
    const results = await Promise.allSettled(
      inspirationsToUpdate.map(async (insp: Inspiration) => {
        try {
          console.log('正在更新灵感:', insp.id, insp.title);
          const result = await apiUpdateInspiration(insp.id.toString(), {
            title: insp.title,
            prompt: insp.prompt,
            tags: editingTagName.trim(),
            image_url: insp.image_url,
          });
          console.log('API返回结果:', result);

          // 更新本地状态
          updateInspiration({
            ...insp,
            tags: editingTagName.trim(),
          });

          return result;
        } catch (err) {
          console.error('更新单个灵感失败:', err);
          throw err;
        }
      })
    );

    // 检查是否有失败的
    const failed = results.filter(r => r.status === 'rejected');
    if (failed.length > 0) {
      console.error('部分更新失败:', failed);
      failed.forEach((f, i) => {
        if (f.status === 'rejected') {
          console.error(`失败 ${i + 1}:`, f.reason);
        }
      });
      alert(`${failed.length} 个灵感更新失败，请查看控制台了解详情`);
    } else {
      console.log('所有灵感更新成功');
    }

    setEditingTagId(null);
    setEditingTagName('');
  };

  const handleCancelTagEdit = () => {
    setEditingTagId(null);
    setEditingTagName('');
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-zinc-900 rounded-lg w-full max-w-md border border-zinc-800 overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <h2 className="text-lg font-semibold">添加灵感</h2>
          <button
            onClick={handleClose}
            className="text-zinc-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* 内容 */}
        <div className="p-4 space-y-4">
          {/* 封面图片 */}
          <div>
            <label className="block text-sm text-zinc-400 mb-2">封面图片</label>
            <div className="flex gap-3">
              {imageUrl ? (
                <div className="relative w-24 h-24 rounded-lg overflow-hidden">
                  <Image src={imageUrl} alt="Preview" fill className="object-cover" />
                  <button
                    onClick={() => setImageUrl('')}
                    className="absolute top-1 right-1 w-5 h-5 bg-red-600 rounded-full flex items-center justify-center"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-24 h-24 border-2 border-dashed border-zinc-700 rounded-lg flex flex-col items-center justify-center text-zinc-500 hover:border-yellow-500 hover:text-yellow-500 transition-colors"
                >
                  {uploading ? (
                    <span className="text-xs">上传中...</span>
                  ) : (
                    <>
                      <ImageIcon size={24} />
                      <span className="text-xs mt-1">上传图片</span>
                    </>
                  )}
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </div>
          </div>

          {/* 标题 */}
          <div>
            <label className="block text-sm text-zinc-400 mb-2">标题 *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-yellow-500"
              placeholder="给灵感起个名字"
            />
          </div>

          {/* 标签 */}
          <div>
            <label className="block text-sm text-zinc-400 mb-2">标签</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-yellow-500"
              placeholder="输入标签或从下方选择"
            />

            {/* 已有标签列表 */}
            {existingTags.length > 0 && (
              <div className="mt-3">
                <div className="text-xs text-zinc-500 mb-2">已有标签（可选择或编辑）：</div>
                <div className="flex flex-wrap gap-2">
                  {existingTags.map((tag) => (
                    <div key={tag} className="flex items-center gap-1">
                      {editingTagId === tag ? (
                        <>
                          <input
                            type="text"
                            value={editingTagName}
                            onChange={(e) => setEditingTagName(e.target.value)}
                            className="px-3 py-1.5 bg-zinc-700 border border-purple-500 rounded-full text-xs text-white focus:outline-none w-40"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={handleSaveTagEdit}
                            className="p-1 bg-green-600 hover:bg-green-500 rounded-full transition-colors"
                          >
                            <Check size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelTagEdit}
                            className="p-1 bg-red-600 hover:bg-red-500 rounded-full transition-colors"
                          >
                            <X size={12} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => setTags(tag)}
                            className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
                              tags === tag
                                ? 'bg-purple-600 text-white'
                                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                            }`}
                          >
                            {tag}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEditTag(tag)}
                            className="p-1 bg-zinc-700 hover:bg-zinc-600 rounded-full transition-colors text-zinc-400 hover:text-white"
                          >
                            <Edit2 size={12} />
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 提示词 */}
          <div>
            <label className="block text-sm text-zinc-400 mb-2">提示词 *</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-yellow-500 resize-none"
              placeholder="输入完整的提示词内容"
            />
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="flex gap-3 p-4 border-t border-zinc-800">
          <button
            onClick={handleClose}
            className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2.5 bg-yellow-600 hover:bg-yellow-500 rounded-lg text-sm font-medium transition-colors"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
