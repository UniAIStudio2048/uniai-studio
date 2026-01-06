'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

// 场景阶段
type Stage = 'loading' | 'door' | 'entering' | 'room';

export default function CommunityHome() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  
  // 状态
  const [stage, setStage] = useState<Stage>('loading');
  const [loadProgress, setLoadProgress] = useState(0);
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });
  const [isHoveringDoor, setIsHoveringDoor] = useState(false);
  const [isHoveringPoster1, setIsHoveringPoster1] = useState(false);
  const [isHoveringPoster2, setIsHoveringPoster2] = useState(false);
  const [doorOpen, setDoorOpen] = useState(false);

  // 加载进度
  useEffect(() => {
    const timer = setInterval(() => {
      setLoadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          setTimeout(() => setStage('door'), 500);
          return 100;
        }
        return prev + Math.random() * 12;
      });
    }, 150);
    return () => clearInterval(timer);
  }, []);

  // 鼠标移动处理 - 视差效果
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setMousePos({ x, y });
  }, []);

  // 计算视差偏移
  const getParallaxStyle = (intensity: number) => {
    const offsetX = (mousePos.x - 0.5) * intensity;
    const offsetY = (mousePos.y - 0.5) * intensity;
    return {
      transform: `translate(${offsetX}px, ${offsetY}px)`,
    };
  };

  // 门点击处理
  const handleDoorClick = () => {
    if (doorOpen) return;
    setDoorOpen(true);
    setTimeout(() => {
      setStage('entering');
      setTimeout(() => {
        setStage('room');
      }, 1000);
    }, 800);
  };

  // 进入室内后的热点点击
  const handleRoomHotspotClick = (path: string) => {
    router.push(path);
  };

  // ========== 加载页面 ==========
  if (stage === 'loading') {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center">
        <div className="mb-8 animate-pulse">
          <div className="text-6xl font-bold text-yellow-400 tracking-wider flex items-center gap-4">
            <span>⚡</span>
            <span>UniAI</span>
          </div>
          <div className="text-zinc-500 text-center mt-2 text-sm tracking-widest">
            AI COMMUNITY
          </div>
        </div>
        <div className="w-64 h-1 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-yellow-500 to-orange-500 transition-all duration-300"
            style={{ width: `${Math.min(loadProgress, 100)}%` }}
          />
        </div>
        <div className="mt-4 text-zinc-500 text-sm">
          Loading... {Math.floor(Math.min(loadProgress, 100))}%
        </div>
      </div>
    );
  }

  // ========== 进入动画 ==========
  if (stage === 'entering') {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-yellow-400 text-2xl animate-pulse">
          欢迎来到 UniAI 社区...
        </div>
      </div>
    );
  }

  // ========== 室内场景 ==========
  if (stage === 'room') {
    return (
      <div 
        ref={containerRef}
        className="fixed inset-0 bg-black overflow-hidden cursor-default"
        onMouseMove={handleMouseMove}
      >
        {/* 室内背景 */}
        <div 
          className="absolute inset-0 transition-transform duration-100 ease-out"
          style={getParallaxStyle(-15)}
        >
          <Image
            src="/community/ComfyUI_temp_ogikq_00004_.png"
            alt="UniAI Room"
            fill
            className="object-cover"
            priority
          />
        </div>

        {/* 橱柜热点 - Nano Banana 入口 */}
        <div
          className={`absolute cursor-pointer transition-all duration-300 ${
            isHoveringDoor ? 'brightness-125' : ''
          }`}
          style={{
            left: '48%',
            top: '12%',
            width: '18%',
            height: '38%',
          }}
          onClick={() => handleRoomHotspotClick('/nanobanana')}
          onMouseEnter={() => setIsHoveringDoor(true)}
          onMouseLeave={() => setIsHoveringDoor(false)}
        >
          <div className={`absolute inset-0 rounded-lg transition-all duration-300 ${
            isHoveringDoor ? 'ring-2 ring-yellow-400/60 shadow-[0_0_40px_rgba(234,179,8,0.4)]' : ''
          }`} />
          
          {isHoveringDoor && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 whitespace-nowrap z-20 animate-fade-in">
              <div className="bg-black/90 backdrop-blur-sm border border-yellow-500/50 rounded-lg px-4 py-2 text-center">
                <div className="text-yellow-400 font-bold">🍌 Nano Banana 工作室</div>
                <div className="text-zinc-400 text-xs mt-0.5">点击进入 AI 图像生成</div>
              </div>
            </div>
          )}

          {/* 呼吸动画 */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
            <div className="w-16 h-16 rounded-full border-2 border-yellow-400/30 animate-ping" />
          </div>
        </div>

        {/* 底部导航 */}
        <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent">
          <div className="flex items-center justify-between px-8 py-6">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚡</span>
              <span className="text-white font-bold text-xl">UniAI</span>
              <span className="text-zinc-500 text-sm">Community</span>
            </div>
            <div className="flex items-center gap-6 text-zinc-400 text-sm">
              <a href="#" className="hover:text-white transition-colors">Discord</a>
              <a href="#" className="hover:text-white transition-colors">Twitter</a>
              <a href="#" className="hover:text-white transition-colors">GitHub</a>
            </div>
            <div className="text-zinc-600 text-xs">© 2024 UniAI</div>
          </div>
        </div>

        <style jsx global>{`
          @keyframes fade-in {
            from { opacity: 0; transform: translate(-50%, 10px); }
            to { opacity: 1; transform: translate(-50%, 0); }
          }
          .animate-fade-in { animation: fade-in 0.3s ease-out; }
        `}</style>
      </div>
    );
  }

  // ========== 大门入口场景 ==========
  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 bg-[#2a1810] overflow-hidden cursor-default"
      onMouseMove={handleMouseMove}
    >
      {/* 背景层 - 最慢的视差 */}
      <div 
        className="absolute inset-[-50px] transition-transform duration-150 ease-out"
        style={getParallaxStyle(-20)}
      >
        <Image
          src="/door/background.png"
          alt="Background"
          fill
          className="object-cover"
          priority
        />
      </div>

      {/* 彩旗层 - 带飘动效果 */}
      <div 
        className={`absolute inset-[-30px] transition-transform duration-100 ease-out ${
          isHoveringDoor ? 'animate-flag-wave' : ''
        }`}
        style={{
          ...getParallaxStyle(-8),
          transformOrigin: 'top center',
        }}
      >
        <Image
          src="/door/flags.png"
          alt="Flags"
          fill
          className="object-cover"
          priority
        />
      </div>

      {/* 海报1 - 带晃动效果 */}
      <div 
        className={`absolute inset-[-20px] transition-all duration-200 ease-out ${
          isHoveringPoster1 ? 'brightness-110' : ''
        }`}
        style={{
          ...getParallaxStyle(-5),
          transform: `${getParallaxStyle(-5).transform} ${isHoveringPoster1 ? 'rotate(2deg)' : 'rotate(0deg)'}`,
        }}
        onMouseEnter={() => setIsHoveringPoster1(true)}
        onMouseLeave={() => setIsHoveringPoster1(false)}
      >
        <Image
          src="/door/poster1.png"
          alt="Poster 1"
          fill
          className="object-cover pointer-events-none"
        />
      </div>

      {/* 海报2 */}
      <div 
        className={`absolute inset-[-20px] transition-all duration-200 ease-out ${
          isHoveringPoster2 ? 'brightness-110' : ''
        }`}
        style={{
          ...getParallaxStyle(-5),
          transform: `${getParallaxStyle(-5).transform} ${isHoveringPoster2 ? 'rotate(-2deg)' : 'rotate(0deg)'}`,
        }}
        onMouseEnter={() => setIsHoveringPoster2(true)}
        onMouseLeave={() => setIsHoveringPoster2(false)}
      >
        <Image
          src="/door/poster2.png"
          alt="Poster 2"
          fill
          className="object-cover pointer-events-none"
        />
      </div>

      {/* 左门扇 */}
      <div 
        className={`absolute inset-0 transition-all duration-700 ease-in-out origin-left ${
          doorOpen ? '-translate-x-[30%] -rotate-y-70 opacity-80' : ''
        }`}
        style={{
          ...getParallaxStyle(doorOpen ? 0 : 10),
          transformStyle: 'preserve-3d',
          perspective: '1000px',
        }}
      >
        <Image
          src="/door/door-left.png"
          alt="Left Door"
          fill
          className="object-cover"
          priority
        />
      </div>

      {/* 右门扇 */}
      <div 
        className={`absolute inset-0 transition-all duration-700 ease-in-out origin-right ${
          doorOpen ? 'translate-x-[30%] rotate-y-70 opacity-80' : ''
        }`}
        style={{
          ...getParallaxStyle(doorOpen ? 0 : 10),
          transformStyle: 'preserve-3d',
          perspective: '1000px',
        }}
      >
        <Image
          src="/door/door-right.png"
          alt="Right Door"
          fill
          className="object-cover"
          priority
        />
      </div>

      {/* 门的交互区域 */}
      <div
        className={`absolute cursor-pointer transition-all duration-300 z-10 ${
          doorOpen ? 'pointer-events-none' : ''
        }`}
        style={{
          left: '30%',
          top: '25%',
          width: '40%',
          height: '60%',
        }}
        onClick={handleDoorClick}
        onMouseEnter={() => setIsHoveringDoor(true)}
        onMouseLeave={() => setIsHoveringDoor(false)}
      >
        {/* 悬浮提示 */}
        {isHoveringDoor && !doorOpen && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center animate-fade-in z-20">
            <div className="bg-black/70 backdrop-blur-sm rounded-full px-8 py-4 border border-yellow-500/30">
              <div className="text-yellow-400 font-bold text-xl tracking-wider">COME ON IN</div>
              <div className="text-zinc-400 text-sm mt-1">点击进入</div>
            </div>
          </div>
        )}
        
        {/* 门的高亮边框 */}
        {isHoveringDoor && !doorOpen && (
          <div className="absolute inset-0 border-4 border-yellow-400/20 rounded-lg animate-pulse" />
        )}
      </div>

      {/* 底部品牌 */}
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent z-20">
        <div className="flex items-center justify-between px-8 py-4">
          <div className="flex items-center gap-3">
            <span className="text-xl">⚡</span>
            <span className="text-white font-semibold">UniAI</span>
          </div>
          <div className="flex items-center gap-6 text-zinc-400 text-xs">
            <a href="#" className="hover:text-white transition-colors">DISCORD</a>
            <a href="#" className="hover:text-white transition-colors">TWITTER</a>
            <a href="#" className="hover:text-white transition-colors">TELEGRAM</a>
          </div>
          <div className="text-zinc-600 text-xs">© 2024 UniAI</div>
        </div>
      </div>

      {/* 全局样式 */}
      <style jsx global>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
          to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
        .animate-fade-in { animation: fade-in 0.3s ease-out; }
        
        @keyframes flag-wave {
          0%, 100% { transform: rotate(0deg) translateX(0); }
          25% { transform: rotate(0.5deg) translateX(2px); }
          75% { transform: rotate(-0.5deg) translateX(-2px); }
        }
        .animate-flag-wave { animation: flag-wave 2s ease-in-out infinite; }
        
        .rotate-y-70 { transform: rotateY(70deg); }
        .-rotate-y-70 { transform: rotateY(-70deg); }
      `}</style>
    </div>
  );
}
