import { pool } from '../db/pool.js';
import { getChatReply, getGrammarCorrection } from '../lib/gemini.js';
import { isValidLength } from '../utils/validators.js';

// Pulls a usable correction out of a settled grammar-check promise, or
// returns nulls if it failed or found nothing worth flagging. Used in
// both the success and failure paths below, so a failed chat reply can
// never accidentally throw away a grammar result that succeeded fine.
function extractCorrection(grammarSettled, originalContent) {
  if (grammarSettled.status !== 'fulfilled') {
    console.error('Grammar check failed (non-fatal):', grammarSettled.reason);
    return { correctedContent: null, correctionExplanation: null };
  }

  const { corrected, explanation } = grammarSettled.value;
  const noErrorsFound = explanation?.trim().toLowerCase() === 'no errors found';
  const unchanged = corrected?.trim() === originalContent.trim();

  if (noErrorsFound || unchanged) {
    return { correctedContent: null, correctionExplanation: null };
  }

  return { correctedContent: corrected, correctionExplanation: explanation };
}

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
    // they're independent Gemini calls. allSettled (not all) means a
    // failure in either one never takes down the other.
    const [replySettled, grammarSettled] = await Promise.allSettled([
      getChatReply(mode, historyResult.rows, content),
      getGrammarCorrection(content)
    ]);

    if (replySettled.status === 'rejected') {
      console.error('Gemini chat reply failed:', replySettled.reason);

      // The chat reply failing doesn't mean the grammar check did too —
      // check it independently instead of discarding it.
      const { correctedContent, correctionExplanation } = extractCorrection(grammarSettled, content);

      const userMessageResult = await pool.query(
        `INSERT INTO messages (conversation_id, sender, content, corrected_content, correction_explanation) 
         VALUES ($1, 'user', $2, $3, $4) 
         RETURNING id, sender, content, corrected_content, correction_explanation, created_at`,
        [id, content, correctedContent, correctionExplanation]
      );

      const isQuotaError = replySettled.reason?.isQuotaError;
      return res.status(isQuotaError ? 429 : 502).json({
        error: isQuotaError
          ? "You've hit today's free AI usage limit. Try again tomorrow."
          : 'Your message was saved, but the AI reply failed. Try again.',
        userMessage: userMessageResult.rows[0]
      });
    }

    const aiReply = replySettled.value;
    const { correctedContent, correctionExplanation } = extractCorrection(grammarSettled, content);

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