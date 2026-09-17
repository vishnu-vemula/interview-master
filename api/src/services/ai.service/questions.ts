import groq from '../../config/groq';
import logger from '../../config/logger';
import { extractContextViaRAG, buildSemanticChunks, createAndStoreEmbeddings, retrieveContextForTopic } from '../rag.service';
import { optimizeQuery } from '../optimizer.service';
import SystemPrompt from '../../models/system-prompt.model';
export const generateInterviewQuestions = async ({
  jobTitle,
  jobDescription,
  experienceLevel,
  numberOfQuestions = 10,
  resumeText = null,
}) => {
  const optimizedContext = await extractContextViaRAG(resumeText, jobDescription);

  // Distribute questions: ~2/3 technical, ~1/3 behavioral (min 1 each)
  const technicalCount = Math.max(1, Math.round((numberOfQuestions * 2) / 3));
  const behavioralCount = Math.max(1, numberOfQuestions - technicalCount);

  const systemPrompt = `You are an expert technical interviewer and HR specialist.
You create precise, challenging, and role-relevant interview questions solely based on the provided context retrieved from RAG chunks.
NO HALLUCINATIONS: Do not ask questions about skills or tools not explicitly present in the provided context.
Always respond with valid JSON only — no extra text, no markdown fences.`;

  const userPrompt = `Act as an AI interviewer.

Given the following strictly retrieved chunks of candidate context and role requirements:
---
${optimizedContext}
---

Job Title: ${jobTitle}
Experience Level: ${experienceLevel}

Generate:
- ${technicalCount} technical questions
- ${behavioralCount} behavioral questions

Rules:
- STRICT GROUNDING: You MUST base every single question ONLY on the provided retrieved chunks above.
- If a technology or experience is not mentioned in the context, DO NOT generate a question about it.
- Questions must match candidate skill level (${experienceLevel}).
- Avoid generic questions.
- Behavioral questions should use STAR method format.
- Technical questions should test real-world problem solving.
- Include 3-5 expected keywords for each question.

Return structured JSON exactly in this format:
{
  "technical": [
    {
      "questionText": "...",
      "difficulty": "easy|medium|hard",
      "expectedKeywords": ["keyword1", "keyword2"]
    }
  ],
  "behavioral": [
    {
      "questionText": "...",
      "difficulty": "easy|medium|hard",
      "expectedKeywords": ["keyword1", "keyword2"]
    }
  ]
}`;

  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: 4096,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('No response from AI model.');

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('AI returned invalid JSON. Please try again.');
  }

  const technicalQs = Array.isArray(parsed.technical) ? parsed.technical : [];
  const behavioralQs = Array.isArray(parsed.behavioral) ? parsed.behavioral : [];

  if (!technicalQs.length && !behavioralQs.length) {
    throw new Error('AI returned no valid questions. Please try again.');
  }

  // Flatten and map to MongoDB question schema format
  const allQuestions = [];
  
  technicalQs.forEach(q => {
    allQuestions.push({
      questionText: q.questionText || q.question || '',
      category: 'technical',
      difficulty: q.difficulty || 'medium',
      expectedKeywords: Array.isArray(q.expectedKeywords) ? q.expectedKeywords : [],
    });
  });

  behavioralQs.forEach(q => {
    allQuestions.push({
      questionText: q.questionText || q.question || '',
      category: 'behavioral',
      difficulty: q.difficulty || 'medium',
      expectedKeywords: Array.isArray(q.expectedKeywords) ? q.expectedKeywords : [],
    });
  });

  // Safety slice: ensure we never return more than the requested number of questions
  const trimmed = allQuestions.slice(0, numberOfQuestions);
  return trimmed.map((q, i) => ({ ...q, order: i + 1 }));
};

/**
 * Evaluate a candidate's answer using Groq
 */

export const generateSeniorTechnicalQuestions = async ({
  retrievedChunks,
  parsedResumeData,
  parsedJdData,
}) => {
  const systemPrompt = `You are a senior technical interviewer.

Generate interview questions using ONLY the provided context.

Rules:
- Do NOT use outside knowledge
- Questions must map directly to skills/projects in context
- Avoid generic questions
- Cover:
  - Core skills
  - Project-based questions
  - Problem-solving
- Difficulty: mixed (easy → hard)
- Max 5 questions`;

  const userPrompt = `Context:
${retrievedChunks}

Candidate Profile:
${JSON.stringify(parsedResumeData, null, 2)}

Job Requirements:
${JSON.stringify(parsedJdData, null, 2)}

Output:
Numbered list of questions.`;

  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.6,
    max_tokens: 1024,
  });

  return response.choices[0]?.message?.content?.trim() || 'Failed to generate questions.';
};

/**
 * Strict technical evaluation of a candidate's answer using RAG context
 * @param {Object} params
 * @param {string} params.retrievedChunks - Raw context from RAG
 * @param {string} params.question - The question being answered
 * @param {string} params.answer - The candidate's answer
 * @returns {Promise<Object>} Evaluation JSON
 */

export const generateTopicQuestions = async ({ resumeText, jobDescription, topic, parsedResumeData, parsedJdData }) => {
  // Step 1: Prepare Vector Store
  const chunks      = buildSemanticChunks(resumeText, jobDescription);
  const vectorStore = await createAndStoreEmbeddings(chunks);

  // Step 2, 3 & 4: Retrieval & Format Context
  const context = await retrieveContextForTopic(vectorStore, topic);

  // Step 5 & 6: Generation (using our existing grounded generator logic)
  return generateSeniorTechnicalQuestions({
    retrievedChunks: context,
    parsedResumeData,
    parsedJdData,
  });
};

export const generateQuestionsDirect = async (jobTitle, jobDescription) => {
  if (!jobTitle || !jobDescription) {
    throw new Error('Job title and job description are required.');
  }

  const systemPrompt = `You are a professional AI Technical Recruiter.
Generate 5 targeted, highly role-relevant interview questions (3 technical, 2 behavioral) based specifically on the provided Job Title and Job Description.
Always respond with a valid JSON object containing a "questions" key pointing to an array of question strings. Format:
{
  "questions": [
    "Question 1...",
    "Question 2...",
    "Question 3...",
    "Question 4...",
    "Question 5..."
  ]
}`;

  const userPrompt = `Job Title: ${jobTitle}
Job Description:
${jobDescription}`;

  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.7,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('Failed to generate questions.');

  try {
    const parsed = JSON.parse(content);
    return parsed.questions || [];
  } catch (err) {
    logger.error('Failed to parse direct questions JSON from Groq:', err);
    throw new Error('Failed to parse questions response.');
  }
};
