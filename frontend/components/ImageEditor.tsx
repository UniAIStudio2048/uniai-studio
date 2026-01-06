'use client';

import { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Save, 
  Download, 
  Maximize2,
  Grid3X3,
  Crop,
  MousePointer2,
  Wand2,
  Undo,
  Redo
} from 'lucide-react';
import Image from 'next/image';
import ExpandImageModal from './ExpandImageModal';
import CutoutModal from './CutoutModal';
import CropModal from './CropModal';

interface ImageEditorProps {
  imageUrl: string;
  imageId: string;
  onClose: () => void;
  onSave?: (editedImageUrl: string) => void;
  initialMode?: 'cutout' | 'expand' | null;
}

type EditMode = 'expand' | 'crop' | 'annotate' | 'cutout' | null;

interface Annotation {
  id: number;
  x: number;
  y: number;
}

// 移动端检测
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  return isMobile;
}

export default function ImageEditor({ imageUrl, imageId, onClose, onSave, initialMode = null }: ImageEditorProps) {
  const isMobile = useIsMobile();
  const [currentImageUrl, setCurrentImageUrl] = useState(imageUrl);
  const [isImagePreview, setIsImagePreview] = useState(false);
  const [showExpandModal, setShowExpandModal] = useState(initialMode === 'expand');
  const [showCutoutModal, setShowCutoutModal] = useState(initialMode === 'cutout');
  const [showCropModal, setShowCropModal] = useState(false);
  const [editMode, setEditMode] = useState<EditMode>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [nextAnnotationId, setNextAnnotationId] = useState(1);
  const [history, setHistory] = useState<Annotation[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  
  // 图片历史记录（用于撤销）
  const [imageHistory, setImageHistory] = useState<string[]>([imageUrl]);
  const [imageHistoryIndex, setImageHistoryIndex] = useState(0);
  
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  // 添加图片到历史记录
  const addToHistory = (newImageUrl: string) => {
    const newHistory = imageHistory.slice(0, imageHistoryIndex + 1);
    newHistory.push(newImageUrl);
    setImageHistory(newHistory);
    setImageHistoryIndex(newHistory.length - 1);
    setCurrentImageUrl(newImageUrl);
  };

  // 切换图像全屏预览
  const toggleImagePreview = () => {
    setIsImagePreview(!isImagePreview);
  };

  // 下载图片
  const handleDownload = async () => {
    try {
      const response = await fetch(currentImageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `edited-image-${imageId}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      alert('下载失败');
    }
  };

  // 保存图片（将标注渲染到图片中）
  const handleSave = async () => {
    // 如果没有标注，直接保存原图
    if (annotations.length === 0) {
      onSave?.(currentImageUrl);
      return;
    }
    
    try {
      // 加载当前图片
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = currentImageUrl;
      });
      
      // 创建 Canvas 绘制图片和标注
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        onSave?.(currentImageUrl);
        return;
      }
      
      // 绘制原图
      ctx.drawImage(img, 0, 0);
      
      // 绘制标注点
      const markerRadius = Math.max(12, Math.min(img.naturalWidth, img.naturalHeight) * 0.015);
      const fontSize = markerRadius * 1.2;
      
      annotations.forEach((annotation) => {
        const x = (annotation.x / 100) * img.naturalWidth;
        const y = (annotation.y / 100) * img.naturalHeight;
        
        // 绘制红色圆形背景
        ctx.beginPath();
        ctx.arc(x, y, markerRadius, 0, Math.PI * 2);
        ctx.fillStyle = '#ef4444'; // red-500
        ctx.fill();
        
        // 绘制白色边框
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // 绘制标注数字
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${fontSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(annotation.id.toString(), x, y);
      });
      
      // 导出为 data URL
      const annotatedImageUrl = canvas.toDataURL('image/png');
      onSave?.(annotatedImageUrl);
    } catch (error) {
      console.error('保存标注图片失败:', error);
      // 失败时保存原图
      onSave?.(currentImageUrl);
    }
  };

  // 添加标注
  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (editMode !== 'annotate') return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    const newAnnotation = { id: nextAnnotationId, x, y };
    const newAnnotations = [...annotations, newAnnotation];
    setAnnotations(newAnnotations);
    setNextAnnotationId(nextAnnotationId + 1);
    
    // 保存到历史记录
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newAnnotations);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  // 删除标注
  const handleDeleteAnnotation = (id: number) => {
    const newAnnotations = annotations.filter(a => a.id !== id);
    setAnnotations(newAnnotations);
    
    // 保存到历史记录
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newAnnotations);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  // 标注撤销
  const handleAnnotationUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setAnnotations(history[newIndex]);
      // 更新 nextAnnotationId
      const maxId = history[newIndex].reduce((max, a) => Math.max(max, a.id), 0);
      setNextAnnotationId(maxId + 1);
    }
  };

  // 标注重做
  const handleAnnotationRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setAnnotations(history[newIndex]);
      // 更新 nextAnnotationId
      const maxId = history[newIndex].reduce((max, a) => Math.max(max, a.id), 0);
      setNextAnnotationId(maxId + 1);
    }
  };

  // 撤销图片编辑
  const handleUndo = () => {
    if (imageHistoryIndex > 0) {
      const newIndex = imageHistoryIndex - 1;
      setImageHistoryIndex(newIndex);
      setCurrentImageUrl(imageHistory[newIndex]);
    }
  };

  const tools = [
    { id: 'expand', icon: Grid3X3, label: '扩图' },
    { id: 'cutout', icon: Wand2, label: '抠图' },
    { id: 'annotate', icon: MousePointer2, label: '标注' },
    { id: 'crop', icon: Crop, label: '裁剪' },
  ];

  // 处理工具点击
  const handleToolClick = (toolId: string) => {
    if (toolId === 'expand') {
      setShowExpandModal(true);
    } else if (toolId === 'cutout') {
      setShowCutoutModal(true);
    } else if (toolId === 'crop') {
      setShowCropModal(true);
    } else {
      setEditMode(editMode === toolId as EditMode ? null : toolId as EditMode);
    }
  };

  // 处理裁剪保存
  const handleCropSave = (croppedImageUrl: string) => {
    addToHistory(croppedImageUrl);
    setShowCropModal(false);
  };

  // 处理扩图
  const handleExpand = (settings: { top: number; right: number; bottom: number; left: number; keepAspectRatio: boolean; bgColor: string; expandedImageUrl?: string }) => {
    console.log('扩图完成:', settings);
    
    // 更新当前图片为扩展后的图片，并添加到历史记录
    if (settings.expandedImageUrl) {
      addToHistory(settings.expandedImageUrl);
    }
    
    setShowExpandModal(false);
  };

  // 处理抠图保存
  const handleCutoutSave = (cutoutImageUrl: string) => {
    addToHistory(cutoutImageUrl);
    setShowCutoutModal(false);
  };
  
  // 图像全屏预览模式
  if (isImagePreview) {
    return (
      <div 
        className="fixed inset-0 bg-black z-[60] flex items-center justify-center cursor-pointer"
        onClick={toggleImagePreview}
      >
        <button
          onClick={toggleImagePreview}
          className="absolute top-4 right-4 w-10 h-10 rounded-lg bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center transition-colors z-10"
          title="退出预览"
        >
          <X size={20} className="text-white" />
        </button>
        <Image
          src={currentImageUrl}
          alt="Preview"
          fill
          className="object-contain p-4"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    );
  }

  // 扩图模式
  if (showExpandModal) {
    return (
      <ExpandImageModal
        imageUrl={currentImageUrl}
        onClose={() => setShowExpandModal(false)}
        onExpand={handleExpand}
      />
    );
  }

  return (
    <div className={`fixed inset-0 bg-black/80 z-50 flex items-center justify-center ${isMobile ? 'p-2' : 'p-8'}`}>
      <div 
        ref={editorRef}
        className={`bg-zinc-900 rounded-xl shadow-2xl flex flex-col w-full overflow-hidden ${
          isMobile ? 'max-w-full h-full max-h-full' : 'max-w-5xl max-h-[90vh]'
        }`}
      >
        {/* 顶部工具栏 - 移动端简化布局 */}
        <div className={`bg-zinc-800 border-b border-zinc-700 flex items-center justify-between flex-shrink-0 ${
          isMobile ? 'h-12 px-2' : 'h-14 px-4'
        }`}>
          {/* 左侧：撤销 */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleUndo}
              disabled={imageHistoryIndex <= 0}
              className={`rounded-lg bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors ${
                isMobile ? 'w-8 h-8' : 'w-10 h-10'
              }`}
              title="撤销"
            >
              <Undo size={isMobile ? 16 : 18} className="text-zinc-300" />
            </button>
          </div>
  
          {/* 中间：主要工具 - 移动端只显示图标 */}
          <div className={`flex items-center ${isMobile ? 'gap-1' : 'gap-2'}`}>
            {tools.map((tool) => (
              <button
                key={tool.id}
                onClick={() => handleToolClick(tool.id)}
                className={`rounded-lg flex items-center justify-center transition-colors ${
                  editMode === tool.id
                    ? 'bg-yellow-500 text-black'
                    : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-300'
                } ${
                  isMobile ? 'w-9 h-9' : 'h-10 px-4 gap-2'
                }`}
                title={tool.label}
              >
                <tool.icon size={isMobile ? 16 : 18} />
                {!isMobile && <span className="text-sm font-medium">{tool.label}</span>}
              </button>
            ))}
          </div>
  
          {/* 右侧：功能按钮 */}
          <div className={`flex items-center ${isMobile ? 'gap-1' : 'gap-2'}`}>
            {!isMobile && (
              <>
                <button
                  onClick={handleDownload}
                  className="w-10 h-10 rounded-lg bg-zinc-700 hover:bg-zinc-600 flex items-center justify-center transition-colors"
                  title="下载"
                >
                  <Download size={18} className="text-zinc-300" />
                </button>
                <button
                  onClick={toggleImagePreview}
                  className="w-10 h-10 rounded-lg bg-zinc-700 hover:bg-zinc-600 flex items-center justify-center transition-colors"
                  title="图像全屏预览"
                >
                  <Maximize2 size={18} className="text-zinc-300" />
                </button>
              </>
            )}
            <button
              onClick={handleSave}
              className={`rounded-lg bg-yellow-500 hover:bg-yellow-400 flex items-center justify-center transition-colors ${
                isMobile ? 'w-8 h-8' : 'w-10 h-10'
              }`}
              title="保存"
            >
              <Save size={isMobile ? 16 : 18} className="text-black" />
            </button>
            <button
              onClick={onClose}
              className={`rounded-lg bg-zinc-700 hover:bg-red-600 flex items-center justify-center transition-colors ${
                isMobile ? 'w-8 h-8' : 'w-10 h-10'
              }`}
              title="关闭"
            >
              <X size={isMobile ? 16 : 18} className="text-zinc-300" />
            </button>
          </div>
        </div>
  
        {/* 编辑区域 */}
        <div className={`flex-1 flex items-center justify-center overflow-hidden bg-zinc-900 min-h-0 ${
          isMobile ? 'p-2' : 'p-8'
        }`}>
          <div 
            ref={imageContainerRef}
            className={`relative ${editMode === 'annotate' ? 'cursor-crosshair' : ''}`}
            onClick={handleImageClick}
          >
            <Image
              src={currentImageUrl}
              alt="Editing"
              width={800}
              height={600}
              className={`object-contain rounded-lg ${
                isMobile ? 'max-w-full max-h-[50vh]' : 'max-w-full max-h-[60vh]'
              }`}
              style={{ width: 'auto', height: 'auto' }}
            />
  
            {/* 标注点 */}
            {annotations.map((annotation) => (
              <div
                key={annotation.id}
                className="absolute w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold cursor-pointer hover:bg-red-600 transform -translate-x-1/2 -translate-y-1/2 shadow-lg"
                style={{ left: `${annotation.x}%`, top: `${annotation.y}%` }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (editMode === 'annotate') {
                    handleDeleteAnnotation(annotation.id);
                  }
                }}
                title={editMode === 'annotate' ? '点击删除' : `标注 ${annotation.id}`}
              >
                {annotation.id}
              </div>
            ))}
            
            {/* 标注模式下的撤销/重做按钮 - 图片右上角 */}
            {editMode === 'annotate' && (
              <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/60 rounded-lg p-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAnnotationUndo();
                  }}
                  disabled={historyIndex <= 0}
                  className="w-8 h-8 rounded-md bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                  title="撤销标注"
                >
                  <Undo size={16} className="text-white" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAnnotationRedo();
                  }}
                  disabled={historyIndex >= history.length - 1}
                  className="w-8 h-8 rounded-md bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                  title="重做标注"
                >
                  <Redo size={16} className="text-white" />
                </button>
              </div>
            )}
          </div>
        </div>
  
        {/* 底部提示 */}
        <div className={`bg-zinc-800 border-t border-zinc-700 flex items-center justify-center flex-shrink-0 ${
          isMobile ? 'h-8' : 'h-10'
        }`}>
          <span className={`text-zinc-500 ${isMobile ? 'text-xs' : 'text-sm'}`}>
            {editMode === 'annotate' && '点击图片添加标注，点击标注点删除'}
            {!editMode && '选择上方工具开始编辑'}
          </span>
        </div>
      </div>
      
      {/* 抠图模态框 - 作为覆盖层渲染，避免闪烁 */}
      {showCutoutModal && (
        <CutoutModal
          imageUrl={currentImageUrl}
          onClose={() => setShowCutoutModal(false)}
          onSave={handleCutoutSave}
        />
      )}
      
      {/* 裁剪模态框 */}
      {showCropModal && (
        <CropModal
          imageUrl={currentImageUrl}
          onClose={() => setShowCropModal(false)}
          onSave={handleCropSave}
        />
      )}
    </div>
  );
}
