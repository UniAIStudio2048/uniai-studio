'use client';

import { useState, useRef, useEffect } from 'react';
import { Crop, ArrowLeft, Save, RotateCcw } from 'lucide-react';

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

interface CropModalProps {
  imageUrl: string;
  onClose: () => void;
  onSave: (croppedImageUrl: string) => void;
}

interface CropBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export default function CropModal({ imageUrl, onClose, onSave }: CropModalProps) {
  const isMobile = useIsMobile();
  const [cropStart, setCropStart] = useState<{ x: number; y: number } | null>(null);
  const [cropEnd, setCropEnd] = useState<{ x: number; y: number } | null>(null);
  const [isCropping, setIsCropping] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [croppedImageUrl, setCroppedImageUrl] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 预加载图片后再显示
  useEffect(() => {
    const img = new window.Image();
    img.src = imageUrl;
    img.onload = () => {
      setIsImageLoaded(true);
      requestAnimationFrame(() => {
        setIsVisible(true);
      });
    };
    img.onerror = () => {
      setIsImageLoaded(true);
      setIsVisible(true);
    };
  }, [imageUrl]);

  // 计算裁剪框
  const getCropBox = (): CropBox | null => {
    if (!cropStart || !cropEnd) return null;
    
    const left = Math.min(cropStart.x, cropEnd.x);
    const top = Math.min(cropStart.y, cropEnd.y);
    const width = Math.abs(cropEnd.x - cropStart.x);
    const height = Math.abs(cropEnd.y - cropStart.y);
    
    return { left, top, width, height };
  };

  const cropBox = getCropBox();

