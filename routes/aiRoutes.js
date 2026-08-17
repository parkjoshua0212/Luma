import express from 'express';
import { correctGrammar } from '../controllers/aiController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * @swagger
 * /api/ai/correct:
 *   post:
 *     summary: Get grammar correction and explanation for a sentence
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sentence]
 *             properties:
 *               sentence:
 *                 type: string
 *     responses:
 *       200:
 *         description: Correction result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 original:
 *                   type: string
 *                 corrected:
 *                   type: string
 *                 explanation:
 *                   type: string
 *       400:
 *         description: Missing sentence
 */
router.post('/correct', requireAuth, correctGrammar);

export default router;