import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import Groq from 'groq-sdk';
import User from './models/user.model';
import { firebaseMode, resolveFirebaseUser } from './services/firebase-identity.service';
import Interview from './models/interview.model';
import Session from './models/session.model';
import SystemPrompt from './models/system-prompt.model';

const initSocket = (httpServer: any) => {
  const io = new Server(httpServer, {
    cors: { origin: process.env.CLIENT_URL || 'http://localhost:5173', methods: ['GET', 'POST'] },
  });
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (typeof token !== 'string') throw new Error('Authentication required');
      if (firebaseMode()) {
        const { user } = await resolveFirebaseUser(token);
        socket.data.userId = String(user._id);
        return next();
      }
      if (!process.env.JWT_SECRET) throw new Error('Authentication required');
      const decoded = jwt.verify(token, process.env.JWT_SECRET) as { id: string };
      const user: any = await User.findById(decoded.id).select('+passwordChangedAt');
      if (!user || !user.isActive || user.isBanned || user.changedPasswordAfter((decoded as any).iat)) throw new Error('Account unavailable');
      socket.data.userId = String(user._id);
      next();
    } catch { next(new Error('Authentication required')); }
  });

  io.on('connection', socket => {
    socket.on('live_answer', async (payload: any) => {
      let acquired = false;
      let claimedSessionId = '';
      let claimedQuestionId = '';
      let claimedAnswer = '';
      try {
        if (socket.data.liveBusy) throw new Error('A follow-up is already running');
        socket.data.liveBusy = true;
        acquired = true;
        const sessionId = String(payload?.sessionId || '');
        const interviewId = String(payload?.interviewId || '');
        const questionId = String(payload?.questionId || '');
        const answerText = String(payload?.answerText || '').trim();
        if (!answerText || answerText.length > 4000) throw new Error('Invalid answer');
        const interview: any = await Interview.findOne({ _id: interviewId, userId: socket.data.userId });
        const question = interview?.questions.id(questionId);
        if (!interview || !question) throw new Error('Interview access denied');
        const active = await Session.findOneAndUpdate({
          _id: sessionId, interviewId, userId: socket.data.userId,
          status: { $in: ['started', 'in_progress'] },
          answers: { $elemMatch: { questionId, answerText, skipped: false, followupUsed: { $ne: true } } },
        }, { $set: { 'answers.$.followupUsed': true } }, { new: true });
        if (!active) throw new Error('Save this answer before requesting its one live follow-up');
        claimedSessionId = sessionId;
        claimedQuestionId = questionId;
        claimedAnswer = answerText;

        let instruction = 'Act as an AI interviewer. Provide a brief 1-3 sentence follow-up based on the answer.';
        const configured = await SystemPrompt.findOne({ category: 'interview' });
        if (configured?.content) instruction = configured.content;
        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
        const stream = await groq.chat.completions.create({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'system', content: instruction }, { role: 'user', content:
            `Question: ${question.questionText}\nExpected keywords: ${question.expectedKeywords?.join(', ') || 'None'}\nCandidate answer: ${answerText}` }],
          temperature: 0.5, max_tokens: 150, stream: true,
        });
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || '';
          if (content) socket.emit('ai_chunk', content);
        }
        socket.emit('ai_complete');
      } catch {
        if (claimedSessionId) await Session.updateOne({
          _id: claimedSessionId, userId: socket.data.userId,
          answers: { $elemMatch: { questionId: claimedQuestionId, answerText: claimedAnswer, followupUsed: true } },
        }, { $set: { 'answers.$.followupUsed': false } }).catch(() => {});
        socket.emit('ai_error', 'Live feedback is unavailable or has already been used for this answer.');
      } finally { if (acquired) socket.data.liveBusy = false; }
    });
  });
  return io;
};

export default initSocket;
