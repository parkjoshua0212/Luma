import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { pool } = pg;

export const pool = new pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } //needed for Neon
});