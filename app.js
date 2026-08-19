import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { pool } from './db/pool.js';
import authRoutes from './routes/authRoutes.js';
import convRoutes from './routes/convRoutes.js';
import aiRoutes from './routes/aiRoutes.js';

import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './swagger.js';

export const app = express();

app.use(helmet());

// Only these origins are allowed to call the API from a browser.
// Add your deployed frontend's URL here once it's live, or set
// ALLOWED_ORIGINS as a comma-separated env var to avoid a redeploy.
const defaultOrigins = ['http://localhost:5173', 'http://localhost:3000'];
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : defaultOrigins;

app.use(cors({
  origin: (origin, callback) => {
    // requests with no origin (Postman, curl, server-to-server) are allowed —
    // this policy is specifically about which *websites* can call the API
    // from a browser, not about locking down all non-browser access.
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));

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