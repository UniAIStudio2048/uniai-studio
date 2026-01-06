import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { query } from '@/lib/db';
import { getStorageConfig, uploadToS3Output, uploadToS3ZImage } from '@/lib/storage';
import { handleOPTIONS, withCors } from '@/lib/cors';

// API 接口配置
const API_CONFIGS = {
  // 接口3: Z-Image-Turbo (ModelScope)
  3: {
    url: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
    keyName: 'zimage_api_key',
    name: 'Z-Image-Turbo',
    async: true  // 异步任务
  },
  // 接口2: Nano Banana API
  2: {
    url: 'https://ai.comfly.chat/v1/images/generations',
    keyName: 'nano_banana_api_key',
    name: 'Nano Banana',
    async: false  // 同步返回结果
  },
  // 接口1: 多米 API NANO-BANANA
  1: {
    url: 'https://duomiapi.com/api/gemini/nano-banana',
    editUrl: 'https://duomiapi.com/api/gemini/nano-banana-edit',
    statusUrl: 'https://duomiapi.com/api/gemini/nano-banana',
    keyName: 'duomi_api_key',
    name: '多米API',
    async: true  // 异步任务，需要轮询
  }
};

// 模型列表
const VALID_MODELS = [
  // 接口3: Z-Image-Turbo 模型
  'z-image-turbo',
  // 接口2: Nano Banana 模型
  'nano-banana-2', 
  'nano-banana-2-2k', 
  'nano-banana-2-4k', 
  'nano-banana-hd', 
  'nano-banana-pro', 
  'nano-banana',
  // 接口1: 多米API NANO-BANANA 模型
  'gemini-3-pro-image-preview'
];

// Handle CORS preflight
export async function OPTIONS() {
  return handleOPTIONS();
}

// POST /api/generate - 触发 AI 生成
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('[Generate API] Received request body:', JSON.stringify(body, null, 2));
    const { 
      prompt, 
      resolution = '2K',
      aspectRatio = '1:1',
      model = 'nano-banana-2',
      batchCount = 1, 
      imageUrl,   // 单图兼容
      imageUrls,  // 多图支持
      batchId,    // 批量任务ID
      // Z-Image 专用参数
      width,
      height,
      samplerMethod,
      samplingSteps,
      seed,
      numImages
    } = body;
    console.log('[Generate API] Parsed model:', model);
    
    // 合并图片 URL（兼容旧版单图和新版多图）
    const allImageUrls: string[] = imageUrls || (imageUrl ? [imageUrl] : []);

    if (!prompt || prompt.length === 0) {
      return withCors(NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      ));
    }

    // Z-Image 允许更长的提示词
    const maxPromptLength = model === 'z-image-turbo' ? 800 : 500;
    if (prompt.length > maxPromptLength) {
      return withCors(NextResponse.json(
        { error: `Prompt must be less than ${maxPromptLength} characters` },
        { status: 400 }
      ));
    }

    if (!VALID_MODELS.includes(model)) {
      return withCors(NextResponse.json(
        { error: `Invalid model. Valid models: ${VALID_MODELS.join(', ')}` },
        { status: 400 }
      ));
    }

    // 判断是否是 Z-Image 模型 - Z-Image 独立处理，不依赖 activeApi
    const isZImageModel = model === 'z-image-turbo';
    let activeApi: 1 | 2 | 3;
    let apiConfig: any;
    let apiKey: string;

    if (isZImageModel) {
      // Z-Image 模型：直接使用接口3的配置
      activeApi = 3;
      apiConfig = API_CONFIGS[3];
      
      // 获取 Z-Image API Key
      const apiKeyResults = await query<any[]>(
        'SELECT setting_value FROM settings WHERE setting_key = ?',
        ['zimage_api_key']
      );
      
      if (apiKeyResults.length === 0 || !apiKeyResults[0].setting_value) {
        return withCors(NextResponse.json(
          { error: 'Z-Image API Key 未配置，请在 Z-Image Turbo 窗口中配置 API Key' },
          { status: 400 }
        ));
      }
      apiKey = apiKeyResults[0].setting_value;
    } else {
      // 其他模型：根据 activeApi 设置选择
      const activeApiResults = await query<any[]>(
        'SELECT setting_value FROM settings WHERE setting_key = ?',
        ['active_api']
      );
      activeApi = activeApiResults.length > 0 && activeApiResults[0].setting_value 
        ? parseInt(activeApiResults[0].setting_value) as 1 | 2 | 3
        : 2;
      
      apiConfig = API_CONFIGS[activeApi] || API_CONFIGS[2];

      // 获取对应的 API Key
      const apiKeyResults = await query<any[]>(
        'SELECT setting_value FROM settings WHERE setting_key = ?',
        [apiConfig.keyName]
      );

      if (apiKeyResults.length === 0 || !apiKeyResults[0].setting_value) {
        return withCors(NextResponse.json(
          { error: `${apiConfig.name} API Key 未配置，请在设置中配置接口${activeApi}的API Key` },
          { status: 400 }
        ));
      }
      apiKey = apiKeyResults[0].setting_value;
    }

    const apiUrl = apiConfig.url;
    
    // Z-Image 专用参数对象
    const zimageParams = isZImageModel ? { width, height, samplerMethod, samplingSteps, seed, numImages } : null;

    // 创建任务（包含 model 字段）
    const taskId = uuidv4();
    await query(
      `INSERT INTO tasks (id, prompt, status, resolution, batch_count, batch_id, model)
       VALUES (?, ?, 'processing', ?, ?, ?, ?)`,
      [taskId, prompt, resolution, batchCount, batchId || null, model]
    );

    // 异步调用 API
    processGenerationTask(taskId, prompt, apiKey, apiConfig, resolution, aspectRatio, model, batchCount, allImageUrls, activeApi, zimageParams);

    return withCors(NextResponse.json({
      taskId,
      status: 'processing',
      message: `生成任务已提交（使用${apiConfig.name}）`,
    }));
  } catch (error: any) {
    console.error('[API Error] POST /api/generate', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
    return withCors(NextResponse.json(
      { error: 'Failed to generate image' },
      { status: 500 }
    ));
  }
}

