import assert from 'node:assert/strict';
import { test } from 'node:test';
import mongoose from 'mongoose';
import groq from '../config/groq';
import User from '../models/user.model';
import Interview from '../models/interview.model';
import Session from '../models/session.model';
import UsageCounter from '../models/usage-counter.model';
import UsageLedger from '../models/usage-ledger.model';
import { generateAccessToken } from '../utils/jwt.utils';

const uri = process.env.TEST_AI_MONGO_URI;
test('malformed AI output is retryable and generation/complete retries do not double charge',
  { skip: !uri?.endsWith('/interviewmaster_ai_test') && 'Set TEST_AI_MONGO_URI to disposable interviewmaster_ai_test' },
  async () => {
    process.env.AUTH_PROVIDER = 'legacy';
    process.env.JWT_SECRET = 'test-access-secret-at-least-32-characters';
    process.env.CLIENT_URL = 'http://localhost:5173';
    const previousOpenAI = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = '';
    const originalCreate = groq.chat.completions.create;
    let malformedQuestions = true;
    let malformedEvaluation = true;
    (groq.chat.completions as any).create = async (input: any) => {
      const prompt = input.messages.map((item: any) => item.content).join('\n');
      let data: any;
      if (prompt.includes('Generate:\n-')) {
        data = malformedQuestions ? { technical: [{ questionText: 'bad' }] } : {
          technical: [
            { questionText: 'Explain how you would design a reliable API?', difficulty: 'medium', expectedKeywords: ['reliability'] },
            { questionText: 'How would you test concurrent database writes?', difficulty: 'medium', expectedKeywords: ['transactions'] },
          ],
          behavioral: [
            { questionText: 'Tell me about a difficult team decision you made?', difficulty: 'medium', expectedKeywords: ['decision'] },
          ],
        };
      } else if (prompt.includes("Candidate's Answer:")) {
        data = malformedEvaluation ? { score: 'none' } : { score: 7, feedback: 'Clear explanation with useful detail.' };
      } else if (prompt.includes('Interview Summary:')) {
        data = { overallScore: 70, strengths: ['Clear explanations'],
          weaknesses: ['Add examples'], improvementTips: ['Practice concise answers'] };
      } else throw new Error('Unexpected AI call');
      return { choices: [{ message: { content: JSON.stringify(data) } }] };
    };
    await mongoose.connect(uri!);
    const { default: app } = await import('../app.js') as any;
    const server = app.listen(0);
    try {
      await mongoose.connection.dropDatabase();
      await Promise.all([User.init(), Interview.init(), Session.init(), UsageCounter.init(), UsageLedger.init()]);
      const user: any = await User.create({ name: 'AI Tester', email: 'ai@example.com', password: 'StrongPassword123!' });
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Test server did not bind');
      const base = `http://127.0.0.1:${address.port}`;
      const headers = { Authorization: `Bearer ${generateAccessToken(user._id)}`, 'Content-Type': 'application/json' };
      const request = (path: string, data: object = {}) => fetch(`${base}/api${path}`, {
        method: 'POST', headers, body: JSON.stringify(data),
      });
      const created = await request('/interviews', { jobTitle: 'Engineer',
        jobDescription: 'Design reliable APIs with transaction safety, automated tests and clear error handling.',
        experienceLevel: 'mid', numberOfQuestions: 3 });
      assert.equal(created.status, 201);
      const interviewId = (await created.json()).interview._id;
      let response = await request(`/interviews/${interviewId}/generate`);
      assert.equal(response.status, 503);
      assert.equal((await Interview.findById(interviewId))?.generationStatus, 'failed');
      assert.equal((await UsageCounter.findOne({ userId: user._id }))?.units, 0);
      malformedQuestions = false;
      response = await request(`/interviews/${interviewId}/generate`);
      assert.equal(response.status, 200);
      const interview: any = await Interview.findById(interviewId);
      assert.equal(interview.questions.length, 3);
      response = await request(`/interviews/${interviewId}/generate`);
      assert.equal(response.status, 200);
      assert.equal((await UsageCounter.findOne({ userId: user._id }))?.units, 1);
      assert.equal(await UsageLedger.countDocuments({ interviewId, status: 'committed' }), 1);

      response = await request('/sessions/start', { interviewId });
      assert.equal(response.status, 201);
      const sessionId = (await response.json()).session._id;
      for (const question of interview.questions) {
        response = await request(`/sessions/${sessionId}/answer`, { questionId: String(question._id),
          answerText: 'I would use transactions and retries.', timeTaken: 10 });
        assert.equal(response.status, 200);
      }
      response = await request(`/sessions/${sessionId}/complete`);
      assert.equal(response.status, 503);
      assert.equal((await Session.findById(sessionId))?.status, 'evaluation_failed');
      malformedEvaluation = false;
      response = await request(`/sessions/${sessionId}/complete`);
      assert.equal(response.status, 200);
      assert.equal((await Session.findById(sessionId))?.status, 'completed');
      response = await request(`/sessions/${sessionId}/complete`);
      assert.equal(response.status, 200);
      assert.equal((await User.findById(user._id))?.totalSessions, 1);
    } finally {
      (groq.chat.completions as any).create = originalCreate;
      if (previousOpenAI === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = previousOpenAI;
      server.closeAllConnections();
      await new Promise<void>(resolve => server.close(() => resolve()));
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  });
