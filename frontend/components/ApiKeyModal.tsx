'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { saveSetting, getSetting, checkRemoveBgAccount } from '@/lib/api';
import { X, Zap } from 'lucide-react';

interface AccountInfo {
  api: {
    free_calls: number;
  };
}

export default function ApiKeyModal() {
  const { 
    showApiKeyModal, setShowApiKeyModal, 
    apiKey, setApiKey,
    duomiApiKey, setDuomiApiKey,
    activeApi, setActiveApi 
  } = useAppStore();
  
  const [inputKey, setInputKey] = useState(apiKey || '');
  const [duomiInputKey, setDuomiInputKey] = useState(duomiApiKey || '');
  const [removeBgKey, setRemoveBgKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [removeBgCredits, setRemoveBgCredits] = useState<number | null>(null);
  const [checkingCredits, setCheckingCredits] = useState(false);

  // 加载 API Keys 和保存的输入值
  useEffect(() => {
    if (showApiKeyModal) {
      // 加载 Nano Banana API Key（接口2）
      getSetting('nano_banana_api_key').then((res) => {
        if (res.value) {
          setInputKey(res.value);
        }
      });
      
      // 加载多米 API Key（接口1）
      getSetting('duomi_api_key').then((res) => {
        if (res.value) {
          setDuomiInputKey(res.value);
        }
      });
      
      // 加载当前接口选择
      getSetting('active_api').then((res) => {
        if (res.value) {
          // 如果之前选的是接口3，自动切换到2
          const api = parseInt(res.value);
          setActiveApi(api === 3 ? 2 : api as 1 | 2);
        }
      });
      
      // 加载 remove.bg API Key
      getSetting('removebg_api_key').then((res) => {
        if (res.value) {
          setRemoveBgKey(res.value);
          checkRemoveBgCredits(res.value);
        }
      });
    }
  }, [showApiKeyModal, setActiveApi]);

  // 检查 remove.bg 剩余次数（通过后端代理）
  const checkRemoveBgCredits = async (key: string) => {
    if (!key) return;
    
    setCheckingCredits(true);
    try {
      // 通过后端代理请求 remove.bg API
      const data = await checkRemoveBgAccount(key);
      if (data?.api?.free_calls !== undefined) {
        setRemoveBgCredits(data.api.free_calls);
      }
    } catch (error) {
      console.error('Failed to check remove.bg credits:', error);
    } finally {
      setCheckingCredits(false);
    }
  };

  if (!showApiKeyModal) return null;

  const handleSave = async () => {
    setLoading(true);
    try {
      // 保存 Nano Banana API Key（接口2）
      await saveSetting('nano_banana_api_key', inputKey.trim());
      setApiKey(inputKey.trim());
      
      // 保存多米 API Key（接口1）
      await saveSetting('duomi_api_key', duomiInputKey.trim());
      setDuomiApiKey(duomiInputKey.trim());
      
      // 保存当前接口选择
      await saveSetting('active_api', String(activeApi));
      
      // 保存 remove.bg API Key
      await saveSetting('removebg_api_key', removeBgKey.trim());
      
      // 如果有值，重新检查额度
      if (removeBgKey.trim()) {
        await checkRemoveBgCredits(removeBgKey.trim());
      } else {
        setRemoveBgCredits(null);
      }
      
      setShowApiKeyModal(false);
      alert('API Key 保存成功！');
    } catch (error) {
      console.error('Save API Key error:', error);
      alert('保存失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  // 切换接口
  const handleSwitchApi = async (api: 1 | 2) => {
    setActiveApi(api);
    try {
      await saveSetting('active_api', String(api));
    } catch (error) {
      console.error('Switch API error:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 rounded-lg p-4 sm:p-6 w-full max-w-md border border-zinc-800 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-xl font-semibold">API Key 配置</h2>
          <button
            onClick={() => setShowApiKeyModal(false)}
            className="text-zinc-500 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* 接口切换按钮 */}
        <div className="mb-4">
          <label className="block text-sm text-zinc-400 mb-2">选择接口</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleSwitchApi(1)}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg border-2 transition-all ${
                activeApi === 1
                  ? 'border-yellow-500 bg-yellow-500/10 text-yellow-400'
                  : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600'
              }`}
            >
              <Zap size={16} />
              <span className="text-sm font-medium">接口1</span>
            </button>
            <button
              onClick={() => handleSwitchApi(2)}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg border-2 transition-all ${
                activeApi === 2
                  ? 'border-yellow-500 bg-yellow-500/10 text-yellow-400'
                  : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600'
              }`}
            >
              <Zap size={16} />
              <span className="text-sm font-medium">接口2</span>
            </button>
          </div>
          <p className="text-xs text-zinc-500 mt-2">提示：Z-Image 模型请在左侧 Z-Image Turbo 窗口中配置</p>
        </div>

        {/* 接口1 - 多米 API Key */}
        {activeApi === 1 && (
          <div className="mb-4">
            <label className="block text-sm text-yellow-400 mb-2">
              多米 API Key
            </label>
            <input
              type="password"
              value={duomiInputKey}
              onChange={(e) => setDuomiInputKey(e.target.value)}
              placeholder="输入多米 API Key..."
              className="w-full bg-zinc-800 border border-yellow-500/50 rounded-lg px-4 py-3 focus:outline-none focus:border-yellow-500 transition-colors"
            />
            <p className="text-xs text-zinc-500 mt-1">
              获取地址: <a href="https://api.domo.run" target="_blank" rel="noopener noreferrer" className="text-yellow-500 hover:underline">api.domo.run</a>
            </p>
          </div>
        )}

        {/* 接口2 - Nano Banana API Key */}
        {activeApi === 2 && (
          <div className="mb-4">
            <label className="block text-sm text-yellow-400 mb-2">
              Nano Banana API Key
            </label>
            <input
              type="password"
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              placeholder="输入 Nano Banana API Key..."
              className="w-full bg-zinc-800 border border-yellow-500/50 rounded-lg px-4 py-3 focus:outline-none focus:border-yellow-500 transition-colors"
            />
            <p className="text-xs text-zinc-500 mt-1">
              获取地址: <a href="https://ai.comfly.chat/log" target="_blank" rel="noopener noreferrer" className="text-yellow-500 hover:underline">ai.comfly.chat</a>
            </p>
          </div>
        )}

        {/* remove.bg API Key */}
        <div className="mb-4">
          <label className="block text-sm text-zinc-400 mb-2">
            remove.bg API Key (抠图功能)
          </label>
          <input
            type="password"
            value={removeBgKey}
            onChange={(e) => {
              setRemoveBgKey(e.target.value);
              if (e.target.value) {
                checkRemoveBgCredits(e.target.value);
              } else {
                setRemoveBgCredits(null);
              }
            }}
            placeholder="输入 remove.bg API Key..."
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 focus:outline-none focus:border-yellow-500 transition-colors"
          />
          <div className="flex items-center justify-between mt-1">
            <p className="text-xs text-zinc-500">
              获取地址: <a href="https://www.remove.bg/api" target="_blank" rel="noopener noreferrer" className="text-yellow-500 hover:underline">remove.bg/api</a>
            </p>
            {checkingCredits ? (
              <span className="text-xs text-blue-400">检查中...</span>
            ) : removeBgCredits !== null ? (
              <span className="text-xs text-green-400">
                剩余 {removeBgCredits} 次/月
              </span>
            ) : removeBgKey ? (
              <span className="text-xs text-red-400">无法获取额度</span>
            ) : (
              <span className="text-xs text-zinc-500">（免费 50 次/月）</span>
            )}
          </div>
        </div>

        {((activeApi === 1 && duomiInputKey) || (activeApi === 2 && inputKey) || removeBgKey) && (
          <div className="text-sm text-green-400 mb-4">✓ 已填写</div>
        )}

        <div className="flex gap-2 sm:gap-3">
          <button
            onClick={async () => {
              if (activeApi === 1) {
                setDuomiInputKey('');
                await saveSetting('duomi_api_key', '');
                setDuomiApiKey('');
              } else if (activeApi === 2) {
                setInputKey('');
                await saveSetting('nano_banana_api_key', '');
                setApiKey('');
              }
              setRemoveBgKey('');
              setRemoveBgCredits(null);
              await saveSetting('removebg_api_key', '');
            }}
            className="flex-1 px-3 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
          >
            清除
          </button>
          <button
            onClick={() => setShowApiKeyModal(false)}
            className="flex-1 px-3 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex-1 px-3 py-2 text-sm bg-yellow-600 hover:bg-yellow-500 disabled:bg-zinc-800 disabled:text-zinc-600 rounded-lg transition-colors"
          >
            {loading ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
