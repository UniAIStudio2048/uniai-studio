'use client';

import { useRef, useState } from 'react';
import { Sparkles, Upload, X, Zap, RefreshCw, Pencil } from 'lucide-react';
import { uploadImage } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import Image from 'next/image';
import ImageEditor from './ImageEditor';
import type { UploadedImage } from '@/types';

interface BottomInputProps {
  prompt: string;
  setPrompt: (prompt: string) => void;
  onGenerate: () => void;
  loading: boolean;
}

export default function BottomInput({
  prompt,
  setPrompt,
  onGenerate,
  loading,
}: BottomInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadedImages, addUploadedImage, removeUploadedImage, updateUploadedImage } = useAppStore();
  const [uploading, setUploading] = useState(false);
  const [editingImage, setEditingImage] = useState<{ url: string; id: string } | null>(null);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onGenerate();
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setUploading(true);
      try {
        for (const file of files) {
          console.log('Uploading file:', file.name);
          const result = await uploadImage(file);
          console.log('Upload result:', result);
          addUploadedImage({
            url: result.url,
            filename: result.filename || file.name,
            id: result.id,
          });
        }
      } catch (error: unknown) {
        console.error('Upload failed:', error);
        const errorMsg = (error as { response?: { data?: { error?: string } } })?.response?.data?.error || '图片上传失败';
        alert(errorMsg);
      } finally {
        setUploading(false);
      }
    }
    // 清空 input 以便可以重复选择同一文件
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleRemoveImage = (id: string) => {
    removeUploadedImage(id);
  };

  const handleEditImage = (img: { url: string; id: string }) => {
    setEditingImage(img);
  };

  const handleCloseEditor = () => {
    setEditingImage(null);
  };

  const handleSaveEdit = async (newUrl: string) => {
    if (editingImage) {
      // 如果是 base64 数据，需要先上传到服务器获取 HTTP URL
      if (newUrl.startsWith('data:')) {
        try {
          setUploading(true);
          // 将 base64 转换为 File 对象
          const response = await fetch(newUrl);
          const blob = await response.blob();
          const file = new File([blob], `edited-${Date.now()}.png`, { type: 'image/png' });
          
          // 上传到服务器
          console.log('[handleSaveEdit] 上传编辑后的图片...');
          const result = await uploadImage(file);
          console.log('[handleSaveEdit] 上传成功:', result.url);
          updateUploadedImage(editingImage.id, result.url);
        } catch (error) {
          console.error('[handleSaveEdit] 上传失败:', error);
          alert('编辑后的图片上传失败，请重试');
        } finally {
          setUploading(false);
        }
      } else {
        // 已经是 HTTP URL，直接更新
        updateUploadedImage(editingImage.id, newUrl);
      }
      setEditingImage(null);
    }
  };

  return (
    <>
      <div className="flex-shrink-0 border-t border-zinc-800 bg-zinc-950 p-4">
        {/* SELECTED 区域 - 显示上传的参考图片 */}
        {uploadedImages.length > 0 && (
          <div className="mb-3 flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 bg-zinc-800 rounded-lg px-3 py-2">
              <Zap size={14} className="text-yellow-400" />
              <span className="text-xs text-zinc-400">SELECTED</span>
              <span className="text-xs text-yellow-400 font-medium">{uploadedImages.length}</span>
            </div>
            
            {/* 图片预览列表 */}
            {uploadedImages.map((img: UploadedImage, index: number) => (
              <div key={img.id} className="relative group">
                <div className="relative w-14 h-14 rounded-lg overflow-hidden border-2 border-yellow-500 bg-zinc-800">
                  <Image
                    src={img.url}
                    alt={`Selected ${index + 1}`}
                    fill
                    className="object-cover"
                  />
                  {/* 序号标记 */}
                  <div className="absolute bottom-0 left-0 bg-yellow-500 text-black text-xs font-bold px-1.5 py-0.5 rounded-tr">
                    {index + 1}
                  </div>
                </div>
                
                {/* 悬浮操作按钮 */}
                <div className="absolute -top-1 -right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  {/* 编辑按钮 */}
                  <button
                    onClick={() => handleEditImage(img)}
                    className="w-5 h-5 bg-blue-600 hover:bg-blue-500 rounded-full flex items-center justify-center"
                    title="编辑图片"
                  >
                    <Pencil size={10} className="text-white" />
                  </button>
                  {/* 删除按钮 */}
                  <button
                    onClick={() => handleRemoveImage(img.id)}
                    className="w-5 h-5 bg-red-600 hover:bg-red-500 rounded-full flex items-center justify-center"
                    title="删除图片"
                  >
                    <X size={10} className="text-white" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3">
          {/* 上传图片按钮 */}
          <button
            onClick={handleUploadClick}
            disabled={uploading}
            className="w-12 h-12 flex-shrink-0 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 rounded-lg flex items-center justify-center transition-colors"
            title="上传参考图片"
          >
            {uploading ? (
              <RefreshCw size={20} className="text-zinc-400 animate-spin" />
            ) : (
              <Upload size={20} className="text-zinc-400" />
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* 提示词输入框 */}
          <div className="flex-1">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="描述您想要生成的图像..."
              maxLength={500}
              className="w-full h-12 bg-zinc-800 border border-zinc-700 rounded-lg px-4 text-sm focus:outline-none focus:border-yellow-500 transition-colors placeholder-zinc-500"
            />
          </div>

          {/* Generate 按钮 */}
          <button
            onClick={onGenerate}
            disabled={!prompt.trim() && uploadedImages.length === 0}
            className="h-12 px-6 bg-yellow-500 hover:bg-yellow-400 disabled:bg-zinc-700 disabled:text-zinc-500 text-black font-semibold rounded-lg flex items-center gap-2 transition-colors flex-shrink-0"
          >
            <Sparkles size={18} />
            Generate
          </button>
        </div>
      </div>

      {/* 图片编辑器 */}
      {editingImage && (
        <ImageEditor
          imageUrl={editingImage.url}
          imageId={editingImage.id}
          onClose={handleCloseEditor}
          onSave={handleSaveEdit}
        />
      )}
    </>
  );
}
