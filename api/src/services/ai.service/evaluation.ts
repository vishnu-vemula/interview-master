import { getActivePrompt, formatPrompt } from './prompts';
import groq from '../../config/groq';
import logger from '../../config/logger';
import { extractContextViaRAG, buildSemanticChunks, createAndStoreEmbeddings, retrieveContextForTopic } from '../rag.service';
import { optimizeQuery } from '../optimizer.service';
import SystemPrompt from '../../models/system-prompt.model';
export const evaluateAnswer = async ({ questionText, answerText, expectedKeywords, jobTitle }) => {
  const defaultPrompt = `Act as an interviewer evaluating a candidate's response.

Job Title: \${jobTitle}
Question: \${questionText}
Expected Keywords Context: \${expectedKeywordsText}
Candidate's Answer: \${answerText}

Evaluate the candidate's answer strictly based on:
1. Correctness
2. Clarity
3. Depth

Return valid JSON exactly in this format:
{
  "score": <number 1-10>,
  "feedback": "<constructive feedback string explaining the evaluation based on correctness, clarity, and depth>"
}`;

  const rawTemplate = await getActivePrompt('ats_scorer', defaultPrompt);
  const prompt      = formatPrompt(rawTemplate, {
    jobTitle,
    questionText,
    expectedKeywordsText: expectedKeywords.join(', '),
    answerText: answerText || '(No answer provided)',
  });

  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.4,
    max_tokens: 512,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content;
  return JSON.parse(content || '{}');
};

/**
 * Generate overall session feedback
 */
export const generateOverallFeedback = async ({ jobTitle, answers }) => {
  const summary = answers
    .map((a, i) => `Q${i + 1}: ${a.questionText}\nScore: ${a.aiScore}/10\nAnswer: ${a.answerText?.slice(0, 200)}`)
    .join('\n\n');

  const defaultPrompt = `You are a senior interviewer providing a final interview report.
Be professional and concise.

Job Title: \${jobTitle}
Interview Summary:
\${summary}

Respond with valid JSON exacty in this format:
{
  "overallScore": <number 1-100>,
  "strengths": ["<point 1>", "<point 2>"],
  "weaknesses": ["<point 1>", "<point 2>"],
  "improvementTips": ["<point 1>", "<point 2>"]
}`;

  const rawTemplate = await getActivePrompt('feedback_report', defaultPrompt);
  const prompt      = formatPrompt(rawTemplate, { jobTitle, summary });

  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.5,
    max_tokens: 1024,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content;
  return JSON.parse(content || '{}');
};

/**
 * Parse Resume & Job Description into structured JSON
 * @param {string} resumeText - Raw extracted resume text
 * @param {string} jdText     - Job description text
 * @returns {Promise<Object>} Structured { resume, jobDescription } object
 */

export const evaluateStrictAnswer = async ({ retrievedChunks, question, answer }) => {
  const systemPrompt = `You are a strict technical interviewer.

Evaluate the candidate's answer using ONLY the given context.

Rules:
- Be strict, not generous
- Tie feedback directly to expected concepts in context
- No generic statements
- Penalize vague answers
- Always return valid JSON`;

  const userPrompt = `Context:
${retrievedChunks}

Question:
${question}

Candidate Answer:
${answer}

Return JSON exactly as:
{
  "score": (0-10),
  "correctness": "low | medium | high",
  "strengths": [],
  "weaknesses": [],
  "missed_concepts": [],
  "improvement_suggestions": []
}`;

  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.2,
    max_tokens: 1024,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content;
  try {
    return JSON.parse(content || '{}');
  } catch {
    throw new Error('AI evaluation returned invalid JSON.');
  }
};

/**
 * Generate a follow-up question based on the previous interaction
 * @param {Object} params
 * @param {string} params.retrievedChunks - Raw context from RAG
 * @param {string} params.question - The question previously asked
 * @param {string} params.answer - The candidate's answer
 * @returns {Promise<string>} Single follow-up question
 */
export const generateFollowUpQuestion = async ({ retrievedChunks, question, answer }) => {
  const systemPrompt = `You are a technical interviewer.

Generate a follow-up question based on the previous interaction.

Rules:
- Focus on weak areas or gaps
- Increase depth of evaluation
- Do NOT repeat the same concept
- Keep it precise`;

  const userPrompt = `Context:
${retrievedChunks}

Previous Question:
${question}

Candidate Answer:
${answer}

Output:
Single follow-up question.`;

  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.5,
    max_tokens: 512,
  });

  return response.choices[0]?.message?.content?.trim() || 'No follow-up generated.';
};

/**
 * Generate a comprehensive final evaluation report
 * @param {Array} allEvaluations - Array of individual answer evaluations
 * @returns {Promise<Object>} Structured report JSON
 */
export const generateFinalEvaluationReport = async (allEvaluations) => {
  const systemPrompt = `You are a senior interviewer.

Generate a final evaluation report based on the provided session data.

Rules:
- Be decisive
- No vague feedback
- Base everything on evaluation data
- Always return valid JSON`;

  const userPrompt = `Evaluation Data:
${JSON.stringify(allEvaluations, null, 2)}

Return JSON exactly as:
{
  "overall_score": (0-10),
  "skill_breakdown": [
    { "skill": "", "score": 0-10 }
  ],
  "key_strengths": [],
  "key_weaknesses": [],
  "hire_decision": "yes | no | borderline",
  "improvement_plan": [
    "step 1",
    "step 2"
  ]
}`;

  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.3,
    max_tokens: 2048,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content;
  try {
    return JSON.parse(content || '{}');
  } catch {
    throw new Error('AI report generator returned invalid JSON.');
  }
};

/**
 * Validate whether a model response is grounded in the provided context
 * @param {Object} params
 * @param {string} params.retrievedChunks - Context used for grounding
 * @param {string} params.modelOutput - Output to be validated
 * @returns {Promise<Object>} Grounding validation result
 */
