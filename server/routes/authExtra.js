import { Router } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { signToken, setAuthCookie } from '../middleware/auth.js';
import { encrypt } from '../utils/crypto.js';
import {
  instagramEnabled,
  instagramAuthUrl,
  exchangeInstagramCode,
  fetchInstagramProfile,
} from '../services/instagram.js';

// Additional sign-in feature (Instagram). Mounted under /api/auth (see server.js), next to the existing auth routes.
const router = Router();
const client = () => process.env.CLIENT_URL;

// ---------- Login with Instagram (users are stored in MongoDB: database aura_pro, collection users) ----------
router.get('/instagram', (_req, res) => {
  if (!instagramEnabled()) return res.redirect(`${client()}/login?error=instagram-not-configured`);
  const state = jwt.sign({ p: 'ig-login' }, process.env.JWT_SECRET, { expiresIn: '10m' });
  res.redirect(instagramAuthUrl(state));
});

router.get('/instagram/callback', async (req, res) => {
  const fail = (code) => res.redirect(`${client()}/login?error=${code}`);
  try {
    if (req.query.error || !req.query.code) return fail('instagram-denied');
    const { p } = jwt.verify(String(req.query.state), process.env.JWT_SECRET);
    if (p !== 'ig-login') return fail('instagram');

    const { token, expiresAt, userId } = await exchangeInstagramCode(String(req.query.code));
    const profile = await fetchInstagramProfile(token);
    const igId = String(profile.user_id || userId || profile.id);

    let user = await User.findOne({ instagramId: igId });
    // Instagram does not share an email address, so a new Instagram login creates its own account
    if (!user) user = new User({ name: profile.name || profile.username, instagramId: igId });
    user.instagramId = igId;
    user.instagram = {
      username: profile.username,
      accountType: profile.account_type,
      token: encrypt(token), // AES-256-GCM, same as Facebook Page tokens
      tokenExpiresAt: expiresAt,
      connectedAt: new Date(),
    };
    if (!user.name) user.name = profile.name || profile.username;
    if (!user.avatar && profile.profile_picture_url) user.avatar = profile.profile_picture_url;
    await user.save();

    setAuthCookie(res, signToken(user.id));
    res.redirect(`${client()}/dashboard`);
  } catch (e) {
    console.error('Instagram login failed:', e.response?.data || e.message);
    fail('instagram');
  }
});

export default router;
