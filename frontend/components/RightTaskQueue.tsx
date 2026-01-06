'use client';

import { useAppStore } from '@/lib/store';
import { Trash2, X } from 'lucide-react';
import Image from 'next/image';
import { useMemo, useState } from 'react';
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

export default function RightTaskQueue() {
  const { tasks, setTasks, setCurrentImages } = useAppStore();
  const [selectedGroup, setSelectedGroup] = useState<GroupedTask | null>(null);

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
        // 没有 batch_id 的单独展示，获取所有 result_images
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
    
    // 处理批量任务
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
    
    // 按时间排序（新的在前面）
    return groups.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [tasks]);

  const handleClearAll = () => {
    if (confirm('确定要清空任务列表吗？\n\n注意：此操作仅清除本地显示，不会删除存储桶中的图片数据。')) {
      setTasks([]);
    }
  };

  const handleTaskClick = (group: GroupedTask) => {
    if (group.images.length > 0) {
      // 设置所有图片，在画布中可以切换
      setCurrentImages(group.images);
    }
  };

  const handleImageSelect = (imageUrl: string) => {
    // 从弹窗中选择单张图片
    setCurrentImages([imageUrl]);
    setSelectedGroup(null);
  };

  return (
    <div className="w-80 bg-zinc-950 border-l border-zinc-800 flex flex-col">
      <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          ⚡ TASK QUEUE
        </h2>
        {tasks.length > 0 && (
          <button
            onClick={handleClearAll}
            className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
          >
            <Trash2 size={14} />
            CLEAR ALL
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {groupedTasks.length === 0 ? (
          <div className="text-center text-zinc-600 mt-10">
            暂无任务
          </div>
        ) : (
          groupedTasks.map((group) => (
            <div
              key={group.id}
              onClick={() => handleTaskClick(group)}
              className="bg-zinc-900 rounded-lg p-3 cursor-pointer hover:bg-zinc-800 transition-colors"
            >
              <div className="flex items-start gap-3">
                {group.images.filter(img => img && typeof img === 'string' && img.trim() !== '').length > 0 ? (
                  <div className="relative w-16 h-16 flex-shrink-0">
                    {/* 层叠效果：显示最多3张图片层叠，带偏移和旋转 */}
                    {group.images.filter(img => img && typeof img === 'string' && img.trim() !== '').slice(0, 3).map((img, idx, arr) => {
                      const total = Math.min(arr.length, 3);
                      const reverseIdx = total - 1 - idx;
                      // 计算偏移和旋转
                      const offset = reverseIdx * 6;
                      const rotation = (reverseIdx - 1) * 8; // -8, 0, 8 度
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
                    {/* 数量角标 - 多图时显示 */}
                    {group.images.length > 1 && (
                      <div className="absolute -bottom-1 -left-1 bg-yellow-500 text-black text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center z-10 shadow">
                        {group.images.length}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-16 h-16 bg-zinc-800 rounded flex items-center justify-center flex-shrink-0">
                    <div className="text-xs text-zinc-600">生成中...</div>
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

                {/* 关闭按钮 */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    // 删除该组任务
                    if (group.batch_id) {
                      setTasks(tasks.filter((t: Task) => t.batch_id !== group.batch_id));
                    } else {
                      setTasks(tasks.filter((t: Task) => t.id !== group.id));
                    }
                  }}
                  className="text-zinc-600 hover:text-zinc-400"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 批量图片选择弹窗 */}
      {selectedGroup && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-zinc-900 rounded-lg p-6 max-w-2xl max-h-[80vh] overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">选择图片</h3>
              <button
                onClick={() => setSelectedGroup(null)}
                className="text-zinc-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {selectedGroup.images.filter(img => img && typeof img === 'string' && img.trim() !== '').map((img, idx) => (
                <div
                  key={idx}
                  onClick={() => handleImageSelect(img)}
                  className="relative aspect-square rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all"
                >
                  <Image
                    src={img}
                    alt={`Result ${idx + 1}`}
                    fill
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
