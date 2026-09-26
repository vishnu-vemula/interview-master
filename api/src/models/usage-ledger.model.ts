import mongoose from 'mongoose';

const usageLedgerSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  interviewId: { type: mongoose.Schema.Types.ObjectId, ref: 'Interview', required: true },
  periodKey: { type: String, required: true },
  status: { type: String, enum: ['reserved', 'committed', 'released'], required: true },
  unitsDelta: { type: Number, required: true },
  reason: { type: String, required: true },
}, { timestamps: true });
usageLedgerSchema.index({ interviewId: 1, reason: 1 }, { unique: true });
export default mongoose.model('UsageLedger', usageLedgerSchema);
