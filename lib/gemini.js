import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

console.log('Gemini key loaded:', process.env.GEMINI_API_KEY ? 'YES' : 'NO - undefined');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const SYSTEM_PROMPTS = {
  formal: `You are a professional language conversation partner. Respond formally and 
politely, using correct grammar and complete sentences. Keep responses concise (2-4 sentences), 
as this is a spoken conversation practice session, not an essay.`,
  casual: `You are a friendly conversation partner, chatting like a close friend. Use casual, 
natural language, contractions, and a relaxed tone. Keep responses short and conversational 
(1-3 sentences), like a real text or chat exchange.`
};

export async function getChatReply(mode, conversationHistory, userMessage) {
  const systemPrompt = SYSTEM_PROMPTS[mode] || SYSTEM_PROMPTS.casual;

  const historyText = conversationHistory
    .map(m => `${m.sender === 'user' ? 'User' : 'AI'}: ${m.content}`)
    .join('\n');

  const prompt = `${systemPrompt}

Conversation so far:
${historyText}

User: ${userMessage}
AI:`;

  const response = await ai.models.generateContent({
    model: 'gemini-3.6-flash',
    contents: prompt
  });

  return response.text;
}

export async function getGrammarCorrection(sentence) {
  const prompt = `You are a grammar correction assistant. Given a sentence, correct any 
grammar, spelling, or phrasing errors, and briefly explain what was fixed.

Respond ONLY in valid JSON, with this exact structure, no markdown formatting, no code blocks:
{
  "original": "the original sentence",
  "corrected": "the corrected sentence",
  "explanation": "a brief explanation of what was fixed, or 'No errors found' if it was already correct"
}

Sentence to correct: "${sentence}"`;

  const response = await ai.models.generateContent({
    model: 'gemini-3.6-flash',
    contents: prompt
  });

  // Gemini sometimes wraps JSON in markdown code fences — strip them if present
  const cleanText = response.text.replace(/```json|```/g, '').trim();

  try {
    return JSON.parse(cleanText);
  } catch (err) {
    console.error('Failed to parse Gemini JSON response:', cleanText);
    throw new Error('AI returned an unparseable response');
  }
}