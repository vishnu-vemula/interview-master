import dotenv from 'dotenv';
import path from 'node:path';
import mongoose from 'mongoose';
import User from '../models/user.model';

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function main() {
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!process.env.MONGO_URI || !email || !password || password.length < 16) {
    throw new Error('MONGO_URI, ADMIN_BOOTSTRAP_EMAIL and a 16+ character ADMIN_BOOTSTRAP_PASSWORD are required');
  }
  await mongoose.connect(process.env.MONGO_URI);
  const existing = await User.findOne({ email });
  if (existing) throw new Error('Bootstrap email already has an account; refusing automatic promotion');
  await User.create({ name: 'Platform Administrator', email, password, role: 'super_admin' });
  console.log('Super admin account created. Remove bootstrap credentials from the environment.');
}

main().catch((error: Error) => { console.error(error.message); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
