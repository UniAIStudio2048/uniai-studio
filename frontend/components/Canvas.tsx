'use client';

import { useAppStore } from '@/lib/store';
import { useCallback, useState, useRef, useEffect } from 'react';
import { uploadImage } from '@/lib/api';
import Image from 'next/image';
import { Download, Maximize2, RotateCcw, X, ChevronLeft, ChevronRight, Grid, Star } from 'lucide-react';
import { addFavorite, removeFavorite } from '@/lib/api';
import { useIsMobile } from '@/lib/useIsMobile';

// 压缩图片到指定大小以下（默认 10MB）
async function compressImage(file: File, maxSizeMB: number = 10): Promise<File> {
  const maxSize = maxSizeMB * 1024 * 1024;
  
  // 如果已经小于最大大小，直接返回
  if (file.size <= maxSize) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    img.onload = async () => {
      let { width, height } = img;
      let quality = 0.92;
      let scale = 1;
      
      // 计算需要的压缩比例
      const ratio = Math.sqrt(maxSize / file.size);
      if (ratio < 1) {
        scale = Math.max(ratio, 0.5); // 最小缩放到50%
      }
      
      // 设置画布尺寸
      canvas.width = Math.floor(width * scale);
      canvas.height = Math.floor(height * scale);
      
      // 绘制图片
      ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      // 尝试不同质量直到满足大小要求
      const tryCompress = (q: number): Promise<Blob | null> => {
        return new Promise((res) => {
          canvas.toBlob((blob) => res(blob), 'image/jpeg', q);
        });
      };
      
      let blob = await tryCompress(quality);
      
      // 逐步降低质量直到满足要求
      while (blob && blob.size > maxSize && quality > 0.5) {
        quality -= 0.1;
        blob = await tryCompress(quality);
      }
      
      // 如果还是太大，继续缩小尺寸
      while (blob && blob.size > maxSize && scale > 0.3) {
        scale -= 0.1;
        canvas.width = Math.floor(width * scale);
        canvas.height = Math.floor(height * scale);
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        blob = await tryCompress(quality);
      }
      
      if (blob) {
        const compressedFile = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
          type: 'image/jpeg',
          lastModified: Date.now(),
        });
        console.log(`图片压缩: ${(file.size / 1024 / 1024).toFixed(2)}MB -> ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`);
        resolve(compressedFile);
      } else {
        reject(new Error('图片压缩失败'));
      }
    };

    img.onerror = () => reject(new Error('图片加载失败'));
    img.src = URL.createObjectURL(file);
  });
}

