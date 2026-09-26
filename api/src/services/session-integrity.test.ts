import assert from 'node:assert/strict';
import { test } from 'node:test';
import mongoose from 'mongoose';
import User from '../models/user.model';
import Interview from '../models/interview.model';
import Session from '../models/session.model';
import { generateAccessToken } from '../utils/jwt.utils';

const uri = process.env.TEST_SESSION_MONGO_URI;
test('concurrent session starts and answers preserve one session and each answer',
  { skip: !uri?.endsWith('/interviewmaster_session_test') && 'Set TEST_SESSION_MONGO_URI to disposable interviewmaster_session_test' },
  async () => {
    process.env.AUTH_PROVIDER = 'legacy';
    process.env.JWT_SECRET = 'test-access-secret-at-least-32-characters';
    process.env.CLIENT_URL = 'http://localhost:5173';
    await mongoose.connect(uri!);
    const { default: app } = await import('../app.js') as any;
    const server = app.listen(0);
    try {
      await mongoose.connection.dropDatabase();
      await Promise.all([User.init(), Interview.init(), Session.init()]);
      const user: any = await User.create({ name: 'Session Tester', email: 'session@example.com',
        password: 'StrongPassword123!' });
      const interview: any = await Interview.create({ userId: user._id, jobTitle: 'Engineer',
        jobDescription: 'Test job', status: 'ready', generationStatus: 'generated',
        questions: [
          { questionText: 'First question?', order: 0 },
          { questionText: 'Second question?', order: 1 },
        ] });
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Test server did not bind');
      const base = `http://127.0.0.1:${address.port}`;
      const headers = { Authorization: `Bearer ${generateAccessToken(user._id)}`, 'Content-Type': 'application/json' };
      const starts = await Promise.all(Array.from({ length: 10 }, () => fetch(`${base}/api/sessions/start`, {
        method: 'POST', headers, body: JSON.stringify({ interviewId: String(interview._id) }),
      })));
      assert.ok(starts.every(response => [200, 201].includes(response.status)),
        `Unexpected start statuses: ${starts.map(response => response.status)}`);
      const sessionIds = await Promise.all(starts.map(async response => (await response.json()).session._id));
      assert.equal(new Set(sessionIds).size, 1);
      assert.equal(await Session.countDocuments({ interviewId: interview._id }), 1);

      const answer = (questionId: string, answerText: string) => fetch(`${base}/api/sessions/${sessionIds[0]}/answer`, {
        method: 'POST', headers, body: JSON.stringify({ questionId, answerText, timeTaken: 10 }),
      });
      const results = await Promise.all([
        answer(String(interview.questions[0]._id), 'First'),
        answer(String(interview.questions[1]._id), 'Second'),
        answer(String(interview.questions[0]._id), 'First'),
      ]);
      assert.ok(results.every(response => response.status === 200));
      const saved: any = await Session.findById(sessionIds[0]);
      assert.equal(saved.answers.length, 2);
      assert.deepEqual(new Set(saved.answers.map((item: any) => String(item.questionId))),
        new Set(interview.questions.map((item: any) => String(item._id))));
      const deletion = await fetch(`${base}/api/interviews/${interview._id}`, { method: 'DELETE', headers });
      assert.equal(deletion.status, 409);
    } finally {
      server.closeAllConnections();
      await new Promise<void>(resolve => server.close(() => resolve()));
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  });
