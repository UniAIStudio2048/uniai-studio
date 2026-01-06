'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { X, Plus, Square, Pipette, ChevronDown, ChevronUp } from 'lucide-react';

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

interface ExpandImageModalProps {
  imageUrl: string;
  onClose: () => void;
  onExpand: (settings: ExpandSettings) => void;
}

interface ExpandSettings {
  top: number;
  right: number;
  bottom: number;
  left: number;
  keepAspectRatio: boolean;
  bgColor: string;
  expandedImageUrl?: string;
}

type DragEdge = 'top' | 'right' | 'bottom' | 'left' | null;

// 根据位置获取颜色 (HSV/HSB 模式)
function hsvToRgb(h: number, s: number, v: number): string {
  s = s / 100;
  v = v / 100;
  const c = v * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  
  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  
  const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export default function ExpandImageModal({ imageUrl, onClose, onExpand }: ExpandImageModalProps) {
  const isMobile = useIsMobile();
  const [expandTop, setExpandTop] = useState(0);
  const [expandRight, setExpandRight] = useState(0);
  const [expandBottom, setExpandBottom] = useState(0);
  const [expandLeft, setExpandLeft] = useState(0);
  const [bgColor, setBgColor] = useState('#ffffff');
  const [tempColor, setTempColor] = useState('#ffffff'); // 临时颜色（预览用）
  const [confirmedColor, setConfirmedColor] = useState('#ffffff'); // 确认的颜色
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [isPickingColor, setIsPickingColor] = useState(false);
  const [hue, setHue] = useState(0);
  const [saturation, setSaturation] = useState(0); // 0-100
  const [brightness, setBrightness] = useState(100); // 0-100 (V in HSV)
  // 保存打开面板前的 HSV 值
  const [savedHue, setSavedHue] = useState(0);
  const [savedSaturation, setSavedSaturation] = useState(0);
  const [savedBrightness, setSavedBrightness] = useState(100);
  const [dragging, setDragging] = useState<DragEdge>(null);
  const [isDraggingColor, setIsDraggingColor] = useState(false);
  const [isDraggingHue, setIsDraggingHue] = useState(false);
  const [showAspectRatioDropdown, setShowAspectRatioDropdown] = useState(false);
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const imgElementRef = useRef<HTMLImageElement>(null);
  const colorPanelRef = useRef<HTMLDivElement>(null);
  const huePanelRef = useRef<HTMLDivElement>(null);
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const aspectRatioRef = useRef<HTMLDivElement>(null);

  const ASPECT_RATIOS = ['Auto', '1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'];

  const handleMouseDown = (edge: DragEdge) => (e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(edge);
  };

  // 解析宽高比字符串
  const parseAspectRatio = useCallback((ratio: string): { width: number; height: number } | null => {
    if (ratio === 'Auto' || !ratio) return null;
    const parts = ratio.split(':');
    if (parts.length !== 2) return null;
    return { width: parseInt(parts[0]), height: parseInt(parts[1]) };
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging || !containerRef.current || !imageRef.current) return;

    const imageRect = imageRef.current.getBoundingClientRect();
    const maxExpand = 300; // 最大扩展像素

    // 如果选中了宽高比，锁定比例扩展
    if (selectedAspectRatio) {
      const aspectRatio = parseAspectRatio(selectedAspectRatio);
      if (aspectRatio) {
        const targetRatio = aspectRatio.width / aspectRatio.height;
        
        // 计算拖拽量
        let dragDiff = 0;
        const isVerticalDrag = dragging === 'top' || dragging === 'bottom';
        
        if (dragging === 'top') {
          dragDiff = imageRect.top - e.clientY;
        } else if (dragging === 'bottom') {
          dragDiff = e.clientY - imageRect.bottom;
        } else if (dragging === 'left') {
          dragDiff = imageRect.left - e.clientX;
        } else if (dragging === 'right') {
          dragDiff = e.clientX - imageRect.right;
        }
        
        dragDiff = Math.max(0, Math.min(maxExpand, dragDiff));
        
        // 当前画布尺寸（原图 + 已扩展）
        // const currentWidth = imageRect.width + expandLeft + expandRight;
        // const currentHeight = imageRect.height + expandTop + expandBottom;
        
        let newExpandH: number, newExpandV: number;
        
        if (isVerticalDrag) {
          // 垂直拖拽：增加高度，根据比例计算宽度
          // const newTotalHeight = currentHeight + dragDiff * 2 - (expandTop + expandBottom) + dragDiff * 2;
          const totalHeight = imageRect.height + dragDiff * 2;
          const totalWidth = totalHeight * targetRatio;
          newExpandV = dragDiff;
          newExpandH = Math.max(0, (totalWidth - imageRect.width) / 2);
        } else {
          // 水平拖拽：增加宽度，根据比例计算高度
          const totalWidth = imageRect.width + dragDiff * 2;
          const totalHeight = totalWidth / targetRatio;
          newExpandH = dragDiff;
          newExpandV = Math.max(0, (totalHeight - imageRect.height) / 2);
        }
        
        // 限制最大扩展
        if (newExpandH > maxExpand || newExpandV > maxExpand) {
          const scale = maxExpand / Math.max(newExpandH, newExpandV);
          newExpandH = Math.round(newExpandH * scale);
          newExpandV = Math.round(newExpandV * scale);
        }
        
        setExpandTop(Math.round(newExpandV));
        setExpandBottom(Math.round(newExpandV));
        setExpandLeft(Math.round(newExpandH));
        setExpandRight(Math.round(newExpandH));
        return;
      }
    }

    // Auto 模式：自由拖动
    switch (dragging) {
      case 'top': {
        const diff = imageRect.top - e.clientY;
        setExpandTop(Math.max(0, Math.min(maxExpand, diff)));
        break;
      }
      case 'right': {
        const diff = e.clientX - imageRect.right;
        setExpandRight(Math.max(0, Math.min(maxExpand, diff)));
        break;
      }
      case 'bottom': {
        const diff = e.clientY - imageRect.bottom;
        setExpandBottom(Math.max(0, Math.min(maxExpand, diff)));
        break;
      }
      case 'left': {
        const diff = imageRect.left - e.clientX;
        setExpandLeft(Math.max(0, Math.min(maxExpand, diff)));
        break;
      }
    }
  }, [dragging, selectedAspectRatio, parseAspectRatio]);

  const handleMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  useEffect(() => {
    if (dragging) {
      const handleMove = (e: MouseEvent | TouchEvent) => {
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        
        if (!containerRef.current || !imageRef.current) return;

        const imageRect = imageRef.current.getBoundingClientRect();
        const maxExpand = 300;

        if (selectedAspectRatio) {
          const aspectRatio = parseAspectRatio(selectedAspectRatio);
          if (aspectRatio) {
            const targetRatio = aspectRatio.width / aspectRatio.height;
            
            let dragDiff = 0;
            const isVerticalDrag = dragging === 'top' || dragging === 'bottom';
            
            if (dragging === 'top') {
              dragDiff = imageRect.top - clientY;
            } else if (dragging === 'bottom') {
              dragDiff = clientY - imageRect.bottom;
            } else if (dragging === 'left') {
              dragDiff = imageRect.left - clientX;
            } else if (dragging === 'right') {
              dragDiff = clientX - imageRect.right;
            }
            
            dragDiff = Math.max(0, Math.min(maxExpand, dragDiff));
            
            let newExpandH: number, newExpandV: number;
            
            if (isVerticalDrag) {
              const totalHeight = imageRect.height + dragDiff * 2;
              const totalWidth = totalHeight * targetRatio;
              newExpandV = dragDiff;
              newExpandH = Math.max(0, (totalWidth - imageRect.width) / 2);
            } else {
              const totalWidth = imageRect.width + dragDiff * 2;
              const totalHeight = totalWidth / targetRatio;
              newExpandH = dragDiff;
              newExpandV = Math.max(0, (totalHeight - imageRect.height) / 2);
            }
            
            if (newExpandH > maxExpand || newExpandV > maxExpand) {
              const scale = maxExpand / Math.max(newExpandH, newExpandV);
              newExpandH = Math.round(newExpandH * scale);
              newExpandV = Math.round(newExpandV * scale);
            }
            
            setExpandTop(Math.round(newExpandV));
            setExpandBottom(Math.round(newExpandV));
            setExpandLeft(Math.round(newExpandH));
            setExpandRight(Math.round(newExpandH));
            return;
          }
        }

        switch (dragging) {
          case 'top': {
            const diff = imageRect.top - clientY;
            setExpandTop(Math.max(0, Math.min(maxExpand, diff)));
            break;
          }
          case 'right': {
            const diff = clientX - imageRect.right;
            setExpandRight(Math.max(0, Math.min(maxExpand, diff)));
            break;
          }
          case 'bottom': {
            const diff = clientY - imageRect.bottom;
            setExpandBottom(Math.max(0, Math.min(maxExpand, diff)));
            break;
          }
          case 'left': {
            const diff = imageRect.left - clientX;
            setExpandLeft(Math.max(0, Math.min(maxExpand, diff)));
            break;
          }
        }
      };

      const handleEnd = () => {
        setDragging(null);
      };

      document.addEventListener('mousemove', handleMove);
      document.addEventListener('mouseup', handleEnd);
      document.addEventListener('touchmove', handleMove, { passive: false });
      document.addEventListener('touchend', handleEnd);
      
      return () => {
        document.removeEventListener('mousemove', handleMove);
        document.removeEventListener('mouseup', handleEnd);
        document.removeEventListener('touchmove', handleMove);
        document.removeEventListener('touchend', handleEnd);
      };
    }
  }, [dragging, selectedAspectRatio, parseAspectRatio]);

  // 吸管工具 - 全屏吸取颜色
  useEffect(() => {
    if (!isPickingColor) return;

    const handleGlobalClick = async () => {
      // 使用 EyeDropper API（现代浏览器支持）
      if ('EyeDropper' in window) {
        try {
          // @ts-expect-error EyeDropper is not in TypeScript types yet
          const eyeDropper = new window.EyeDropper();
          const result = await eyeDropper.open();
          const color = result.sRGBHex;
          
          // 解析颜色并同步到 HSV
          const r = parseInt(color.slice(1, 3), 16);
          const g = parseInt(color.slice(3, 5), 16);
          const b = parseInt(color.slice(5, 7), 16);
          
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const d = max - min;
          let h = 0;
          const s = max === 0 ? 0 : (d / max) * 100;
          const v = (max / 255) * 100;
          
          if (d !== 0) {
            switch (max) {
              case r: h = ((g - b) / d + (g < b ? 6 : 0)) * 60; break;
              case g: h = ((b - r) / d + 2) * 60; break;
              case b: h = ((r - g) / d + 4) * 60; break;
            }
          }
          
          setHue(Math.round(h));
          setSaturation(Math.round(s));
          setBrightness(Math.round(v));
          setTempColor(color);
          setBgColor(color);
        } catch {
          // 用户取消或不支持
        }
      }
      setIsPickingColor(false);
    };

    // 启动吸管
    handleGlobalClick();
    
  }, [isPickingColor]);

  // 更新颜色 (HSV 模式)
  const updateColor = useCallback((s: number, v: number, h: number) => {
    setSaturation(s);
    setBrightness(v);
    setHue(h);
    const color = hsvToRgb(h, s, v);
    setTempColor(color);
    setBgColor(color);
  }, []);

  // 色板拖拽 - PS风格: 左上白，左下黑，右上纯色
  const handleColorPanelMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    setIsDraggingColor(true);
    updateColorFromPanel(e);
  };

  const updateColorFromPanel = (e: React.MouseEvent<HTMLDivElement> | MouseEvent) => {
    if (!colorPanelRef.current) return;
    const rect = colorPanelRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    // x = 饱和度 (0-100), y = 亮度反向 (100-0)
    const s = x * 100;
    const v = (1 - y) * 100;
    updateColor(s, v, hue);
  };

  // 色相条拖拽
  const handleHuePanelMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    setIsDraggingHue(true);
    updateHueFromPanel(e);
  };

  const updateHueFromPanel = (e: React.MouseEvent<HTMLDivElement> | MouseEvent) => {
    if (!huePanelRef.current) return;
    const rect = huePanelRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const h = Math.floor(x * 360);
    updateColor(saturation, brightness, h);
  };

  // 颜色选择器拖拽事件 - 限制在面板内
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingColor && colorPanelRef.current) {
        e.preventDefault();
        e.stopPropagation();
        const rect = colorPanelRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
        const s = x * 100;
        const v = (1 - y) * 100;
        setSaturation(s);
        setBrightness(v);
        const color = hsvToRgb(hue, s, v);
        setTempColor(color);
        setBgColor(color);
      }
      if (isDraggingHue && huePanelRef.current) {
        e.preventDefault();
        e.stopPropagation();
        const rect = huePanelRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const h = Math.floor(x * 360);
        setHue(h);
        const color = hsvToRgb(h, saturation, brightness);
        setTempColor(color);
        setBgColor(color);
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingColor(false);
      setIsDraggingHue(false);
    };

    if (isDraggingColor || isDraggingHue) {
      document.addEventListener('mousemove', handleMouseMove, { capture: true });
      document.addEventListener('mouseup', handleMouseUp, { capture: true });
      return () => {
        document.removeEventListener('mousemove', handleMouseMove, { capture: true });
        document.removeEventListener('mouseup', handleMouseUp, { capture: true });
      };
    }
  }, [isDraggingColor, isDraggingHue, hue, saturation, brightness]);

  // 打开颜色选择器时保存当前颜色和 HSV
  const openColorPicker = () => {
    setConfirmedColor(bgColor);
    setTempColor(bgColor);
    setSavedHue(hue);
    setSavedSaturation(saturation);
    setSavedBrightness(brightness);
    setShowColorPicker(true);
  };

  // 确认颜色
  const confirmColor = () => {
    setConfirmedColor(tempColor);
    setBgColor(tempColor);
    setSavedHue(hue);
    setSavedSaturation(saturation);
    setSavedBrightness(brightness);
    setShowColorPicker(false);
  };

  // 取消颜色选择（恢复之前的颜色和 HSV）
  const cancelColorPicker = useCallback(() => {
    setBgColor(confirmedColor);
    setTempColor(confirmedColor);
    setHue(savedHue);
    setSaturation(savedSaturation);
    setBrightness(savedBrightness);
    setShowColorPicker(false);
  }, [confirmedColor, savedHue, savedSaturation, savedBrightness]);

  // 点击外部关闭颜色选择器
  useEffect(() => {
    if (!showColorPicker) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
        cancelColorPicker();
      }
    };

    // 延迟添加事件，避免立即触发
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showColorPicker, cancelColorPicker]);

  // 点击外部关闭宽高比下拉框
  useEffect(() => {
    if (!showAspectRatioDropdown) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      if (aspectRatioRef.current && !aspectRatioRef.current.contains(e.target as Node)) {
        setShowAspectRatioDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAspectRatioDropdown]);

  // 根据宽高比计算扩展区域
  const calculateExpansion = useCallback((ratio: string | null) => {
    if (!ratio || !imgElementRef.current) return;
    
    const img = imgElementRef.current;
    const imgWidth = img.naturalWidth || img.clientWidth;
    const imgHeight = img.naturalHeight || img.clientHeight;
    
    const aspectRatio = parseAspectRatio(ratio);
    if (!aspectRatio) {
      // Auto: 清除扩展
      setExpandTop(0);
      setExpandRight(0);
      setExpandBottom(0);
      setExpandLeft(0);
      return;
    }
    
    const targetRatio = aspectRatio.width / aspectRatio.height;
    const currentRatio = imgWidth / imgHeight;
    
    let newWidth = imgWidth;
    let newHeight = imgHeight;
    
    if (currentRatio > targetRatio) {
      // 图片太宽，需要增加高度
      newHeight = imgWidth / targetRatio;
    } else {
      // 图片太高，需要增加宽度
      newWidth = imgHeight * targetRatio;
    }
    
    // 计算各方向的扩展量（居中扩展）
    const expandH = Math.max(0, (newWidth - imgWidth) / 2);
    const expandV = Math.max(0, (newHeight - imgHeight) / 2);
    
    // 限制最大扩展像素（用于显示，实际可以更大）
    const maxExpand = 200;
    const scale = Math.min(1, maxExpand / Math.max(expandH, expandV, 1));
    
    setExpandTop(Math.round(expandV * scale));
    setExpandBottom(Math.round(expandV * scale));
    setExpandLeft(Math.round(expandH * scale));
    setExpandRight(Math.round(expandH * scale));
  }, [parseAspectRatio]);

  // 选择宽高比
  const handleSelectAspectRatio = (ratio: string) => {
    const newRatio = ratio === 'Auto' ? null : ratio;
    setSelectedAspectRatio(newRatio);
    setShowAspectRatioDropdown(false);
    calculateExpansion(newRatio);
  };

  // 图片加载后计算扩展
  useEffect(() => {
    if (!selectedAspectRatio || !imgElementRef.current) return;

    const img = imgElementRef.current;
    
    const handleImageLoad = () => {
      calculateExpansion(selectedAspectRatio);
    };

    if (img.complete) {
      // 图片已经加载
      handleImageLoad();
    } else {
      // 等待图片加载
      img.addEventListener('load', handleImageLoad);
      return () => img.removeEventListener('load', handleImageLoad);
    }
  }, [selectedAspectRatio, calculateExpansion]);

  const handleExpand = async () => {
    if (!imgElementRef.current) return;
    
    const img = imgElementRef.current;
    const imgWidth = img.naturalWidth;
    const imgHeight = img.naturalHeight;
    
    // 计算扩展比例（显示尺寸与实际尺寸的比例）
    const displayWidth = img.clientWidth;
    const displayHeight = img.clientHeight;
    const scaleX = imgWidth / displayWidth;
    const scaleY = imgHeight / displayHeight;
    
    // 计算实际扩展像素
    const actualExpandTop = Math.round(expandTop * scaleY);
    const actualExpandRight = Math.round(expandRight * scaleX);
    const actualExpandBottom = Math.round(expandBottom * scaleY);
    const actualExpandLeft = Math.round(expandLeft * scaleX);
    
    // 新画布尺寸
    const newWidth = imgWidth + actualExpandLeft + actualExpandRight;
    const newHeight = imgHeight + actualExpandTop + actualExpandBottom;
    
    // 创建 Canvas 并绘制
    const canvas = document.createElement('canvas');
    canvas.width = newWidth;
    canvas.height = newHeight;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      alert('无法创建画布');
      return;
    }
    
    // 填充背景色
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, newWidth, newHeight);
    
    // 绘制原图（居中位置）
    ctx.drawImage(img, actualExpandLeft, actualExpandTop, imgWidth, imgHeight);
    
    // 转换为 base64 URL
    const expandedImageUrl = canvas.toDataURL('image/png');
    
    // 调用回调，传递扩展后的图片
    onExpand({
      top: actualExpandTop,
      right: actualExpandRight,
      bottom: actualExpandBottom,
      left: actualExpandLeft,
      keepAspectRatio: !!selectedAspectRatio,
      bgColor,
      expandedImageUrl,
    });
  };

  return (
    <div 
      className="fixed inset-0 bg-black/90 z-[70] flex flex-col select-none"
      style={{ userSelect: 'none' }}
    >
      {/* 主要区域 */}
      <div 
        ref={containerRef}
        className={`flex-1 flex items-center justify-center overflow-hidden ${
          isMobile ? 'p-4' : 'p-8'
        }`}
      >
        <div className="relative">
          {/* 扩展背景层 - 包围整个图片 */}
          {(expandTop > 0 || expandRight > 0 || expandBottom > 0 || expandLeft > 0) && (
            <div 
              className="absolute"
              style={{ 
                top: -expandTop,
                right: -expandRight,
                bottom: -expandBottom,
                left: -expandLeft,
                backgroundColor: bgColor
              }}
            />
          )}

          {/* 拖拽手柄 - 上 */}
          <div
            className={`absolute left-1/2 -translate-x-1/2 cursor-n-resize flex items-center justify-center hover:bg-yellow-500/30 rounded transition-colors ${
              isMobile ? 'w-12 h-6' : 'w-16 h-4'
            }`}
            style={{ top: -expandTop - (isMobile ? 28 : 20) }}
            onMouseDown={handleMouseDown('top')}
            onTouchStart={(e) => {
              e.preventDefault();
              setDragging('top');
            }}
          >
            <div className={`bg-yellow-500 rounded-full ${isMobile ? 'w-10 h-1.5' : 'w-8 h-1'}`} />
          </div>
          
          {/* 拖拽手柄 - 右 */}
          <div
            className={`absolute top-1/2 -translate-y-1/2 cursor-e-resize flex items-center justify-center hover:bg-yellow-500/30 rounded transition-colors ${
              isMobile ? 'w-6 h-12' : 'w-4 h-16'
            }`}
            style={{ right: -expandRight - (isMobile ? 28 : 20) }}
            onMouseDown={handleMouseDown('right')}
            onTouchStart={(e) => {
              e.preventDefault();
              setDragging('right');
            }}
          >
            <div className={`bg-yellow-500 rounded-full ${isMobile ? 'w-1.5 h-10' : 'w-1 h-8'}`} />
          </div>
          
          {/* 拖拽手柄 - 下 */}
          <div
            className={`absolute left-1/2 -translate-x-1/2 cursor-s-resize flex items-center justify-center hover:bg-yellow-500/30 rounded transition-colors ${
              isMobile ? 'w-12 h-6' : 'w-16 h-4'
            }`}
            style={{ bottom: -expandBottom - (isMobile ? 28 : 20) }}
            onMouseDown={handleMouseDown('bottom')}
            onTouchStart={(e) => {
              e.preventDefault();
              setDragging('bottom');
            }}
          >
            <div className={`bg-yellow-500 rounded-full ${isMobile ? 'w-10 h-1.5' : 'w-8 h-1'}`} />
          </div>
          
          {/* 拖拽手柄 - 左 */}
          <div
            className={`absolute top-1/2 -translate-y-1/2 cursor-w-resize flex items-center justify-center hover:bg-yellow-500/30 rounded transition-colors ${
              isMobile ? 'w-6 h-12' : 'w-4 h-16'
            }`}
            style={{ left: -expandLeft - (isMobile ? 28 : 20) }}
            onMouseDown={handleMouseDown('left')}
            onTouchStart={(e) => {
              e.preventDefault();
              setDragging('left');
            }}
          >
            <div className={`bg-yellow-500 rounded-full ${isMobile ? 'w-1.5 h-10' : 'w-1 h-8'}`} />
          </div>

          {/* 原始图片 */}
          <div 
            ref={imageRef} 
            className="relative"
            style={{ userSelect: 'none' }}
          >
            <img
              ref={imgElementRef}
              src={imageUrl}
              alt="Expand"
              className={`object-contain rounded-lg ${
                isMobile ? 'max-w-[70vw] max-h-[40vh]' : 'max-w-[50vw] max-h-[60vh]'
              }`}
              crossOrigin="anonymous"
              draggable={false}
              style={{ userSelect: 'none' }}
            />
          </div>
        </div>
      </div>

      {/* 底部工具栏 - 移动端使用纯竖排布局 */}
      {isMobile ? (
        <div className="bg-zinc-800 border-t border-zinc-700 p-3 space-y-2">
          {/* 第一行：宽高比 + 颜色 */}
          <div className="flex items-center justify-between gap-2">
            {/* 宽高比 */}
            <div className="relative flex-1" ref={aspectRatioRef}>
              <button
                onClick={() => setShowAspectRatioDropdown(!showAspectRatioDropdown)}
                className={`w-full h-9 px-3 rounded-lg flex items-center justify-between transition-colors ${
                  selectedAspectRatio ? 'bg-yellow-500 text-black' : 'bg-zinc-700 text-zinc-300'
                }`}
              >
                <div className="flex items-center gap-1">
                  <Square size={14} />
                  <span className="text-xs">{selectedAspectRatio || '比例'}</span>
                </div>
                {showAspectRatioDropdown ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              
              {showAspectRatioDropdown && (
                <div className="absolute bottom-10 left-0 right-0 bg-zinc-800 rounded-lg shadow-xl border border-zinc-600 py-1 z-50 max-h-48 overflow-y-auto">
                  {ASPECT_RATIOS.map((ratio) => (
                    <button
                      key={ratio}
                      onClick={() => handleSelectAspectRatio(ratio)}
                      className={`w-full px-3 py-2 text-left text-xs ${
                        (ratio === 'Auto' && !selectedAspectRatio) || ratio === selectedAspectRatio
                          ? 'text-yellow-500 bg-zinc-700/50'
                          : 'text-zinc-300'
                      }`}
                    >
                      {ratio}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 颜色选择 */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsPickingColor(true)}
                className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                  isPickingColor ? 'bg-yellow-500 text-black' : 'bg-zinc-700 text-zinc-300'
                }`}
              >
                <Pipette size={16} />
              </button>
              <button
                onClick={openColorPicker}
                className="w-16 h-9 rounded-lg border-2 border-zinc-600 overflow-hidden"
              >
                <div className="w-full h-full" style={{ backgroundColor: bgColor }} />
              </button>
            </div>
          </div>

          {/* 第二行：操作按钮 */}
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="flex-1 h-10 bg-zinc-700 hover:bg-zinc-600 rounded-lg flex items-center justify-center gap-1 text-zinc-300"
            >
              <X size={16} />
              <span className="text-sm">取消</span>
            </button>
            <button
              onClick={handleExpand}
              className="flex-1 h-10 bg-yellow-500 hover:bg-yellow-400 text-black font-semibold rounded-lg flex items-center justify-center gap-1"
            >
              <Plus size={16} />
              <span className="text-sm">扩图</span>
            </button>
          </div>
        </div>
      ) : (
        /* 桌面端底部工具栏 */
        <div className="h-16 bg-zinc-800 border-t border-zinc-700 flex items-center justify-center gap-4 px-6">
        {/* 取消按钮 */}
        <button
          onClick={onClose}
          className="w-10 h-10 bg-red-600 hover:bg-red-500 rounded-lg flex items-center justify-center transition-colors"
          title="取消"
        >
          <X size={20} className="text-white" />
        </button>

        {/* 宽高比 */}
        <div className="relative" ref={aspectRatioRef}>
          <button
            onClick={() => setShowAspectRatioDropdown(!showAspectRatioDropdown)}
            className={`h-10 px-4 rounded-lg flex items-center gap-2 transition-colors ${
              selectedAspectRatio ? 'bg-yellow-500 text-black' : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
            }`}
          >
            <Square size={16} />
            <span className="text-sm">{selectedAspectRatio || '宽高比'}</span>
            <ChevronDown size={14} className={`transition-transform ${showAspectRatioDropdown ? 'rotate-180' : ''}`} />
          </button>
          
          {/* 宽高比下拉框 */}
          {showAspectRatioDropdown && (
            <div className="absolute bottom-12 left-0 bg-zinc-800 rounded-lg shadow-xl border border-zinc-600 py-2 min-w-[120px] z-50">
              {ASPECT_RATIOS.map((ratio) => (
                <button
                  key={ratio}
                  onClick={() => handleSelectAspectRatio(ratio)}
                  className={`w-full px-4 py-2 text-left text-sm hover:bg-zinc-700 transition-colors ${
                    (ratio === 'Auto' && !selectedAspectRatio) || ratio === selectedAspectRatio
                      ? 'text-yellow-500 bg-zinc-700/50'
                      : 'text-zinc-300'
                  }`}
                >
                  {ratio}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 提示文字 */}
        <span className="text-sm text-zinc-400">拖拽外框进行扩图</span>

        {/* 颜色选择器 */}
        <div className="relative flex items-center gap-2">
          {/* 吸管工具 */}
          <button
            onClick={() => setIsPickingColor(true)}
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
              isPickingColor 
                ? 'bg-yellow-500 text-black' 
                : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-300'
            }`}
            title="吸管工具 - 全屏吸取颜色"
          >
            <Pipette size={18} />
          </button>

          {/* 渐变颜色选择器 */}
          <div className="relative">
            <button
              onClick={openColorPicker}
              className="w-24 h-10 rounded-lg border-2 border-zinc-600 hover:border-zinc-400 transition-colors overflow-hidden"
              title="选择背景颜色"
            >
              <div 
                className="w-full h-full" 
                style={{ 
                  background: `linear-gradient(to right, #000000, ${bgColor}, #ffffff)` 
                }} 
              />
            </button>
            
            {/* 颜色选择器弹出层 */}
            {showColorPicker && (
              <div 
                ref={colorPickerRef}
                className="absolute bottom-12 left-1/2 -translate-x-1/2 bg-zinc-800 rounded-lg p-4 shadow-xl border border-zinc-600 w-64"
                onMouseDown={(e) => e.stopPropagation()}
              >
                {/* 渐变色板 - PS风格 */}
                <div className="mb-3">
                  <div 
                    ref={colorPanelRef}
                    className="w-full h-32 rounded-lg cursor-crosshair relative"
                    style={{
                      background: `
                        linear-gradient(to bottom, transparent, #000),
                        linear-gradient(to right, #fff, hsl(${hue}, 100%, 50%))
                      `
                    }}
                    onMouseDown={handleColorPanelMouseDown}
                  >
                    {/* 圆点指示器 */}
                    <div 
                      className="absolute w-4 h-4 rounded-full border-2 border-white shadow-lg pointer-events-none"
                      style={{
                        left: `${saturation}%`,
                        top: `${100 - brightness}%`,
                        transform: 'translate(-50%, -50%)',
                        backgroundColor: bgColor,
                        boxShadow: '0 0 0 1px rgba(0,0,0,0.3), 0 2px 4px rgba(0,0,0,0.3)'
                      }}
                    />
                  </div>
                </div>
                
                {/* 色相条 */}
                <div className="relative mb-3">
                  <div 
                    ref={huePanelRef}
                    className="w-full h-4 rounded cursor-pointer"
                    style={{
                      background: 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)'
                    }}
                    onMouseDown={handleHuePanelMouseDown}
                  />
                  {/* 滑块指示器 */}
                  <div 
                    className="absolute top-1/2 w-2 h-6 bg-white rounded border border-zinc-400 shadow pointer-events-none"
                    style={{
                      left: `${(hue / 360) * 100}%`,
                      transform: 'translate(-50%, -50%)'
                    }}
                  />
                </div>
                
                {/* 当前颜色显示和输入 */}
                <div className="flex items-center gap-2">
                  <div 
                    className="w-10 h-10 rounded border-2 border-zinc-600"
                    style={{ backgroundColor: tempColor }}
                  />
                  <input
                    type="text"
                    value={tempColor}
                    onChange={(e) => {
                      setTempColor(e.target.value);
                      setBgColor(e.target.value);
                    }}
                    className="flex-1 h-10 bg-zinc-700 border border-zinc-600 rounded px-2 text-sm text-white"
                    placeholder="#000000"
                  />
                </div>
                
                {/* 确定按钮 */}
                <button
                  onClick={confirmColor}
                  className="w-full mt-3 h-8 bg-yellow-500 hover:bg-yellow-400 text-black text-sm font-medium rounded"
                >
                  确定
                </button>
              </div>
            )}
          </div>
          
          {/* 当前颜色标识 */}
          <div 
            className="w-10 h-10 rounded-lg border-2 border-zinc-600"
            style={{ backgroundColor: bgColor }}
            title={bgColor}
          />
        </div>

        {/* 扩图按钮 */}
        <button
          onClick={handleExpand}
          className="h-10 px-6 bg-yellow-500 hover:bg-yellow-400 text-black font-semibold rounded-lg flex items-center gap-2 transition-colors"
        >
          <Plus size={18} />
          扩图
        </button>
      </div>
      )}

      {/* 移动端颜色选择器弹窗 */}
      {isMobile && showColorPicker && (
        <div className="fixed inset-0 bg-black/80 z-[80] flex items-center justify-center p-4">
          <div 
            className="bg-zinc-800 rounded-lg p-4 w-full max-w-xs"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="mb-3">
              <div 
                ref={colorPanelRef}
                className="w-full h-40 rounded-lg cursor-crosshair relative"
                style={{
                  background: `
                    linear-gradient(to bottom, transparent, #000),
                    linear-gradient(to right, #fff, hsl(${hue}, 100%, 50%))
                  `
                }}
                onMouseDown={handleColorPanelMouseDown}
                onTouchStart={(e) => {
                  e.preventDefault();
                  const touch = e.touches[0];
                  const rect = colorPanelRef.current?.getBoundingClientRect();
                  if (rect) {
                    const x = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
                    const y = Math.max(0, Math.min(1, (touch.clientY - rect.top) / rect.height));
                    updateColor(x * 100, (1 - y) * 100, hue);
                  }
                  setIsDraggingColor(true);
                }}
              >
                <div 
                  className="absolute w-5 h-5 rounded-full border-2 border-white shadow-lg pointer-events-none"
                  style={{
                    left: `${saturation}%`,
                    top: `${100 - brightness}%`,
                    transform: 'translate(-50%, -50%)',
                    backgroundColor: bgColor
                  }}
                />
              </div>
            </div>
            
            <div className="relative mb-3">
              <div 
                ref={huePanelRef}
                className="w-full h-6 rounded cursor-pointer"
                style={{
                  background: 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)'
                }}
                onMouseDown={handleHuePanelMouseDown}
                onTouchStart={(e) => {
                  e.preventDefault();
                  const touch = e.touches[0];
                  const rect = huePanelRef.current?.getBoundingClientRect();
                  if (rect) {
                    const x = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
                    updateColor(saturation, brightness, Math.floor(x * 360));
                  }
                  setIsDraggingHue(true);
                }}
              />
              <div 
                className="absolute top-1/2 w-3 h-8 bg-white rounded border border-zinc-400 shadow pointer-events-none"
                style={{
                  left: `${(hue / 360) * 100}%`,
                  transform: 'translate(-50%, -50%)'
                }}
              />
            </div>
            
            <div className="flex items-center gap-2 mb-3">
              <div 
                className="w-12 h-12 rounded border-2 border-zinc-600 flex-shrink-0"
                style={{ backgroundColor: tempColor }}
              />
              <input
                type="text"
                value={tempColor}
                onChange={(e) => {
                  setTempColor(e.target.value);
                  setBgColor(e.target.value);
                }}
                className="flex-1 h-10 bg-zinc-700 border border-zinc-600 rounded px-2 text-sm text-white"
                placeholder="#000000"
              />
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={cancelColorPicker}
                className="flex-1 h-10 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded-lg"
              >
                取消
              </button>
              <button
                onClick={confirmColor}
                className="flex-1 h-10 bg-yellow-500 hover:bg-yellow-400 text-black font-medium rounded-lg"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
