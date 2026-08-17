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

/**
 * @swagger
 * /api/conversations/start:
 *   post:
 *     summary: Start a new conversation
 *     tags: [Conversations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [mode]
 *             properties:
 *               mode:
 *                 type: string
 *                 enum: [formal, casual]
 *     responses:
 *       201:
 *         description: Conversation created
 *       400:
 *         description: Invalid or missing mode
 */
router.post('/start', startConversation);

/**
 * @swagger
 * /api/conversations:
 *   get:
 *     summary: List all conversations for the current user
 *     tags: [Conversations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of conversations
 */
router.get('/', getConversations);

/**
 * @swagger
 * /api/conversations/{id}:
 *   get:
 *     summary: Get a single conversation with its messages
 *     tags: [Conversations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Conversation ID
 *     responses:
 *       200:
 *         description: Conversation and its messages
 *       404:
 *         description: Conversation not found
 */
router.get('/:id', getConversationById);

/**
 * @swagger
 * /api/conversations/{id}:
 *   delete:
 *     summary: Delete a conversation
 *     tags: [Conversations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Conversation ID
 *     responses:
 *       200:
 *         description: Conversation deleted
 *       404:
 *         description: Conversation not found
 */
router.delete('/:id', deleteConversation);

/**
 * @swagger
 * /api/conversations/{id}/message:
 *   post:
 *     summary: Send a message in a conversation and get an AI reply
 *     tags: [Conversations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Conversation ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [content]
 *             properties:
 *               content:
 *                 type: string
 *     responses:
 *       201:
 *         description: AI reply message
 *       404:
 *         description: Conversation not found
 */
router.post('/:id/message', sendMessage);

export default router;