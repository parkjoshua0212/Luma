import './env.js';
import fs from 'node:fs/promises';
import { pool } from '../../db/pool.js';

// Runs once before all integration tests: rebuild the tables from schema.sql.
export default async function () {
  const schema = await fs.readFile(new URL('../../db/schema.sql', import.meta.url), 'utf8');
  await pool.query('DROP TABLE IF EXISTS messages, conversations, users');
  await pool.query(schema);
  await pool.end();
}
