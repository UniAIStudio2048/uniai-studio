'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { X, Eye, EyeOff } from 'lucide-react';
import { saveSetting, getSetting, testStorageConnection } from '@/lib/api';

export default function StorageModal() {
  const { showStorageModal, setShowStorageModal } = useAppStore();
  const [enabled, setEnabled] = useState(false);
  const [external, setExternal] = useState('');
  const [bucket, setBucket] = useState('');
  const [accessKey, setAccessKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);

  // 加载配置
  useEffect(() => {
    if (showStorageModal) {
      loadConfig();
    }
  }, [showStorageModal]);

  const loadConfig = async () => {
    try {
      const [enabledRes, externalRes, bucketRes, accessKeyRes, secretKeyRes] = await Promise.all([
        getSetting('storage_enabled'),
        getSetting('storage_external'),
        getSetting('storage_bucket'),
        getSetting('storage_access_key'),
        getSetting('storage_secret_key'),
      ]);
      
      setEnabled(enabledRes.value === 'true');
      setExternal(externalRes.value || '');
      setBucket(bucketRes.value || '');
      setAccessKey(accessKeyRes.value || '');
      setSecretKey(secretKeyRes.value || '');
    } catch (error) {
      console.error('Failed to load storage config:', error);
    }
  };

  if (!showStorageModal) return null;

  // 检查配置是否完整
  const isConfigComplete = external.trim() && bucket.trim() && accessKey.trim() && secretKey.trim();

  const handleSave = async () => {
    setLoading(true);
    try {
      // 只有当启用且配置完整时才真正启用
      const realEnabled = enabled && isConfigComplete;
      
      await Promise.all([
        saveSetting('storage_enabled', realEnabled ? 'true' : 'false'),
        saveSetting('storage_external', external.trim()),
        saveSetting('storage_bucket', bucket.trim()),
        saveSetting('storage_access_key', accessKey.trim()),
        saveSetting('storage_secret_key', secretKey.trim()),
      ]);
      
      if (enabled && !isConfigComplete) {
        alert('配置已保存，但参数不完整，对象存储未启用');
      } else if (realEnabled) {
        alert('对象存储配置已保存并启用！');
      } else {
        alert('配置已保存，对象存储未启用');
      }
      setShowStorageModal(false);
    } catch (error) {
      console.error('Failed to save storage config:', error);
      alert('保存失败');
    } finally {
      setLoading(false);
    }
  };

  // 清除所有参数
  const handleClear = () => {
    setEnabled(false);
    setExternal('');
    setBucket('');
    setAccessKey('');
    setSecretKey('');
  };

  const handleTest = async () => {
    if (!external || !bucket || !accessKey || !secretKey) {
      alert('请填写完整的配置信息');
      return;
    }

    setTesting(true);
    try {
      const data = await testStorageConnection({ external, bucket, accessKey, secretKey });
      if (data.success) {
        alert('连接成功！');
      } else {
        alert('连接失败: ' + (data.error || '未知错误'));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      alert('连接失败: ' + errorMessage);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-zinc-900 rounded-lg p-6 w-full max-w-2xl border border-zinc-800 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            💾 对象存储配置
          </h2>
          <button
            onClick={() => setShowStorageModal(false)}
            className="text-zinc-500 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="w-4 h-4"
            />
            <label className="text-sm">启用对象存储</label>
          </div>

          <div className="bg-zinc-800 p-4 rounded-lg text-sm text-zinc-400 mb-4">
            启用后，参考图片会先上传到对象存储获取 URL 再发送给 API，大幅提升上传速度。
            <br />
            💡 查看与{' '}
            <a
              href="https://bja.sealos.run/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-yellow-400 hover:underline"
            >
              https://bja.sealos.run/
            </a>{' '}
            对象存储配置设置方式&quot;公开读写&quot;权限。
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">
              • External
            </label>
            <input
              type="text"
              value={external}
              onChange={(e) => setExternal(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 focus:outline-none focus:border-yellow-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">
              • Bucket 名称
            </label>
            <input
              type="text"
              value={bucket}
              onChange={(e) => setBucket(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 focus:outline-none focus:border-yellow-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">
              • Access Key
            </label>
            <input
              type="text"
              value={accessKey}
              onChange={(e) => setAccessKey(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 focus:outline-none focus:border-yellow-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">
              • Secret Key
            </label>
            <div className="relative">
              <input
                type={showSecret ? 'text' : 'password'}
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 pr-12 focus:outline-none focus:border-yellow-500 transition-colors"
              />
              <button
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
              >
                {showSecret ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={handleClear}
            className="px-4 py-3 bg-red-900/50 hover:bg-red-800 text-red-300 rounded-lg transition-colors"
          >
            清除
          </button>
          <button
            onClick={() => setShowStorageModal(false)}
            className="flex-1 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleTest}
            disabled={testing || !isConfigComplete}
            className="flex-1 px-4 py-3 bg-orange-600 hover:bg-orange-500 disabled:bg-zinc-700 disabled:text-zinc-500 rounded-lg transition-colors"
          >
            {testing ? '连接中...' : '连接测试'}
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex-1 px-4 py-3 bg-yellow-600 hover:bg-yellow-500 disabled:bg-zinc-700 rounded-lg transition-colors"
          >
            {loading ? '保存中...' : '保存配置'}
          </button>
        </div>

        {/* 状态提示 */}
        {enabled && !isConfigComplete && (
          <div className="mt-4 text-sm text-yellow-500">
            ⚠️ 已勾选启用，但参数不完整，保存后对象存储不会生效
          </div>
        )}
        {enabled && isConfigComplete && (
          <div className="mt-4 text-sm text-green-500">
            ✅ 配置完整，保存后对象存储将启用
          </div>
        )}
      </div>
    </div>
  );
}
