const mysql = require('mysql2/promise');

async function addModelColumn() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'uniai_studio',
  });

  try {
    console.log('Adding model column to tasks table...');
    
    // 检查列是否已存在
    const [columns] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'tasks' AND COLUMN_NAME = 'model'`,
      [process.env.DB_NAME || 'uniai_studio']
    );
    
    if (columns.length === 0) {
      // 添加 model 列
      await connection.query(`
        ALTER TABLE tasks 
        ADD COLUMN model VARCHAR(50) DEFAULT 'nano-banana-2' AFTER batch_count,
        ADD INDEX idx_model (model)
      `);
      console.log('Model column added successfully!');
    } else {
      console.log('Model column already exists, skipping...');
    }
    
  } catch (error) {
    console.error('Error adding model column:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

addModelColumn()
  .then(() => {
    console.log('Database migration completed!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Database migration failed:', err);
    process.exit(1);
  });
