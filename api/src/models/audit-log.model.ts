/**
 * models/AuditLog.model.js
 *
 * Mongoose Schema for system-wide auditing logs.
 * Registers security signins, AI model completions, webhook payments, and scraper timers.
 */

import mongoose from 'mongoose';
const auditLogSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      enum: ['auth', 'admin', 'ai', 'payment', 'scraper', 'email'],
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['success', 'failed', 'warning', 'info'],
      default: 'success',
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    details: {
      type: String,
      required: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

export default mongoose.model('AuditLog', auditLogSchema);
