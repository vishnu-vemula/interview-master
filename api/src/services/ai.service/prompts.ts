import groq from '../../config/groq';
import logger from '../../config/logger';
import { extractContextViaRAG, buildSemanticChunks, createAndStoreEmbeddings, retrieveContextForTopic } from '../rag.service';
import { optimizeQuery } from '../optimizer.service';
import SystemPrompt from '../../models/system-prompt.model';
export const getActivePrompt = async (category, defaultVal) => {
  try {
    const promptDoc = await SystemPrompt.findOne({ category });
    return promptDoc ? promptDoc.content : defaultVal;
  } catch {
    return defaultVal;
  }
};

export const formatPrompt = (template, vars) => {
  return template.replace(/\$\{(\w+)\}/g, (match, key) => {
    return vars[key] !== undefined ? vars[key] : match;
  });
};

/**
 * Generate interview questions using Groq LLM (llama-3.3-70b-versatile)
 * @param {Object} params
 * @param {string} params.jobTitle
 * @param {string} params.jobDescription
 * @param {string} params.experienceLevel
 * @param {string[]} params.questionTypes
 * @param {number} params.numberOfQuestions
 * @param {string|null} params.resumeText
 * @returns {Promise<Array>} Array of question objects
 */
