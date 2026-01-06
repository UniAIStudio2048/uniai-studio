'use client';

import { useState, useRef, useEffect } from 'react';
import { Wand2, Square, ArrowLeft, Save, RefreshCw } from 'lucide-react';

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

interface CutoutModalProps {
  imageUrl: string;
  onClose: () => void;
  onSave: (cutoutImageUrl: string) => void;
}

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || '';

export default function CutoutModal({ imageUrl, onClose, onSave }: CutoutModalProps) {
  const isMobile = useIsMobile();
  const [processedImageUrl, setProcessedImageUrl] = useState<string | null>(null);
  const [hasWhiteBackground, setHasWhiteBackground] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useFallback, setUseFallback] = useState(false);
  const [detectedType, setDetectedType] = useState<'person' | 'product' | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  
  // 淡入动画
  useEffect(() => {
    // 延迟一帧后显示，确保动画效果
    requestAnimationFrame(() => {
      setIsVisible(true);
    });
  }, []);
  
  // 保存原始图片数据和遮罩数据用于反转
  const originalImageDataRef = useRef<ImageData | null>(null);
  const maskDataRef = useRef<Uint8Array | null>(null);
  const canvasSizeRef = useRef<{ width: number; height: number } | null>(null);

  // 检测图片类型（人像还是商品）
  const detectImageType = async (imageBlob: Blob): Promise<'person' | 'product'> => {
    return new Promise((resolve) => {
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      const url = URL.createObjectURL(imageBlob);
      
      img.onload = async () => {
        try {
          // 使用 MediaPipe 尝试检测人脸
          const { FaceDetector, FilesetResolver } = await import('@mediapipe/tasks-vision');
          
          const vision = await FilesetResolver.forVisionTasks(
            'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
          );
          
          const faceDetector = await FaceDetector.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite',
              delegate: 'GPU'
            },
            runningMode: 'IMAGE'
          });
          
          const detections = faceDetector.detect(img);
          faceDetector.close();
          URL.revokeObjectURL(url);
          
          // 如果检测到人脸，则为人像
          resolve(detections.detections.length > 0 ? 'person' : 'product');
        } catch {
          URL.revokeObjectURL(url);
          // 默认使用商品模式
          resolve('product');
        }
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve('product');
      };
      
      img.src = url;
    });
  };

  // 人像抠图：使用 MediaPipe Selfie Segmenter
  const personCutout = async (imageBlob: Blob): Promise<string> => {
    return new Promise(async (resolve, reject) => {
      try {
        const { ImageSegmenter, FilesetResolver } = await import('@mediapipe/tasks-vision');
        
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );
        
        const segmenter = await ImageSegmenter.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite',
            delegate: 'GPU'
          },
          runningMode: 'IMAGE',
          outputCategoryMask: true,
          outputConfidenceMasks: true
        });

        const img = new window.Image();
        img.crossOrigin = 'anonymous';
        const url = URL.createObjectURL(imageBlob);
        
        img.onload = async () => {
          try {
            const result = segmenter.segment(img);
            
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            
            if (!ctx || !result.confidenceMasks || result.confidenceMasks.length === 0) {
              throw new Error('分割失败');
            }

            // 先绘制原图并保存原始数据
            ctx.drawImage(img, 0, 0);
            const originalData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            originalImageDataRef.current = new ImageData(
              new Uint8ClampedArray(originalData.data),
              canvas.width,
              canvas.height
            );
            
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const pixels = imageData.data;

            // 使用置信度遮罩
            const confidenceMask = result.confidenceMasks[0].getAsFloat32Array();
            const maskData = new Uint8Array(confidenceMask.length);

            for (let i = 0; i < confidenceMask.length; i++) {
              const confidence = confidenceMask[i];
              // 置信度 > 0.5 表示前景，mask[i] = 1 表示保留
              const alpha = Math.round(confidence * 255);
              pixels[i * 4 + 3] = alpha;
              maskData[i] = alpha > 127 ? 1 : 0;
            }

            // 保存遮罩数据
            maskDataRef.current = maskData;
            canvasSizeRef.current = { width: canvas.width, height: canvas.height };

            ctx.putImageData(imageData, 0, 0);
            URL.revokeObjectURL(url);
            segmenter.close();
            
            resolve(canvas.toDataURL('image/png'));
          } catch (err) {
            URL.revokeObjectURL(url);
            reject(err);
          }
        };
        
        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error('图片加载失败'));
        };
        
        img.src = url;
      } catch (error) {
        reject(error);
      }
    });
  };

  // 商品图抠图：使用洪水填充算法
  const productCutout = async (imageBlob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      const url = URL.createObjectURL(imageBlob);
      
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          
          if (!ctx) throw new Error('无法创建 Canvas');
          
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          const width = canvas.width;
          const height = canvas.height;
          
          // 保存原始数据
          const originalData = new Uint8ClampedArray(data);
          
          // 从边缘采样背景色
          const samples: number[][] = [];
          const step = Math.max(1, Math.floor(Math.min(width, height) / 30));
          
          for (let x = 0; x < width; x += step) {
            samples.push([data[x * 4], data[x * 4 + 1], data[x * 4 + 2]]);
            const bIdx = ((height - 1) * width + x) * 4;
            samples.push([data[bIdx], data[bIdx + 1], data[bIdx + 2]]);
          }
          for (let y = 0; y < height; y += step) {
            const lIdx = y * width * 4;
            samples.push([data[lIdx], data[lIdx + 1], data[lIdx + 2]]);
            const rIdx = (y * width + width - 1) * 4;
            samples.push([data[rIdx], data[rIdx + 1], data[rIdx + 2]]);
          }
          
          const avgBg = [
            Math.round(samples.reduce((s, c) => s + c[0], 0) / samples.length),
            Math.round(samples.reduce((s, c) => s + c[1], 0) / samples.length),
            Math.round(samples.reduce((s, c) => s + c[2], 0) / samples.length)
          ];
          
          let stdDev = 0;
          samples.forEach(c => {
            stdDev += Math.pow(c[0] - avgBg[0], 2) + Math.pow(c[1] - avgBg[1], 2) + Math.pow(c[2] - avgBg[2], 2);
          });
          stdDev = Math.sqrt(stdDev / samples.length / 3);
          
          const threshold = Math.max(20, Math.min(50, 30 + stdDev * 0.3));
          
          const visited = new Uint8Array(width * height);
          const toRemove = new Uint8Array(width * height);
          
          const isBgColor = (idx: number): boolean => {
            const r = data[idx * 4], g = data[idx * 4 + 1], b = data[idx * 4 + 2];
            return Math.sqrt(Math.pow(r - avgBg[0], 2) + Math.pow(g - avgBg[1], 2) + Math.pow(b - avgBg[2], 2)) < threshold;
          };
          
          const queue: number[] = [];
          for (let x = 0; x < width; x++) {
            if (isBgColor(x)) queue.push(x);
            const bIdx = (height - 1) * width + x;
            if (isBgColor(bIdx)) queue.push(bIdx);
          }
          for (let y = 1; y < height - 1; y++) {
            if (isBgColor(y * width)) queue.push(y * width);
            if (isBgColor(y * width + width - 1)) queue.push(y * width + width - 1);
          }
          
          while (queue.length > 0) {
            const idx = queue.pop()!;
            if (visited[idx]) continue;
            visited[idx] = 1;
            if (!isBgColor(idx)) continue;
            toRemove[idx] = 1;
            const x = idx % width, y = Math.floor(idx / width);
            if (x > 0 && !visited[idx - 1]) queue.push(idx - 1);
            if (x < width - 1 && !visited[idx + 1]) queue.push(idx + 1);
            if (y > 0 && !visited[idx - width]) queue.push(idx - width);
            if (y < height - 1 && !visited[idx + width]) queue.push(idx + width);
          }
          
          // 应用透明度
          for (let i = 0; i < toRemove.length; i++) {
            if (toRemove[i]) {
              data[i * 4 + 3] = 0;
            } else {
              // 边缘柔化
              const x = i % width, y = Math.floor(i / width);
              let nearBg = false;
              for (let d = -1; d <= 1 && !nearBg; d++) {
                for (let e = -1; e <= 1; e++) {
                  const ni = (y + d) * width + (x + e);
                  if (ni >= 0 && ni < toRemove.length && toRemove[ni]) { nearBg = true; break; }
                }
              }
              if (nearBg) {
                const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
                const diff = Math.sqrt(Math.pow(r - avgBg[0], 2) + Math.pow(g - avgBg[1], 2) + Math.pow(b - avgBg[2], 2));
                data[i * 4 + 3] = Math.min(255, Math.round((diff / threshold) * 200));
              }
            }
          }
          
          // 保存遮罩数据（mask[i] = 1 表示前景/保留，0 表示背景/移除）
          const keepMask = new Uint8Array(toRemove.length);
          for (let i = 0; i < toRemove.length; i++) {
            keepMask[i] = toRemove[i] ? 0 : 1;
          }
          originalImageDataRef.current = new ImageData(originalData, width, height);
          maskDataRef.current = keepMask;
          canvasSizeRef.current = { width, height };
          
          ctx.putImageData(imageData, 0, 0);
          URL.revokeObjectURL(url);
          resolve(canvas.toDataURL('image/png'));
        } catch (err) {
          URL.revokeObjectURL(url);
          reject(err);
        }
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('图片加载失败'));
      };
      
      img.src = url;
    });
  };

  // 反转遮罩
  const handleInvertMask = () => {
    if (!originalImageDataRef.current || !maskDataRef.current || !canvasSizeRef.current) {
      setError('请先执行抠图');
      return;
    }
    
    const { width, height } = canvasSizeRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;
    
    const imageData = new ImageData(
      new Uint8ClampedArray(originalImageDataRef.current.data),
      width,
      height
    );
    const pixels = imageData.data;
    const mask = maskDataRef.current;
    
    // 先反转遮罩数据
    for (let i = 0; i < mask.length; i++) {
      mask[i] = mask[i] ? 0 : 1;
    }
    
    // 然后应用新的遮罩（mask[i] = 1 表示保留）
    for (let i = 0; i < mask.length; i++) {
      pixels[i * 4 + 3] = mask[i] ? 255 : 0;
    }
    
    ctx.putImageData(imageData, 0, 0);
    setProcessedImageUrl(canvas.toDataURL('image/png'));
    setError('↔️ 遮罩已反转');
  };

  // 执行抠图
  const handleCutout = async () => {
    setIsProcessing(true);
    setError(null);
    
    try {
      // 获取图片数据
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      
      // 尝试调用 API（如果未使用备用方案）
      if (!useFallback) {
        try {
          const formData = new FormData();
          formData.append('image', blob, 'image.png');

          const cutoutResponse = await fetch(`${BACKEND_URL}/api/cutout`, {
            method: 'POST',
            body: formData,
          });

          const result = await cutoutResponse.json();

          if (!cutoutResponse.ok) {
            const errorMsg = result.error || '';
            const needFallback = 
              errorMsg.includes('额度') || 
              errorMsg.includes('credits') || 
              errorMsg.includes('quota') ||
              errorMsg.includes('API Key') ||
              errorMsg.includes('配置');
            
            if (needFallback) {
              console.log('检测到 API 不可用，切换到备用方案');
              setUseFallback(true);
              throw new Error('USE_FALLBACK');
            }
            throw new Error(errorMsg || '抠图失败');
          }

          setProcessedImageUrl(result.image);
          setHasWhiteBackground(false);
          setDetectedType(null);
          return;
        } catch (apiError) {
          if (apiError instanceof Error && apiError.message === 'USE_FALLBACK') {
            // 继续使用备用方案
          } else {
            throw apiError;
          }
        }
      }
      
      // 使用备用方案：先检测图片类型
      setError('🔍 正在检测图片类型...');
      const imageType = await detectImageType(blob);
      setDetectedType(imageType);
      
      let result: string;
      if (imageType === 'person') {
        setError('👤 检测到人像，使用 AI 人像分割模型...');
        result = await personCutout(blob);
        setError('💡 使用免费 AI 人像抠图方案');
      } else {
        setError('📦 检测到商品图，使用智能背景移除...');
        result = await productCutout(blob);
        setError('💡 使用免费商品图抠图方案');
      }
      
      setProcessedImageUrl(result);
      setHasWhiteBackground(false);
    } catch (err) {
      console.error('抠图失败:', err);
      if (err instanceof Error && err.message !== 'USE_FALLBACK') {
        setError(err.message || '抠图处理失败，请重试');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // 一键换白底
  const handleWhiteBackground = async () => {
    if (!processedImageUrl) {
      setError('请先执行抠图');
      return;
    }
    
    setIsProcessing(true);
    try {
      // 使用 Canvas 添加白色背景
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = processedImageUrl;
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d')!;
      
      // 填充白色背景
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // 绘制抠图结果
      ctx.drawImage(img, 0, 0);
      
      const whiteBackgroundUrl = canvas.toDataURL('image/png');
      setProcessedImageUrl(whiteBackgroundUrl);
      setHasWhiteBackground(true);
    } catch (err) {
      console.error('换白底失败:', err);
      setError('换白底失败');
    } finally {
      setIsProcessing(false);
    }
  };

  // 保存
  const handleSave = () => {
    if (processedImageUrl) {
      onSave(processedImageUrl);
    }
  };

  const currentImage = processedImageUrl || imageUrl;

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
        <div className={`bg-zinc-800 border-b border-zinc-700 flex flex-shrink-0 ${
          isMobile ? 'flex-col p-2 gap-2' : 'h-14 items-center justify-between px-4'
        }`}>
          {/* 移动端第一行：标题 + 关闭按钮 */}
          {isMobile ? (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wand2 size={16} className="text-yellow-500" />
                  <span className="text-white font-medium text-sm">智能抠图</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={onClose}
                    className="h-8 px-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-xs font-medium rounded-lg flex items-center gap-1 transition-colors"
                  >
                    <ArrowLeft size={14} />
                    返回
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={!processedImageUrl}
                    className="h-8 px-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg flex items-center gap-1 transition-colors"
                  >
                    <Save size={14} />
                    保存
                  </button>
                </div>
              </div>
              {/* 移动端第二行：操作按钮 */}
              <div className="flex items-center gap-1 overflow-x-auto">
                <button
                  onClick={handleCutout}
                  disabled={isProcessing}
                  className="h-8 px-3 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed text-black text-xs font-medium rounded-lg flex items-center gap-1 transition-colors flex-shrink-0"
                >
                  <Wand2 size={14} />
                  {isProcessing ? '处理中...' : '执行抠图'}
                </button>
                
                <button
                  onClick={handleWhiteBackground}
                  disabled={isProcessing || !processedImageUrl}
                  className="h-8 px-3 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-300 text-xs font-medium rounded-lg flex items-center gap-1 transition-colors flex-shrink-0"
                >
                  <Square size={14} />
                  换白底
                </button>
                
                <button
                  onClick={handleInvertMask}
                  disabled={isProcessing || !processedImageUrl}
                  className="h-8 px-3 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-300 text-xs font-medium rounded-lg flex items-center gap-1 transition-colors flex-shrink-0"
                >
                  <RefreshCw size={14} />
                  反转
                </button>
              </div>
            </>
          ) : (
            /* 桌面端布局 */
            <>
              {/* 左侧：标题 */}
              <div className="flex items-center gap-3">
                <Wand2 size={20} className="text-yellow-500" />
                <span className="text-white font-medium">智能抠图</span>
              </div>

              {/* 右侧：功能按钮 */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCutout}
                  disabled={isProcessing}
                  className="h-9 px-4 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed text-black text-sm font-medium rounded-lg flex items-center gap-2 transition-colors"
                >
                  <Wand2 size={16} />
                  {isProcessing ? '处理中...' : '执行抠图'}
                </button>
                
                <button
                  onClick={handleWhiteBackground}
                  disabled={isProcessing || !processedImageUrl}
                  className="h-9 px-4 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-300 text-sm font-medium rounded-lg flex items-center gap-2 transition-colors"
                >
                  <Square size={16} />
                  换白底
                </button>
                
                <button
                  onClick={handleInvertMask}
                  disabled={isProcessing || !processedImageUrl}
                  className="h-9 px-4 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-300 text-sm font-medium rounded-lg flex items-center gap-2 transition-colors"
                  title="反转遮罩：保留背景，移除主体"
                >
                  <RefreshCw size={16} />
                  反转
                </button>

                <div className="w-px h-6 bg-zinc-600 mx-1" />

                <button
                  onClick={onClose}
                  className="h-9 px-3 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-sm font-medium rounded-lg flex items-center gap-2 transition-colors"
                >
                  <ArrowLeft size={16} />
                  返回
                </button>
                
                <button
                  onClick={handleSave}
                  disabled={!processedImageUrl}
                  className="h-9 px-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg flex items-center gap-2 transition-colors"
                >
                  <Save size={16} />
                  保存
                </button>
              </div>
            </>
          )}
        </div>

        {/* 主要区域 */}
        <div className={`flex-1 flex items-center justify-center overflow-hidden bg-zinc-900 min-h-0 ${
          isMobile ? 'p-2' : 'p-6'
        }`}>
          <div 
            className="relative rounded-lg overflow-hidden"
            style={{ 
              backgroundImage: 'linear-gradient(45deg, #333 25%, transparent 25%), linear-gradient(-45deg, #333 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #333 75%), linear-gradient(-45deg, transparent 75%, #333 75%)',
              backgroundSize: '16px 16px',
              backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
              backgroundColor: hasWhiteBackground ? '#fff' : '#222'
            }}
          >
            <img
              src={currentImage}
              alt="Cutout"
              className={`object-contain ${
                isMobile ? 'max-w-full max-h-[50vh]' : 'max-w-full max-h-[55vh]'
              }`}
              style={{ userSelect: 'none' }}
              draggable={false}
            />
            
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
          isMobile ? 'h-8 px-2' : 'h-10'
        }`}>
          <span className={`text-zinc-500 text-center ${
            isMobile ? 'text-xs' : 'text-sm'
          }`}>
            {error ? (
              <span className={error.includes('💡') || error.includes('⇔️') || error.includes('🔍') || error.includes('👤') || error.includes('📦') ? 'text-blue-400' : 'text-red-400'}>{error}</span>
            ) : processedImageUrl ? (
              useFallback ? (
                <span className="text-blue-400">
                  抠图完成（{detectedType === 'person' ? '人像 AI' : '商品图'}方案）
                </span>
              ) : (
                '抠图完成，可以保存或继续编辑'
              )
            ) : (
              isMobile ? '点击"执行抠图"开始' : '点击"执行抠图"开始智能抠图'
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