// 异步处理生成任务 - 调用 API
async function processGenerationTask(
  taskId: string,
  prompt: string,
  apiKey: string,
  apiConfig: any,
  resolution: string,
  aspectRatio: string,
  model: string,
  batchCount: number,
  imageUrls: string[] = [],
  activeApi: number,
  zimageParams: { width?: number; height?: number; samplerMethod?: string; samplingSteps?: number; seed?: number; numImages?: number } | null = null
) {
  try {
    let generatedImages: string[] = [];

    if (activeApi === 3) {
      // Z-Image-Turbo API
      generatedImages = await callZImageApi(taskId, prompt, apiKey, apiConfig, resolution, aspectRatio, model, imageUrls, zimageParams);
    } else if (activeApi === 1) {
      // 多米API - 异步模式
      generatedImages = await callDuomiApi(taskId, prompt, apiKey, apiConfig, resolution, aspectRatio, model, imageUrls);
    } else {
      // Nano Banana API - 同步模式
      generatedImages = await callNanoBananaApi(taskId, prompt, apiKey, apiConfig.url, resolution, aspectRatio, model, imageUrls);
    }

    if (generatedImages.length === 0) {
      throw new Error('No images generated');
    }

    // 判断是否是 Z-Image 模型，选择不同的存储文件夹
    const isZImageModel = model === 'z-image-turbo';
    const savedImages: string[] = [];
    const storageConfig = await getStorageConfig();
    
    if (storageConfig.enabled) {
      for (const imgUrl of generatedImages) {
        try {
          // 下载图片
          const imgResponse = await fetch(imgUrl);
          if (imgResponse.ok) {
            const buffer = Buffer.from(await imgResponse.arrayBuffer());
            const fileName = `generated_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.png`;
            
            // Z-Image 模型上传到 zimage 文件夹，其他模型上传到 output 文件夹
            const savedUrl = isZImageModel 
              ? await uploadToS3ZImage(buffer, fileName, 'image/png')
              : await uploadToS3Output(buffer, fileName, 'image/png');
            
            if (savedUrl) {
              savedImages.push(savedUrl);
              console.log(`Task ${taskId}: Saved image to ${isZImageModel ? 'zimage' : 'output'} folder: ${savedUrl}`);
            } else {
              savedImages.push(imgUrl); // 上传失败，使用原 URL
            }
          } else {
            savedImages.push(imgUrl);
          }
        } catch (err) {
          console.error(`Task ${taskId}: Failed to save image:`, err);
          savedImages.push(imgUrl); // 出错时使用原 URL
        }
      }
    } else {
      // 未启用对象存储，使用原 URL
      savedImages.push(...generatedImages);
    }

    // 更新任务状态为成功，并保存生成的图片
    await query(
      `UPDATE tasks SET status = 'success', result_images = ?, updated_at = NOW()
       WHERE id = ?`,
      [JSON.stringify(savedImages), taskId]
    );

    console.log(`Task ${taskId} completed successfully with ${savedImages.length} images`);
  } catch (error) {
    console.error(`Task ${taskId} failed:`, error);

    await query(
      `UPDATE tasks SET status = 'failed', error_message = ?, updated_at = NOW()
       WHERE id = ?`,
      [String(error), taskId]
    );
  }
}

