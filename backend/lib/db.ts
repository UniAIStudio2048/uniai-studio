import mysql from 'mysql2/promise';

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'uniai_studio',
};

let pool: mysql.Pool | null = null;

export function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      ...dbConfig,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });

    console.log('[DB] Connection pool created', {
      host: dbConfig.host,
      database: dbConfig.database,
      connectionLimit: 10,
    });
  }
  return pool;
}

export async function query<T = any>(sql: string, params?: any[]): Promise<T> {
  const pool = getPool();
  try {
    const [rows] = await pool.execute(sql, params);
    return rows as T;
  } catch (error: any) {
    console.error('[DB Query Error]', {
      sql: sql.substring(0, 100), // 只记录前100个字符
      error: error.message,
      code: error.code,
      timestamp: new Date().toISOString(),
    });
    throw error; // 重新抛出错误，保持原有行为
  }
}

export default { getPool, query };
