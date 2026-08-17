import express from 'express';
import { correctGrammar } from '../controllers/aiController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/correct', requireAuth, correctGrammar);

export default router;