// 多米API调用 - 异步任务模式
async function callDuomiApi(
  taskId: string,
  prompt: string,
  apiKey: string,
  apiConfig: any,
  resolution: string,
  aspectRatio: string,
  model: string,
  imageUrls: string[] = []
): Promise<string[]> {
  // 根据是否有图片选择接口
  const apiUrl = imageUrls.length > 0 ? apiConfig.editUrl : apiConfig.url;
  
  // 构建请求体
  const requestBody: any = {
    model,
    prompt,
    aspect_ratio: aspectRatio,
    image_size: resolution
  };

  // 如果有图片URL，则为图生图模式
  if (imageUrls.length > 0) {
    requestBody.image_urls = imageUrls;
  }

  console.log(`Task ${taskId}: Calling Duomi API at ${apiUrl}...`, { model, imageCount: imageUrls.length });

  // 提交任务
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Duomi API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  console.log(`Task ${taskId}: Duomi API task submitted`, result);

  if (result.code !== 200 || !result.data?.task_id) {
    throw new Error(`Duomi API error: ${result.msg || 'Unknown error'}`);
  }

  const duomiTaskId = result.data.task_id;

  // 轮询任务状态
  const maxAttempts = 60; // 最多等待 60 次，每次 3 秒
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 3000)); // 等待 3 秒

    const statusUrl = `${apiConfig.statusUrl}/${duomiTaskId}`;
    console.log(`Task ${taskId}: Polling Duomi task status (attempt ${attempt + 1})...`);

    try {
      const statusResponse = await fetch(statusUrl, {
        method: 'GET',
        headers: {
          'Authorization': apiKey,
        },
      });

      if (!statusResponse.ok) {
        console.log(`Task ${taskId}: Status check failed, retrying...`);
        continue;
      }

      const statusResult = await statusResponse.json();
      console.log(`Task ${taskId}: Duomi task status:`, statusResult);

      if (statusResult.code === 200 && statusResult.data) {
        const taskState = statusResult.data.state || statusResult.data.status;
        
        // 检查任务是否完成 - 多米API 使用 state 字段
        if (taskState === 'completed' || taskState === 'success' || taskState === 'done' || taskState === 'succeeded') {
          // 获取图片 URL - 多米API 的图片在 data.data 字段中
          const taskData = statusResult.data.data;
          let images: string[] = [];
          
          if (taskData) {
            // 多米API 返回的结构是 { images: [...] }
            if (taskData.images && Array.isArray(taskData.images)) {
              // images 可能是字符串数组或对象数组
              images = taskData.images.map((item: any) => {
                if (typeof item === 'string') return item;
                if (typeof item === 'object' && item !== null) {
                  return item.url || item.image_url || item.src || '';
                }
                return '';
              }).filter(Boolean);
            } else if (Array.isArray(taskData)) {
              images = taskData.map((item: any) => {
                if (typeof item === 'string') return item;
                if (typeof item === 'object' && item !== null) {
                  return item.url || item.image_url || item.src || '';
                }
                return '';
              }).filter(Boolean);
            } else if (typeof taskData === 'object') {
              if (taskData.image_urls) images = taskData.image_urls;
              else if (taskData.url) images = [taskData.url];
              else if (taskData.image_url) images = [taskData.image_url];
            } else if (typeof taskData === 'string') {
              images = [taskData];
            }
          }
          
          // 尝试其他字段
          if (images.length === 0) {
            if (statusResult.data.images) images = statusResult.data.images;
            else if (statusResult.data.image_urls) images = statusResult.data.image_urls;
            else if (statusResult.data.image_url) images = [statusResult.data.image_url];
            else if (statusResult.data.url) images = [statusResult.data.url];
          }
          
          if (images.length > 0) {
            console.log(`Task ${taskId}: Duomi task completed with ${images.length} images`);
            return images;
          }
          
          // 没有找到图片，记录完整响应并继续轮询
          console.log(`Task ${taskId}: Task completed but no images found, response:`, JSON.stringify(statusResult));
        } else if (taskState === 'failed' || taskState === 'error') {
          const errorMsg = statusResult.data.msg || statusResult.data.error || 'Unknown error';
          throw new Error(`Duomi task failed: ${errorMsg}`);
        }
        // 任务仍在处理中 (running/pending)，继续轮询
      }
    } catch (pollError) {
      console.log(`Task ${taskId}: Poll error:`, pollError);
    }
  }

  throw new Error('Duomi task timeout: exceeded maximum polling attempts');
}

