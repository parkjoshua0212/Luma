import express from 'express';
import cors from 'cors';
import { pool } from './db/pool.js';
import authRoutes from './routes/authRoutes.js';
import convRoutes from './routes/convRoutes.js';
import aiRoutes from './routes/aiRoutes.js';

import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './swagger.js';

export const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/conversations', convRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get('/', (req, res) => res.send("Luma API is running!"));

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      status: 'ok',
      db: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      db: 'disconnected',
      error: err.message
    });
  }
});