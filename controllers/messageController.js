import { pool } from '../db/pool.js';
import { getChatReply } from '../lib/gemini.js';
import { isValidLength } from '../utils/validators.js';

// POST /api/conversations/:id/message
export const sendMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    if (!isValidLength(content, 2000)) {
      return res.status(400).json({ error: 'Message must be 2000 characters or fewer' });
    }

    const convResult = await pool.query(
      `SELECT id, mode FROM conversations WHERE id = $1 AND user_id = $2`,
      [id, req.userId]
    );

    if (convResult.rows.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const { mode } = convResult.rows[0];

    const historyResult = await pool.query(
      `SELECT sender, content FROM messages 
       WHERE conversation_id = $1 ORDER BY created_at ASC`,
      [id]
    );

    const userMessageResult = await pool.query(
      `INSERT INTO messages (conversation_id, sender, content) 
       VALUES ($1, 'user', $2) 
       RETURNING id, sender, content, created_at`,
      [id, content]
    );

    // The user's message is saved at this point regardless of what happens next.
    // If Gemini fails, we tell the caller explicitly instead of a generic 500,
    // so the frontend can show "message sent, reply failed" instead of nothing.
    let aiReply;
    try {
      aiReply = await getChatReply(mode, historyResult.rows, content);
    } catch (aiErr) {
      console.error('Gemini call failed:', aiErr);
      return res.status(502).json({
        error: 'Your message was saved, but the AI reply failed. Try again.',
        userMessage: userMessageResult.rows[0]
      });
    }

    const aiMessageResult = await pool.query(
      `INSERT INTO messages (conversation_id, sender, content) 
       VALUES ($1, 'ai', $2) 
       RETURNING id, sender, content, created_at`,
      [id, aiReply]
    );

    res.status(201).json({
      userMessage: userMessageResult.rows[0],
      reply: aiMessageResult.rows[0]
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send message' });
  }
};