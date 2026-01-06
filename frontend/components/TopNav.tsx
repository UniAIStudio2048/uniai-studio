'use client';

import { useAppStore } from '@/lib/store';
import { Star, Database, Settings, Menu, X } from 'lucide-react';
import { useIsMobile } from '@/lib/useIsMobile';
import { useState, useEffect } from 'react';

export default function TopNav() {
  const {
    setShowApiKeyModal,
    setShowStorageModal,
    setShowFavoritesModal,
  } = useAppStore();

  const isMobileHook = useIsMobile();
  const [mounted, setMounted] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  
  // 客户端挂载后才应用移动端样式，避免 hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);
  
  const isMobile = mounted ? isMobileHook : false;

  // 移动端导航
  if (isMobile) {
    return (
      <>
        <div className="h-14 bg-zinc-950 border-b border-zinc-800 flex items-center px-4 justify-between">
          <div className="text-lg font-bold text-yellow-400">⚡ UniAI</div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFavoritesModal(true)}
              className="w-10 h-10 bg-yellow-600 hover:bg-yellow-500 rounded-lg flex items-center justify-center transition-colors"
            >
              <Star size={18} />
            </button>
            
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="w-10 h-10 bg-zinc-800 hover:bg-zinc-700 rounded-lg flex items-center justify-center transition-colors"
            >
              {showMobileMenu ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {/* 移动端下拉菜单 */}
        {showMobileMenu && (
          <div className="absolute top-14 left-0 right-0 bg-zinc-900 border-b border-zinc-800 z-50 animate-in slide-in-from-top duration-200">
            <div className="p-3 space-y-2">
              <button
                onClick={() => {
                  setShowStorageModal(true);
                  setShowMobileMenu(false);
                }}
                className="w-full px-4 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm flex items-center gap-3 transition-colors"
              >
                <Database size={18} />
                对象存储
              </button>

              <button
                onClick={() => {
                  setShowApiKeyModal(true);
                  setShowMobileMenu(false);
                }}
                className="w-full px-4 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm flex items-center gap-3 transition-colors"
              >
                <Settings size={18} />
                设置
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // 桌面端导航
  return (
    <div className="h-16 bg-zinc-950 border-b border-zinc-800 flex items-center px-6 justify-between">
      <div className="flex items-center gap-4">
        <div className="text-xl font-bold text-yellow-400">⚡ UniAI Studio</div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => setShowStorageModal(true)}
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm flex items-center gap-2 transition-colors"
        >
          <Database size={16} />
          对象存储
        </button>

        <button
          onClick={() => setShowFavoritesModal(true)}
          className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 rounded-lg text-sm flex items-center gap-2 transition-colors"
        >
          <Star size={16} />
          收藏
        </button>

        <button
          onClick={() => setShowApiKeyModal(true)}
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm flex items-center gap-2 transition-colors"
        >
          <Settings size={16} />
          设置
        </button>
      </div>
    </div>
  );
}
