import { Router } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { META_SCOPES, exchangeCode, fetchPages, setConnectedPages, selectPage } from '../services/meta.js';

const router = Router();
const redirectUri = () => `${process.env.SERVER_URL}/api/accounts/meta/callback`;
const graphVer = () => process.env.GRAPH_VERSION || 'v23.0';

router.get('/', requireAuth, (req, res) => res.json(req.user.toSafe().meta));

router.get('/meta/connect', requireAuth, (req, res) => {
  const state = jwt.sign({ id: req.user.id }, process.env.JWT_SECRET, { expiresIn: '10m' });
  const url = new URL(`https://www.facebook.com/${graphVer()}/dialog/oauth`);
  url.search = new URLSearchParams({
    client_id: process.env.FACEBOOK_APP_ID,
    redirect_uri: redirectUri(),
    state,
    scope: META_SCOPES.join(','),
    response_type: 'code',
  });
  res.redirect(url.toString());
});

router.get('/meta/callback', async (req, res) => {
  const back = (q) => res.redirect(`${process.env.CLIENT_URL}/connect?${q}`);
  try {
    if (req.query.error || !req.query.code) return back('error=denied');
    const { id } = jwt.verify(String(req.query.state), process.env.JWT_SECRET);
    const user = await User.findById(id);
    if (!user) return back('error=user');

    const userToken = await exchangeCode(String(req.query.code), redirectUri());
    const pages = await fetchPages(userToken);
    if (!setConnectedPages(user, pages, user.meta?.pageId)) return back('error=nopage');

    await user.save();
    back('connected=1');
  } catch (e) {
    console.error('Meta connect failed:', e.response?.data || e.message);
    back('error=meta');
  }
});

router.post('/meta/select', requireAuth, async (req, res) => {
  if (!selectPage(req.user, String(req.body?.pageId || '')))
    return res.status(404).json({ error: 'Page not found. Disconnect and connect again.' });
  await req.user.save();
  res.json(req.user.toSafe().meta);
});

router.delete('/meta', requireAuth, async (req, res) => {
  req.user.meta = undefined;
  await req.user.save();
  res.json(req.user.toSafe().meta);
});

export default router;
