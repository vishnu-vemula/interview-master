import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import cloudinary from '../config/cloudinary';
import { OpenAIEmbeddings } from '@langchain/openai';
import { generateInterviewQuestions } from '../services/ai.service/questions';

async function smoke() {
  for (const name of ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET',
    'GROQ_API_KEY', 'OPENAI_API_KEY']) {
    if (!process.env[name] || /^(your_|replace_|example|changeme|test_)/i.test(process.env[name]!)) {
      throw new Error(`Configure ${name} before running the provider smoke test`);
    }
  }
  const document = readFileSync(resolve(__dirname, '../services/fixtures/resume.pdf'));
  const publicId = `smoke-${randomUUID()}`;
  const expectedObjectId = `interviewmaster/smoke/${publicId}`;
  let uploadStarted = false;
  let uploadedId: string | null = null;
  try {
    uploadStarted = true;
    const object: any = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({ resource_type: 'raw', type: 'authenticated',
        folder: 'interviewmaster/smoke', public_id: publicId },
      (error, result) => error ? reject(error) : resolve(result));
      stream.end(document);
    });
    uploadedId = object.public_id;
    const url = cloudinary.utils.private_download_url(uploadedId!, object.format || 'pdf', {
      resource_type: 'raw', type: 'authenticated', expires_at: Math.floor(Date.now() / 1000) + 60,
    });
    const download = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!download.ok || !Buffer.from(await download.arrayBuffer()).subarray(0, 5).equals(Buffer.from('%PDF-'))) {
      throw new Error(`Private Cloudinary download failed (${download.status})`);
    }
    console.log('Configured Cloudinary upload/download path: OK');

    const vector = await new OpenAIEmbeddings({ modelName: 'text-embedding-3-small' }).embedQuery('API engineering');
    if (!vector.length || !vector.every(Number.isFinite)) throw new Error('OpenAI embedding was empty or invalid');
    console.log(`Configured embedding endpoint: OK (${vector.length} dimensions${process.env.OPENAI_BASE_URL ? ', custom base URL' : ''})`);

    const questions = await generateInterviewQuestions({ jobTitle: 'API engineer',
      jobDescription: 'Design reliable HTTP APIs with idempotency keys, PostgreSQL transactions, and automated tests.',
      experienceLevel: 'mid', numberOfQuestions: 3,
      resumeText: 'Jane Doe is an API engineer who builds HTTP APIs, PostgreSQL transactions and automated tests.',
    });
    if (questions.length !== 3) throw new Error('Groq did not produce three validated questions');
    console.log(`Configured question endpoint: OK (3 validated questions${process.env.GROQ_BASE_URL ? ', custom base URL' : ''})`);
  } finally {
    if (uploadStarted) {
      const result = await cloudinary.uploader.destroy(uploadedId || expectedObjectId,
        { resource_type: 'raw', type: 'authenticated' });
      if (!['ok', 'not found'].includes(result.result)) throw new Error('Smoke object cleanup failed');
      console.log('Configured Cloudinary object cleanup: OK');
    }
  }
}

smoke().catch(error => { console.error(`Provider smoke test failed: ${error?.message || 'unknown'}`); process.exitCode = 1; });
