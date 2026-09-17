import Groq from 'groq-sdk';
require('dotenv').config();

if (!process.env.GROQ_API_KEY) {
  console.warn('[GROQ] Warning: GROQ_API_KEY is missing from environment variables.');
}

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export default groq;