const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'uniai_studio',
};

async function initInspirationsTable() {
  const connection = await mysql.createConnection(dbConfig);
  
  try {
    // 创建 inspirations 表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS inspirations (
        id VARCHAR(36) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        prompt TEXT NOT NULL,
        tags VARCHAR(500),
        image_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    console.log('✅ inspirations 表创建成功');
  } catch (error) {
    console.error('❌ 创建表失败:', error);
  } finally {
    await connection.end();
  }
}

initInspirationsTable();
