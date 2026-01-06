'use client';

import { Sliders, List, Sparkles, Upload, RefreshCw, X, Zap, Pencil, Image as ImageIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { uploadImage } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import Image from 'next/image';
import type { UploadedImage } from '@/types';
import ImageEditor from './ImageEditor';

interface MobileBottomNavProps {
  onOpenSettings: () => void;
  onOpenTaskQueue: () => void;
  onGenerate: () => void;
  prompt: string;
  setPrompt: (prompt: string) => void;
}

export default function MobileBottomNav({
  onOpenSettings,
  onOpenTaskQueue,
  onGenerate,
  prompt,
  setPrompt,
}: MobileBottomNavProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadedImages, addUploadedImage, removeUploadedImage, updateUploadedImage, tasks, setShowZImageModal } = useAppStore();
  const [uploading, setUploading] = useState(false);
  const [editingImage, setEditingImage] = useState<{ url: string; id: string } | null>(null);

  // 统计进行中的任务数量
  const processingCount = tasks.filter(
    (t: { status: string }) => t.status === 'processing' || t.status === 'pending'
  ).length;

  // 编辑图片
  const handleEditImage = (img: { url: string; id: string }) => {
    setEditingImage(img);
  };

  const handleCloseEditor = () => {
    setEditingImage(null);
  };

  const handleSaveEdit = (newUrl: string) => {
    if (editingImage) {
      updateUploadedImage(editingImage.id, newUrl);
      setEditingImage(null);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setUploading(true);
      try {
        for (const file of files) {
          const result = await uploadImage(file);
          addUploadedImage({
            url: result.url,
            filename: result.filename || file.name,
            id: result.id,
          });
        }
      } catch (error) {
        console.error('Upload failed:', error);
        alert('图片上传失败');
      } finally {
        setUploading(false);
      }
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <>
    <div className="fixed bottom-0 left-0 right-0 bg-zinc-950 border-t border-zinc-800 pb-safe z-40">
      {/* SELECTED 预览区域 - 显示上传的参考图片 */}
      {uploadedImages.length > 0 && (
        <div className="px-3 pt-2 pb-1">
          <div className="flex items-center gap-2 overflow-x-auto">
            <div className="flex items-center gap-1.5 bg-zinc-800 rounded-lg px-2 py-1.5 flex-shrink-0">
              <Zap size={12} className="text-yellow-400" />
              <span className="text-[10px] text-zinc-400">SELECTED</span>
              <span className="text-[10px] text-yellow-400 font-medium">{uploadedImages.length}</span>
            </div>
            
            {/* 图片预览列表 */}
            {uploadedImages.map((img: UploadedImage, index: number) => (
              <div key={img.id} className="relative flex-shrink-0">
                <div 
                  className="relative w-10 h-10 rounded-lg overflow-hidden border-2 border-yellow-500 bg-zinc-800"
                  onClick={() => handleEditImage(img)}
                >
                  <Image
                    src={img.url}
                    alt={`Selected ${index + 1}`}
                    fill
                    className="object-cover"
                  />
                  {/* 序号标记 */}
                  <div className="absolute bottom-0 left-0 bg-yellow-500 text-black text-[8px] font-bold px-1 rounded-tr">
                    {index + 1}
                  </div>
                  {/* 编辑图标 */}
                  <div className="absolute top-0 right-0 bg-blue-600 p-0.5 rounded-bl">
                    <Pencil size={8} className="text-white" />
                  </div>
                </div>
                
                {/* 删除按钮 */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeUploadedImage(img.id);
                  }}
                  className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 hover:bg-red-500 rounded-full flex items-center justify-center"
                >
                  <X size={8} className="text-white" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 输入区域 */}
      <div className="px-3 py-2 flex items-center gap-2">
        {/* 上传按钮 */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-10 h-10 flex-shrink-0 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 rounded-lg flex items-center justify-center transition-colors relative"
        >
          {uploading ? (
            <RefreshCw size={18} className="text-zinc-400 animate-spin" />
          ) : (
            <>
              <Upload size={18} className="text-zinc-400" />
              {uploadedImages.length > 0 && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-500 rounded-full text-xs text-black font-bold flex items-center justify-center">
                  {uploadedImages.length}
                </div>
              )}
            </>
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

        {/* 输入框 - 支持横屏时更大 */}
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="描述您想要生成的图像..."
          maxLength={500}
          rows={1}
          className="flex-1 min-h-[40px] max-h-[80px] bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-yellow-500 transition-colors placeholder-zinc-500 resize-none landscape:min-h-[60px]"
          style={{ lineHeight: '1.4' }}
        />

        {/* 生成按钮 */}
        <button
          onClick={onGenerate}
          disabled={!prompt.trim() && uploadedImages.length === 0}
          className="w-10 h-10 flex-shrink-0 bg-yellow-500 hover:bg-yellow-400 disabled:bg-zinc-700 disabled:text-zinc-500 text-black font-semibold rounded-lg flex items-center justify-center transition-colors"
        >
          <Sparkles size={18} />
        </button>
      </div>

      {/* 底部导航栏 */}
      <div className="flex items-center justify-around py-2 px-4">
        {/* ZImage 按钮 */}
        <button
          onClick={() => setShowZImageModal(true)}
          className="flex flex-col items-center gap-1 py-2 px-4 rounded-lg hover:bg-zinc-800 transition-colors"
        >
          <ImageIcon size={20} className="text-purple-400" />
          <span className="text-xs text-zinc-500">ZImage</span>
        </button>

        {/* 设置按钮 */}
        <button
          onClick={onOpenSettings}
          className="flex flex-col items-center gap-1 py-2 px-4 rounded-lg hover:bg-zinc-800 transition-colors"
        >
          <Sliders size={20} className="text-zinc-400" />
          <span className="text-xs text-zinc-500">设置</span>
        </button>

        {/* 任务队列按钮 */}
        <button
          onClick={onOpenTaskQueue}
          className="flex flex-col items-center gap-1 py-2 px-4 rounded-lg hover:bg-zinc-800 transition-colors relative"
        >
          <List size={20} className="text-zinc-400" />
          <span className="text-xs text-zinc-500">任务</span>
          {processingCount > 0 && (
            <div className="absolute top-1 right-2 w-4 h-4 bg-yellow-500 rounded-full text-xs text-black font-bold flex items-center justify-center animate-pulse">
              {processingCount}
            </div>
          )}
        </button>
      </div>

      {/* iOS 安全区域填充 */}
      <div className="h-[env(safe-area-inset-bottom)]" />
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
