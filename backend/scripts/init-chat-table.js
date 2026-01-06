const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'uniai_studio',
};

async function initChatTable() {
  const connection = await mysql.createConnection(dbConfig);
  
  try {
    console.log('Creating zimage_chat_sessions table...');
    
    // 对话会话表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS zimage_chat_sessions (
        id VARCHAR(36) PRIMARY KEY,
        title VARCHAR(255) DEFAULT 'New Chat',
        summary TEXT,
        message_count INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL 10 DAY),
        INDEX idx_expires_at (expires_at),
        INDEX idx_updated_at (updated_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    console.log('Creating zimage_chat_messages table...');
    
    // 对话消息表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS zimage_chat_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        session_id VARCHAR(36) NOT NULL,
        role ENUM('user', 'assistant', 'system', 'summary') NOT NULL,
        content TEXT NOT NULL,
        images JSON,
        token_count INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES zimage_chat_sessions(id) ON DELETE CASCADE,
        INDEX idx_session_id (session_id),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    console.log('Tables created successfully!');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
  }
}

initChatTable();
