const mysql = require('mysql2/promise');

async function addFavoritesColumns() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'uniai_studio',
  });

  try {
    // 检查 url 列是否存在
    const [columns] = await connection.execute(
      "SHOW COLUMNS FROM favorites LIKE 'url'"
    );

    if (columns.length === 0) {
      console.log('Adding url, prompt, filename columns to favorites table...');
      
      // 删除外键约束
      try {
        await connection.execute('ALTER TABLE favorites DROP FOREIGN KEY favorites_ibfk_1');
        console.log('Dropped foreign key constraint');
      } catch (e) {
        console.log('No foreign key to drop or already dropped');
      }

      // 添加新列
      await connection.execute('ALTER TABLE favorites ADD COLUMN url TEXT NOT NULL DEFAULT "" AFTER id');
      await connection.execute('ALTER TABLE favorites ADD COLUMN prompt TEXT AFTER url');
      await connection.execute('ALTER TABLE favorites ADD COLUMN filename VARCHAR(255) DEFAULT "image.png" AFTER prompt');
      
      // 修改 image_id 为可空
      try {
        await connection.execute('ALTER TABLE favorites MODIFY COLUMN image_id VARCHAR(36) NULL');
        console.log('Modified image_id to nullable');
      } catch (e) {
        console.log('image_id modification skipped');
      }
      
      console.log('Columns added successfully!');
    } else {
      console.log('Columns already exist, skipping...');
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await connection.end();
  }
}

addFavoritesColumns();
