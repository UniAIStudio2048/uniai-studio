'use client';

import { useState, useEffect, useRef } from 'react';

export default function IntroAnimation() {
  const [isVisible, setIsVisible] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);
  const [showBlackScreen, setShowBlackScreen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const endedRef = useRef(false);

  useEffect(() => {
    console.log('=== IntroAnimation 组件已挂载 ===');

    // 临时注释掉sessionStorage检查，用于测试（测试完成后可以取消注释）
    // const hasPlayed = sessionStorage.getItem('hasPlayedIntro');
    // if (hasPlayed === 'true') {
    //   console.log('开场动画已播放过，直接隐藏');
    //   setIsVisible(false);
    //   return;
    // }

    // 使用延迟确保video元素已渲染到DOM
    const timer = setTimeout(() => {
      const video = videoRef.current;
      if (!video) {
        console.error('视频元素未找到');
        return;
      }

      console.log('视频元素已找到，视频路径:', video.src);
      setupVideoListeners(video);

      // 立即尝试播放一次（因为有autoPlay属性，这里作为备份）
      if (video.paused) {
        video.play().then(() => {
          console.log('初始播放尝试成功');
          setIsPlaying(true);
        }).catch(err => {
          console.log('初始播放尝试失败，等待事件触发:', err.message);
        });
      }
    }, 0);

    return () => {
      clearTimeout(timer);
    };
  }, []);

  const setupVideoListeners = (video: HTMLVideoElement) => {
    // 立即尝试播放视频
    const tryAutoPlay = () => {
      console.log('尝试自动播放视频...');
      const playPromise = video.play();

      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log('=== 视频自动播放成功 ===');
            setIsPlaying(true);
          })
          .catch(error => {
            console.error('自动播放被浏览器阻止:', error);
            console.log('等待用户交互后播放');
            // 自动播放失败，但不影响后续的手动播放
          });
      }
    };

    // 监听视频加载事件
    const handleLoadedMetadata = () => {
      console.log('✓ 视频元数据已加载, 时长:', video.duration.toFixed(2), '秒');
      // 元数据加载完成后尝试播放
      tryAutoPlay();
    };

    const handleCanPlay = () => {
      console.log('✓ 视频可以播放');
      // 如果还没开始播放，再次尝试
      if (video.paused) {
        tryAutoPlay();
      } else {
        setIsPlaying(true);
      }
    };

    const handleEnded = () => {
      if (endedRef.current) return;
      endedRef.current = true;

      console.log('=== 视频播放完毕 ===');
      handleComplete();
    };

    const handleError = (e: Event) => {
      console.error('视频加载错误:', e);
      handleComplete();
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('error', handleError);
  };

  const handleComplete = () => {
    console.log('视频播放完毕，开始过渡动画');

    // 第一步：视频淡出到黑屏（500ms）
    setFadeOut(true);

    // 第二步：500ms后显示纯黑屏
    setTimeout(() => {
      console.log('切换到黑屏过渡');
      setShowBlackScreen(true);
    }, 500);

    // 第三步：再过500ms后黑屏淡出，显示主页面（总共1500ms的平滑过渡）
    setTimeout(() => {
      console.log('黑屏淡出，显示主页面');
      setIsVisible(false);
      // 标记已播放
      sessionStorage.setItem('hasPlayedIntro', 'true');
    }, 1500);
  };

  const handleSkip = () => {
    if (endedRef.current) return;
    endedRef.current = true;

    console.log('用户点击跳过');
    const video = videoRef.current;
    if (video) {
      video.pause();
    }
    handleComplete();
  };

  // 点击屏幕跳过或播放
  const handleScreenClick = () => {
    const video = videoRef.current;
    if (!video) return;

    // 如果视频暂停，尝试播放
    if (video.paused) {
      console.log('用户点击屏幕，尝试播放');
      video.play().catch(err => {
        console.error('播放失败:', err);
      });
    } else {
      // 如果视频正在播放，跳过
      handleSkip();
    }
  };

  if (!isVisible) {
    console.log('组件不可见，返回null');
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black flex items-center justify-center cursor-pointer"
      onClick={handleScreenClick}
    >
      {/* 视频层 */}
      {!showBlackScreen && (
        <div
          className={`absolute inset-0 transition-opacity duration-500 ${
            fadeOut ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <video
            ref={videoRef}
            className="w-full h-full object-cover pointer-events-none"
            autoPlay
            playsInline
            muted
            preload="auto"
          >
            <source src="/intro.mp4" type="video/mp4" />
          </video>
        </div>
      )}

      {/* 黑屏过渡层 - 在视频淡出后显示，然后自己也淡出 */}
      {showBlackScreen && (
        <div
          className="absolute inset-0 bg-black animate-fadeOut"
          style={{
            animation: 'fadeOut 1s ease-out forwards',
          }}
        />
      )}

      {/* 提示文字 */}
      {!showBlackScreen && (
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 pointer-events-none">
          <div className="text-white/20 text-xs">点击跳过</div>
        </div>
      )}

      <style jsx>{`
        @keyframes fadeOut {
          from {
            opacity: 1;
          }
          to {
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
