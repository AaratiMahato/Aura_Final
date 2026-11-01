import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import passport from 'passport';
import User from '../models/User.js';
import { requireAuth, signToken, setAuthCookie, userPayload } from '../middleware/auth.js';
import { loginScopes, exchangeCode, fetchPages, setConnectedPages, fetchProfile } from '../services/meta.js';

const router = Router();
const client = () => process.env.CLIENT_URL;
const fbRedirect = () => `${process.env.SERVER_URL}/api/auth/facebook/callback`;
const graphVer = () => process.env.GRAPH_VERSION || 'v23.0';

router.get('/providers', (_req, res) =>
  res.json({
    google: Boolean(process.env.GOOGLE_CLIENT_ID),
    facebook: Boolean(process.env.FACEBOOK_APP_ID),
    instagram: Boolean(process.env.INSTAGRAM_APP_ID && process.env.INSTAGRAM_APP_SECRET),
    cloudinary: Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY),
  })
);

// ---------- Email + password (users are stored in MongoDB: database aura_pro, collection users) ----------
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!email || !password || password.length < 8)
    return res.status(400).json({ error: 'Email and a password of 8+ characters are required' });
  if (await User.findOne({ email: email.toLowerCase() }))
    return res.status(409).json({ error: 'Email already registered. Please sign in.' });
  const user = await User.create({ name, email, passwordHash: await bcrypt.hash(password, 12) });
  setAuthCookie(res, signToken(user.id));
  res.status(201).json(userPayload(user));
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  const user = email && (await User.findOne({ email: email.toLowerCase() }));
  if (!user?.passwordHash || !(await bcrypt.compare(password || '', user.passwordHash)))
    return res.status(401).json({ error: 'Invalid email or password' });
  setAuthCookie(res, signToken(user.id));
  res.json(userPayload(user));
});

router.post('/logout', (_req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => res.json(userPayload(req.user)));

router.patch('/me', requireAuth, async (req, res) => {
  const { name, businessName, captionTone, businessType, audience, location, keywords, callToAction, autoPost } = req.body || {};
  if (name !== undefined) req.user.name = name;
  if (businessName !== undefined) req.user.businessName = businessName;
  if (captionTone !== undefined) req.user.captionTone = captionTone;
  if (businessType !== undefined) req.user.businessType = String(businessType).slice(0, 80);
  if (audience !== undefined) req.user.audience = String(audience).slice(0, 200);
  if (location !== undefined) req.user.location = String(location).slice(0, 120);
  if (keywords !== undefined) req.user.keywords = String(keywords).slice(0, 200);
  if (callToAction !== undefined) req.user.callToAction = String(callToAction).slice(0, 160);
  if (autoPost !== undefined) req.user.autoPost = Boolean(autoPost);
  await req.user.save();
  res.json(userPayload(req.user));
});

// ---------- Login with Facebook: signs in AND connects your Facebook Page + Instagram in one step ----------
router.get('/facebook', (_req, res) => {
  if (!process.env.FACEBOOK_APP_ID) return res.redirect(`${client()}/login?error=facebook-not-configured`);
  const state = jwt.sign({ p: 'login' }, process.env.JWT_SECRET, { expiresIn: '10m' });
  const url = new URL(`https://www.facebook.com/${graphVer()}/dialog/oauth`);
  url.search = new URLSearchParams({
    client_id: process.env.FACEBOOK_APP_ID,
    redirect_uri: fbRedirect(),
    state,
    scope: loginScopes().join(','),
    response_type: 'code',
  });
  res.redirect(url.toString());
});

router.get('/facebook/callback', async (req, res) => {
  const fail = (code) => res.redirect(`${client()}/login?error=${code}`);
  try {
    if (req.query.error || !req.query.code) return fail('facebook-denied');
    jwt.verify(String(req.query.state), process.env.JWT_SECRET);

    const userToken = await exchangeCode(String(req.query.code), fbRedirect());
    const profile = await fetchProfile(userToken);
    const email = profile.email?.toLowerCase();

    let user = await User.findOne({ facebookId: profile.id });
    if (!user && email) user = await User.findOne({ email });
    if (!user) user = new User({ name: profile.name, ...(email ? { email } : {}) });
    user.facebookId = profile.id;
    if (!user.name) user.name = profile.name;
    if (!user.avatar) user.avatar = profile.picture?.data?.url;

    // Auto-connect the Facebook Page (+ linked Instagram) so posting works right after login
    try {
      setConnectedPages(user, await fetchPages(userToken), user.meta?.pageId);
    } catch (e) {
      console.error('Page lookup after Facebook login failed:', e.response?.data || e.message);
    }
    await user.save();

    setAuthCookie(res, signToken(user.id));
    res.redirect(`${client()}/dashboard`);
  } catch (e) {
    console.error('Facebook login failed:', e.response?.data || e.message);
    fail('facebook');
  }
});

// ---------- Login with Google ----------
router.get('/google', (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID) return res.redirect(`${client()}/login?error=google-not-configured`);
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })(req, res, next);
});
router.get(
  '/google/callback',
  (req, res, next) =>
    passport.authenticate('google', { session: false, failureRedirect: `${client()}/login?error=google` })(req, res, next),
  (req, res) => {
    setAuthCookie(res, signToken(req.user.id));
    res.redirect(`${client()}/dashboard`);
  }
);

export default router;
