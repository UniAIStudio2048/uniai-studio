import axios from 'axios';

// 后端 API 地址
// 优先使用环境变量 NEXT_PUBLIC_API_URL
// 如果未设置，则使用相对路径 /api（适用于前后端部署在同一域名下的情况）
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
});

// 图片上传
export async function uploadImage(file: File) {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await axios.post(`${API_BASE_URL}/upload`, formData, {
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 30000, // 30秒超时
    });
    return response.data;
  } catch (error) {
    console.error('Upload failed, using fallback:', error);
    // 如果上传失败，使用本地 base64 作为降级方案
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve({
          url: reader.result as string,
          filename: file.name,
          id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        });
      };
      reader.readAsDataURL(file);
    });
  }
}

// 获取设置
export async function getSetting(key: string): Promise<{ value: string | null }> {
  try {
    const response = await api.get(`/settings?key=${key}`);
    return response.data;
  } catch (error) {
    console.error(`Failed to get setting ${key}:`, error);
    // 返回空值作为降级
    return { value: null };
  }
}

// 保存设置
export async function saveSetting(key: string, value: string) {
  const response = await api.post('/settings', { key, value });
  return response.data;
}

// 创建生成任务
export async function generateImage(data: {
  prompt: string;
  resolution?: string;
  aspectRatio?: string;
  model?: 'nano-banana-2' | 'nano-banana-hd' | 'nano-banana-pro' | 'nano-banana';
  batchCount?: number;
  imageUrl?: string; // 图生图时传入的图片URL
}) {
  const response = await api.post('/generate', data);
  return response.data;
}

// 获取任务列表
export async function getTasks(limit: number = 50) {
  try {
    const response = await api.get(`/tasks?limit=${limit}`);
    return response.data;
  } catch (error) {
    console.error('Failed to get tasks:', error);
    // 返回空任务列表作为降级
    return { tasks: [] };
  }
}

// 获取 Z-Image 任务列表
export async function getZImageTasks(limit: number = 50) {
  try {
    const response = await api.get(`/zimage-tasks?limit=${limit}`);
    return response.data;
  } catch (error) {
    console.error('Failed to get Z-Image tasks:', error);
    return { tasks: [] };
  }
}

// 清空所有 Z-Image 任务
export async function clearZImageTasks() {
  try {
    const response = await api.delete('/zimage-tasks');
    return response.data;
  } catch (error) {
    console.error('Failed to clear Z-Image tasks:', error);
    throw error;
  }
}

// 获取单个任务
export async function getTask(taskId: string) {
  const response = await api.get(`/tasks/${taskId}`);
  return response.data;
}

// 获取收藏列表
export async function getFavorites() {
  try {
    const response = await api.get('/favorites');
    return response.data;
  } catch (error) {
    console.error('Failed to get favorites:', error);
    // 返回空收藏列表作为降级
    return { favorites: [] };
  }
}

// 添加收藏
export async function addFavorite(data: { url: string; prompt?: string; filename?: string }) {
  const response = await api.post('/favorites', data);
  return response.data;
}

// 取消收藏
export async function removeFavorite(url: string) {
  const response = await api.delete(`/favorites/${encodeURIComponent(url)}`);
  return response.data;
}

// 检查图片是否已收藏
export async function checkFavorite(url: string) {
  try {
    const response = await api.get(`/favorites/${encodeURIComponent(url)}`);
    return response.data;
  } catch (error) {
    console.error('Failed to check favorite:', error);
    return { isFavorited: false };
  }
}

// 获取灵感列表
export async function getInspirations() {
  try {
    const response = await api.get('/inspirations');
    return response.data;
  } catch (error) {
    console.error('Failed to get inspirations:', error);
    return { inspirations: [] };
  }
}

// 添加灵感
export async function addInspiration(data: { title: string; prompt: string; tags?: string; image_url?: string }) {
  const response = await api.post('/inspirations', data);
  return response.data;
}

// 更新灵感
export async function updateInspiration(id: string, data: { title: string; prompt: string; tags?: string; image_url?: string }) {
  const response = await api.put(`/inspirations/${id}`, data);
  return response.data;
}

// 删除灵感
export async function deleteInspiration(id: string) {
  const response = await api.delete(`/inspirations?id=${id}`);
  return response.data;
}

// 从存储桶导入灵感
export async function importInspirations() {
  const response = await api.post('/inspirations/import');
  return response.data;
}

// 更新灵感排序
export async function updateInspirationOrder(id: string, sort_order: number) {
  const response = await api.put('/inspirations', { id, sort_order });
  return response.data;
}

// 批量更新灵感排序
export async function batchUpdateInspirationOrder(updates: Array<{id: string, sort_order: number}>) {
  const response = await api.post('/inspirations/batch-update', { updates });
  return response.data;
}

// 测试对象存储连接
export async function testStorageConnection(data: { external: string; bucket: string; accessKey: string; secretKey: string }) {
  const response = await api.post('/storage/test', data);
  return response.data;
}

// 检查 remove.bg 账户额度（通过后端代理）
export async function checkRemoveBgAccount(apiKey?: string) {
  if (apiKey) {
    // 使用提供的 API Key 检查（用于保存前验证）
    const response = await api.post('/removebg/account', { apiKey });
    return response.data;
  } else {
    // 使用已保存的 API Key 检查
    const response = await api.get('/removebg/account');
    return response.data;
  }
}

export default api;
