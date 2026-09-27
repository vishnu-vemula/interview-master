import express from 'express';
import { protectPostgres } from '../middleware/postgres-auth.middleware';
import { checkout, listPlans, me, orderStatus, payuNotification, payuReturn } from '../controllers/postgres-billing.controller';

const router = express.Router();
router.get('/plans', listPlans);
router.post('/payu/webhook', payuNotification);
router.post('/payu/return', payuReturn);
router.get('/me', protectPostgres, me);
router.post('/checkout', protectPostgres, checkout);
router.get('/orders/:transactionId', protectPostgres, orderStatus);
export default router;
