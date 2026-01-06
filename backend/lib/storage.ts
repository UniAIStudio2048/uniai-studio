import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { query } from './db';

interface StorageConfig {
  enabled: boolean;
  external: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
}

let cachedConfig: StorageConfig | null = null;
let configLoadTime = 0;
const CONFIG_CACHE_TTL = 60000; // 1分钟缓存

// 从数据库加载存储配置
export async function getStorageConfig(): Promise<StorageConfig> {
  const now = Date.now();
  
  // 使用缓存
  if (cachedConfig && (now - configLoadTime) < CONFIG_CACHE_TTL) {
    return cachedConfig;
  }
  
  try {
    const results = await query<any[]>(
      `SELECT setting_key, setting_value FROM settings WHERE setting_key IN (?, ?, ?, ?, ?)`,
      ['storage_enabled', 'storage_external', 'storage_bucket', 'storage_access_key', 'storage_secret_key']
    );
    
    const configMap: Record<string, string> = {};
    for (const row of results) {
      configMap[row.setting_key] = row.setting_value || '';
    }
    
    cachedConfig = {
      enabled: configMap['storage_enabled'] === 'true',
      external: configMap['storage_external'] || '',
      bucket: configMap['storage_bucket'] || '',
      accessKey: configMap['storage_access_key'] || '',
      secretKey: configMap['storage_secret_key'] || '',
    };
    configLoadTime = now;
    
    return cachedConfig;
  } catch (error) {
    console.error('Failed to load storage config:', error);
    return {
      enabled: false,
      external: '',
      bucket: '',
      accessKey: '',
      secretKey: '',
    };
  }
}

// 清除缓存
export function clearStorageConfigCache() {
  cachedConfig = null;
  configLoadTime = 0;
}

// 创建 S3 客户端
export function createS3Client(config: StorageConfig): S3Client {
  return new S3Client({
    endpoint: `https://${config.external}`,
    region: 'us-east-1',
    credentials: {
      accessKeyId: config.accessKey,
      secretAccessKey: config.secretKey,
    },
    forcePathStyle: true,
  });
}

// 上传到 S3的 input 文件夹
export async function uploadToS3Input(
  fileBuffer: Buffer,
  fileName: string,
  contentType: string
): Promise<string | null> {
  const config = await getStorageConfig();
  
  if (!config.enabled || !config.external || !config.bucket || !config.accessKey || !config.secretKey) {
    return null; // 未配置，返回 null
  }
  
  const client = createS3Client(config);
  const key = `input/${Date.now()}-${fileName}`;

  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    Body: fileBuffer,
    ContentType: contentType,
  });

  await client.send(command);

  return `https://${config.external}/${config.bucket}/${key}`;
}

// 上传到 S3 的 output 文件夹
export async function uploadToS3Output(
  fileBuffer: Buffer,
  fileName: string,
  contentType: string
): Promise<string | null> {
  const config = await getStorageConfig();
  
  if (!config.enabled || !config.external || !config.bucket || !config.accessKey || !config.secretKey) {
    return null;
  }
  
  const client = createS3Client(config);
  const key = `output/${Date.now()}-${fileName}`;

  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    Body: fileBuffer,
    ContentType: contentType,
  });

  await client.send(command);

  return `https://${config.external}/${config.bucket}/${key}`;
}

// 上传到 S3 的 zimage 文件夹（Z-Image 模型专用）
export async function uploadToS3ZImage(
  fileBuffer: Buffer,
  fileName: string,
  contentType: string
): Promise<string | null> {
  const config = await getStorageConfig();
  
  if (!config.enabled || !config.external || !config.bucket || !config.accessKey || !config.secretKey) {
    return null;
  }
  
  const client = createS3Client(config);
  const key = `zimage/${Date.now()}-${fileName}`;

  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    Body: fileBuffer,
    ContentType: contentType,
  });

  await client.send(command);

  return `https://${config.external}/${config.bucket}/${key}`;
}

// 获取签名下载 URL
export async function getSignedDownloadUrl(key: string): Promise<string | null> {
  const config = await getStorageConfig();
  
  if (!config.enabled) {
    return null;
  }
  
  const client = createS3Client(config);

  const command = new GetObjectCommand({
    Bucket: config.bucket,
    Key: key,
  });

  return await getSignedUrl(client, command, { expiresIn: 3600 });
}

// 兼容旧的 uploadToS3 函数
export async function uploadToS3(
  fileBuffer: Buffer,
  fileName: string,
  contentType: string
): Promise<string> {
  const url = await uploadToS3Input(fileBuffer, fileName, contentType);
  if (!url) {
    throw new Error('Storage not configured');
  }
  return url;
}

// 从 URL 中提取 S3 key
export function extractKeyFromUrl(url: string): string | null {
  try {
    // URL 格式: https://external/bucket/key
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    // 去掉第一个空字符串和 bucket 名称
    if (pathParts.length >= 3) {
      return pathParts.slice(2).join('/');
    }
    return null;
  } catch {
    return null;
  }
}

// 删除 S3 中的单个文件
export async function deleteFromS3(key: string): Promise<boolean> {
  const config = await getStorageConfig();
  
  if (!config.enabled || !config.external || !config.bucket) {
    return false;
  }
  
  try {
    const client = createS3Client(config);
    const command = new DeleteObjectCommand({
      Bucket: config.bucket,
      Key: key,
    });
    await client.send(command);
    console.log(`Deleted from S3: ${key}`);
    return true;
  } catch (error) {
    console.error(`Failed to delete from S3: ${key}`, error);
    return false;
  }
}

// 删除 S3 中的文件（通过 URL）
export async function deleteFromS3ByUrl(url: string): Promise<boolean> {
  const key = extractKeyFromUrl(url);
  if (!key) {
    return false;
  }
  return deleteFromS3(key);
}

// 清理 S3 中超过指定天数的文件
export async function cleanupOldS3Files(retentionDays: number = 20): Promise<{ deleted: number; errors: number }> {
  const config = await getStorageConfig();
  
  if (!config.enabled || !config.external || !config.bucket) {
    return { deleted: 0, errors: 0 };
  }
  
  const client = createS3Client(config);
  const cutoffTime = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
  let deleted = 0;
  let errors = 0;
  
  // 清理 input、output 和 zimage 文件夹
  for (const prefix of ['input/', 'output/', 'zimage/']) {
    try {
      const listCommand = new ListObjectsV2Command({
        Bucket: config.bucket,
        Prefix: prefix,
      });
      
      const response = await client.send(listCommand);
      
      if (response.Contents) {
        for (const obj of response.Contents) {
          if (obj.LastModified && obj.Key) {
            const fileTime = new Date(obj.LastModified).getTime();
            if (fileTime < cutoffTime) {
              try {
                await deleteFromS3(obj.Key);
                deleted++;
              } catch {
                errors++;
              }
            }
          }
        }
      }
    } catch (error) {
      console.error(`Failed to list S3 objects with prefix ${prefix}:`, error);
      errors++;
    }
  }
  
  return { deleted, errors };
}

export default {
  getStorageConfig,
  clearStorageConfigCache,
  uploadToS3,
  uploadToS3Input,
  uploadToS3Output,
  uploadToS3ZImage,
  getSignedDownloadUrl,
  deleteFromS3,
  deleteFromS3ByUrl,
  cleanupOldS3Files,
};
