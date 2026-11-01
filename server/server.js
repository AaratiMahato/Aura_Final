import 'dotenv/config';
import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import passport from 'passport';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import connectDB, { dbReady } from './config/db.js';
import { uploadDir } from './config/paths.js';
import './config/passport.js';
import authRoutes from './routes/auth.js';
import authExtraRoutes from './routes/authExtra.js';
import accountRoutes from './routes/accounts.js';
import postRoutes from './routes/posts.js';

const app = express();
app.set('trust proxy', 1); // behind ngrok / reverse proxy
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        connectSrc: ["'self'"],
      },
    },
  })
);
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(passport.initialize());

// Public so Meta can download images when publishing
app.use('/uploads', express.static(uploadDir, { maxAge: '7d' }));

app.get('/api/health', (_req, res) => res.json({ ok: true, database: dbReady() ? 'connected' : 'not connected' }));
app.use('/api', (_req, res, next) =>
  dbReady()
    ? next()
    : res.status(503).json({ error: 'Database is not connected. Start MongoDB and check MONGODB_URI in server/.env, then restart.' })
);
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 200 }), authRoutes);
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 200 }), authExtraRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/posts', postRoutes);

// Production: serve the built React app from this same server (one host, same-origin cookies)
const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'client', 'dist');
if (process.env.NODE_ENV === 'production' && fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^\/(?!api|uploads).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use((err, _req, res, _next) => {
  console.error(err);
  const dup = err.code === 11000;
  res.status(dup ? 409 : err.status || 500).json({ error: dup ? 'This account already exists' : err.message || 'Something went wrong' });
});

const port = process.env.PORT || 5000;
connectDB();
app.listen(port, () => {
      const on = (v) => (v ? 'ON ' : 'OFF');
      console.log(`API running on http://localhost:${port}`);
      console.log(`  AI captions (Gemini)      : ${on(process.env.GEMINI_API_KEY)}`);
      console.log(`  Google login              : ${on(process.env.GOOGLE_CLIENT_ID)}`);
      console.log(`  Facebook login + posting  : ${on(process.env.FACEBOOK_APP_ID)}`);
      console.log(`  Instagram login           : ${on(process.env.INSTAGRAM_APP_ID && process.env.INSTAGRAM_APP_SECRET)}`);
      console.log(`  Instagram image hosting   : ${on(process.env.CLOUDINARY_API_KEY || process.env.PUBLIC_BASE_URL)}`);
    });
