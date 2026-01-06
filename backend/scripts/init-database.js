const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
};

async function initDatabase() {
  let connection;

  try {
    // 连接到 MySQL 服务器（不指定数据库）
    connection = await mysql.createConnection(dbConfig);
    console.log('Connected to MySQL server');

    // 读取 SQL 文件
    const sqlPath = path.join(__dirname, 'init-db.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    // 按分号分割 SQL 语句
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);

    // 执行每条 SQL 语句
    for (const statement of statements) {
      await connection.query(statement);
      console.log('Executed:', statement.substring(0, 50) + '...');
    }

    console.log('✅ Database initialized successfully!');
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

initDatabase();
