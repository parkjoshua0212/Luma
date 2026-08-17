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