import mongoose from 'mongoose';

/**
 * Single-use, short-lived auth tokens (password reset links and OAuth login codes).
 * Only a SHA-256 hash of the token is stored; documents expire automatically.
 */
const authTokenSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  purpose: { type: String, enum: ['password_reset', 'oauth_login'], required: true },
  tokenHash: { type: String, required: true, unique: true },
  meta: { type: mongoose.Schema.Types.Mixed, default: null },
  expiresAt: { type: Date, required: true },
  usedAt: { type: Date, default: null },
}, { timestamps: true });

authTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('AuthToken', authTokenSchema);
