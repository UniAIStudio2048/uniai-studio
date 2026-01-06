'use client';

import { useAppStore } from '@/lib/store';
import { X, Trash2 } from 'lucide-react';
import Image from 'next/image';
import { useMemo } from 'react';
import type { Task } from '@/types';

interface GroupedTask {
  id: string;
  batch_id?: string;
  status: string;
  prompt: string;
  images: string[];
  created_at: string;
  count: number;
}

interface MobileTaskQueuePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MobileTaskQueuePanel({ isOpen, onClose }: MobileTaskQueuePanelProps) {
  const { tasks, setTasks, setCurrentImages } = useAppStore();

  // 按 batch_id 分组任务
  const groupedTasks = useMemo(() => {
    const groups: GroupedTask[] = [];
    const batchMap = new Map<string, Task[]>();

    tasks.forEach((task: Task) => {
      if (task.batch_id) {
        const existing = batchMap.get(task.batch_id) || [];
        existing.push(task);
        batchMap.set(task.batch_id, existing);
      } else {
        const images: string[] = task.result_images || [];
        if (images.length === 0 && task.result_image_url) {
          images.push(task.result_image_url);
        }
        
        groups.push({
          id: task.id,
          batch_id: undefined,
          status: task.status,
          prompt: task.prompt,
          images,
          created_at: task.created_at,
          count: images.length || 1,
        });
      }
    });
    
    batchMap.forEach((batchTasks, batchId) => {
      const images: string[] = [];
      let allSuccess = true;
      let anyProcessing = false;
      
      batchTasks.forEach((t) => {
        if (t.result_images?.[0]) images.push(t.result_images[0]);
        else if (t.result_image_url) images.push(t.result_image_url);
        
        if (t.status !== 'success') allSuccess = false;
        if (t.status === 'processing' || t.status === 'pending') anyProcessing = true;
      });
      
      groups.push({
        id: batchId,
        batch_id: batchId,
        status: anyProcessing ? 'processing' : (allSuccess ? 'success' : 'failed'),
        prompt: batchTasks[0].prompt,
        images,
        created_at: batchTasks[0].created_at,
        count: batchTasks.length,
      });
    });
    
    return groups.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [tasks]);

  const handleClearAll = () => {
    if (confirm('确定要清空任务列表吗？')) {
      setTasks([]);
    }
  };

  const handleTaskClick = (group: GroupedTask) => {
    if (group.images.length > 0) {
      setCurrentImages(group.images);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* 背景遮罩 */}
      <div 
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />
      
      {/* 面板 - 从右侧滑出 */}
      <div className="absolute top-0 right-0 bottom-0 w-[85%] max-w-sm bg-zinc-900 animate-in slide-in-from-right duration-300">
        {/* 顶部 */}
        <div className="sticky top-0 bg-zinc-900 p-4 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            ⚡ 任务队列
          </h2>
          <div className="flex items-center gap-2">
            {tasks.length > 0 && (
              <button
                onClick={handleClearAll}
                className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 px-2 py-1"
              >
                <Trash2 size={14} />
                清空
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 bg-zinc-800 rounded-full flex items-center justify-center"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* 任务列表 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ maxHeight: 'calc(100vh - 70px)' }}>
          {groupedTasks.length === 0 ? (
            <div className="text-center text-zinc-600 mt-20">
              暂无任务
            </div>
          ) : (
            groupedTasks.map((group) => (
              <div
                key={group.id}
                onClick={() => handleTaskClick(group)}
                className="bg-zinc-800 rounded-lg p-3 cursor-pointer active:scale-98 transition-transform"
              >
                <div className="flex items-start gap-3">
                  {group.images.length > 0 ? (
                    <div className="relative w-16 h-16 flex-shrink-0">
                      {group.images.filter(img => img && typeof img === 'string' && img.trim() !== '').slice(0, 3).map((img, idx, arr) => {
                        const total = Math.min(arr.length, 3);
                        const reverseIdx = total - 1 - idx;
                        const offset = reverseIdx * 5;
                        const rotation = (reverseIdx - 1) * 6;
                        return (
                          <div
                            key={idx}
                            className="absolute w-12 h-12 rounded overflow-hidden border-2 border-zinc-700 shadow-lg"
                            style={{
                              top: 2 + reverseIdx * 2,
                              left: offset,
                              transform: `rotate(${rotation}deg)`,
                              zIndex: idx,
                            }}
                          >
                            <Image
                              src={img}
                              alt="Result"
                              fill
                              className="object-cover"
                            />
                          </div>
                        );
                      })}
                      {group.images.filter(img => img && typeof img === 'string' && img.trim() !== '').length > 1 && (
                        <div className="absolute -bottom-1 -left-1 bg-yellow-500 text-black text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center z-10 shadow">
                          {group.images.filter(img => img && typeof img === 'string' && img.trim() !== '').length}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="w-16 h-16 bg-zinc-700 rounded flex items-center justify-center flex-shrink-0">
                      <div className="text-xs text-zinc-500">生成中...</div>
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          group.status === 'success'
                            ? 'bg-green-900 text-green-300'
                            : group.status === 'failed'
                            ? 'bg-red-900 text-red-300'
                            : 'bg-yellow-900 text-yellow-300'
                        }`}
                      >
                        {group.status === 'success'
                          ? 'SUCCESS'
                          : group.status === 'failed'
                          ? 'FAILED'
                          : 'PROCESSING'}
                      </span>
                    </div>

                    <div className="text-xs text-zinc-400 line-clamp-2">
                      {group.prompt}
                    </div>

                    <div className="text-xs text-zinc-600 mt-1">
                      {new Date(group.created_at).toLocaleTimeString()}
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (group.batch_id) {
                        setTasks(tasks.filter((t: Task) => t.batch_id !== group.batch_id));
                      } else {
                        setTasks(tasks.filter((t: Task) => t.id !== group.id));
                      }
                    }}
                    className="text-zinc-600 hover:text-zinc-400 p-1"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
