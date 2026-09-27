import test from 'node:test';
import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import mongoose from 'mongoose';
import pdf from 'pdf-parse';
import cloudinary from '../config/cloudinary';
import groq from '../config/groq';
import User from '../models/user.model';
import Resume from '../models/resume.model';
import Interview from '../models/interview.model';
import { generateAccessToken } from '../utils/jwt.utils';

const uri = process.env.TEST_RESUME_MONGO_URI;
test('PDF upload uses private storage, owner checks, parser retry and object cleanup',
  { skip: !uri?.endsWith('/interviewmaster_resume_test') }, async () => {
    process.env.AUTH_PROVIDER = 'legacy';
    process.env.JWT_SECRET = 'test-access-secret-at-least-32-characters';
    process.env.CLIENT_URL = 'http://localhost:5173';
    const document = readFileSync(resolve(__dirname, 'fixtures/resume.pdf'));
    assert.match((await pdf(document)).text, /Jane Doe API engineer/);
    const originalUpload = cloudinary.uploader.upload_stream;
    const originalDestroy = cloudinary.uploader.destroy;
    const originalDownload = cloudinary.utils.private_download_url;
    const originalCreate = groq.chat.completions.create;
    const objects = new Set<string>();
    let parserFails = true;
    (cloudinary.uploader as any).upload_stream = (options: any, callback: any) => {
      assert.equal(options.type, 'authenticated');
      assert.equal(options.resource_type, 'raw');
      return new Writable({ write(_chunk, _encoding, done) { done(); }, final(done) {
        objects.add(options.public_id);
        callback(null, { public_id: options.public_id, format: 'pdf' });
        done();
      } });
    };
    (cloudinary.uploader as any).destroy = async (publicId: string) => {
      objects.delete(publicId); return { result: 'ok' };
    };
    (cloudinary.utils as any).private_download_url = (publicId: string) => `https://example.com/private/${publicId}`;
    (groq.chat.completions as any).create = async () => {
      if (parserFails) throw new Error('Temporary AI outage');
      return { choices: [{ message: { content: JSON.stringify({ name: 'Jane Doe', skills: ['API'] }) } }] };
    };
    await mongoose.connect(uri!);
    const { default: app } = await import('../legacy-test-app.js') as any;
    const server = app.listen(0);
    try {
      await mongoose.connection.dropDatabase();
      await Promise.all([User.init(), Resume.init(), Interview.init()]);
      const owner: any = await User.create({ name: 'Owner Candidate', email: 'resume-owner@example.com', password: 'StrongPassword123!' });
      const other: any = await User.create({ name: 'Other Candidate', email: 'resume-other@example.com', password: 'StrongPassword123!' });
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Test server did not bind');
      const base = `http://127.0.0.1:${address.port}/api/resumes`;
      const ownerHeaders = { Authorization: `Bearer ${generateAccessToken(owner._id)}` };
      const otherHeaders = { Authorization: `Bearer ${generateAccessToken(other._id)}` };
      const form = new FormData();
      form.append('resume', new Blob([document], { type: 'application/pdf' }), 'jane.pdf');
      let response = await fetch(`${base}/upload`, { method: 'POST', headers: ownerHeaders, body: form });
      assert.equal(response.status, 201);
      const uploaded = (await response.json()).resume;
      assert.equal(uploaded.deliveryType, 'authenticated');
      assert.equal(uploaded.parseStatus, 'parsed');
      assert.equal(uploaded.isParsed, false);
      assert.equal(uploaded.fileUrl, undefined);
      assert.equal(objects.size, 1);

      response = await fetch(`${base}/${uploaded._id}/download`, { headers: otherHeaders });
      assert.equal(response.status, 404);
      response = await fetch(`${base}/${uploaded._id}/download`, { headers: ownerHeaders });
      assert.equal(response.status, 200);
      assert.match((await response.json()).url, /^https:\/\/example.com\/private\//);
      parserFails = false;
      response = await fetch(`${base}/${uploaded._id}/parse`, { method: 'POST', headers: {
        ...ownerHeaders, 'Content-Type': 'application/json',
      }, body: JSON.stringify({ jobDescription: 'Build reliable APIs' }) });
      assert.equal(response.status, 200);
      assert.equal((await Resume.findById(uploaded._id))?.isParsed, true);
      response = await fetch(`${base}/${uploaded._id}`, { method: 'DELETE', headers: otherHeaders });
      assert.equal(response.status, 404);
      response = await fetch(`${base}/${uploaded._id}`, { method: 'DELETE', headers: ownerHeaders });
      assert.equal(response.status, 200);
      assert.equal(objects.size, 0);
      assert.equal(await Resume.countDocuments(), 0);
    } finally {
      (cloudinary.uploader as any).upload_stream = originalUpload;
      (cloudinary.uploader as any).destroy = originalDestroy;
      (cloudinary.utils as any).private_download_url = originalDownload;
      (groq.chat.completions as any).create = originalCreate;
      server.closeAllConnections();
      await new Promise<void>(resolve => server.close(() => resolve()));
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  });