// Nano Banana API调用 - 同步模式
async function callNanoBananaApi(
  taskId: string,
  prompt: string,
  apiKey: string,
  apiUrl: string,
  resolution: string,
  aspectRatio: string,
  model: string,
  imageUrls: string[] = []
): Promise<string[]> {
  // 构建请求体
  const requestBody: any = {
    prompt,
    model,
    aspect_ratio: aspectRatio,
    response_format: 'url',
    image_size: resolution
  };

  // 如果有图片URL，则为图生图模式
  if (imageUrls.length > 0) {
    requestBody.image = imageUrls;
  }

  console.log(`Task ${taskId}: Calling Nano Banana API at ${apiUrl}...`, { model, imageCount: imageUrls.length });

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Nano Banana API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  console.log(`Task ${taskId}: Nano Banana API response received`, result);

  // 获取生成的图片URL
  const generatedImages = result.data?.map((item: any) => item.url) || [];
  return generatedImages;
}

// 调用 Z-Image-Turbo API
async function callZImageApi(
  taskId: string,
  prompt: string,
  apiKey: string,
  apiConfig: any,
  resolution: string,
  aspectRatio: string,
  model: string,
  imageUrls: string[] = [],
  zimageParams: { width?: number; height?: number; samplerMethod?: string; samplingSteps?: number; seed?: number; numImages?: number } | null = null
): Promise<string[]> {
  const apiUrl = apiConfig.url;
  
  // 确定图片尺寸
  let size: string;
  if (zimageParams?.width && zimageParams?.height) {
    // 使用前端传递的宽高
    size = `${zimageParams.width}*${zimageParams.height}`;
  } else {
    // 回退到比例和分辨率计算
    const getSizeByRatio = (ratio: string, res: string): string => {
      const base: Record<string, number> = { '1K': 1024, '2K': 1536, '4K': 2048 };
      const b = base[res] || 1024;
      const ratioMap: Record<string, string> = {
        '1:1': `${b}*${b}`, '2:3': `${Math.round(b*0.82)}*${Math.round(b*1.22)}`,
        '3:2': `${Math.round(b*1.22)}*${Math.round(b*0.82)}`, '3:4': `${Math.round(b*0.86)}*${Math.round(b*1.15)}`,
        '4:3': `${Math.round(b*1.15)}*${Math.round(b*0.86)}`, '9:16': `${Math.round(b*0.72)}*${Math.round(b*1.28)}`,
        '16:9': `${Math.round(b*1.28)}*${Math.round(b*0.72)}`,
      };
      return ratioMap[ratio] || `${b}*${b}`;
    };
    size = getSizeByRatio(aspectRatio, resolution);
  }
  
  // 构建 multimodal-generation 格式请求体
  // 注意：Z-Image-Turbo API 要求 content 数组必须且仅包含 1 个 text 对象，不支持图生图
  const messageContent: any[] = [{ text: prompt }];
  // 图生图功能暂不支持，忽略参考图片
  // if (imageUrls.length > 0) { messageContent.unshift({ image: imageUrls[0] }); }
  
  // 构建参数
  const parameters: any = { 
    prompt_extend: false, 
    size: size 
  };
  
  // 添加可选参数
  if (zimageParams?.seed !== undefined && zimageParams.seed !== -1) {
    parameters.seed = zimageParams.seed;
  }
  if (zimageParams?.samplingSteps !== undefined) {
    parameters.steps = zimageParams.samplingSteps;
  }
  
  const requestBody = {
    model: 'z-image-turbo',
    input: { messages: [{ role: 'user', content: messageContent }] },
    parameters: parameters
  };

  console.log(`Task ${taskId}: Calling Z-Image-Turbo API...`, { size, imageCount: imageUrls.length });

  // 同步调用 API
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Z-Image-Turbo API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  console.log(`Task ${taskId}: Z-Image-Turbo response:`, JSON.stringify(result, null, 2));
  
  // 解析响应 - 从 choices[0].message.content 中提取图片URL
  const choices = result.output?.choices;
  if (!choices || choices.length === 0) { throw new Error('No choices returned from Z-Image-Turbo API'); }
  
  const content = choices[0]?.message?.content;
  if (!content || !Array.isArray(content)) { throw new Error('Invalid response format'); }
  
  const images = content.filter((item: any) => item.image).map((item: any) => item.image);
  if (images.length === 0) { throw new Error('No images returned from Z-Image-Turbo API'); }
  
  console.log(`Task ${taskId}: Z-Image-Turbo completed with ${images.length} images`);
  return images;
}
