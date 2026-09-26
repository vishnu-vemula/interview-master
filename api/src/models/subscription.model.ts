import mongoose from 'mongoose';

const subscriptionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  planId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', required: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'PaymentOrder', required: true, unique: true },
  creditLimit: { type: Number, required: true, min: 1 },
  status: { type: String, enum: ['active', 'canceled', 'refunded', 'expired'], default: 'active', index: true },
  currentPeriodStart: { type: Date, required: true },
  currentPeriodEnd: { type: Date, required: true, index: true },
  cancelAtPeriodEnd: { type: Boolean, default: false },
  canceledAt: { type: Date, default: null },
}, { timestamps: true });

subscriptionSchema.index({ userId: 1, status: 1, currentPeriodEnd: -1 });
export default mongoose.model('Subscription', subscriptionSchema);
