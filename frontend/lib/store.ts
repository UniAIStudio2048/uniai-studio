import { create } from 'zustand';

interface Task {
  id: string;
  prompt: string;
  status: 'pending' | 'processing' | 'success' | 'failed';
  result_image_url?: string;
  result_images?: string[];
  result_image_filename?: string;
  error_message?: string;
  resolution: string;
  batch_count: number;
  batch_id?: string;
  created_at: string;
}

interface Favorite {
  id: string;
  url: string;
  prompt?: string;
  filename: string;
  created_at: string;
}

interface Inspiration {
  id: string;
  title: string;
  prompt: string;
  tags: string;
  image_url: string;
  sort_order: number;
  created_at: string;
}

interface UploadedImage {
  url: string;
  filename: string;
  id: string;
}

interface AppState {
  // 当前画布图片（生成结果）
  currentImage: string | null;
  setCurrentImage: (url: string | null) => void;
  
  // 当前任务的所有图片（支持多图切换）
  currentImages: string[];
  currentImageIndex: number;
  isSelectingImage: boolean;  // 是否在选择图片模式
  setCurrentImages: (urls: string[]) => void;
  setCurrentImageIndex: (index: number) => void;
  setIsSelectingImage: (selecting: boolean) => void;

  // 上传的参考图片（支持多张）
  uploadedImages: UploadedImage[];
  addUploadedImage: (image: UploadedImage) => void;
  removeUploadedImage: (id: string) => void;
  updateUploadedImage: (id: string, newUrl: string) => void;
  clearUploadedImages: () => void;

  // 兼容旧的单图片 API
  uploadedImage: UploadedImage | null;
  setUploadedImage: (image: UploadedImage | null) => void;
  clearUploadedImage: () => void;

  // 任务列表
  tasks: Task[];
  setTasks: (tasks: Task[]) => void;
  addTask: (task: Task) => void;

  // 收藏列表
  favorites: Favorite[];
  favoriteUrls: Set<string>;  // 用于快速查找
  setFavorites: (favorites: Favorite[]) => void;
  addFavorite: (favorite: Favorite) => void;
  removeFavoriteByUrl: (url: string) => void;
  isFavorited: (url: string) => boolean;

  // 配置
  apiKey: string | null;
  setApiKey: (key: string | null) => void;
  
  // 接口选择（1=多米API, 2=Nano Banana, 3=Z-Image-Turbo）
  activeApi: 1 | 2 | 3;
  setActiveApi: (api: 1 | 2 | 3) => void;
  
  // 多米 API Key（接口1）
  duomiApiKey: string | null;
  setDuomiApiKey: (key: string | null) => void;
  
  // Z-Image API Key（接口3）
  zimageApiKey: string | null;
  setZimageApiKey: (key: string | null) => void;

  // UI 状态
  showApiKeyModal: boolean;
  setShowApiKeyModal: (show: boolean) => void;

  showStorageModal: boolean;
  setShowStorageModal: (show: boolean) => void;

  showFavoritesModal: boolean;
  setShowFavoritesModal: (show: boolean) => void;

  // 生成参数
  resolution: '1K' | '2K' | '4K';
  setResolution: (resolution: '1K' | '2K' | '4K') => void;

  batchCount: number;
  setBatchCount: (count: number) => void;

  aspectRatio: 'Auto' | '1:1' | '2:3' | '3:2' | '3:4' | '4:3' | '4:5' | '5:4' | '9:16' | '16:9' | '21:9';
  setAspectRatio: (ratio: 'Auto' | '1:1' | '2:3' | '3:2' | '3:4' | '4:3' | '4:5' | '5:4' | '9:16' | '16:9' | '21:9') => void;

  // 模型选择
  selectedModel: string;
  setSelectedModel: (model: string) => void;

  // 提示词
  prompt: string;
  setPrompt: (prompt: string) => void;

  // 灵感中心
  inspirations: Inspiration[];
  setInspirations: (inspirations: Inspiration[]) => void;
  addInspiration: (inspiration: Inspiration) => void;
  updateInspiration: (inspiration: Inspiration) => void;
  removeInspiration: (id: string) => void;
  showInspirationModal: boolean;
  setShowInspirationModal: (show: boolean) => void;
  showAddInspirationModal: boolean;
  setShowAddInspirationModal: (show: boolean) => void;

  // 移动端面板状态
  showMobileSettings: boolean;
  setShowMobileSettings: (show: boolean) => void;
  showMobileTaskQueue: boolean;
  setShowMobileTaskQueue: (show: boolean) => void;

  // Z-Image Modal 状态
  showZImageModal: boolean;
  setShowZImageModal: (show: boolean) => void;

  // Z-Image 专用任务列表
  zimageTasks: Task[];
  setZimageTasks: (tasks: Task[]) => void;
  addZimageTask: (task: Task) => void;
  updateZimageTask: (id: string, updates: Partial<Task>) => void;

  // Z-Image 当前选中的图片
  zimageCurrentImages: string[];
  zimageCurrentIndex: number;
  setZimageCurrentImages: (urls: string[]) => void;
  setZimageCurrentIndex: (index: number) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  currentImage: null,
  setCurrentImage: (url) => set({ currentImage: url, currentImages: url ? [url] : [], currentImageIndex: 0 }),
  
