'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { X, Zap, RefreshCw, Download, Image as ImageIcon, ChevronDown, Settings, Check, Trash2, Clock, Upload, Wand2, Loader2, MessageCircle, Send, Plus, Edit2, ExternalLink, Sliders, List } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { saveSetting, getSetting, getZImageTasks, clearZImageTasks, getTask, uploadImage } from '@/lib/api';
import Image from 'next/image';
import api from '@/lib/api';
import { useIsMobile } from '@/lib/useIsMobile';

// 采样方法选项
const SAMPLER_METHODS = ['Euler', 'Euler a', 'DPM++ 2M', 'DPM++ SDE', 'DDIM', 'LMS'];

// 预设尺寸选项（基于官方推荐分辨率，总像素1280*1280）
const PRESET_SIZES = [
  { ratio: '1:1', width: 1280, height: 1280, label: '正方形' },
  { ratio: '3:4', width: 1104, height: 1472, label: '纵向' },
  { ratio: '4:3', width: 1472, height: 1104, label: '横向' },
  { ratio: '9:16', width: 864, height: 1536, label: '手机壁纸' },
  { ratio: '16:9', width: 1536, height: 864, label: '宽屏' },
  { ratio: '2:3', width: 1024, height: 1536, label: '海报' },
  { ratio: '3:2', width: 1536, height: 1024, label: '横版海报' },
  { ratio: '7:9', width: 1120, height: 1440, label: '纵向宽' },
  { ratio: '9:7', width: 1440, height: 1120, label: '横向宽' },
];

// 反推提示词预设脚本（可编辑）
const DEFAULT_SCRIPTS: Record<string, string> = {
  'default': '请详细描述这张图片的内容，包括主体、场景、风格、光线、色调、构图等细节，用于AI图像生成的提示词。请用英文输出。',
  'portrait': '请分析这张人像照片，详细描述人物的外貌特征（发型、肤色、表情、服装）、姿势、背景环境、光线效果和整体风格。请用英文输出，格式适合作为AI图像生成的提示词。',
  'landscape': '请描述这张风景图片，包括自然元素（天空、云、山、水、植物等）、季节氛围、时间段（日出/日落/夜晚）、色彩搭配和艺术风格。请用英文输出。',
  'product': '请分析这张产品图片，描述产品的外观、材质、颜色、摆放角度、背景环境和光线效果。请用英文输出，适合作为电商或广告图片的AI生成提示词。',
  'anime': '请将这张图片转换为动漫/插画风格的描述，包括角色特征、画风（如日系动漫、赛博朋克、水彩等）、场景元素和整体氛围。请用英文输出。',
  'artistic': '请从艺术角度分析这张图片，描述其艺术风格（如印象派、极简主义、超现实主义等）、色彩运用、构图技巧和情感表达。请用英文输出。',
  'chinese': '请详细描述这张图片的内容，包括主体、场景、风格、光线、色调、构图等细节。请用中文输出，作为AI图像生成的提示词。',
};

const DEFAULT_PRESETS = [
  { id: 'default', name: '通用描述', icon: '📝' },
  { id: 'portrait', name: '人像照片', icon: '👤' },
  { id: 'landscape', name: '风景图片', icon: '🌄' },
  { id: 'product', name: '产品图片', icon: '📦' },
  { id: 'anime', name: '动漫/插画', icon: '🎨' },
  { id: 'artistic', name: '艺术风格', icon: '🖼️' },
  { id: 'chinese', name: '中文输出', icon: '🇨🇳' },
];

interface ZImageTask {
  id: string;
  prompt: string;
  status: 'pending' | 'processing' | 'success' | 'failed';
  result_images: string[];
  created_at: string;
  error_message?: string;
  batch_id?: string;
}

// 分组后的任务
interface GroupedZImageTask {
  id: string;
  batch_id?: string;
  status: 'pending' | 'processing' | 'success' | 'failed';
  prompt: string;
  images: string[];
  created_at: string;
  count: number;
}

interface ZImageModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ZImageModal({ isOpen, onClose }: ZImageModalProps) {
  // 提示词状态
  const [prompt, setPrompt] = useState('');
  
  // 基本参数
  const [samplerMethod, setSamplerMethod] = useState('Euler');
  const [samplerOpen, setSamplerOpen] = useState(false);
  const [randomSeed, setRandomSeed] = useState('-1');
  const [samplingSteps, setSamplingSteps] = useState(9);
  const [numImages, setNumImages] = useState(1);
  
  // 尺寸设置
  const [sizeMode, setSizeMode] = useState<'preset' | 'custom'>('preset');
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [customWidth, setCustomWidth] = useState(1024);
  const [customHeight, setCustomHeight] = useState(1024);
  
