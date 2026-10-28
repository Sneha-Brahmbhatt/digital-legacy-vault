import mongoose from 'mongoose';
import { ENV } from './env.js';

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(ENV.MONGO_URI, {
      serverSelectionTimeoutMS: 5000
    });
    console.log(`[MongoDB] Connected successfully to host: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`[MongoDB] Connection error: ${error.message}`);
    if (ENV.NODE_ENV === 'production') {
      process.exit(1);
    } else {
      console.warn('[MongoDB] Running in offline/degraded mode. Ensure MongoDB is running for full functionality.');
    }
    return null;
  }
};
