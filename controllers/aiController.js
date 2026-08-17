import { getGrammarCorrection } from '../lib/gemini.js';

// POST /api/ai/correct
export const correctGrammar = async (req, res) => {
  try {
    const { sentence } = req.body;

    if (!sentence || typeof sentence !== 'string') {
      return res.status(400).json({ error: 'A sentence string is required' });
    }

    const result = await getGrammarCorrection(sentence);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to correct grammar' });
  }
};