  // 鼠标/触摸事件
  const handleStart = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (croppedImageUrl) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    
    setCropStart({ x, y });
    setCropEnd({ x, y });
    setIsCropping(true);
  };

  const handleMove = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (!isCropping) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
    
    setCropEnd({ x, y });
  };

  const handleEnd = () => {
    setIsCropping(false);
  };

  // 执行裁剪
  const handleCrop = async () => {
    if (!cropBox || cropBox.width < 1 || cropBox.height < 1) return;
    
    setIsProcessing(true);
    
    try {
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = imageUrl;
      });
      
      const canvas = document.createElement('canvas');
      const cropX = (cropBox.left / 100) * img.naturalWidth;
      const cropY = (cropBox.top / 100) * img.naturalHeight;
      const cropW = (cropBox.width / 100) * img.naturalWidth;
      const cropH = (cropBox.height / 100) * img.naturalHeight;
      
      canvas.width = cropW;
      canvas.height = cropH;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
        const result = canvas.toDataURL('image/png');
        setCroppedImageUrl(result);
      }
    } catch (error) {
      console.error('裁剪失败:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // 重置裁剪
  const handleReset = () => {
    setCropStart(null);
    setCropEnd(null);
    setCroppedImageUrl(null);
  };

  // 保存
  const handleSave = () => {
    if (croppedImageUrl) {
      onSave(croppedImageUrl);
    }
  };

  const currentImage = croppedImageUrl || imageUrl;
  const showCropOverlay = !croppedImageUrl && cropBox && cropBox.width > 0 && cropBox.height > 0;

  return (
    <div 
      className={`fixed inset-0 bg-black/80 z-[70] flex items-center justify-center transition-opacity duration-150 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      } ${
        isMobile ? 'p-2' : 'p-8'
      }`}
    >
      <div 
        className={`bg-zinc-900 rounded-xl shadow-2xl flex flex-col w-full overflow-hidden transition-all duration-150 ${
          isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        } ${
          isMobile ? 'max-w-full h-full max-h-full' : 'max-w-4xl max-h-[85vh]'
        }`}
      >
        {/* 顶部工具栏 */}
        <div className={`bg-zinc-800 border-b border-zinc-700 flex items-center justify-between flex-shrink-0 ${
          isMobile ? 'h-12 px-2' : 'h-14 px-4'
        }`}>
          {/* 左侧：标题 */}
          <div className="flex items-center gap-2">
            <Crop size={isMobile ? 16 : 20} className="text-yellow-500" />
            <span className={`text-white font-medium ${isMobile ? 'text-sm' : ''}`}>图片裁剪</span>
          </div>

          {/* 右侧：功能按钮 */}
          <div className={`flex items-center ${isMobile ? 'gap-1' : 'gap-2'}`}>
            {!croppedImageUrl && cropBox && cropBox.width > 1 && cropBox.height > 1 && (
              <button
                onClick={handleCrop}
                disabled={isProcessing}
                className={`bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-medium rounded-lg flex items-center gap-1 transition-colors ${
                  isMobile ? 'h-8 px-2 text-xs' : 'h-9 px-4 text-sm gap-2'
                }`}
              >
                <Crop size={isMobile ? 14 : 16} />
                {isProcessing ? '处理中...' : '确认裁剪'}
              </button>
            )}
            
            {(croppedImageUrl || (cropBox && cropBox.width > 1)) && (
              <button
                onClick={handleReset}
                disabled={isProcessing}
                className={`bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-zinc-300 font-medium rounded-lg flex items-center gap-1 transition-colors ${
                  isMobile ? 'h-8 px-2 text-xs' : 'h-9 px-4 text-sm gap-2'
                }`}
              >
                <RotateCcw size={isMobile ? 14 : 16} />
                {isMobile ? '重选' : '重新选择'}
              </button>
            )}

            {!isMobile && <div className="w-px h-6 bg-zinc-600 mx-1" />}

            <button
              onClick={onClose}
              className={`bg-zinc-700 hover:bg-zinc-600 text-zinc-300 font-medium rounded-lg flex items-center gap-1 transition-colors ${
                isMobile ? 'h-8 px-2 text-xs' : 'h-9 px-3 text-sm gap-2'
              }`}
            >
              <ArrowLeft size={isMobile ? 14 : 16} />
              {!isMobile && '返回'}
            </button>
            
            <button
              onClick={handleSave}
              disabled={!croppedImageUrl}
              className={`bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg flex items-center gap-1 transition-colors ${
                isMobile ? 'h-8 px-2 text-xs' : 'h-9 px-3 text-sm gap-2'
              }`}
            >
              <Save size={isMobile ? 14 : 16} />
              {!isMobile && '保存'}
            </button>
          </div>
        </div>

        {/* 主要区域 */}
        <div className={`flex-1 flex items-center justify-center overflow-hidden bg-zinc-900 min-h-0 ${
          isMobile ? 'p-2' : 'p-6'
        }`}>
          <div 
            ref={containerRef}
            className={`relative rounded-lg overflow-hidden ${!croppedImageUrl ? 'cursor-crosshair' : ''}`}
            onMouseDown={handleStart}
            onMouseMove={handleMove}
            onMouseUp={handleEnd}
            onMouseLeave={handleEnd}
            onTouchStart={handleStart}
            onTouchMove={handleMove}
            onTouchEnd={handleEnd}
            style={{ 
              backgroundImage: 'linear-gradient(45deg, #333 25%, transparent 25%), linear-gradient(-45deg, #333 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #333 75%), linear-gradient(-45deg, transparent 75%, #333 75%)',
              backgroundSize: '16px 16px',
              backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
              backgroundColor: '#222',
              touchAction: 'none'
            }}
          >
            <img
              ref={imageRef}
              src={currentImage}
              alt="Crop"
              className={`object-contain select-none ${
                isMobile ? 'max-w-full max-h-[45vh]' : 'max-w-full max-h-[55vh]'
              }`}
              draggable={false}
            />
            
            {/* 裁剪框遮罩 */}
            {showCropOverlay && (
              <>
                {/* 遮罩层 - 上 */}
                <div 
                  className="absolute left-0 right-0 top-0 bg-black/60 pointer-events-none"
                  style={{ height: `${cropBox.top}%` }}
                />
                {/* 遮罩层 - 下 */}
                <div 
                  className="absolute left-0 right-0 bottom-0 bg-black/60 pointer-events-none"
                  style={{ height: `${100 - cropBox.top - cropBox.height}%` }}
                />
                {/* 遮罩层 - 左 */}
                <div 
                  className="absolute left-0 bg-black/60 pointer-events-none"
                  style={{ 
                    top: `${cropBox.top}%`, 
                    height: `${cropBox.height}%`,
                    width: `${cropBox.left}%`
                  }}
                />
                {/* 遮罩层 - 右 */}
                <div 
                  className="absolute right-0 bg-black/60 pointer-events-none"
                  style={{ 
                    top: `${cropBox.top}%`, 
                    height: `${cropBox.height}%`,
                    width: `${100 - cropBox.left - cropBox.width}%`
                  }}
                />
                {/* 裁剪框边界 */}
                <div 
                  className="absolute pointer-events-none"
                  style={{ 
                    left: `${cropBox.left}%`, 
                    top: `${cropBox.top}%`,
                    width: `${cropBox.width}%`,
                    height: `${cropBox.height}%`,
                    border: '2px dashed #facc15'
                  }}
                >
                  {/* 九宫格参考线 */}
                  <div className="absolute inset-0">
                    <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/30" />
                    <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/30" />
                    <div className="absolute top-1/3 left-0 right-0 h-px bg-white/30" />
                    <div className="absolute top-2/3 left-0 right-0 h-px bg-white/30" />
                  </div>
                  {/* 四角标记 */}
                  <div className="absolute -left-1 -top-1 w-3 h-3 border-l-2 border-t-2 border-yellow-400" />
                  <div className="absolute -right-1 -top-1 w-3 h-3 border-r-2 border-t-2 border-yellow-400" />
                  <div className="absolute -left-1 -bottom-1 w-3 h-3 border-l-2 border-b-2 border-yellow-400" />
                  <div className="absolute -right-1 -bottom-1 w-3 h-3 border-r-2 border-b-2 border-yellow-400" />
                </div>
              </>
            )}
            
            {/* 处理中遮罩 */}
            {isProcessing && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-3 border-yellow-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-white text-sm">处理中...</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 底部提示 */}
        <div className={`bg-zinc-800 border-t border-zinc-700 flex items-center justify-center flex-shrink-0 ${
          isMobile ? 'h-8' : 'h-10'
        }`}>
          <span className={`text-zinc-500 ${isMobile ? 'text-xs' : 'text-sm'}`}>
            {croppedImageUrl ? (
              <span className="text-green-400">裁剪完成，可以保存或重新选择</span>
            ) : cropBox && cropBox.width > 1 && cropBox.height > 1 ? (
              <span className="text-blue-400">已选择裁剪区域，点击“确认裁剪”完成</span>
            ) : (
              isMobile ? '拖动选择裁剪区域' : '按住鼠标左键拖动选择裁剪区域'
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
