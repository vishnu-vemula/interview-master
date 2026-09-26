import mongoose from 'mongoose';

const usageCounterSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  periodKey: { type: String, required: true },
  units: { type: Number, required: true, default: 0, min: 0 },
}, { timestamps: true });
usageCounterSchema.index({ userId: 1, periodKey: 1 }, { unique: true });
export default mongoose.model('UsageCounter', usageCounterSchema);
