import { pool } from '../db/pool.js';

// POST /api/conversations/start
export const startConversation = async (req, res) => {
  try {
    const { mode } = req.body; // 'formal' or 'casual'

    if (!mode || !['formal', 'casual'].includes(mode)) {
      return res.status(400).json({ error: "Mode must be 'formal' or 'casual'" });
    }

    const result = await pool.query(
      `INSERT INTO conversations (user_id, mode) 
       VALUES ($1, $2) 
       RETURNING id, user_id, mode, started_at`,
      [req.userId, mode]
    );

    res.status(201).json({ conversation: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to start conversation' });
  }
};

// GET /api/conversations
export const getConversations = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, mode, started_at, ended_at 
       FROM conversations 
       WHERE user_id = $1 
       ORDER BY started_at DESC`,
      [req.userId]
    );

    res.json({ conversations: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
};

// GET /api/conversations/:id
export const getConversationById = async (req, res) => {
  try {
    const { id } = req.params;

    // Confirm the conversation belongs to this user
    const convResult = await pool.query(
      `SELECT id, mode, started_at, ended_at 
       FROM conversations 
       WHERE id = $1 AND user_id = $2`,
      [id, req.userId]
    );

    if (convResult.rows.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const messagesResult = await pool.query(
      `SELECT id, sender, content, created_at 
       FROM messages 
       WHERE conversation_id = $1 
       ORDER BY created_at ASC`,
      [id]
    );

    res.json({
      conversation: convResult.rows[0],
      messages: messagesResult.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
};

// DELETE /api/conversations/:id
export const deleteConversation = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `DELETE FROM conversations 
       WHERE id = $1 AND user_id = $2 
       RETURNING id`,
      [id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json({ message: 'Conversation deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
};