'use client';

import { useAppStore } from '@/lib/store';
import { X, Star, Trash2, Copy, Wand2 } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import { removeFavorite } from '@/lib/api';
import type { Favorite } from '@/types';

export default function FavoritesModal() {
  const { showFavoritesModal, setShowFavoritesModal, favorites, setCurrentImage, removeFavoriteByUrl, setPrompt } =
    useAppStore();
  const [selectedFavorite, setSelectedFavorite] = useState<typeof favorites[0] | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  if (!showFavoritesModal) return null;

  const handleImageClick = (favorite: typeof favorites[0]) => {
    setSelectedFavorite(favorite);
  };

  const handleViewImage = () => {
    if (selectedFavorite) {
      setCurrentImage(selectedFavorite.url);
      setShowFavoritesModal(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, favorite: typeof favorites[0]) => {
    e.stopPropagation();
    if (deleting) return;
    
    setDeleting(favorite.id);
    try {
      await removeFavorite(favorite.url);
      removeFavoriteByUrl(favorite.url);
      if (selectedFavorite?.id === favorite.id) {
        setSelectedFavorite(null);
      }
    } catch (error) {
      console.error('Delete favorite failed:', error);
    } finally {
      setDeleting(null);
    }
  };

  const handleCopyPrompt = () => {
    if (selectedFavorite?.prompt) {
      navigator.clipboard.writeText(selectedFavorite.prompt);
    }
  };

  const handleApplyPrompt = () => {
    if (selectedFavorite?.prompt) {
      setPrompt(selectedFavorite.prompt);
      setShowFavoritesModal(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-zinc-900 rounded-lg p-6 w-full max-w-5xl h-[80vh] border border-zinc-800 flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Star size={24} className="text-yellow-400" />
            我的收藏
          </h2>
          <button
            onClick={() => setShowFavoritesModal(false)}
            className="text-zinc-500 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {favorites.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-500">
            <Star size={64} className="mb-4 opacity-30" />
            <div className="text-lg mb-2">还没有收藏的图片</div>
            <div className="text-sm">
              点击预览窗右上方⭐将喜欢的作品
            </div>
          </div>
        ) : (
          <div className="flex-1 flex gap-6 overflow-hidden">
            {/* 图片列表 - 每张图片下方显示提示词 */}
            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                {favorites.map((favorite: Favorite) => (
                  <div
                    key={favorite.id}
                    onClick={() => handleImageClick(favorite)}
                    className={`relative rounded-lg overflow-hidden cursor-pointer transition-all group bg-zinc-800 ${
                      selectedFavorite?.id === favorite.id
                        ? 'ring-2 ring-yellow-500'
                        : 'hover:ring-2 hover:ring-yellow-500/50'
                    }`}
                  >
                    {/* 图片 */}
                    <div className="aspect-square relative">
                      <Image
                        src={favorite.url}
                        alt={favorite.filename}
                        fill
                        className="object-cover"
                      />
                      {/* 删除按钮 */}
                      <button
                        onClick={(e) => handleDelete(e, favorite)}
                        disabled={deleting === favorite.id}
                        className="absolute top-2 right-2 w-8 h-8 bg-black/70 hover:bg-red-600 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    {/* 提示词预览 */}
                    <div className="p-3">
                      <p className="text-xs text-zinc-400 line-clamp-2">
                        {favorite.prompt || '无提示词'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* 右侧详情面板 */}
            {selectedFavorite && (
              <div className="w-80 bg-zinc-800 rounded-lg p-4 flex flex-col">
                <div className="aspect-square relative rounded-lg overflow-hidden mb-4">
                  <Image
                    src={selectedFavorite.url}
                    alt={selectedFavorite.filename}
                    fill
                    className="object-contain bg-zinc-900"
                  />
                </div>
                
                <div className="flex-1 overflow-y-auto">
                  <h3 className="text-sm font-semibold text-zinc-400 mb-2">提示词</h3>
                  <div className="bg-zinc-900 rounded-lg p-3 text-sm text-zinc-300 mb-4">
                    {selectedFavorite.prompt || '无提示词信息'}
                  </div>
                  
                  {selectedFavorite.prompt && (
                    <>
                      <button
                        onClick={handleApplyPrompt}
                        className="w-full py-2 px-4 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors mb-2"
                      >
                        <Wand2 size={16} />
                        应用提示词
                      </button>
                      <button
                        onClick={handleCopyPrompt}
                        className="w-full py-2 px-4 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors mb-2"
                      >
                        <Copy size={16} />
                        复制提示词
                      </button>
                    </>
                  )}
                  
                  <button
                    onClick={handleViewImage}
                    className="w-full py-2 px-4 bg-yellow-600 hover:bg-yellow-500 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors"
                  >
                    在画布中查看
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