  currentImages: [],
  currentImageIndex: 0,
  isSelectingImage: false,
  setCurrentImages: (urls) => set({ 
    currentImages: urls, 
    currentImage: urls.length === 1 ? urls[0] : null,  // 单图直接显示，多图进入选择模式
    currentImageIndex: 0,
    isSelectingImage: urls.length > 1  // 多图时进入选择模式
  }),
  setCurrentImageIndex: (index) => set((state) => ({ 
    currentImageIndex: index, 
    currentImage: state.currentImages[index] || null,
    isSelectingImage: false  // 选择后退出选择模式
  })),
  setIsSelectingImage: (selecting) => set({ isSelectingImage: selecting }),

  uploadedImages: [],
  addUploadedImage: (image) => set((state) => ({ 
    uploadedImages: [...state.uploadedImages, image] 
  })),
  removeUploadedImage: (id) => set((state) => ({ 
    uploadedImages: state.uploadedImages.filter(img => img.id !== id) 
  })),
  updateUploadedImage: (id, newUrl) => set((state) => ({
    uploadedImages: state.uploadedImages.map(img => 
      img.id === id ? { ...img, url: newUrl } : img
    )
  })),
  clearUploadedImages: () => set({ uploadedImages: [] }),

  // 兼容旧 API
  uploadedImage: null,
  setUploadedImage: (image) => set({ uploadedImage: image }),
  clearUploadedImage: () => set({ uploadedImage: null }),

  tasks: [],
  setTasks: (tasks) => set({ tasks }),
  addTask: (task) => set((state) => ({ tasks: [task, ...state.tasks] })),

  favorites: [],
  favoriteUrls: new Set<string>(),
  setFavorites: (favorites) => set({ 
    favorites,
    favoriteUrls: new Set(favorites.map(f => f.url))
  }),
  addFavorite: (favorite) => set((state) => {
    const newFavorites = [favorite, ...state.favorites];
    const newUrls = new Set(state.favoriteUrls);
    newUrls.add(favorite.url);
    return { favorites: newFavorites, favoriteUrls: newUrls };
  }),
  removeFavoriteByUrl: (url) => set((state) => {
    const newFavorites = state.favorites.filter(f => f.url !== url);
    const newUrls = new Set(state.favoriteUrls);
    newUrls.delete(url);
    return { favorites: newFavorites, favoriteUrls: newUrls };
  }),
  isFavorited: (url) => {
    // 使用 get() 函数访问当前状态
    return get().favoriteUrls.has(url);
  },

  apiKey: null,
  setApiKey: (key) => set({ apiKey: key }),
  
  // 接口选择（默认接口2）
  activeApi: 2,
  setActiveApi: (api) => set({ activeApi: api }),
  
  // 多米 API Key
  duomiApiKey: null,
  setDuomiApiKey: (key) => set({ duomiApiKey: key }),
  
  // Z-Image API Key
  zimageApiKey: null,
  setZimageApiKey: (key) => set({ zimageApiKey: key }),

  showApiKeyModal: false,
  setShowApiKeyModal: (show) => set({ showApiKeyModal: show }),

  showStorageModal: false,
  setShowStorageModal: (show) => set({ showStorageModal: show }),

  showFavoritesModal: false,
  setShowFavoritesModal: (show) => set({ showFavoritesModal: show }),

  resolution: '2K',
  setResolution: (resolution) => set({ resolution }),

  batchCount: 1,
  setBatchCount: (count) => set({ batchCount: count }),

  aspectRatio: 'Auto',
  setAspectRatio: (ratio) => set({ aspectRatio: ratio }),

  selectedModel: 'Nano Banana 2',
  setSelectedModel: (model) => set({ selectedModel: model }),

  prompt: '',
  setPrompt: (prompt) => set({ prompt }),

  inspirations: [],
  setInspirations: (inspirations) => set({ inspirations }),
  addInspiration: (inspiration) => set((state) => ({
    inspirations: [...state.inspirations, inspiration]
  })),
  updateInspiration: (inspiration) => set((state) => ({
    inspirations: state.inspirations.map(i =>
      i.id === inspiration.id ? inspiration : i
    )
  })),
  removeInspiration: (id) => set((state) => ({
    inspirations: state.inspirations.filter(i => i.id !== id)
  })),
  showInspirationModal: false,
  setShowInspirationModal: (show) => set({ showInspirationModal: show }),
  showAddInspirationModal: false,
  setShowAddInspirationModal: (show) => set({ showAddInspirationModal: show }),

  // 移动端面板状态
  showMobileSettings: false,
  setShowMobileSettings: (show) => set({ showMobileSettings: show }),
  showMobileTaskQueue: false,
  setShowMobileTaskQueue: (show) => set({ showMobileTaskQueue: show }),

  // Z-Image Modal 状态
  showZImageModal: false,
  setShowZImageModal: (show) => set({ showZImageModal: show }),

  // Z-Image 专用任务列表
  zimageTasks: [],
  setZimageTasks: (tasks) => set({ zimageTasks: tasks }),
  addZimageTask: (task) => set((state) => ({ zimageTasks: [task, ...state.zimageTasks] })),
  updateZimageTask: (id, updates) => set((state) => ({
    zimageTasks: state.zimageTasks.map((t) =>
      t.id === id ? { ...t, ...updates } : t
    ),
  })),

  // Z-Image 当前选中的图片
  zimageCurrentImages: [],
  zimageCurrentIndex: 0,
  setZimageCurrentImages: (urls) => set({ zimageCurrentImages: urls, zimageCurrentIndex: 0 }),
  setZimageCurrentIndex: (index) => set({ zimageCurrentIndex: index }),
}));
