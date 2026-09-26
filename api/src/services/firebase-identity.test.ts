import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { test } from 'node:test';
import mongoose from 'mongoose';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import User from '../models/user.model';
import Interview from '../models/interview.model';
import Resume from '../models/resume.model';
import { io as socketClient } from 'socket.io-client';
import initSocket from '../socket';

const uri = process.env.TEST_FIREBASE_MONGO_URI;
const run = Boolean(uri?.endsWith('/interviewmaster_firebase_test') &&
  process.env.FIREBASE_AUTH_EMULATOR_HOST && process.env.FIREBASE_PROJECT_ID);

test('Firebase emulator verifies identity, rejects email takeover, and enforces owner and admin checks',
  { skip: !run && 'Set TEST_FIREBASE_MONGO_URI and Firebase Auth emulator settings' },
  async () => {
    process.env.AUTH_PROVIDER = 'firebase';
    process.env.CLIENT_URL = 'http://localhost:5173';
    if (!getApps().length) initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID });
    const auth = getAuth();
    const marker = randomUUID();
    const createdUids: string[] = [];
    await mongoose.connect(uri!);
    const { default: app } = await import('../app.js') as any;
    const server = createServer(app);
    const io = initSocket(server);
    await new Promise<void>(resolve => server.listen(0, resolve));
    try {
      await mongoose.connection.dropDatabase();
      await Promise.all([User.init(), Interview.init()]);
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Test server did not bind');
      const base = `http://127.0.0.1:${address.port}`;
      const password = 'StrongPassword123!';
      const create = async (prefix: string, verified: boolean) => {
        const record = await auth.createUser({ email: `${prefix}-${marker}@example.com`,
          password, emailVerified: verified, displayName: 'Test Candidate' });
        createdUids.push(record.uid);
        return record;
      };
      const tokenFor = async (email: string) => {
        const response = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, returnSecureToken: true }),
        });
        assert.equal(response.status, 200);
        return (await response.json()).idToken as string;
      };
      const candidate = await create('candidate', false);
      let token = await tokenFor(candidate.email!);
      let response = await fetch(`${base}/api/auth/firebase/session`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      assert.equal(response.status, 403);
      await auth.updateUser(candidate.uid, { emailVerified: true });
      token = await tokenFor(candidate.email!);
      for (let i = 0; i < 2; i++) {
        response = await fetch(`${base}/api/auth/firebase/session`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
        assert.equal(response.status, 200);
      }
      assert.equal(await User.countDocuments({ firebaseUid: candidate.uid }), 1);
      response = await fetch(`${base}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
      assert.equal(response.status, 200);
      response = await fetch(`${base}/api/auth/me`, { headers: { Authorization: 'Bearer bad-token' } });
      assert.equal(response.status, 401);
      response = await fetch(`${base}/api/admin/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
      assert.equal(response.status, 403);

      const other = await create('other', true);
      const otherToken = await tokenFor(other.email!);
      response = await fetch(`${base}/api/auth/firebase/session`, { method: 'POST', headers: { Authorization: `Bearer ${otherToken}` } });
      assert.equal(response.status, 200);
      const otherUser: any = await User.findOne({ firebaseUid: other.uid });
      const interview = await Interview.create({ userId: otherUser._id, jobTitle: 'Engineer',
        jobDescription: 'Private job', experienceLevel: 'mid',
        questions: [{ questionText: 'Private question?' }] });
      response = await fetch(`${base}/api/interviews/${interview._id}`, { headers: { Authorization: `Bearer ${token}` } });
      assert.equal(response.status, 404);
      const resume = await Resume.create({ userId: otherUser._id, fileName: 'private-resume',
        originalName: 'private.pdf', publicId: 'private-resume', deliveryType: 'authenticated' });
      response = await fetch(`${base}/api/resumes/${resume._id}/download`, { headers: { Authorization: `Bearer ${token}` } });
      assert.equal(response.status, 404);
      response = await fetch(`${base}/api/resumes/${resume._id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      assert.equal(response.status, 404);
      await resume.deleteOne();

      const forbiddenSocket = socketClient(base, { auth: { token: 'bad-token' }, transports: ['websocket'], reconnection: false });
      try {
        const failure = await new Promise<Error>((resolve, reject) => {
          forbiddenSocket.once('connect_error', resolve);
          setTimeout(() => reject(new Error('Socket authentication did not fail')), 3000);
        });
        assert.match(failure.message, /Authentication required/);
      } finally { forbiddenSocket.disconnect(); }
      const candidateSocket = socketClient(base, { auth: { token }, transports: ['websocket'], reconnection: false });
      try {
        await new Promise<void>((resolve, reject) => {
          candidateSocket.once('connect', () => resolve());
          candidateSocket.once('connect_error', reject);
        });
        const denied = new Promise<string>((resolve, reject) => {
          candidateSocket.once('ai_error', resolve);
          setTimeout(() => reject(new Error('Cross-user socket request did not fail')), 3000);
        });
        candidateSocket.emit('live_answer', { interviewId: String(interview._id),
          sessionId: String(new mongoose.Types.ObjectId()),
          questionId: String(interview.questions[0]._id), answerText: 'Private answer' });
        assert.match(await denied, /unavailable|already been used/i);
      } finally { candidateSocket.disconnect(); }

      response = await fetch(`${base}/api/auth/firebase/account`, { method: 'DELETE',
        headers: { Authorization: `Bearer ${otherToken}` } });
      assert.equal(response.status, 200);
      await assert.rejects(auth.getUser(other.uid));
      assert.equal(await Interview.countDocuments({ userId: otherUser._id }), 0);
      assert.ok((await User.findById(otherUser._id))?.deletedAt);

      const adminEmail = `admin-${marker}@example.com`;
      await User.create({ name: 'Existing Admin', email: adminEmail, password, role: 'super_admin' });
      const chosenEmail = await auth.createUser({ email: adminEmail, password, emailVerified: true });
      createdUids.push(chosenEmail.uid);
      const chosenToken = await tokenFor(adminEmail);
      response = await fetch(`${base}/api/auth/firebase/session`, { method: 'POST', headers: { Authorization: `Bearer ${chosenToken}` } });
      assert.equal(response.status, 409);
      assert.equal(await User.countDocuments({ firebaseUid: chosenEmail.uid }), 0);

      await new Promise(resolve => setTimeout(resolve, 1100));
      await auth.revokeRefreshTokens(candidate.uid);
      response = await fetch(`${base}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
      assert.equal(response.status, 401);
    } finally {
      await new Promise<void>(resolve => io.close(() => resolve()));
      server.closeAllConnections();
      await new Promise<void>(resolve => server.close(() => resolve()));
      await Promise.allSettled(createdUids.map(uid => auth.deleteUser(uid)));
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
      process.env.AUTH_PROVIDER = 'legacy';
    }
  });
