import pg from 'pg';

const { DB_HOST, DB_PORT = '5432', DB_USER, DB_PASSWORD, DB_NAME, DB_SCHEMA = 'wa_nalizer' } = process.env;

if (!DB_HOST || !DB_USER || !DB_PASSWORD || !DB_NAME) {
  console.error('Falta DB_HOST, DB_USER, DB_PASSWORD o DB_NAME en .env');
  process.exit(1);
}

const pool = new pg.Pool({
  host: DB_HOST,
  port: Number(DB_PORT),
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  // Las tablas viven en DB_SCHEMA (no en public, que Supabase expone por la Data API y exige RLS).
  options: `-c search_path=${DB_SCHEMA}`,
});

export const query = (text: string, params?: unknown[]) => pool.query(text, params);
