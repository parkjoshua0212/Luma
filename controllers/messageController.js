import { pool } from '../db/pool.js';
import { getChatReply } from '../lib/gemini.js';

// POST /api/conversations/:id/message
export const sendMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Message content is required' });
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

    await pool.query(
      `INSERT INTO messages (conversation_id, sender, content) VALUES ($1, 'user', $2)`,
      [id, content]
    );

    const aiReply = await getChatReply(mode, historyResult.rows, content);

    const aiMessageResult = await pool.query(
      `INSERT INTO messages (conversation_id, sender, content) 
       VALUES ($1, 'ai', $2) 
       RETURNING id, sender, content, created_at`,
      [id, aiReply]
    );

    res.status(201).json({ reply: aiMessageResult.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send message' });
  }
};