export default function Canvas() {
  const { currentImage, setCurrentImage, addUploadedImage, currentImages, currentImageIndex, setCurrentImageIndex, isSelectingImage, setIsSelectingImage, favoriteUrls, addFavorite: addFavoriteToStore, removeFavoriteByUrl, tasks } = useAppStore();
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFavoriting, setIsFavoriting] = useState(false);
  const innerBoxRef = useRef<HTMLDivElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const isMobileHook = useIsMobile();
  const [mounted, setMounted] = useState(false);
  
  // 客户端挂载后才应用移动端样式，避免 hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);
  
  const isMobile = mounted ? isMobileHook : false;

  // 检查当前图片是否已收藏
  const isCurrentImageFavorited = currentImage ? favoriteUrls.has(currentImage) : false;
  
  // 获取当前图片的 prompt（从任务中查找）
  const getCurrentImagePrompt = useCallback(() => {
    if (!currentImage) return '';
    // 从任务中查找包含该图片的任务
    for (const task of tasks) {
      if (task.result_image_url === currentImage) {
        return task.prompt || '';
      }
      if (task.result_images?.includes(currentImage)) {
        return task.prompt || '';
      }
    }
    return '';
  }, [currentImage, tasks]);

  // 收藏/取消收藏
  const handleToggleFavorite = useCallback(async () => {
    if (!currentImage || isFavoriting) return;
    
    setIsFavoriting(true);
    try {
      if (isCurrentImageFavorited) {
        // 取消收藏
        await removeFavorite(currentImage);
        removeFavoriteByUrl(currentImage);
      } else {
        // 添加收藏
        const prompt = getCurrentImagePrompt();
        const result = await addFavorite({ 
          url: currentImage, 
          prompt,
          filename: `image_${Date.now()}.png` 
        });
        addFavoriteToStore({
          id: result.id,
          url: currentImage,
          prompt,
          filename: `image_${Date.now()}.png`,
          created_at: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Toggle favorite failed:', error);
    } finally {
      setIsFavoriting(false);
    }
  }, [currentImage, isCurrentImageFavorited, isFavoriting, getCurrentImagePrompt, addFavoriteToStore, removeFavoriteByUrl]);

  // 选择图片
  const handleSelectImage = useCallback((index: number) => {
    setCurrentImageIndex(index);
  }, [setCurrentImageIndex]);

  // 返回选择模式
  const handleBackToSelect = useCallback(() => {
    if (currentImages.length > 1) {
      setIsSelectingImage(true);
    }
  }, [currentImages.length, setIsSelectingImage]);

  // 切换到上一张图片
  const handlePrevImage = useCallback(() => {
    if (currentImages.length > 1 && currentImageIndex > 0) {
      setCurrentImageIndex(currentImageIndex - 1);
    }
  }, [currentImages.length, currentImageIndex, setCurrentImageIndex]);

  // 切换到下一张图片
  const handleNextImage = useCallback(() => {
    if (currentImages.length > 1 && currentImageIndex < currentImages.length - 1) {
      setCurrentImageIndex(currentImageIndex + 1);
    }
  }, [currentImages.length, currentImageIndex, setCurrentImageIndex]);

  // 下载原图
  const handleDownload = useCallback(async () => {
    if (!currentImage) return;
    try {
      const response = await fetch(currentImage);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `image_${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      // 降级方案：新窗口打开
      window.open(currentImage, '_blank');
    }
  }, [currentImage]);

  // 全屏切换
  const handleFullscreen = useCallback(() => {
    if (!imageContainerRef.current) return;
    
    if (!document.fullscreenElement) {
      imageContainerRef.current.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch((err) => {
        console.error('Fullscreen error:', err);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      });
    }
  }, []);

  // 监听全屏变化
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // 重新上传到 SELECTED
  const handleReupload = useCallback(() => {
    if (!currentImage) return;
    addUploadedImage({
      url: currentImage,
      filename: `reupload_${Date.now()}.png`,
      id: `reupload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    });
  }, [currentImage, addUploadedImage]);

  // 关闭当前图像（多图时返回选择界面）
  const handleClose = useCallback(() => {
    if (currentImages.length > 1) {
      // 多图时返回选择界面
      setIsSelectingImage(true);
    } else {
      // 单图时完全关闭
      setCurrentImage(null);
    }
  }, [currentImages.length, setIsSelectingImage, setCurrentImage]);

  const handleFileUpload = useCallback(async (file: File) => {
    setUploading(true);
    try {
      // 如果图片超过 10MB，自动压缩
      let fileToUpload = file;
      if (file.size > 10 * 1024 * 1024) {
        console.log(`图片超过 10MB (${(file.size / 1024 / 1024).toFixed(2)}MB)，开始压缩...`);
        fileToUpload = await compressImage(file, 10);
      }
      
      const result = await uploadImage(fileToUpload);
      addUploadedImage({
        url: result.url,
        filename: result.filename || fileToUpload.name,
        id: result.id,
      });
    } catch (error: unknown) {
      console.error('Upload failed:', error);
      const errorMsg = (error as { response?: { data?: { error?: string } } })?.response?.data?.error || '图片上传失败';
      alert(errorMsg);
    } finally {
      setUploading(false);
    }
  }, [addUploadedImage]);

  // 检查坐标是否在黄色框内
  const isInsideInnerBox = useCallback((x: number, y: number) => {
    if (!innerBoxRef.current) return false;
    const rect = innerBoxRef.current.getBoundingClientRect();
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      
      // 如果 drop 在黄色框内，不执行上传
      if (isInsideInnerBox(e.clientX, e.clientY)) {
        return;
      }
      
      const files = Array.from(e.dataTransfer.files);
      const imageFiles = files.filter((file) => file.type.startsWith('image/'));

      if (imageFiles.length > 0) {
        for (const imageFile of imageFiles) {
          await handleFileUpload(imageFile);
        }
      } else {
        alert('请拖拽图片文件');
      }
    },
    [handleFileUpload, isInsideInnerBox]
  );

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // 只有在黄色框外才显示拖拽提示
    if (!isInsideInnerBox(e.clientX, e.clientY)) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // 根据位置更新 isDragging 状态
    const inside = isInsideInnerBox(e.clientX, e.clientY);
    if (inside && isDragging) {
      setIsDragging(false);
    } else if (!inside && !isDragging) {
      setIsDragging(true);
    }
  };

  return (
    <div
      className={`flex-1 flex items-center justify-center relative ${isMobile ? 'p-2 h-full' : 'p-4 min-h-0'}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
    >
      {/* 黄色框 - 用于展示生成的图片 */}
      <div 
        ref={innerBoxRef}
        className={`relative border-4 border-yellow-500 rounded-lg overflow-hidden bg-zinc-800 flex items-center justify-center z-10 group ${
          isMobile 
            ? 'w-full h-full' 
            : 'w-full max-w-3xl h-full max-h-[calc(100vh-200px)]'
        }`}
      >
        {/* 多图选择模式 - 网格展示 */}
        {isSelectingImage && currentImages.length > 1 ? (
          <div className="w-full h-full p-4 overflow-auto bg-zinc-900">
            <div className="text-center text-zinc-400 mb-4">点击选择要查看的图片</div>
            <div className="grid grid-cols-2 gap-3">
              {currentImages.map((img: string, idx: number) => (
                <div
                  key={idx}
                  onClick={() => handleSelectImage(idx)}
                  className="relative aspect-square rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-yellow-500 transition-all group/item"
                >
                  <Image
                    src={img}
                    alt={`Image ${idx + 1}`}
                    fill
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover/item:bg-black/20 transition-all flex items-center justify-center">
                    <span className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                      {idx + 1}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : currentImage ? (
          <>
            <div ref={imageContainerRef} className="relative w-full h-full bg-zinc-900">
              <Image
                src={currentImage}
                alt="Generated Image"
                fill
                className="object-contain"
              />
            </div>
            
            {/* 多图切换按钮 - 左右箭头 */}
            {currentImages.length > 1 && (
              <>
                {/* 左箭头 */}
                {currentImageIndex > 0 && (
                  <button
                    onClick={handlePrevImage}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center transition-all text-white"
                  >
                    <ChevronLeft size={24} />
                  </button>
                )}
                
                {/* 右箭头 */}
                {currentImageIndex < currentImages.length - 1 && (
                  <button
                    onClick={handleNextImage}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center transition-all text-white"
                  >
                    <ChevronRight size={24} />
                  </button>
                )}
                
                {/* 底部指示器 */}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
                  {currentImages.map((_: string, idx: number) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentImageIndex(idx)}
                      className={`w-2.5 h-2.5 rounded-full transition-all ${
                        idx === currentImageIndex 
                          ? 'bg-yellow-500 scale-110' 
                          : 'bg-white/50 hover:bg-white/80'
                      }`}
                    />
                  ))}
                </div>
                
                {/* 返回网格按钮 - 多图时显示 */}
                {currentImages.length > 1 && (
                  <button
                    onClick={handleBackToSelect}
                    className="absolute top-3 left-3 bg-black/50 hover:bg-black/70 text-white text-sm px-3 py-1.5 rounded flex items-center gap-1.5 transition-all"
                  >
                    <Grid size={14} />
                    查看全部
                  </button>
                )}
              </>
            )}
            
            {/* 操作按钮组 - 右上角（移动端始终显示） */}
            <div className={`absolute top-3 right-3 flex gap-2 transition-opacity duration-200 ${
              isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            }`}>
              {/* 收藏按钮 */}
              <button
                onClick={handleToggleFavorite}
                disabled={isFavoriting}
                className={`w-9 h-9 bg-zinc-900/80 hover:bg-zinc-800 border rounded-lg flex items-center justify-center transition-all ${
                  isCurrentImageFavorited 
                    ? 'border-yellow-500 text-yellow-400' 
                    : 'border-zinc-700 text-zinc-400 hover:border-yellow-500 hover:text-yellow-400'
                }`}
                title={isCurrentImageFavorited ? '取消收藏' : '收藏图片'}
              >
                <Star size={18} fill={isCurrentImageFavorited ? 'currentColor' : 'none'} />
              </button>
              
              {/* 下载按钮 */}
              <button
                onClick={handleDownload}
                className="w-9 h-9 bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-700 rounded-lg flex items-center justify-center transition-all hover:border-yellow-500 hover:text-yellow-400"
                title="下载原图"
              >
                <Download size={18} />
              </button>
              
              {/* 全屏按钮 */}
              <button
                onClick={handleFullscreen}
                className="w-9 h-9 bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-700 rounded-lg flex items-center justify-center transition-all hover:border-yellow-500 hover:text-yellow-400"
                title="全屏查看"
              >
                <Maximize2 size={18} />
              </button>
              
              {/* 重新上传按钮 */}
              <button
                onClick={handleReupload}
                className="w-9 h-9 bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-700 rounded-lg flex items-center justify-center transition-all hover:border-yellow-500 hover:text-yellow-400"
                title="重新上传到 SELECTED"
              >
                <RotateCcw size={18} />
              </button>
              
              {/* 关闭按钮 */}
              <button
                onClick={handleClose}
                className="w-9 h-9 bg-zinc-900/80 hover:bg-red-900/80 border border-zinc-700 rounded-lg flex items-center justify-center transition-all hover:border-red-500 hover:text-red-400"
                title="关闭图像"
              >
                <X size={18} />
              </button>
            </div>
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-zinc-500 px-4">
            <div className={`mb-2 text-center ${isMobile ? 'text-base' : 'text-lg'}`}>输入提示词开始创作</div>
            <div className={`text-center ${isMobile ? 'text-xs' : 'text-sm'}`}>支持中英文描述，AI将为您生成精美图像</div>
          </div>
        )}
      </div>

      {/* 拖拽遮罩层 - 只在黄色框外显示（仅桌面端） */}
      {!isMobile && (isDragging || uploading) && (
        <div className="absolute inset-0 pointer-events-none z-0">
          <div className="absolute inset-0 bg-yellow-500/10 border-2 border-dashed border-yellow-500 flex items-center justify-center">
            <div className="text-yellow-400 text-xl font-medium">
              {uploading ? '上传中...' : '松开以上传参考图片'}
            </div>
          </div>
          {/* 黄色框区域的遮挡 - 不显示拖拽提示 */}
          <div 
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-3xl h-full max-h-[calc(100vh-200px)] bg-zinc-800"
            style={{ pointerEvents: 'none' }}
          />
        </div>
      )}
    </div>
  );
}
