import pg from 'pg';

const { Pool } = pg;

export const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL !== 'false' //SSL with cert verification for Neon, off for local/CI Postgres
});