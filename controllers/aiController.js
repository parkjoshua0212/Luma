import { getGrammarCorrection } from '../lib/gemini.js';
import { isValidLength } from '../utils/validators.js';

// POST /api/ai/correct
export const correctGrammar = async (req, res) => {
  try {
    const { sentence } = req.body;

    if (!sentence || typeof sentence !== 'string') {
      return res.status(400).json({ error: 'A sentence string is required' });
    }

    if (!isValidLength(sentence, 500)) {
      return res.status(400).json({ error: 'Sentence must be 500 characters or fewer' });
    }

    const result = await getGrammarCorrection(sentence);
    res.json(result);
  } catch (err) {
    console.error(err);
    if (err.isQuotaError) {
      return res.status(429).json({ error: "You've hit today's free AI usage limit. Try again tomorrow." });
    }
    res.status(500).json({ error: 'Failed to correct grammar' });
  }
};