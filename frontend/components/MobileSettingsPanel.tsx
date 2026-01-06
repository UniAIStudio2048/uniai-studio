'use client';

import { useAppStore } from '@/lib/store';
import { ChevronDown, Zap, X, Plus } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import type { Inspiration } from '@/types';

// 接口3：Z-Image-Turbo 模型列表
const ZIMAGE_MODELS = [
  { id: 'z-image-turbo', name: 'Z-Image Turbo', isNew: true },
];

// 接口2：Nano Banana 模型列表
const NANO_MODELS = [
  { id: 'nano-banana-2', name: 'Nano Banana 2', isNew: true },
  { id: 'nano-banana-hd', name: 'Nano Banana HD', isNew: false },
  { id: 'nano-banana-pro', name: 'Nano Banana Pro', isNew: false },
  { id: 'nano-banana', name: 'Nano Banana', isNew: false },
];

// 接口1：多米API NANO-BANANA 模型列表
const DUOMI_MODELS = [
  { id: 'gemini-3-pro-image-preview', name: 'Gemini 3 Pro', isNew: true },
];

const FIXED_RESOLUTION_MODELS = ['nano-banana', 'nano-banana-hd'];

interface MobileSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MobileSettingsPanel({ isOpen, onClose }: MobileSettingsPanelProps) {
  const {
    resolution,
    setResolution,
    batchCount,
    setBatchCount,
    aspectRatio,
    setAspectRatio,
    selectedModel,
    setSelectedModel,
    inspirations,
    setShowInspirationModal,
    setShowAddInspirationModal,
    setPrompt,
    activeApi,
  } = useAppStore();

  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 根据接口选择不同的模型列表
  const MODELS = activeApi === 3 ? ZIMAGE_MODELS : activeApi === 1 ? DUOMI_MODELS : NANO_MODELS;
  const currentModel = MODELS.find(m => m.name === selectedModel) || MODELS[0];
  const isFixedResolutionModel = FIXED_RESOLUTION_MODELS.includes(currentModel.id);

  // 当接口切换时，自动选择该接口的第一个模型
  useEffect(() => {
    const models = activeApi === 3 ? ZIMAGE_MODELS : activeApi === 1 ? DUOMI_MODELS : NANO_MODELS;
    const isCurrentModelValid = models.some(m => m.name === selectedModel);
    if (!isCurrentModelValid) {
      setSelectedModel(models[0].name);
    }
  }, [activeApi, selectedModel, setSelectedModel]);

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* 背景遮罩 */}
      <div 
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />
      
      {/* 面板 - 从底部滑出 */}
      <div className="absolute bottom-0 left-0 right-0 bg-zinc-900 rounded-t-2xl max-h-[80vh] overflow-y-auto animate-in slide-in-from-bottom duration-300">
        {/* 顶部拖动条 */}
        <div className="sticky top-0 bg-zinc-900 pt-3 pb-2 px-4 border-b border-zinc-800">
          <div className="w-10 h-1 bg-zinc-600 rounded-full mx-auto mb-3" />
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">生成设置</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 bg-zinc-800 rounded-full flex items-center justify-center"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-5">
          {/* Model Selector */}
          <div className="relative" ref={dropdownRef}>
            <label className="text-sm font-semibold text-zinc-400 mb-2 block">模型</label>
            <button
              onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
              className="w-full flex items-center justify-between px-4 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
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
                    className={`w-full px-4 py-3 text-left text-sm hover:bg-zinc-700 transition-colors flex items-center gap-2 ${
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

          {/* Aspect Ratio */}
          <div>
            <label className="text-sm font-semibold text-zinc-400 mb-2 block">画面比例</label>
            <div className="grid grid-cols-4 gap-2">
              {(['Auto', '1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9'] as const).map((ratio) => (
                <button
                  key={ratio}
                  onClick={() => setAspectRatio(ratio as any)}
                  className={`py-2.5 px-2 rounded-lg text-xs font-medium transition-colors ${
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

          {/* Resolution */}
          {!isFixedResolutionModel && (
            <div>
              <label className="text-sm font-semibold text-zinc-400 mb-2 block">分辨率</label>
              <div className="flex gap-2">
                {(['1K', '2K', '4K'] as const).map((res) => (
                  <button
                    key={res}
                    onClick={() => setResolution(res)}
                    className={`flex-1 py-3 rounded-lg text-sm font-medium transition-colors ${
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
          <div>
            <label className="text-sm font-semibold text-zinc-400 mb-2 block">生成数量</label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setBatchCount(Math.max(1, batchCount - 1))}
                className="w-12 h-12 bg-zinc-800 hover:bg-zinc-700 rounded-lg flex items-center justify-center text-xl font-bold"
              >
                -
              </button>
              <div className="flex-1 text-center text-2xl font-bold">{batchCount}</div>
              <button
                onClick={() => setBatchCount(Math.min(8, batchCount + 1))}
                className="w-12 h-12 bg-zinc-800 hover:bg-zinc-700 rounded-lg flex items-center justify-center text-xl font-bold"
              >
                +
              </button>
            </div>
          </div>

          {/* Inspiration */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-zinc-400 flex items-center gap-1">
                🔥 灵感中心
              </label>
              <button
                onClick={() => {
                  setShowAddInspirationModal(true);
                  onClose();
                }}
                className="w-7 h-7 bg-yellow-500 hover:bg-yellow-400 rounded-full flex items-center justify-center transition-colors"
              >
                <Plus size={14} className="text-black" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {inspirations.slice(0, 6).map((insp: Inspiration) => (
                <div
                  key={insp.id}
                  onClick={() => {
                    setPrompt(insp.prompt);
                    onClose();
                  }}
                  className="bg-zinc-800 rounded-lg overflow-hidden cursor-pointer active:scale-95 transition-transform"
                >
                  <div className="aspect-[4/3] relative">
                    {insp.image_url ? (
                      (() => {
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
                  <div className="px-2 py-1.5">
                    <p className="text-[10px] text-zinc-400 truncate">{insp.title}</p>
                  </div>
                </div>
              ))}
            </div>
            
            {/* 查看全部按钮 */}
            <button
              onClick={() => {
                setShowInspirationModal(true);
                onClose();
              }}
              className="w-full py-3 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm text-white font-medium transition-colors flex items-center justify-center gap-2 mt-3"
            >
              📷 查看全部灵感
            </button>
          </div>
        </div>

        {/* 底部安全区域 */}
        <div className="h-8" />
      </div>
    </div>
  );
}
