/**
 * seedAdmin.js — Create the admin user in MongoDB
 *
 * Run once: node backend/src/scripts/seedAdmin.js
 */

import dotenv from 'dotenv';
dotenv.config({ path: require('path').join(__dirname, '../../.env') });
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/user.model';
const ADMIN = {
  name:     'InterviewMaster Admin',
  email:    'admin@interviewmaster.com',
  password: 'passwore123',
  role:     'super_admin',   // Super Admin — full platform access
};

async function seedAdmin() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Check if admin already exists
    const existing = await User.findOne({ email: ADMIN.email });

    if (existing) {
      // Update role to admin and reset password
      existing.role     = 'admin';
      existing.password = ADMIN.password; // pre-save hook will hash it
      existing.isActive = true;
      await existing.save();
      console.log(`✅ Admin user updated: ${ADMIN.email}`);
    } else {
      await User.create(ADMIN);
      console.log(`✅ Admin user created: ${ADMIN.email}`);
    }

    console.log(`\n🔑 Login credentials:`);
    console.log(`   Email:    ${ADMIN.email}`);
    console.log(`   Password: ${ADMIN.password}`);
    console.log(`   Role:     admin\n`);

  } catch (err) {
    // @ts-expect-error TODO(ts-migration): type this site
    console.error('❌ Error seeding admin:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seedAdmin();
