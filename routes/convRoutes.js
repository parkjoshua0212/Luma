import express from 'express';
import {
  startConversation,
  getConversations,
  getConversationById,
  deleteConversation
} from '../controllers/convController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(requireAuth); // all conversation routes require auth

router.post('/start', startConversation);
router.get('/', getConversations);
router.get('/:id', getConversationById);
router.delete('/:id', deleteConversation);

export default router;