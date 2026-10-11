import mongoose from 'mongoose';
import { env } from './env.js';

let memoryServer = null;

// Connects to MONGO_URI, or (outside production) to a temporary in-memory MongoDB
// so the API can be run and tried without installing a database.
export async function connectDB() {
  let uri = env.mongoUri;
  if (!uri) {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    memoryServer = await MongoMemoryServer.create();
    uri = memoryServer.getUri('crm');
    console.log('MONGO_URI not set: using a temporary in-memory MongoDB (data is lost on restart).');
  }
  await mongoose.connect(uri);
  console.log('MongoDB connected');
}

export async function disconnectDB() {
  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop();
}
