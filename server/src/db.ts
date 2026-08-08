import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

export const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/nexusflow';
    await mongoose.connect(mongoUri);
    console.log('✅ Successfully connected to MongoDB!');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err);
    // Don't exit process, allow graceful degradation if possible, or just fail to auth.
  }
};
