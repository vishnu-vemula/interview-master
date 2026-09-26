import mongoose from 'mongoose';
const resumeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    fileName: {
      type: String,
      required: true,
    },
    originalName: {
      type: String,
      required: true,
    },
    fileUrl: {
      type: String,
      default: '',
    },
    deliveryType: { type: String, enum: ['upload', 'authenticated'], default: 'upload' },
    format: { type: String, default: 'pdf' },
    publicId: {
      type: String, // Cloudinary public_id for deletion
      required: true,
    },
    fileSize: {
      type: Number, // in bytes
    },
    mimeType: {
      type: String,
      enum: ['application/pdf', 'application/msword',
             'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    },
    extractedText: {
      type: String, // Raw text extracted from PDF/doc
      default: null,
    },
    parsedData: {
      type: mongoose.Schema.Types.Mixed, // Structured JSON from AI parser
      default: null,
    },
    isParsed: {
      type: Boolean,
      default: false,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    parseStatus: {
      type: String,
      enum: ['pending', 'parsed', 'failed'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

// Ensure only one default resume per user
resumeSchema.pre('save', async function (next) {
  if (this.isDefault) {
    // @ts-expect-error TODO(ts-migration): type this site
    await this.constructor.updateMany(
      { userId: this.userId, _id: { $ne: this._id } },
      { isDefault: false }
    );
  }
  next();
});

export default mongoose.model('Resume', resumeSchema);
