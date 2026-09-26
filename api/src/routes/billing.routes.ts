import express from 'express';
import { protect } from '../middleware/auth.middleware';
import { checkout, listPlans, me, orderStatus, payuNotification, payuReturn } from '../controllers/billing.controller';

const router = express.Router();
router.get('/plans', listPlans);
router.post('/payu/webhook', payuNotification);
router.post('/payu/return', payuReturn);
router.get('/me', protect, me);
router.post('/checkout', protect, checkout);
router.get('/orders/:transactionId', protect, orderStatus);
export default router;
