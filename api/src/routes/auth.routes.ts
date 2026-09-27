import express from 'express';
const router = express.Router();

import { protectPostgres } from '../middleware/postgres-auth.middleware';
import { presentUser, resolvePostgresUser } from '../services/postgres-identity.service';
import { deleteMyAccount } from '../controllers/postgres-user.controller';

router.post('/firebase/session', async (req, res) => {
  const token = req.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];
  if (!token) return res.status(401).json({ success: false, message: 'Identity token required.' });
  const { user } = await resolvePostgresUser(token, true);
  return res.json({ success: true, data: { user: presentUser(user) }, user: presentUser(user) });
});
router.get('/me', protectPostgres, (req, res) => res.json({ success: true, data: { user: req.user }, user: req.user }));
router.delete('/firebase/account', protectPostgres, deleteMyAccount);
router.get('/providers', (_req, res) => res.json({ success: true, data: { email: true, google: true, linkedin: false } }));

export default router;