  // 生成状态
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);

  // 任务队列
  const [tasks, setTasks] = useState<ZImageTask[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);

  // API Key 设置
  const [showApiSettings, setShowApiSettings] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [apiKeySaving, setApiKeySaving] = useState(false);

  // 参考图片（支持多张）
  const [referenceImages, setReferenceImages] = useState<{ url: string; filename: string }[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 反推提示词
  const [reversePromptResult, setReversePromptResult] = useState('');
  const [isReversingPrompt, setIsReversingPrompt] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState('default');
  const [showPresetDropdown, setShowPresetDropdown] = useState(false);
  const [currentScript, setCurrentScript] = useState(DEFAULT_SCRIPTS['default']);
  const [presets, setPresets] = useState<{ id: string; name: string; icon: string; script?: string }[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0); // 当前选中的图片索引（用于反推）
  const [multiImageMode, setMultiImageMode] = useState(false); // 多图反推模式
  const [selectedImagesForReverse, setSelectedImagesForReverse] = useState<number[]>([]); // 多图反推选中的图片
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null); // 正在编辑名称的预设 ID
  const [editingPresetName, setEditingPresetName] = useState(''); // 编辑中的名称
  const [isLoadingPresets, setIsLoadingPresets] = useState(false);
  
  // AI 对话生成提示词
  const [showChatDialog, setShowChatDialog] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant' | 'summary'; content: string; images?: string[] }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatImages, setChatImages] = useState<{ url: string; filename: string }[]>([]);
  const [isChatUploading, setIsChatUploading] = useState(false);
  const chatFileInputRef = useRef<HTMLInputElement>(null);
  const [chatSessionId, setChatSessionId] = useState<string | null>(null);
  const [isCompressingContext, setIsCompressingContext] = useState(false);
  const [chatSessions, setChatSessions] = useState<{ id: string; title: string; updatedAt: string }[]>([]);
  const [showSessionList, setShowSessionList] = useState(false);
  const [selectedDisplayIndex, setSelectedDisplayIndex] = useState(0); // 展示区选中的图片索引
  
  // 移动端状态
  const isMobileHook = useIsMobile();
  const [mounted, setMounted] = useState(false);
  const [mobileTab, setMobileTab] = useState<'params' | 'result' | 'tasks'>('params');
  
  // 客户端挂载后才应用移动端样式，避免 hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);
  
  const isMobile = mounted ? isMobileHook : false;

  // 按 batch_id 分组任务
  const groupedTasks = useMemo(() => {
    const groups: GroupedZImageTask[] = [];
    const batchMap = new Map<string, ZImageTask[]>();

    tasks.forEach((task) => {
      if (task.batch_id) {
        const existing = batchMap.get(task.batch_id) || [];
        existing.push(task);
        batchMap.set(task.batch_id, existing);
      } else {
        // 没有 batch_id 的单独展示
        const images = task.result_images || [];
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
        if (t.status !== 'success') allSuccess = false;
        if (t.status === 'processing' || t.status === 'pending') anyProcessing = true;
      });

      const status = anyProcessing ? 'processing' : (allSuccess ? 'success' : 'failed');
      groups.push({
        id: batchId,
        batch_id: batchId,
        status: status as 'pending' | 'processing' | 'success' | 'failed',
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

  // 点击分组任务显示图片
  const handleGroupClick = (group: GroupedZImageTask) => {
    if (group.images.length > 0) {
      setGeneratedImages(group.images);
      setSelectedDisplayIndex(0);
    }
  };

  // 获取 API 配置
  const { zimageApiKey, setZimageApiKey, addUploadedImage } = useAppStore();

  // 加载任务列表
  const loadTasks = useCallback(async () => {
    setIsLoadingTasks(true);
    try {
      const result = await getZImageTasks(50);
      setTasks(result.tasks || []);
    } catch (err) {
      console.error('Failed to load Z-Image tasks:', err);
    } finally {
      setIsLoadingTasks(false);
    }
  }, []);

  // 从数据库加载预设脚本
  const loadPresets = useCallback(async () => {
    setIsLoadingPresets(true);
    try {
      const response = await api.get('/zimage-presets');
      if (response.data.success && response.data.presets && response.data.presets.length > 0) {
        const dbPresets = response.data.presets.map((p: any) => ({
          id: p.id,
          name: p.name,
          icon: p.icon,
          script: p.script,
        }));
        setPresets(dbPresets);
        // 更新当前脚本
        const current = dbPresets.find((p: any) => p.id === selectedPresetId);
        if (current) {
          setCurrentScript(current.script || '');
        }
      } else {
        // 数据库为空时使用默认预设
        const defaultPresets = DEFAULT_PRESETS.map(p => ({ ...p, script: DEFAULT_SCRIPTS[p.id] }));
        setPresets(defaultPresets);
      }
    } catch (err) {
      console.error('Failed to load presets from database:', err);
      // 加载失败时使用默认预设
      const defaultPresets = DEFAULT_PRESETS.map(p => ({ ...p, script: DEFAULT_SCRIPTS[p.id] }));
      setPresets(defaultPresets);
    } finally {
      setIsLoadingPresets(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 加载 API Key 和任务列表
  useEffect(() => {
    if (isOpen) {
      // 每次打开窗口时生成新的随机种子
      const newSeed = Math.floor(Math.random() * 2147483647);
      setRandomSeed(newSeed.toString());
      
      getSetting('zimage_api_key').then((res) => {
        if (res.value) {
          setApiKeyInput(res.value);
          setZimageApiKey(res.value);
        }
      });
      loadTasks();
      loadPresets(); // 从数据库加载预设
    }
  }, [isOpen, setZimageApiKey, loadTasks, loadPresets]);

  // 保存 API Key
  const handleSaveApiKey = async () => {
    setApiKeySaving(true);
    try {
      await saveSetting('zimage_api_key', apiKeyInput.trim());
      setZimageApiKey(apiKeyInput.trim());
      setShowApiSettings(false);
    } catch (err) {
      console.error('Save API Key error:', err);
    } finally {
      setApiKeySaving(false);
    }
  };

  // 保存单个预设到数据库
  const savePresetToDb = useCallback(async (preset: { id: string; name: string; icon: string; script?: string }, sortOrder?: number) => {
    try {
      await api.post('/zimage-presets', {
        id: preset.id,
        name: preset.name,
        icon: preset.icon,
        script: preset.script || '',
        sortOrder: sortOrder ?? 0,
      });
    } catch (e) {
      console.error('Failed to save preset to database:', e);
    }
  }, []);

  // 从数据库删除预设
  const deletePresetFromDb = useCallback(async (id: string) => {
    try {
      await api.delete(`/zimage-presets?id=${id}`);
    } catch (e) {
      console.error('Failed to delete preset from database:', e);
    }
  }, []);

  // 清空任务队列
  const handleClearTasks = async () => {
    if (confirm('确定要清空所有 Z-Image 任务吗？\n\n注意：此操作将删除所有历史记录和对应的图片文件。')) {
      try {
        await clearZImageTasks();
        setTasks([]);
      } catch (err) {
        console.error('Failed to clear tasks:', err);
      }
    }
  };

  // 删除单个任务或批次
  const handleDeleteTask = async (group: GroupedZImageTask, e: React.MouseEvent) => {
    e.stopPropagation(); // 阻止触发点击任务的事件
    
    try {
      if (group.batch_id) {
        // 删除整个批次
        await api.delete(`/zimage-tasks?batchId=${group.batch_id}`);
      } else {
        // 删除单个任务
        await api.delete(`/zimage-tasks?taskId=${group.id}`);
      }
      // 乐观更新本地状态
      if (group.batch_id) {
        setTasks(prev => prev.filter(t => t.batch_id !== group.batch_id));
      } else {
        setTasks(prev => prev.filter(t => t.id !== group.id));
      }
    } catch (err) {
      console.error('Failed to delete task:', err);
      setError('删除任务失败');
    }
  };

  // 点击任务显示图片
  const handleTaskClick = (task: ZImageTask) => {
    if (task.result_images && task.result_images.length > 0) {
      setGeneratedImages(task.result_images);
    }
  };

  // 上传参考图片（支持多张）
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setIsUploading(true);
    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        const result = await uploadImage(file);
        return { url: result.url, filename: result.filename || file.name };
      });
      const uploaded = await Promise.all(uploadPromises);
      setReferenceImages(prev => [...prev, ...uploaded]);
    } catch (error) {
      console.error('Upload failed:', error);
      setError('参考图片上传失败');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // 移除指定参考图片
  const handleRemoveReferenceImage = (index: number) => {
    setReferenceImages(prev => prev.filter((_, i) => i !== index));
    if (selectedImageIndex >= index && selectedImageIndex > 0) {
      setSelectedImageIndex(selectedImageIndex - 1);
    }
  };

  // 清空所有参考图片
  const handleClearAllImages = () => {
    setReferenceImages([]);
    setSelectedImageIndex(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 拖拽上传处理
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
      if (imageFiles.length === 0) {
        setError('请上传图片文件');
        return;
      }
      
      setIsUploading(true);
      try {
        const uploadPromises = imageFiles.map(async (file) => {
          const result = await uploadImage(file);
          return { url: result.url, filename: result.filename || file.name };
        });
        const uploaded = await Promise.all(uploadPromises);
        setReferenceImages(prev => [...prev, ...uploaded]);
      } catch (error) {
        console.error('Upload failed:', error);
        setError('参考图片上传失败');
      } finally {
        setIsUploading(false);
      }
    }
  };

  // 反推提示词（支持多图）
  const handleReversePrompt = async () => {
    if (referenceImages.length === 0) {
      setError('请先上传参考图片');
      return;
    }

    if (!zimageApiKey) {
      setError('请先配置 API Key');
      setShowApiSettings(true);
      return;
    }

    setIsReversingPrompt(true);
    setError('');

    try {
      let imageUrls: string[];

      if (multiImageMode && selectedImagesForReverse.length > 0) {
        // 多图模式
        imageUrls = selectedImagesForReverse.map(idx => referenceImages[idx]?.url).filter(Boolean);
      } else {
        // 单图模式
        const currentImage = referenceImages[selectedImageIndex] || referenceImages[0];
        imageUrls = [currentImage.url];
      }

      const response = await api.post('/reverse-prompt', {
        imageUrls: imageUrls,
        preset: selectedPresetId,
        customPrompt: currentScript,  // 始终使用预设脚本
      });

      if (response.data.success) {
        setReversePromptResult(response.data.prompt);
      } else {
        setError(response.data.error || '反推失败');
      }
    } catch (err) {
      console.error('Reverse prompt error:', err);
      setError('反推提示词失败');
    } finally {
      setIsReversingPrompt(false);
    }
  };

  // AI 对话生成提示词
  const handleChatSend = async () => {
    if (!chatInput.trim() && chatImages.length === 0) return;
    if (!zimageApiKey) {
      setError('请先配置 API Key');
      setShowApiSettings(true);
      return;
    }

    const userMessage = chatInput.trim();
    const userImages = chatImages.map(img => img.url);
    setChatInput('');
    setChatImages([]);
    
    // 如果没有会话，先创建一个
    let sessionId = chatSessionId;
    if (!sessionId) {
      try {
        const createRes = await api.post('/chat-sessions', { action: 'create', title: userMessage.slice(0, 50) || 'AI 对话' });
        if (createRes.data.success) {
          sessionId = createRes.data.sessionId;
          setChatSessionId(sessionId);
        }
      } catch (e) {
        console.error('Failed to create session:', e);
      }
    }
    
    // 添加用户消息（包含图片）
    const newUserMessage = { 
      role: 'user' as const, 
      content: userMessage || '（已上传图片）', 
      images: userImages.length > 0 ? userImages : undefined 
    };
    setChatMessages(prev => [...prev, newUserMessage]);
    setIsChatLoading(true);

    // 保存用户消息到数据库
    if (sessionId) {
      try {
        await api.post('/chat-sessions', {
          action: 'addMessage',
          sessionId,
          message: newUserMessage,
        });
      } catch (e) {
        console.error('Failed to save user message:', e);
      }
    }

    try {
      // 构建消息列表（包含摘要）
      const messagesForApi = chatMessages
        .filter(m => m.role !== 'summary')
        .concat([{ 
          role: 'user' as const, 
          content: userMessage || '请描述这张图片并生成提示词',
          images: userImages.length > 0 ? userImages : undefined
        }]);
      
      // 如果有摘要，在最前面添加
      const summary = chatMessages.find(m => m.role === 'summary');
      if (summary) {
        messagesForApi.unshift({ role: 'user' as const, content: `[之前的对话摘要] ${summary.content}` });
      }

      const response = await api.post('/chat-prompt', {
        messages: messagesForApi,
        systemPrompt: currentScript,
        imageUrls: userImages,
      });

      if (response.data.success) {
        const assistantMessage = { role: 'assistant' as const, content: response.data.reply };
        setChatMessages(prev => [...prev, assistantMessage]);
        
        // 保存 AI 回复到数据库
        if (sessionId) {
          try {
            const saveRes = await api.post('/chat-sessions', {
              action: 'addMessage',
              sessionId,
              message: assistantMessage,
            });
            
            // 检查是否需要压缩上下文
            if (saveRes.data.needsCompression) {
              await compressContext(sessionId);
            }
          } catch (e) {
            console.error('Failed to save assistant message:', e);
          }
        }
      } else {
        setError(response.data.error || '对话失败');
      }
    } catch (err) {
      console.error('Chat error:', err);
      setError('AI 对话失败');
    } finally {
      setIsChatLoading(false);
    }
  };

  // 压缩上下文
  const compressContext = async (sessionId: string) => {
    setIsCompressingContext(true);
    try {
      // 获取需要总结的消息
      const messagesToSummarize = chatMessages.filter(m => m.role !== 'summary').slice(0, -6);
      
      if (messagesToSummarize.length === 0) return;
      
      // 调用总结 API
      const summaryRes = await api.post('/chat-summarize', {
        messages: messagesToSummarize,
      });
      
      if (summaryRes.data.success) {
        // 压缩数据库中的消息
        await api.put('/chat-sessions', {
          sessionId,
          summary: summaryRes.data.summary,
        });
        
        // 更新本地消息（保留最近 6 条 + 摘要）
        const recentMessages = chatMessages.slice(-6);
        setChatMessages([
          { role: 'summary', content: summaryRes.data.summary },
          ...recentMessages,
        ]);
      }
    } catch (e) {
      console.error('Failed to compress context:', e);
    } finally {
      setIsCompressingContext(false);
    }
  };

  // 加载会话列表
  const loadChatSessions = async () => {
    try {
      const res = await api.get('/chat-sessions');
      if (res.data.success) {
        setChatSessions(res.data.sessions || []);
      }
    } catch (e) {
      console.error('Failed to load sessions:', e);
    }
  };

  // 加载指定会话
  const loadChatSession = async (sessionId: string) => {
    try {
      const res = await api.get(`/chat-sessions?sessionId=${sessionId}`);
      if (res.data.success) {
        setChatSessionId(sessionId);
        const messages = res.data.messages.map((m: any) => ({
          role: m.role,
          content: m.content,
          images: m.images,
        }));
        setChatMessages(messages);
        setShowSessionList(false);
      }
    } catch (e) {
      console.error('Failed to load session:', e);
    }
  };

  // 新建对话
  const startNewChat = () => {
    setChatSessionId(null);
    setChatMessages([]);
    setShowSessionList(false);
  };

  // 对话窗口上传图片
  const handleChatImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setIsChatUploading(true);
    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        const result = await uploadImage(file);
        return { url: result.url, filename: result.filename || file.name };
      });
      const uploaded = await Promise.all(uploadPromises);
      setChatImages(prev => [...prev, ...uploaded]);
    } catch (error) {
      console.error('Upload failed:', error);
      setError('图片上传失败');
    } finally {
      setIsChatUploading(false);
      if (chatFileInputRef.current) {
        chatFileInputRef.current.value = '';
      }
    }
  };

  // 移除对话图片
  const removeChatImage = (index: number) => {
    setChatImages(prev => prev.filter((_, i) => i !== index));
  };

  // 应用对话结果到提示词
  const applyChatResult = (content: string) => {
    const truncated = content.slice(0, 800);
    setPrompt(truncated);
    setShowChatDialog(false);
    if (content.length > 800) {
      setError(`提示词已截断到 800 字符`);
    }
  };

  // 清空对话
  const clearChat = async () => {
    if (chatSessionId) {
      try {
        await api.delete(`/chat-sessions?sessionId=${chatSessionId}`);
      } catch (e) {
        console.error('Failed to delete session:', e);
      }
    }
    setChatSessionId(null);
    setChatMessages([]);
  };

  // 将反推结果应用到提示词（截断到 800 字符）
  const applyReversePrompt = () => {
    if (reversePromptResult) {
      const truncated = reversePromptResult.slice(0, 800);
      setPrompt(truncated);
      if (reversePromptResult.length > 800) {
        setError(`提示词已截断到 800 字符（原长 ${reversePromptResult.length} 字符）`);
      }
    }
  };

  if (!isOpen) return null;

  // 生成图片
  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('请输入正向提示词');
      return;
    }

    if (!zimageApiKey) {
      setError('请先点击右上角设置按钮配置 API Key');
      setShowApiSettings(true);
      return;
    }

    setIsGenerating(true);
    setError('');
    setGeneratedImages([]);
    setSelectedImageIndex(0);

    try {
      const width = sizeMode === 'preset' ? PRESET_SIZES[selectedPreset].width : customWidth;
      const height = sizeMode === 'preset' ? PRESET_SIZES[selectedPreset].height : customHeight;

      // numImages 表示请求次数，每次生成 1 张图
      const taskIds: string[] = [];
      // 为同一批次的任务生成 batchId
      const batchId = numImages > 1 ? `zimage_${Date.now()}` : undefined;
      
      for (let i = 0; i < numImages; i++) {
        const response = await api.post('/generate', {
          prompt: prompt,
          model: 'z-image-turbo',
          width: width,
          height: height,
          samplerMethod: samplerMethod,
          samplingSteps: samplingSteps,
          seed: randomSeed === '-1' ? undefined : parseInt(randomSeed) + i, // 每次用不同的种子
          numImages: 1, // 每次只生成 1 张
          imageUrls: referenceImages.map(img => img.url),
          batchId: batchId, // 批次 ID
        });

        if (response.data.taskId) {
          taskIds.push(response.data.taskId);
        }
      }

      if (taskIds.length > 0) {
        setCurrentTaskId(taskIds[0]); // 显示第一个任务 ID
        // 轮询所有任务的结果
        pollForMultipleResults(taskIds);
      } else {
        setError('生成失败');
        setIsGenerating(false);
      }
    } catch (err) {
      setError('请求失败，请重试');
      setIsGenerating(false);
    }
  };

  // 轮询多个任务的结果
  const pollForMultipleResults = async (taskIds: string[]) => {
    const maxAttempts = 120;
    let attempts = 0;
    const collectedImages: string[] = [];
    const completedTasks = new Set<string>();

    const poll = async () => {
      try {
        for (const taskId of taskIds) {
          if (completedTasks.has(taskId)) continue;
          
          const data = await getTask(taskId);

          if (data.status === 'success' && data.result_images) {
            const images = JSON.parse(data.result_images);
            collectedImages.push(...images);
            completedTasks.add(taskId);
            // 实时更新已生成的图片
            setGeneratedImages([...collectedImages]);
          } else if (data.status === 'failed') {
            completedTasks.add(taskId);
          }
        }

        // 检查是否所有任务都完成
        if (completedTasks.size === taskIds.length) {
          setIsGenerating(false);
          setCurrentTaskId(null);
          loadTasks();
          if (collectedImages.length === 0) {
            setError('所有生成任务失败');
          }
        } else if (attempts < maxAttempts) {
          attempts++;
          setTimeout(poll, 2000);
        } else {
          setError('生成超时，请重试');
          setIsGenerating(false);
          setCurrentTaskId(null);
        }
      } catch {
        setError('获取结果失败');
        setIsGenerating(false);
        setCurrentTaskId(null);
      }
    };

    poll();
  };

  // 随机种子刷新 - 生成新的随机数
  const refreshSeed = () => {
    const newSeed = Math.floor(Math.random() * 2147483647);
    setRandomSeed(newSeed.toString());
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-0 md:p-4">
      <div className="bg-zinc-900 rounded-none md:rounded-xl w-full max-w-7xl h-full md:h-[90vh] flex flex-col">
        {/* 顶部标题栏 */}
        <div className="flex items-center justify-between px-3 md:px-6 py-3 md:py-4 border-b border-zinc-800">
          <div className="flex items-center gap-2 md:gap-3">
            <Zap size={isMobile ? 18 : 24} className="text-purple-400" />
            <h2 className="text-base md:text-xl font-bold">Z-Image</h2>
            <span className="px-1.5 md:px-2 py-0.5 text-[10px] md:text-xs bg-purple-600 text-white rounded hidden sm:inline">专业生图</span>
          </div>
          <div className="flex items-center gap-1.5 md:gap-2">
            {/* API 设置按钮 */}
            <button
              onClick={() => setShowApiSettings(!showApiSettings)}
              className={`flex items-center gap-1 md:gap-1.5 px-2 md:px-3 py-1 md:py-1.5 rounded-lg text-xs md:text-sm transition-colors ${
                zimageApiKey
                  ? 'bg-green-600/20 text-green-400 hover:bg-green-600/30'
                  : 'bg-yellow-600/20 text-yellow-400 hover:bg-yellow-600/30'
              }`}
            >
              <Settings size={isMobile ? 12 : 14} />
              <span className="hidden sm:inline">{zimageApiKey ? 'API 已配置' : '配置 API'}</span>
            </button>
            <button onClick={onClose} className="text-zinc-400 hover:text-white p-1">
              <X size={isMobile ? 20 : 24} />
            </button>
          </div>
        </div>

        {/* API Key 设置面板 */}
        {showApiSettings && (
          <div className="px-6 py-3 bg-zinc-800 border-b border-zinc-700">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="text-xs text-zinc-400 mb-1 block">DashScope API Key (阿里云百炼)</label>
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="输入 DashScope API Key..."
                  className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-sm focus:outline-none focus:border-purple-500"
                />
              </div>
              <button
                onClick={handleSaveApiKey}
                disabled={apiKeySaving}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-700 rounded-lg text-sm font-medium flex items-center gap-1.5 mt-5"
              >
                <Check size={14} />
                {apiKeySaving ? '保存中...' : '保存'}
              </button>
            </div>
            <p className="text-xs text-zinc-500 mt-1">
              获取地址: <a href="https://dashscope.console.aliyun.com/apiKey" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">DashScope 控制台</a>
            </p>
          </div>
        )}

        {/* 移动端选项卡导航 */}
        {isMobile && (
          <div className="flex border-b border-zinc-800 bg-zinc-950">
            <button
              onClick={() => setMobileTab('params')}
              className={`flex-1 py-2.5 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                mobileTab === 'params'
                  ? 'text-purple-400 border-b-2 border-purple-400 bg-zinc-900'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Sliders size={14} />
              参数设置
            </button>
            <button
              onClick={() => setMobileTab('result')}
              className={`flex-1 py-2.5 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                mobileTab === 'result'
                  ? 'text-purple-400 border-b-2 border-purple-400 bg-zinc-900'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <ImageIcon size={14} />
              生成结果
              {isGenerating && <span className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />}
            </button>
            <button
              onClick={() => setMobileTab('tasks')}
              className={`flex-1 py-2.5 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                mobileTab === 'tasks'
                  ? 'text-purple-400 border-b-2 border-purple-400 bg-zinc-900'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <List size={14} />
              任务列表
              {groupedTasks.length > 0 && (
                <span className="bg-purple-600 text-white text-[10px] px-1.5 rounded-full">{groupedTasks.length}</span>
              )}
            </button>
          </div>
        )}

        {/* 主体内容区 - 三栏布局（PC）/ 单栏切换（移动端） */}
        <div className="flex-1 flex overflow-hidden">
          {/* 左侧任务队列 - PC显示，移动端通过选项卡显示 */}
          <div className={`${isMobile ? (mobileTab === 'tasks' ? 'flex w-full' : 'hidden') : 'w-64'} border-r border-zinc-800 flex-col bg-zinc-950 ${!isMobile ? 'flex' : ''}`}>
            <div className="p-3 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Clock size={14} className="text-purple-400" />
                TASK QUEUE
              </h3>
              {tasks.length > 0 && (
                <button
                  onClick={handleClearTasks}
                  className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
                >
                  <Trash2 size={12} />
                  清空
                </button>
              )}
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {isLoadingTasks ? (
                <div className="text-center text-zinc-600 py-8 text-xs">加载中...</div>
              ) : groupedTasks.length === 0 ? (
                <div className="text-center text-zinc-600 py-8 text-xs">暂无任务</div>
              ) : (
                groupedTasks.map((group) => (
                  <div
                    key={group.id}
                    onClick={() => handleGroupClick(group)}
                    className="bg-zinc-900 rounded-lg p-2 cursor-pointer hover:bg-zinc-800 transition-colors relative group/task"
                  >
                    {/* 删除按钮 */}
                    <button
                      onClick={(e) => handleDeleteTask(group, e)}
                      className="absolute top-1 right-1 p-1 bg-red-600/80 hover:bg-red-500 rounded opacity-0 group-hover/task:opacity-100 transition-opacity z-10"
                      title="删除此任务"
                    >
                      <X size={10} className="text-white" />
                    </button>
                    <div className="flex items-start gap-2">
                      {/* 缩略图 - 叠放效果 */}
                      {group.images.length > 0 ? (
                        <div className="relative w-14 h-14 flex-shrink-0">
                          {/* 层叠效果：显示最多3张图片层叠，带偏移和旋转 */}
                          {group.images.slice(0, 3).map((img, idx, arr) => {
                            const total = Math.min(arr.length, 3);
                            const reverseIdx = total - 1 - idx;
                            const offset = reverseIdx * 5;
                            const rotation = (reverseIdx - 1) * 6;
                            return (
                              <div
                                key={idx}
                                className="absolute w-10 h-10 rounded overflow-hidden border-2 border-zinc-700 shadow-lg"
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
                                  sizes="40px"
                                  className="object-cover"
                                />
                              </div>
                            );
                          })}
                          {/* 数量角标 - 多图时显示 */}
                          {group.count > 1 && (
                            <div className="absolute -bottom-1 -left-1 bg-yellow-500 text-black text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center z-10 shadow">
                              {group.count}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="w-14 h-14 bg-zinc-800 rounded flex items-center justify-center flex-shrink-0">
                          {group.status === 'processing' || group.status === 'pending' ? (
                            <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <X size={16} className="text-red-400" />
                          )}
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        {/* 状态标签 */}
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                            group.status === 'success'
                              ? 'bg-green-900 text-green-300'
                              : group.status === 'failed'
                              ? 'bg-red-900 text-red-300'
                              : 'bg-purple-900 text-purple-300'
                          }`}
                        >
                          {group.status === 'success'
                            ? 'SUCCESS'
                            : group.status === 'failed'
                            ? 'FAILED'
                            : 'PROCESSING'}
                        </span>
                        
                        {/* 提示词 */}
                        <div className="text-[10px] text-zinc-400 line-clamp-2 mt-1">
                          {group.prompt}
                        </div>
                        
                        {/* 时间 */}
                        <div className="text-[9px] text-zinc-600 mt-0.5">
                          {new Date(group.created_at).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 中间参数区 - PC显示，移动端通过选项卡显示 */}
          <div className={`${isMobile ? (mobileTab === 'params' ? 'flex w-full' : 'hidden') : 'flex-1'} p-3 md:p-4 flex-col overflow-y-auto ${!isMobile ? 'flex' : ''}`}>
            {/* 反推提示词 + 参考图片上传 */}
            <div className="mb-3 p-3 bg-zinc-800/50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Wand2 size={14} className="text-purple-400" />
                  <span className="text-sm font-medium text-purple-400">反推提示词</span>
                  {/* 多图模式切换 */}
                  {referenceImages.length > 1 && (
                    <button
                      onClick={() => {
                        setMultiImageMode(!multiImageMode);
                        if (!multiImageMode) {
                          setSelectedImagesForReverse([]);
                        }
                      }}
                      className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                        multiImageMode
                          ? 'bg-purple-600 text-white'
                          : 'bg-zinc-700 text-zinc-400 hover:bg-zinc-600'
                      }`}
                    >
                      多图模式
                    </button>
                  )}
                </div>
                {/* AI 对话按钮 */}
                <button
                  onClick={() => setShowChatDialog(true)}
                  className="flex items-center gap-1 px-2 py-1 bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 rounded text-[10px] transition-colors"
                >
                  <MessageCircle size={12} />
                  AI 对话
                </button>
              </div>
              
              {/* 多图模式提示 */}
              {multiImageMode && referenceImages.length > 1 && (
                <div className="mb-2 p-2 bg-purple-900/30 rounded text-[10px] text-purple-300">
                  点击图片选择用于反推的图片（已选 {selectedImagesForReverse.length} 张），在上方脚本中编辑需求
                </div>
              )}
              
              <div className="flex gap-3">
                {/* 左侧：反推功能区 */}
                <div className="flex-1 space-y-2">
                  {/* 预设脚本选择 */}
                  <div className="relative">
                    <label className="text-[10px] text-zinc-400 mb-0.5 block">预设脚本</label>
                    <button
                      onClick={() => setShowPresetDropdown(!showPresetDropdown)}
                      className="w-full flex items-center justify-between px-2 py-1.5 bg-zinc-700 border border-zinc-600 rounded text-xs"
                    >
                      <span className="flex items-center gap-1">
                        <span>{presets.find(p => p.id === selectedPresetId)?.icon || '📝'}</span>
                        <span>{presets.find(p => p.id === selectedPresetId)?.name || '通用描述'}</span>
                      </span>
                      <ChevronDown size={12} className={showPresetDropdown ? 'rotate-180' : ''} />
                    </button>
                    {showPresetDropdown && (
                      <>
                        {/* 点击外部关闭 */}
                        <div 
                          className="fixed inset-0 z-[5]" 
                          onClick={() => setShowPresetDropdown(false)}
                        />
                        <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-700 border border-zinc-600 rounded overflow-hidden z-10 max-h-60 overflow-y-auto">
                        {isLoadingPresets ? (
                          <div className="px-2 py-3 text-center text-zinc-400 text-xs">
                            <Loader2 size={14} className="animate-spin mx-auto mb-1" />
                            加载中...
                          </div>
                        ) : presets.length === 0 ? (
                          <div className="px-2 py-3 text-center text-zinc-500 text-xs">暂无预设</div>
                        ) : (
                          presets.map((preset) => (
                          <div
                            key={preset.id}
                            className={`flex items-center justify-between px-2 py-1.5 text-xs hover:bg-zinc-600 ${selectedPresetId === preset.id ? 'text-purple-400 bg-zinc-600/50' : ''}`}
                          >
                            {editingPresetId === preset.id ? (
                              // 编辑模式
                              <div className="flex-1 flex items-center gap-1">
                                <span>{preset.icon}</span>
                                <input
                                  type="text"
                                  value={editingPresetName}
                                  onChange={(e) => setEditingPresetName(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      const updatedPreset = { ...preset, name: editingPresetName };
                                      const newPresets = presets.map(p => 
                                        p.id === preset.id ? updatedPreset : p
                                      );
                                      setPresets(newPresets);
                                      savePresetToDb(updatedPreset, newPresets.findIndex(p => p.id === preset.id));
                                      setEditingPresetId(null);
                                    } else if (e.key === 'Escape') {
                                      setEditingPresetId(null);
                                    }
                                  }}
                                  onBlur={() => {
                                    if (editingPresetName.trim()) {
                                      const updatedPreset = { ...preset, name: editingPresetName };
                                      const newPresets = presets.map(p => 
                                        p.id === preset.id ? updatedPreset : p
                                      );
                                      setPresets(newPresets);
                                      savePresetToDb(updatedPreset, newPresets.findIndex(p => p.id === preset.id));
                                    }
                                    setEditingPresetId(null);
                                  }}
                                  className="flex-1 px-1 py-0.5 bg-zinc-800 border border-purple-500 rounded text-[10px] focus:outline-none"
                                  autoFocus
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                            ) : (
                              // 显示模式
                              <>
                                <button
                                  onClick={() => { 
                                    setSelectedPresetId(preset.id); 
                                    setCurrentScript(preset.script || '');
                                    setShowPresetDropdown(false); 
                                  }}
                                  className="flex-1 text-left flex items-center gap-1"
                                >
                                  <span>{preset.icon}</span>
                                  <span>{preset.name}</span>
                                </button>
                                <div className="flex items-center gap-0.5">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingPresetId(preset.id);
                                      setEditingPresetName(preset.name);
                                    }}
                                    className="p-0.5 hover:bg-blue-500/50 rounded"
                                    title="编辑名称"
                                  >
                                    <Edit2 size={10} />
                                  </button>
                                  {presets.length > 1 && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const newPresets = presets.filter(p => p.id !== preset.id);
                                        setPresets(newPresets);
                                        deletePresetFromDb(preset.id);
                                        if (selectedPresetId === preset.id && newPresets.length > 0) {
                                          setSelectedPresetId(newPresets[0].id);
                                          setCurrentScript(newPresets[0].script || '');
                                        }
                                      }}
                                      className="p-0.5 hover:bg-red-500/50 rounded"
                                      title="删除模板"
                                    >
                                      <Trash2 size={10} />
                                    </button>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        ))
                        )}
                        {/* 新增预设按钮 */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const newId = `custom_${Date.now()}`;
                            const newPreset = { id: newId, name: '新预设', icon: '✨', script: '' };
                            const newPresets = [...presets, newPreset];
                            setPresets(newPresets);
                            setSelectedPresetId(newId);
                            setCurrentScript('');
                            setEditingPresetId(newId);
                            setEditingPresetName('新预设');
                            savePresetToDb(newPreset, newPresets.length - 1);
                          }}
                          className="w-full px-2 py-1.5 text-xs text-green-400 hover:bg-zinc-600 flex items-center gap-1 border-t border-zinc-600"
                        >
                          <Plus size={12} />
                          新增预设脚本
                        </button>
                      </div>
                      </>
                    )}
                  </div>
                  
                  {/* 脚本内容编辑框（始终显示） */}
                  <div>
                    <label className="text-[10px] text-zinc-400 mb-0.5 block">脚本内容（可编辑）</label>
                    <textarea
                      value={currentScript}
                      onChange={(e) => {
                        const newValue = e.target.value;
                        setCurrentScript(newValue);
                        // 更新 presets 中的脚本
                        const newPresets = presets.map(p => 
                          p.id === selectedPresetId ? { ...p, script: newValue } : p
                        );
                        setPresets(newPresets);
                      }}
                      onBlur={() => {
                        // 失去焦点时保存到数据库
                        const currentPreset = presets.find(p => p.id === selectedPresetId);
                        if (currentPreset) {
                          savePresetToDb({ ...currentPreset, script: currentScript }, presets.findIndex(p => p.id === selectedPresetId));
                        }
                      }}
                      placeholder="输入提示词脚本..."
                      className="w-full h-20 bg-zinc-700 border border-zinc-600 rounded px-2 py-1.5 text-[11px] resize-none focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  
                  {/* 反推按钮 */}
                  <button
                    onClick={handleReversePrompt}
                    disabled={isReversingPrompt || referenceImages.length === 0}
                    className={`w-full py-2 rounded text-xs font-medium flex items-center justify-center gap-1 transition-colors ${
                      isReversingPrompt || referenceImages.length === 0
                        ? 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
                        : 'bg-purple-600 hover:bg-purple-500 text-white'
                    }`}
                  >
                    {isReversingPrompt ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        反推中...
                      </>
                    ) : (
                      <>
                        <Wand2 size={14} />
                        反推提示词
                      </>
                    )}
                  </button>
                  
                  {/* 反推结果文本框 */}
                  {reversePromptResult && (
                    <div className="space-y-1">
                      <textarea
                        value={reversePromptResult}
                        onChange={(e) => setReversePromptResult(e.target.value)}
                        className="w-full h-20 bg-zinc-700 border border-zinc-600 rounded px-2 py-1.5 text-[11px] resize-none focus:outline-none focus:border-purple-500"
                        placeholder="反推结果将显示在这里..."
                      />
                      <button
                        onClick={applyReversePrompt}
                        className="w-full py-1.5 bg-green-600 hover:bg-green-500 rounded text-[10px] font-medium text-white flex items-center justify-center gap-1"
                      >
                        <Check size={12} />
                        应用到提示词
                      </button>
                    </div>
                  )}
                </div>
                
                {/* 右侧：图片上传区（支持多张） */}
                <div className="flex flex-col">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] text-zinc-400">参考图片 ({referenceImages.length})</label>
                    {referenceImages.length > 0 && (
                      <button
                        onClick={handleClearAllImages}
                        className="text-[9px] text-red-400 hover:text-red-300"
                      >
                        清空全部
                      </button>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <div className="flex flex-wrap gap-1">
                    {/* 已上传的图片 */}
                    {referenceImages.map((img, index) => (
                      <div
                        key={index}
                        className={`relative w-14 h-14 rounded overflow-hidden border cursor-pointer ${
                          multiImageMode
                            ? selectedImagesForReverse.includes(index)
                              ? 'border-purple-500 ring-2 ring-purple-500'
                              : 'border-zinc-700'
                            : selectedImageIndex === index
                              ? 'border-purple-500 ring-1 ring-purple-500'
                              : 'border-zinc-700'
                        }`}
                        onClick={() => {
                          if (multiImageMode) {
                            // 多图模式：切换选中状态
                            setSelectedImagesForReverse(prev =>
                              prev.includes(index)
                                ? prev.filter(i => i !== index)
                                : [...prev, index]
                            );
                          } else {
                            // 单图模式
                            setSelectedImageIndex(index);
                          }
                        }}
                      >
                        <Image
                          src={img.url}
                          alt={`Reference ${index + 1}`}
                          fill
                          sizes="56px"
                          className="object-cover"
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveReferenceImage(index);
                          }}
                          className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-400"
                        >
                          <X size={8} />
                        </button>
                        {/* 单图模式标记 */}
                        {!multiImageMode && selectedImageIndex === index && (
                          <div className="absolute bottom-0 left-0 right-0 bg-purple-500/80 text-[8px] text-center">
                            反推用
                          </div>
                        )}
                        {/* 多图模式序号 */}
                        {multiImageMode && selectedImagesForReverse.includes(index) && (
                          <div className="absolute top-0 left-0 w-4 h-4 bg-purple-500 text-[8px] text-center flex items-center justify-center">
                            {selectedImagesForReverse.indexOf(index) + 1}
                          </div>
                        )}
                      </div>
                    ))}
                    {/* 添加按钮 */}
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      className={`w-14 h-14 border-2 border-dashed rounded flex flex-col items-center justify-center cursor-pointer transition-colors ${
                        isDragging
                          ? 'border-purple-500 bg-purple-500/20'
                          : 'border-zinc-700 hover:border-purple-500 hover:bg-zinc-800/50'
                      } ${isUploading ? 'pointer-events-none' : ''}`}
                    >
                      {isUploading ? (
                        <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <Upload size={14} className="text-zinc-500" />
                          <span className="text-[8px] text-zinc-500">添加</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 正向提示词 */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium text-purple-400">正向提示词 Prompt</label>
                <span className="text-xs text-zinc-500">{prompt.length} / 800</span>
              </div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value.slice(0, 800))}
                placeholder="请输入正向提示词，描述你想生成的图像内容..."
                className="w-full h-24 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-purple-500"
              />
            </div>

            {/* 基本参数 */}
            <div className="mb-3 p-3 bg-zinc-800/50 rounded-lg">
              <h3 className="text-xs font-semibold mb-2 flex items-center gap-1">
                <span className="w-4 h-4 bg-purple-600 rounded flex items-center justify-center text-[10px]">⚙</span>
                基本参数
              </h3>

              <div className="grid grid-cols-2 gap-3">
                {/* 采样方法 */}
                <div className="relative">
                  <label className="text-[10px] text-zinc-400 mb-0.5 block">采样方法</label>
                  <button
                    onClick={() => setSamplerOpen(!samplerOpen)}
                    className="w-full flex items-center justify-between px-2 py-1.5 bg-zinc-700 border border-zinc-600 rounded text-xs"
                  >
                    {samplerMethod}
                    <ChevronDown size={12} className={samplerOpen ? 'rotate-180' : ''} />
                  </button>
                  {samplerOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-700 border border-zinc-600 rounded overflow-hidden z-10">
                      {SAMPLER_METHODS.map((method) => (
                        <button
                          key={method}
                          onClick={() => { setSamplerMethod(method); setSamplerOpen(false); }}
                          className={`w-full px-2 py-1.5 text-left text-xs hover:bg-zinc-600 ${samplerMethod === method ? 'text-purple-400' : ''}`}
                        >
                          {method}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* 随机种子 */}
                <div>
                  <label className="text-[10px] text-zinc-400 mb-0.5 block">随机种子</label>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={randomSeed}
                      onChange={(e) => setRandomSeed(e.target.value)}
                      className="flex-1 px-2 py-1.5 bg-zinc-700 border border-zinc-600 rounded text-xs focus:outline-none focus:border-purple-500"
                    />
                    <button onClick={refreshSeed} className="px-2 py-1.5 bg-zinc-700 border border-zinc-600 rounded hover:bg-zinc-600">
                      <RefreshCw size={12} />
                    </button>
                  </div>
                </div>

                {/* 采样步数 */}
                <div>
                  <label className="text-[10px] text-zinc-400 mb-0.5 block">采样步数: {samplingSteps}</label>
                  <input
                    type="range"
                    min="1"
                    max="30"
                    value={samplingSteps}
                    onChange={(e) => setSamplingSteps(parseInt(e.target.value))}
                    className="w-full accent-purple-500 h-1"
                  />
                </div>

                {/* 生成数量 */}
                <div>
                  <label className="text-[10px] text-zinc-400 mb-0.5 block">生成数量</label>
                  <div className="flex gap-1">
                    {[1, 2, 4].map((n) => (
                      <button
                        key={n}
                        onClick={() => setNumImages(n)}
                        className={`flex-1 py-1 rounded text-xs font-medium transition-colors ${
                          numImages === n ? 'bg-purple-600 text-white' : 'bg-zinc-700 text-zinc-400 hover:bg-zinc-600'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 图片尺寸 */}
            <div className="mb-3 p-3 bg-zinc-800/50 rounded-lg flex-1">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold">图片尺寸</h3>
                <div className="flex gap-1">
                  <button
                    onClick={() => setSizeMode('preset')}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                      sizeMode === 'preset' ? 'bg-purple-600 text-white' : 'bg-zinc-700 text-zinc-400 hover:bg-zinc-600'
                    }`}
                  >
                    预置
                  </button>
                  <button
                    onClick={() => setSizeMode('custom')}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                      sizeMode === 'custom' ? 'bg-purple-600 text-white' : 'bg-zinc-700 text-zinc-400 hover:bg-zinc-600'
                    }`}
                  >
                    自定义
                  </button>
                </div>
              </div>

              {sizeMode === 'preset' ? (
                <div className="grid grid-cols-3 gap-1.5">
                  {PRESET_SIZES.map((size, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedPreset(idx)}
                      className={`p-2 rounded border text-center transition-colors ${
                        selectedPreset === idx
                          ? 'border-purple-500 bg-purple-500/20 text-purple-300'
                          : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600'
                      }`}
                    >
                      <div className="text-xs font-medium">{size.ratio}</div>
                      <div className="text-[9px] text-zinc-500">{size.width}×{size.height}</div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs text-zinc-400">宽度</label>
                      <span className="text-xs text-purple-400">{customWidth}</span>
                    </div>
                    <input
                      type="range"
                      min="512"
                      max="2048"
                      step="64"
                      value={customWidth}
                      onChange={(e) => setCustomWidth(parseInt(e.target.value))}
                      className="w-full accent-purple-500"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs text-zinc-400">高度</label>
                      <span className="text-xs text-purple-400">{customHeight}</span>
                    </div>
                    <input
                      type="range"
                      min="512"
                      max="2048"
                      step="64"
                      value={customHeight}
                      onChange={(e) => setCustomHeight(parseInt(e.target.value))}
                      className="w-full accent-purple-500"
                    />
                  </div>
                  <div className="text-center text-xs text-zinc-500">
                    当前尺寸: {customWidth} × {customHeight}
                  </div>
                </div>
              )}
            </div>

            {/* 生成按钮 */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className={`w-full py-3 rounded-lg text-base font-bold transition-all ${
                isGenerating
                  ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white'
              }`}
            >
              {isGenerating ? '生成中...' : '开始生图'}
            </button>

            {error && (
              <div className="mt-2 p-2 bg-red-900/50 border border-red-700 rounded text-red-300 text-xs">
                {error}
              </div>
            )}
          </div>

          {/* 右侧图片展示区 - PC显示，移动端通过选项卡显示 */}
          <div className={`${isMobile ? (mobileTab === 'result' ? 'flex w-full' : 'hidden') : 'w-96'} p-3 md:p-4 flex-col border-l border-zinc-800 ${!isMobile ? 'flex' : ''}`}>
            <h3 className="text-sm font-semibold mb-3 md:mb-4 flex items-center gap-2">
              <ImageIcon size={16} className="text-purple-400" />
              生成图片
              {generatedImages.length > 1 && (
                <span className="text-xs text-zinc-500">
                  {selectedDisplayIndex + 1}/{generatedImages.length}
                </span>
              )}
            </h3>

            <div className="flex-1 flex flex-col overflow-hidden">
              {isGenerating ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-zinc-400">正在生成图片...</p>
                  </div>
                </div>
              ) : generatedImages.length > 0 ? (
                <>
                  {/* 主图展示区 */}
                  <div className="flex-1 relative rounded-lg overflow-hidden bg-zinc-800">
                    <Image 
                      src={generatedImages[selectedDisplayIndex] || generatedImages[0]} 
                      alt="Generated" 
                      fill 
                      sizes="(max-width: 768px) 100vw, 400px"
                      className="object-contain" 
                    />
                    {/* 左上角按钮组 */}
                    <div className="absolute top-2 left-2 flex gap-1.5 z-10">
                      {/* 保存按钮 */}
                      <a 
                        href={generatedImages[selectedDisplayIndex] || generatedImages[0]} 
                        download 
                        className="p-2 bg-black/60 hover:bg-black/80 rounded-lg transition-colors" 
                        title="保存图片"
                      >
                        <Download size={16} className="text-white" />
                      </a>
                      {/* 发送到 nanobanana */}
                      <button
                        onClick={() => {
                          const currentImg = generatedImages[selectedDisplayIndex] || generatedImages[0];
                          if (currentImg) {
                            addUploadedImage({
                              id: `zimage_${Date.now()}`,
                              url: currentImg,
                              filename: `zimage_${Date.now()}.png`,
                            });
                            onClose(); // 关闭窗口返回主界面
                          }
                        }}
                        className="p-2 bg-purple-600/80 hover:bg-purple-500 rounded-lg transition-colors"
                        title="发送到 Nano Banana 继续生图"
                      >
                        <ExternalLink size={16} className="text-white" />
                      </button>
                    </div>
                  </div>
                  
                  {/* 多图缩略图选择器 */}
                  {generatedImages.length > 1 && (
                    <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                      {generatedImages.map((img, idx) => (
                        <button
                          key={idx}
                          onClick={() => setSelectedDisplayIndex(idx)}
                          className={`relative w-14 h-14 flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all ${
                            selectedDisplayIndex === idx
                              ? 'border-purple-500 ring-2 ring-purple-500/30'
                              : 'border-zinc-700 hover:border-zinc-500'
                          }`}
                        >
                          <Image
                            src={img}
                            alt={`Thumbnail ${idx + 1}`}
                            fill
                            sizes="56px"
                            className="object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-24 h-24 bg-zinc-800 rounded-xl flex items-center justify-center mx-auto mb-4">
                      <ImageIcon size={40} className="text-zinc-600" />
                    </div>
                    <p className="text-zinc-500">请开始在线生图</p>
                    <p className="text-zinc-600 text-xs mt-1">或点击左侧任务查看历史图片</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* AI 对话窗口 */}
      {showChatDialog && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-0 md:p-4">
          <div className="bg-zinc-900 rounded-none md:rounded-xl w-full max-w-2xl h-full md:h-[70vh] flex flex-col shadow-2xl border-0 md:border border-zinc-700">
            {/* 对话窗口标题 */}
            <div className="flex items-center justify-between px-3 md:px-4 py-2 md:py-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <MessageCircle size={isMobile ? 16 : 18} className="text-blue-400" />
                <span className="font-medium text-sm md:text-base">AI 对话</span>
                {isCompressingContext && (
                  <span className="text-[10px] text-purple-400 flex items-center gap-1">
                    <Loader2 size={10} className="animate-spin" />
                    压缩...
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 md:gap-2">
                <button
                  onClick={() => {
                    setShowSessionList(!showSessionList);
                    if (!showSessionList) loadChatSessions();
                  }}
                  className="text-[10px] text-blue-400 hover:text-blue-300 px-1.5 md:px-2 py-1 bg-zinc-800 rounded flex items-center gap-1"
                >
                  <Clock size={10} />
                  <span className="hidden sm:inline">历史记录</span>
                </button>
                <button
                  onClick={startNewChat}
                  className="text-[10px] text-green-400 hover:text-green-300 px-1.5 md:px-2 py-1 bg-zinc-800 rounded flex items-center gap-1"
                >
                  <Plus size={10} />
                  <span className="hidden sm:inline">新建对话</span>
                </button>
                <button
                  onClick={clearChat}
                  className="text-[10px] text-zinc-400 hover:text-zinc-300 px-1.5 md:px-2 py-1 bg-zinc-800 rounded hidden sm:block"
                >
                  清空对话
                </button>
                <button onClick={() => setShowChatDialog(false)} className="text-zinc-400 hover:text-white p-1">
                  <X size={isMobile ? 18 : 20} />
                </button>
              </div>
            </div>

            {/* 历史会话列表 */}
            {showSessionList && (
              <div className="absolute top-12 right-4 w-64 max-h-60 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl overflow-y-auto z-10">
                <div className="p-2 border-b border-zinc-700 text-xs text-zinc-400">历史对话（10天内）</div>
                {chatSessions.length === 0 ? (
                  <div className="p-4 text-center text-zinc-500 text-xs">暂无历史记录</div>
                ) : (
                  chatSessions.map(session => (
                    <button
                      key={session.id}
                      onClick={() => loadChatSession(session.id)}
                      className={`w-full px-3 py-2 text-left hover:bg-zinc-700 text-xs border-b border-zinc-700/50 ${
                        chatSessionId === session.id ? 'bg-zinc-700 text-blue-400' : ''
                      }`}
                    >
                      <div className="truncate font-medium">{session.title}</div>
                      <div className="text-zinc-500 text-[10px]">
                        {new Date(session.updatedAt).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}

            {/* 对话内容 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatMessages.length === 0 ? (
                <div className="text-center text-zinc-500 mt-8">
                  <MessageCircle size={32} className="mx-auto mb-2 opacity-50" />
                  <p>告诉 AI 你想生成什么样的图片</p>
                  <p className="text-xs mt-1">例如：“我想生成一张日落时分的海边风景”</p>
                </div>
              ) : (
                chatMessages.map((msg, idx) => (
                  msg.role === 'summary' ? (
                    // 摘要消息特殊显示
                    <div key={idx} className="flex justify-center">
                      <div className="bg-purple-900/30 border border-purple-700/50 px-3 py-2 rounded-lg text-xs text-purple-300 max-w-[90%]">
                        <div className="flex items-center gap-1 mb-1 text-purple-400">
                          <Clock size={10} />
                          <span>之前的对话摘要</span>
                        </div>
                        <div className="text-purple-200 opacity-80">{msg.content}</div>
                      </div>
                    </div>
                  ) : (
                    <div
                      key={idx}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${
                          msg.role === 'user'
                            ? 'bg-blue-600 text-white'
                            : 'bg-zinc-800 text-zinc-200'
                        }`}
                      >
                        {/* 显示用户上传的图片 */}
                        {msg.images && msg.images.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {msg.images.map((imgUrl, imgIdx) => (
                              <div key={imgIdx} className="relative w-16 h-16 rounded overflow-hidden">
                                <Image src={imgUrl} alt={`上传图片 ${imgIdx + 1}`} fill sizes="64px" className="object-cover" />
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="whitespace-pre-wrap">{msg.content}</div>
                        {/* 如果是 AI 回复且包含提示词，显示应用按钮 */}
                        {msg.role === 'assistant' && msg.content.includes('【提示词】') && (
                          <button
                            onClick={() => {
                              // 提取【提示词】后的内容
                              const match = msg.content.match(/【提示词】[\s\S]*?([\s\S]+?)(?:【|（|$)/);
                              const promptText = match ? match[1].trim() : msg.content;
                              applyChatResult(promptText);
                            }}
                            className="mt-2 px-2 py-1 bg-green-600 hover:bg-green-500 rounded text-[10px] text-white"
                          >
                            应用此提示词
                          </button>
                        )}
                      </div>
                    </div>
                  )
                ))
              )}
              {isChatLoading && (
                <div className="flex justify-start">
                  <div className="bg-zinc-800 px-3 py-2 rounded-lg flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin" />
                    <span className="text-sm text-zinc-400">AI 思考中...</span>
                  </div>
                </div>
              )}
            </div>

            {/* 输入框 */}
            <div className="p-4 border-t border-zinc-800">
              {/* 已上传的图片预览 */}
              {chatImages.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2 pt-1 pr-1">
                  {chatImages.map((img, idx) => (
                    <div key={idx} className="relative w-12 h-12">
                      <div className="w-full h-full rounded overflow-hidden border border-zinc-600">
                        <Image src={img.url} alt={`上传 ${idx + 1}`} fill sizes="48px" className="object-cover" />
                      </div>
                      <button
                        onClick={() => removeChatImage(idx)}
                        className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-400 z-10"
                      >
                        <X size={8} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                {/* 图片上传按钮 */}
                <input
                  ref={chatFileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleChatImageUpload}
                  className="hidden"
                />
                <button
                  onClick={() => chatFileInputRef.current?.click()}
                  disabled={isChatUploading}
                  className="px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg hover:bg-zinc-600 flex items-center gap-1 text-sm"
                  title="上传图片"
                >
                  {isChatUploading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Upload size={16} />
                  )}
                </button>
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleChatSend();
                    }
                  }}
                  placeholder="描述你想生成的图片，或上传参考图..."
                  className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                  disabled={isChatLoading}
                />
                <button
                  onClick={handleChatSend}
                  disabled={isChatLoading || (!chatInput.trim() && chatImages.length === 0)}
                  className={`px-4 py-2 rounded-lg flex items-center gap-1 ${
                    isChatLoading || (!chatInput.trim() && chatImages.length === 0)
                      ? 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-500 text-white'
                  }`}
                >
                  <Send size={16} />
                </button>
              </div>
              <div className="text-[10px] text-zinc-500 mt-1">
                点击上传按钮添加参考图片，按 Enter 发送。AI 生成的提示词会用【提示词】标注。
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
