const mysql = require('mysql2/promise');

async function migrate() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'uniai_studio'
  });

  try {
    await conn.execute('ALTER TABLE tasks ADD COLUMN result_images TEXT AFTER result_image_id');
    console.log('✅ Column result_images added successfully');
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') {
      console.log('✅ Column result_images already exists');
    } else {
      console.error('❌ Error:', e.message);
    }
  }

  await conn.end();
}

migrate();
