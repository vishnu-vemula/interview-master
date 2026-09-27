import mongoose from 'mongoose';

const paymentOrderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  planId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', required: true },
  transactionId: { type: String, required: true, unique: true },
  idempotencyKey: { type: String, required: true, unique: true },
  amountMinor: { type: Number, required: true, min: 1 },
  creditLimit: { type: Number, required: true, min: 1 },
  durationDays: { type: Number, required: true, min: 1 },
  currency: { type: String, required: true, enum: ['INR'] },
  productInfo: { type: String, required: true },
  firstName: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  callbackEmailTag: { type: String, default: null, select: false },
  callbackPhoneTag: { type: String, default: null, select: false },
  status: { type: String, required: true, enum: ['pending', 'success', 'failed', 'refund_pending', 'refunded'], default: 'pending', index: true },
  payuId: { type: String, default: null },
  refundToken: { type: String, default: null },
  refundRequestId: { type: String, default: null },
  failureCode: { type: String, default: null },
  lastReconciledAt: { type: Date, default: null },
  reconcileLeaseUntil: { type: Date, default: null },
}, { timestamps: true });

paymentOrderSchema.index({ status: 1, lastReconciledAt: 1, reconcileLeaseUntil: 1 });

export default mongoose.model('PaymentOrder', paymentOrderSchema);
