'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { ChevronDown, Zap, GripVertical, Plus } from 'lucide-react';
import { getInspirations, getSetting } from '@/lib/api';
import type { Inspiration } from '@/types';

// 接口2：Nano Banana 模型列表
const NANO_MODELS = [
  { id: 'nano-banana-2', name: 'Nano Banana 2', isNew: true },
  { id: 'nano-banana-hd', name: 'Nano Banana HD', isNew: false },
  { id: 'nano-banana-pro', name: 'Nano Banana Pro', isNew: false },
  { id: 'nano-banana', name: 'Nano Banana', isNew: false },
];

// 接口1：多米API 模型列表
const DUOMI_MODELS = [
  { id: 'gemini-3-pro-image-preview', name: 'Gemini 3 Pro', isNew: true },
];

// 不支持分辨率选择的模型（固定分辨率）
const FIXED_RESOLUTION_MODELS = ['nano-banana', 'nano-banana-hd'];

const MIN_WIDTH = 200;
const MAX_WIDTH = 400;
const DEFAULT_WIDTH = 260;

export default function LeftSidebar() {
  const { resolution, setResolution, batchCount, setBatchCount, aspectRatio, setAspectRatio, selectedModel, setSelectedModel, inspirations, setInspirations, setShowInspirationModal, setShowAddInspirationModal, activeApi, setActiveApi, setShowZImageModal } =
    useAppStore();
  
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // 根据接口选择不同的模型列表
  const MODELS = activeApi === 1 ? DUOMI_MODELS : NANO_MODELS;
  const currentModel = MODELS.find(m => m.name === selectedModel) || MODELS[0];
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // 固定分辨率的模型不显示 Resolution 选择器
  const isFixedResolutionModel = FIXED_RESOLUTION_MODELS.includes(currentModel.id);

  // 加载当前接口选择
  useEffect(() => {
    getSetting('active_api').then((res) => {
      if (res.value) {
        setActiveApi(parseInt(res.value) as 1 | 2 | 3);
      }
    });
  }, [setActiveApi]);

  // 当接口切换时，自动选择该接口的第一个模型
  useEffect(() => {
    const models = activeApi === 1 ? DUOMI_MODELS : NANO_MODELS;
    const isCurrentModelValid = models.some(m => m.name === selectedModel);
    if (!isCurrentModelValid) {
      setSelectedModel(models[0].name);
    }
  }, [activeApi, selectedModel, setSelectedModel]);

  // 打开 Z-Image Modal
  const openZImageModal = () => {
    setShowZImageModal(true);
  };

  // 页面加载时获取灵感列表
  useEffect(() => {
    const loadInspirations = async () => {
      try {
        const data = await getInspirations();
        if (data.inspirations && data.inspirations.length > 0) {
          setInspirations(data.inspirations);
        }
      } catch (error) {
        console.error('加载灵感失败:', error);
      }
    };
    loadInspirations();
  }, [setInspirations]);

  // 点击外部关闭下拉框
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsModelDropdownOpen(false);
      }
    };

    if (isModelDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isModelDropdownOpen]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;
    
    const newWidth = e.clientX;
    if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
      setSidebarWidth(newWidth);
    }
  }, [isResizing]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  return (
    <div 
      ref={sidebarRef}
      className="relative bg-zinc-950 border-r border-zinc-800 flex-shrink-0"
      style={{ width: sidebarWidth }}
    >
      <div className="p-4 h-full flex flex-col">
      {/* Model Selector */}
      <div className="mb-6 space-y-2">
        {/* Nano Banana 模型下拉选择 */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
            className="w-full flex items-center justify-between px-3 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
          >
            <div className="flex items-center gap-2">
              <Zap size={16} className="text-yellow-400" />
              <span className="text-sm font-medium">{currentModel.name}</span>
              {currentModel.isNew && (
                <span className="px-1.5 py-0.5 text-xs bg-purple-600 text-white rounded">NEW</span>
              )}
            </div>
            <ChevronDown size={16} className={`text-zinc-400 transition-transform ${isModelDropdownOpen ? 'rotate-180' : ''}`} />
          </button>
          
          {isModelDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-lg z-50 overflow-hidden">
              {MODELS.map((model) => (
                <button
                  key={model.id}
                  onClick={() => {
                    setSelectedModel(model.name);
                    setIsModelDropdownOpen(false);
                  }}
                  className={`w-full px-3 py-2.5 text-left text-sm hover:bg-zinc-700 transition-colors flex items-center gap-2 ${
                    selectedModel === model.name ? 'text-yellow-400' : 'text-zinc-300'
                  }`}
                >
                  {model.name}
                  {model.isNew && (
                    <span className="px-1.5 py-0.5 text-xs bg-purple-600 text-white rounded">NEW</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Z-Image 打开按钮 */}
        <button
          onClick={openZImageModal}
          className="w-full flex items-center justify-between px-3 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 rounded-lg transition-all"
        >
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-white" />
            <span className="text-sm font-medium text-white">Z-Image Turbo</span>
            <span className="px-1.5 py-0.5 text-xs bg-white/20 text-white rounded">NEW</span>
          </div>
          <ChevronDown size={14} className="text-white/70 -rotate-90" />
        </button>
      </div>

      {/* Aspect Ratio */}
      <div className="mb-4">
        <h3 className="text-sm font-semibold mb-2 text-zinc-400">Aspect Ratio</h3>
        <div className="grid grid-cols-3 gap-1.5">
          {(['Auto', '1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'] as const).map((ratio) => (
            <button
              key={ratio}
              onClick={() => setAspectRatio(ratio as any)}
              className={`py-2.5 px-2 rounded text-xs transition-colors ${
                aspectRatio === ratio
                  ? 'bg-yellow-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              {ratio}
            </button>
          ))}
        </div>
      </div>

      {/* Resolution - 固定分辨率模型时隐藏 */}
      {!isFixedResolutionModel && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold mb-2 text-zinc-400">Resolution</h3>
          <div className="flex gap-2">
            {(['1K', '2K', '4K'] as const).map((res) => (
              <button
                key={res}
                onClick={() => setResolution(res)}
                className={`flex-1 py-2 rounded text-sm transition-colors ${
                  resolution === res
                    ? 'bg-yellow-600 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                {res}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Batch Count */}
      <div className="mb-4">
        <h3 className="text-sm font-semibold mb-2 text-zinc-400">Batch Count</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setBatchCount(Math.max(1, batchCount - 1))}
            className="w-8 h-8 bg-zinc-800 hover:bg-zinc-700 rounded flex items-center justify-center"
          >
            -
          </button>
          <div className="flex-1 text-center text-lg font-semibold">{batchCount}</div>
          <button
            onClick={() => setBatchCount(Math.min(8, batchCount + 1))}
            className="w-8 h-8 bg-zinc-800 hover:bg-zinc-700 rounded flex items-center justify-center"
          >
            +
          </button>
        </div>
      </div>

      {/* Inspiration */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-zinc-400 flex items-center gap-1">
            🔥 INSPIRATION
          </h3>
          <button
            onClick={() => setShowAddInspirationModal(true)}
            className="w-6 h-6 bg-yellow-500 hover:bg-yellow-400 rounded-full flex items-center justify-center transition-colors"
            title="添加灵感"
          >
            <Plus size={14} className="text-black" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {inspirations.length > 0 ? (
            inspirations.slice(0, 6).map((insp: Inspiration, idx: number) => (
              <div
                key={insp.id}
                onClick={() => {
                  const { setPrompt } = useAppStore.getState();
                  setPrompt(insp.prompt);
                }}
                className="bg-zinc-800 rounded overflow-hidden cursor-pointer hover:ring-2 hover:ring-yellow-500 transition-all"
              >
                <div className="aspect-[3/2] relative">
                  {insp.image_url ? (
                    (() => {
                      // 提取真正的 data URL（如果URL中包含data:image）
                      const dataUrlMatch = insp.image_url.match(/data:image[^"]+/);
                      const actualUrl = dataUrlMatch ? dataUrlMatch[0] : insp.image_url;
                      return <img src={actualUrl} alt={insp.title} className="w-full h-full object-cover" />;
                    })()
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-zinc-700 text-zinc-500">
                      <Plus size={16} />
                    </div>
                  )}
                </div>
                <div className="px-1.5 py-1">
                  <p className="text-[9px] text-zinc-400 truncate">{insp.title}</p>
                </div>
              </div>
            ))
          ) : (
            ['在复仇者大厦跟死侍合影', '90年代风格居酒屋', '圣诞少女胶片风', '平面图3D渲染', '视角转换', '服装迁移'].map((title, i) => (
              <div
                key={i}
                onClick={() => setShowAddInspirationModal(true)}
                className="bg-zinc-800 rounded overflow-hidden cursor-pointer hover:bg-zinc-700 transition-colors"
              >
                <div className="aspect-[3/2] bg-zinc-700 flex items-center justify-center">
                  <div className="text-zinc-600 text-[10px]">示例</div>
                </div>
                <div className="px-1.5 py-1">
                  <p className="text-[9px] text-zinc-500 truncate">{title}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      
      {/* 查看全部灵感按钮 */}
      <button
        onClick={() => setShowInspirationModal(true)}
        className="w-full py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-xs text-white font-medium transition-colors flex items-center justify-center gap-1.5 mt-2"
      >
        📷 查看全部灵感
      </button>
      </div>

      {/* Resize Handle */}
      <div
        onMouseDown={handleMouseDown}
        className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-yellow-500 transition-colors group flex items-center justify-center ${
          isResizing ? 'bg-yellow-500' : 'bg-transparent hover:bg-yellow-500/50'
        }`}
      >
        <div className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
          <GripVertical size={12} className="text-yellow-400" />
        </div>
      </div>
    </div>
  );
}
