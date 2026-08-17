import express from 'express';
import {
  startConversation,
  getConversations,
  getConversationById,
  deleteConversation
} from '../controllers/convController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { sendMessage } from '../controllers/messageController.js';

const router = express.Router();

router.use(requireAuth); // all conversation routes require auth

router.post('/start', startConversation);
router.get('/', getConversations);
router.get('/:id', getConversationById);
router.delete('/:id', deleteConversation);
router.post('/:id/message', sendMessage);

export default router;