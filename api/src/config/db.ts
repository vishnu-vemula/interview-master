import mongoose from 'mongoose';
import logger from './logger';
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      bufferCommands: false,
    });
    logger.info(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    // @ts-expect-error TODO(ts-migration): type this site
    logger.error(`❌ MongoDB connection error: ${error.message}`);
    logger.warn('⚠️ Server continuing without MongoDB. Some features will be disabled.');
  }
};

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected. Attempting to reconnect...');
});

mongoose.connection.on('reconnected', () => {
  logger.info('MongoDB reconnected');
});

export default connectDB;