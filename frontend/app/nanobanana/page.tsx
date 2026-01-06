'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import { getTasks, getFavorites, getSetting, generateImage } from '@/lib/api';
import { useIsMobile } from '@/lib/useIsMobile';
import TopNav from '@/components/TopNav';
import LeftSidebar from '@/components/LeftSidebar';
import Canvas from '@/components/Canvas';
import RightTaskQueue from '@/components/RightTaskQueue';
import BottomInput from '@/components/BottomInput';
import ApiKeyModal from '@/components/ApiKeyModal';
import StorageModal from '@/components/StorageModal';
import FavoritesModal from '@/components/FavoritesModal';
import InspirationModal from '@/components/InspirationModal';
import AddInspirationModal from '@/components/AddInspirationModal';
import IntroAnimation from '@/components/IntroAnimation';
import MobileSettingsPanel from '@/components/MobileSettingsPanel';
import MobileTaskQueuePanel from '@/components/MobileTaskQueuePanel';
import MobileBottomNav from '@/components/MobileBottomNav';
import ZImageModal from '@/components/ZImageModal';
import type { UploadedImage, ModelType } from '@/types';

export default function Home() {
  const {
    setTasks,
    setFavorites,
    setApiKey,
    setShowApiKeyModal,
    resolution,
    batchCount,
    aspectRatio,
    selectedModel,
    uploadedImages,
    prompt,
    setPrompt,
    showZImageModal,
    setShowZImageModal,
  } = useAppStore();

  const [loading, setLoading] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const tasksRef = useRef<typeof tasks>([]);
  const { tasks } = useAppStore();
  const isMobileHook = useIsMobile();
  const [mounted, setMounted] = useState(false);
  const [showMobileSettings, setShowMobileSettings] = useState(false);
  const [showMobileTaskQueue, setShowMobileTaskQueue] = useState(false);
  
  // 客户端挂载后才应用移动端样式，避免 hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);
  
  const isMobile = mounted ? isMobileHook : false;

  // 更新任务引用
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  const loadInitialData = useCallback(async () => {
    try {
      // 加载任务列表
      const tasksData = await getTasks();
      setTasks(tasksData.tasks);

      // 加载收藏列表
      const favoritesData = await getFavorites();
      setFavorites(favoritesData.favorites);

      // 加载 API Key，但不自动显示弹窗
      const apiKeyData = await getSetting('nano_banana_api_key');
      if (apiKeyData.value) {
        setApiKey(apiKeyData.value);
      }
    } catch (error) {
      console.error('Failed to load initial data:', error);
    }
  }, [setTasks, setFavorites, setApiKey]);

  useEffect(() => {
    // 加载初始数据
    loadInitialData();
  }, [loadInitialData]);

  // 轮询任务状态
  useEffect(() => {
    const pollTasks = async () => {
      try {
        const tasksData = await getTasks();
        setTasks(tasksData.tasks);
        
        // 检查是否有进行中的任务
        const hasProcessingTasks = tasksData.tasks.some(
          (task: { status: string }) => task.status === 'processing' || task.status === 'pending'
        );
        
        // 如果有进行中的任务，继续轮询
        if (hasProcessingTasks) {
          pollingRef.current = setTimeout(pollTasks, 3000);
        } else {
          pollingRef.current = null;
        }
      } catch (error) {
        console.error('Failed to poll tasks:', error);
        // 出错后也继续轮询
        pollingRef.current = setTimeout(pollTasks, 5000);
      }
    };

    // 检查当前任务状态，决定是否开始轮询
    const hasProcessing = tasksRef.current.some(
      (task: any) => task.status === 'processing' || task.status === 'pending'
    );
    
    if (hasProcessing && !pollingRef.current) {
      pollingRef.current = setTimeout(pollTasks, 3000);
    }

    return () => {
      if (pollingRef.current) {
        clearTimeout(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [tasks, setTasks]);

  async function handleGenerate() {
    console.log('[handleGenerate] 开始执行', { prompt, uploadedImages: uploadedImages.length });
    
    // 如果没有提示词且没有上传图片，提示用户
    if (!prompt.trim() && uploadedImages.length === 0) {
      alert('请输入提示词或上传参考图片');
      return;
    }

    if (prompt.length > 500) {
      alert('提示词不能超过 500 个字符');
      return;
    }

    // 保存当前参数
    const currentPrompt = prompt;
    const currentBatchCount = batchCount;
    // 保存所有上传的图片 URL
    const currentImageUrls = uploadedImages.map((img: UploadedImage) => img.url);

    // 异步提交任务，不阻塞 UI
    (async () => {
      try {
        // 构建请求参数
        const modelMap: Record<string, string> = {
          // 接口2: Nano Banana 模型
          'Nano Banana 2': 'nano-banana-2',
          'Nano Banana HD': 'nano-banana-hd',
          'Nano Banana Pro': 'nano-banana-pro',
          'Nano Banana': 'nano-banana',
          // 接口1: 多米API NANO-BANANA 模型
          'Gemini 3 Pro': 'gemini-3-pro-image-preview',
          // 接口3: Z-Image-Turbo 模型
          'Z-Image Turbo': 'z-image-turbo',
        };
        
        // 生成批量任务ID（当 batchCount > 1 时使用同一个 ID）
        const batchId = currentBatchCount > 1 ? crypto.randomUUID() : undefined;
        
        const requestData: {
          prompt: string;
          resolution: string;
          aspectRatio: string;
          model: ModelType;
          batchCount: number;
          imageUrls?: string[];  // 支持多图
          batchId?: string;
        } = {
          prompt: currentPrompt,
          resolution,
          aspectRatio: aspectRatio === 'Auto' ? '1:1' : aspectRatio,
          model: (modelMap[selectedModel] || 'nano-banana-2') as ModelType,
          batchCount: currentBatchCount,
          batchId,
        };

        // 如果有上传的图片，使用图生图模式（支持多图）
        if (currentImageUrls.length > 0) {
          requestData.imageUrls = currentImageUrls;
        }

        // 第一次请求成功后才清空输入框
        console.log('[handleGenerate] 发送请求', requestData);
        await generateImage(requestData);
        console.log('[handleGenerate] 请求成功');
        setPrompt(''); // 提交成功后清空提示词
        
        // 每次请求后刷新任务列表
        const tasksData = await getTasks();
        setTasks(tasksData.tasks);

        // 如果还有更多批次，继续请求
        for (let i = 1; i < currentBatchCount; i++) {
          await new Promise(resolve => setTimeout(resolve, 500));
          await generateImage(requestData);
          
          // 每次请求后刷新任务列表
          const tasksData2 = await getTasks();
          setTasks(tasksData2.tasks);
        }

        // 开始轮询
        if (!pollingRef.current) {
          const pollTasks = async () => {
            try {
              const data = await getTasks();
              setTasks(data.tasks);
              
              const hasProcessing = data.tasks.some(
                (task: { status: string }) => task.status === 'processing' || task.status === 'pending'
              );
              
              if (hasProcessing) {
                pollingRef.current = setTimeout(pollTasks, 3000);
              } else {
                pollingRef.current = null;
              }
            } catch (error) {
              console.error('Poll error:', error);
              pollingRef.current = setTimeout(pollTasks, 5000);
            }
          };
          pollingRef.current = setTimeout(pollTasks, 3000);
        }
      } catch (error: unknown) {
        console.error('Generate error:', error);
        alert((
          error as { response?: { data?: { error?: string } } }
        )?.response?.data?.error || '生成失败，请重试');
      }
    })();
  }

  return (
    <>
      {/* 开场动画 */}
      <IntroAnimation />

      <div className="h-screen w-screen flex flex-col bg-zinc-900 text-white overflow-hidden">
        {/* 顶部导航栏 */}
        <TopNav />

        {/* 主体区域 */}
        {isMobile ? (
          // 移动端布局
          <>
            <div className="flex-1 flex flex-col overflow-hidden" style={{ paddingBottom: '140px' }}>
              <Canvas />
            </div>

            {/* 移动端底部导航 */}
            <MobileBottomNav
              onOpenSettings={() => setShowMobileSettings(true)}
              onOpenTaskQueue={() => setShowMobileTaskQueue(true)}
              onGenerate={handleGenerate}
              prompt={prompt}
              setPrompt={setPrompt}
            />

            {/* 移动端设置面板 */}
            <MobileSettingsPanel
              isOpen={showMobileSettings}
              onClose={() => setShowMobileSettings(false)}
            />

            {/* 移动端任务队列面板 */}
            <MobileTaskQueuePanel
              isOpen={showMobileTaskQueue}
              onClose={() => setShowMobileTaskQueue(false)}
            />
          </>
        ) : (
          // 桌面端布局
          <div className="flex-1 flex overflow-hidden">
            {/* 左侧工具栏 */}
            <LeftSidebar />

            {/* 中央画布区域 */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <Canvas />

              {/* 底部输入区 */}
              <BottomInput
                prompt={prompt}
                setPrompt={setPrompt}
                onGenerate={handleGenerate}
                loading={loading}
              />
            </div>

            {/* 右侧任务队列 */}
            <RightTaskQueue />
          </div>
        )}

        {/* 模态框 */}
        <ApiKeyModal />
        <StorageModal />
        <FavoritesModal />
        <InspirationModal />
        <AddInspirationModal />
        <ZImageModal isOpen={showZImageModal} onClose={() => setShowZImageModal(false)} />
      </div>
    </>
  );
}
