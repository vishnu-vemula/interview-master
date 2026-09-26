import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [50, 'Name cannot exceed 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },
    firebaseUid: { type: String, unique: true, sparse: true, select: false },
    password: {
      type: String,
      required: function (this: any) { return !this.firebaseUid; },
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
    },
    role: {
      type: String,
      enum: ['candidate', 'support', 'content_manager', 'admin', 'super_admin'],
      default: 'candidate',
    },
    avatar: {
      type: String,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isBanned: {
      type: Boolean,
      default: false,
    },
    credits: {
      type: Number,
      default: 10,
    },
    isPremium: {
      type: Boolean,
      default: false,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
    totalSessions: {
      type: Number,
      default: 0,
    },
    passwordChangedAt: Date,
    deletedAt: { type: Date, default: null },
    refreshToken: {
      type: String,
      select: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Virtuals ──────────────────────────────────────────────────────
userSchema.virtual('resumes', {
  ref: 'Resume',
  localField: '_id',
  foreignField: 'userId',
});

userSchema.virtual('sessions', {
  ref: 'Session',
  localField: '_id',
  foreignField: 'userId',
});

// ─── Pre-save Hook: Hash Password ─────────────────────────────────
userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// ─── Methods ──────────────────────────────────────────────────────
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password || typeof candidatePassword !== 'string') return false;
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = Math.floor(this.passwordChangedAt.getTime() / 1000);
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

export default mongoose.model('User', userSchema);
