import { pool } from '../db/pool.js';
import { getChatReply, getGrammarCorrection } from '../lib/gemini.js';
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

    // Run the conversational reply and the grammar check in parallel —
    // they're independent Gemini calls, no reason to wait on one before
    // starting the other. allSettled (not all) means a grammar-check
    // failure never takes down the actual conversation.
    const [replySettled, grammarSettled] = await Promise.allSettled([
      getChatReply(mode, historyResult.rows, content),
      getGrammarCorrection(content)
    ]);

    if (replySettled.status === 'rejected') {
      console.error('Gemini chat reply failed:', replySettled.reason);
      const userMessageResult = await pool.query(
        `INSERT INTO messages (conversation_id, sender, content) 
         VALUES ($1, 'user', $2) 
         RETURNING id, sender, content, corrected_content, correction_explanation, created_at`,
        [id, content]
      );
      return res.status(502).json({
        error: 'Your message was saved, but the AI reply failed. Try again.',
        userMessage: userMessageResult.rows[0]
      });
    }

    const aiReply = replySettled.value;

    // Only attach a correction if the grammar check succeeded AND actually
    // found something worth flagging — "no errors found" or an identical
    // sentence shouldn't light up the lightbulb icon.
    let correctedContent = null;
    let correctionExplanation = null;
    if (grammarSettled.status === 'fulfilled') {
      const { corrected, explanation } = grammarSettled.value;
      const noErrorsFound = explanation?.trim().toLowerCase() === 'no errors found';
      const unchanged = corrected?.trim() === content.trim();
      if (!noErrorsFound && !unchanged) {
        correctedContent = corrected;
        correctionExplanation = explanation;
      }
    } else {
      // Non-fatal — the conversation still works, it just won't show a
      // grammar tip for this particular message.
      console.error('Grammar check failed (non-fatal):', grammarSettled.reason);
    }

    const userMessageResult = await pool.query(
      `INSERT INTO messages (conversation_id, sender, content, corrected_content, correction_explanation) 
       VALUES ($1, 'user', $2, $3, $4) 
       RETURNING id, sender, content, corrected_content, correction_explanation, created_at`,
      [id, content, correctedContent, correctionExplanation]
    );

    const aiMessageResult = await pool.query(
      `INSERT INTO messages (conversation_id, sender, content) 
       VALUES ($1, 'ai', $2) 
       RETURNING id, sender, content, corrected_content, correction_explanation, created_at`,
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