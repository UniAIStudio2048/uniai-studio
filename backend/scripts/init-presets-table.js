const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'uniai_studio',
};

async function initPresetsTable() {
  const connection = await mysql.createConnection(dbConfig);
  
  try {
    console.log('Creating zimage_presets table...');
    
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS zimage_presets (
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        icon VARCHAR(10) DEFAULT '📝',
        script TEXT,
        sort_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_sort_order (sort_order)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    console.log('Table created successfully!');
    
    // 插入默认预设
    const defaultPresets = [
      { id: 'default', name: '通用描述', icon: '📝', script: '请详细描述这张图片的内容，包括主体、场景、风格、光线、色调、构图等细节，用于AI图像生成的提示词。请用英文输出。', sort_order: 0 },
      { id: 'portrait', name: '人像照片', icon: '👤', script: '请分析这张人像照片，详细描述人物的外貌特征（发型、肤色、表情、服装）、姿势、背景环境、光线效果和整体风格。请用英文输出，格式适合作为AI图像生成的提示词。', sort_order: 1 },
      { id: 'landscape', name: '风景图片', icon: '🌄', script: '请描述这张风景图片，包括自然元素（天空、云、山、水、植物等）、季节氛围、时间段（日出/日落/夜晚）、色彩搭配和艺术风格。请用英文输出。', sort_order: 2 },
      { id: 'product', name: '产品图片', icon: '📦', script: '请分析这张产品图片，描述产品的外观、材质、颜色、摆放角度、背景环境和光线效果。请用英文输出，适合作为电商或广告图片的AI生成提示词。', sort_order: 3 },
      { id: 'anime', name: '动漫/插画', icon: '🎨', script: '请将这张图片转换为动漫/插画风格的描述，包括角色特征、画风（如日系动漫、赛博朋克、水彩等）、场景元素和整体氛围。请用英文输出。', sort_order: 4 },
      { id: 'artistic', name: '艺术风格', icon: '🖼️', script: '请从艺术角度分析这张图片，描述其艺术风格（如印象派、极简主义、超现实主义等）、色彩运用、构图技巧和情感表达。请用英文输出。', sort_order: 5 },
      { id: 'chinese', name: '中文输出', icon: '🇨🇳', script: '请详细描述这张图片的内容，包括主体、场景、风格、光线、色调、构图等细节。请用中文输出，作为AI图像生成的提示词。', sort_order: 6 },
    ];
    
    console.log('Inserting default presets...');
    
    for (const preset of defaultPresets) {
      await connection.execute(
        'INSERT IGNORE INTO zimage_presets (id, name, icon, script, sort_order) VALUES (?, ?, ?, ?, ?)',
        [preset.id, preset.name, preset.icon, preset.script, preset.sort_order]
      );
    }
    
    console.log('Default presets inserted!');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
  }
}

initPresetsTable();
