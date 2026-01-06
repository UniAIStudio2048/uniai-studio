// 共享类型定义

export interface UploadedImage {
  url: string;
  filename: string;
  id: string;
}

export interface Inspiration {
  id: string;
  title: string;
  prompt: string;
  tags: string;
  image_url: string;
  sort_order: number;
  created_at: string;
}

export interface Task {
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

export interface Favorite {
  id: string;
  url: string;
  prompt?: string;
  filename: string;
  created_at: string;
}

export type ModelType = 'nano-banana-2' | 'nano-banana-hd' | 'nano-banana-pro' | 'nano-banana';
