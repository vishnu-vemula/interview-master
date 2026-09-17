require('dotenv').config();
import connectDB from '../config/db';
import User from '../models/user.model';
import Resume from '../models/resume.model';
import { getRecommendedJobs } from '../controllers/jobs.controller';

connectDB().then(async () => {
  let user = await User.findOne();
  if (!user) {
    user = await User.create({ name: 'Test User', email: 'test@example.com', password: 'password123' });
    console.log('Created test user:', user.email);
  }
  
  let resume = await Resume.findOne({ userId: user._id });
  if (!resume) {
    resume = await Resume.create({
      userId: user._id,
      fileName: 'test.pdf',
      originalName: 'test.pdf',
      fileUrl: 'https://example.com/test.pdf',
      publicId: 'test_id',
      isDefault: true,
      parsedData: { skills: ['React', 'Node.js', 'Docker', 'MongoDB'] }
    });
    console.log('Created test resume');
  } else {
    await Resume.updateOne(
      { _id: resume._id }, 
      { 
        $set: { 
          parsedData: { skills: ['React', 'Node.js', 'Docker', 'MongoDB'] }, 
          isDefault: true 
        } 
      }
    );
    console.log('Updated existing resume skills');
  }

  const req = { user };
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(payload) {
      console.log('API RESPONSE CODE:', this.statusCode);
      console.log('RECOMMENDED JOBS COUNT:', payload.results.length);
      console.log(JSON.stringify(payload.results.slice(0, 3).map(j => ({ title: j.title, matchScore: j.matchScore })), null, 2));
      process.exit(0);
    }
  };

    // @ts-expect-error TODO(ts-migration): type this site
  await getRecommendedJobs(req, res);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
