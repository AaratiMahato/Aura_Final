import mongoose from 'mongoose';

mongoose.set('strictQuery', true);
mongoose.set('bufferCommands', false); // fail fast instead of hanging when DB is down

export const dbReady = () => mongoose.connection.readyState === 1;

// Connects, and keeps retrying in the background so the API never crashes if MongoDB is not up yet.
export default async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('\n[DB] MONGODB_URI is empty in server/.env\n');
    return;
  }
  const attempt = async () => {
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
      console.log(`[DB] MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
    } catch (e) {
      console.error(`\n[DB] Cannot connect to MongoDB (${e.message})`);
      console.error('[DB] 1) Is MongoDB Community Server installed and running?  2) Is MONGODB_URI correct in server/.env?');
      console.error('[DB] Retrying in 5 seconds...\n');
      setTimeout(attempt, 5000);
    }
  };
  attempt();
}
