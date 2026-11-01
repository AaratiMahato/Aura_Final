import { Router } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import Post from '../models/Post.js';
import { requireAuth } from '../middleware/auth.js';
import { uploadDir } from '../config/paths.js';
import { generateCaption } from '../services/gemini.js';
import { publishFacebook, publishInstagram } from '../services/meta.js';
import { decrypt } from '../utils/crypto.js';
import { cloudinaryEnabled, uploadToCloudinary } from '../services/cloudinary.js';

const router = Router();
router.use(requireAuth);

const MAX_PHOTOS = 10; // Instagram carousels allow up to 10

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: MAX_PHOTOS },
  fileFilter: (_req, file, cb) =>
    /^image\/(jpeg|png|gif|webp)$/.test(file.mimetype)
      ? cb(null, true)
      : cb(new Error('Only JPG, PNG, GIF or WEBP images')),
});

// 1) Upload photo -> normalise to JPEG (Instagram needs JPEG) -> Gemini caption + hashtags
const profileOf = (u) => ({
  businessName: u.businessName,
  tone: u.captionTone,
  businessType: u.businessType,
  audience: u.audience,
  location: u.location,
  keywords: u.keywords,
  callToAction: u.callToAction,
});

// Smaller copy sent to the AI so several photos stay well under Gemini's request size limit
const forAI = (buffer) => sharp(buffer).resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();

// Older posts only have imagePath/imageUrl: move them into `images` so every post is handled the same way
const ensureImages = (post) => {
  if (!post.images?.length) post.images = [{ path: post.imagePath, url: post.imageUrl, publicUrl: post.publicUrl }];
  return post.images;
};

router.post('/generate', upload.fields([{ name: 'photos', maxCount: MAX_PHOTOS }, { name: 'photo', maxCount: 1 }]), async (req, res) => {
  const files = [...(req.files?.photos || []), ...(req.files?.photo || [])];
  if (!files.length) return res.status(400).json({ error: 'At least one photo is required' });
  const { businessName, tone, businessType, audience, location, keywords, callToAction, autoPost } = req.body;

  if (businessName !== undefined) req.user.businessName = businessName;
  if (tone) req.user.captionTone = tone;
  if (businessType) req.user.businessType = String(businessType).slice(0, 80);
  if (audience !== undefined) req.user.audience = String(audience).slice(0, 200);
  if (location !== undefined) req.user.location = String(location).slice(0, 120);
  if (keywords !== undefined) req.user.keywords = String(keywords).slice(0, 200);
  if (callToAction !== undefined) req.user.callToAction = String(callToAction).slice(0, 160);
  if (autoPost !== undefined) req.user.autoPost = autoPost === 'true' || autoPost === true;
  await req.user.save();

  const saved = [];
  const buffers = [];
  try {
    for (const file of files) {
      const buffer = await sharp(file.buffer)
        .rotate()
        .resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 88 })
        .toBuffer();
      const filename = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.jpg`;
      const imagePath = path.join(uploadDir, filename);
      await fs.writeFile(imagePath, buffer);
      saved.push({ path: imagePath, url: `/uploads/${filename}` });
      buffers.push(buffer);
    }
  } catch (e) {
    await Promise.all(saved.map((i) => fs.unlink(i.path).catch(() => {})));
    console.error('Image processing failed:', e.message);
    return res.status(400).json({ error: 'One of the images could not be read. Please try different photos.' });
  }

  let post;
  try {
    const aiBuffers = await Promise.all(buffers.map(forAI));
    const { caption, hashtags } = await generateCaption({ buffers: aiBuffers, ...profileOf(req.user) });
    post = await Post.create({
      user: req.user.id,
      images: saved,
      imagePath: saved[0].path,
      imageUrl: saved[0].url,
      caption,
      hashtags,
    });
  } catch (e) {
    await Promise.all(saved.map((i) => fs.unlink(i.path).catch(() => {})));
    console.error('Gemini failed:', e.message);
    return res.status(502).json({ error: 'AI could not read these images. Please try again.' });
  }

  // Optional: publish straight away to every connected account (no review step)
  if (req.user.autoPost && req.user.meta?.pageId) {
    const targets = ['facebook', req.user.meta.igUserId && 'instagram'].filter(Boolean);
    try {
      post = await publishPost(req.user, post, { targets });
    } catch (e) {
      console.error('Auto-post failed:', e.message);
    }
  }
  res.status(201).json(post);
});

// Ask the AI to rewrite the caption/hashtags of an existing draft (optional instruction, e.g. "shorter")
router.post('/:id/regenerate', async (req, res) => {
  const post = await Post.findOne({ _id: req.params.id, user: req.user.id });
  if (!post) return res.status(404).json({ error: 'Post not found' });
  try {
    const buffers = await Promise.all(ensureImages(post).map(async (i) => forAI(await fs.readFile(i.path))));
    const { caption, hashtags } = await generateCaption({
      buffers,
      ...profileOf(req.user),
      instruction: req.body?.instruction,
    });
    post.caption = caption;
    post.hashtags = hashtags;
    await post.save();
    res.json(post);
  } catch (e) {
    console.error('Gemini regenerate failed:', e.message);
    res.status(502).json({ error: 'AI could not rewrite this caption. Please try again.' });
  }
});

router.get('/', async (req, res) => {
  const posts = await Post.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(100);
  res.json(posts);
});

router.get('/:id', async (req, res) => {
  const post = await Post.findOne({ _id: req.params.id, user: req.user.id });
  if (!post) return res.status(404).json({ error: 'Post not found' });
  res.json(post);
});

// 2) Publish (caption + hashtags may have been edited by the user)
const httpError = (status, error) => Object.assign(new Error(error), { status });

async function publishPost(user, post, { caption, hashtags, targets }) {
  if (!targets.length) throw httpError(400, 'Choose at least one platform');
  if (typeof caption === 'string') post.caption = caption.slice(0, 2200);
  if (Array.isArray(hashtags)) post.hashtags = hashtags;

  const meta = user.meta;
  if (!meta?.pageId) {
    // No account connected: simulate a successful publish (nothing is sent to Facebook/Instagram)
    post.platforms = targets;
    post.results = Object.fromEntries(targets.map((t) => [t, { ok: true, id: `demo-${Date.now()}` }]));
    post.status = 'published';
    post.publishedAt = new Date();
    await post.save();
    return post;
  }
  if (!meta?.pageId) throw httpError(400, 'Connect your Facebook page first');
  const pageToken = decrypt(meta.pageToken);
  const imgs = ensureImages(post);
  const imageBuffers = await Promise.all(imgs.map((i) => fs.readFile(i.path)));

  // Instagram needs a public https image URL for every photo: Cloudinary (recommended) or your hosted PUBLIC_BASE_URL
  const imageUrls = imgs.map((i) => i.publicUrl || null);
  let uploadError = null;
  if (targets.includes('instagram')) {
    for (const [k, img] of imgs.entries()) {
      if (imageUrls[k]) continue;
      try {
        if (cloudinaryEnabled()) {
          img.publicUrl = await uploadToCloudinary(imageBuffers[k]);
          imageUrls[k] = img.publicUrl;
        } else if (process.env.PUBLIC_BASE_URL) {
          imageUrls[k] = `${process.env.PUBLIC_BASE_URL}${img.url}`;
        }
      } catch (e) {
        uploadError = e.message;
      }
    }
    post.publicUrl = imgs[0].publicUrl || post.publicUrl;
  }
  const igReady = imageUrls.every(Boolean);
  const message = `${post.caption}\n\n${post.hashtags.join(' ')}`.trim();

  post.platforms = targets;
  post.results = {};
  if (targets.includes('facebook'))
    post.results.facebook = await publishFacebook({ pageId: meta.pageId, pageToken, imageBuffers, message });
  if (targets.includes('instagram')) {
    post.results.instagram = !meta.igUserId
      ? { ok: false, error: 'No Instagram business account linked to your Facebook page' }
      : !igReady
        ? { ok: false, error: uploadError || 'Instagram needs a public link for every photo. Add the CLOUDINARY_* keys in server/.env (free) and try again.' }
        : await publishInstagram({ igUserId: meta.igUserId, pageToken, imageUrls, caption: message });
  }

  const anyOk = targets.some((t) => post.results[t]?.ok);
  post.status = anyOk ? 'published' : 'failed';
  if (anyOk) post.publishedAt = new Date();
  await post.save();
  return post;
}

router.post('/:id/publish', async (req, res) => {
  const post = await Post.findOne({ _id: req.params.id, user: req.user.id });
  if (!post) return res.status(404).json({ error: 'Post not found' });

  const { caption, hashtags, platforms } = req.body || {};
  const targets = (platforms || []).filter((p) => ['facebook', 'instagram'].includes(p));
  try {
    res.json(await publishPost(req.user, post, { caption, hashtags, targets }));
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    throw e;
  }
});

router.delete('/:id', async (req, res) => {
  const post = await Post.findOneAndDelete({ _id: req.params.id, user: req.user.id });
  if (post) {
    const paths = new Set([post.imagePath, ...(post.images || []).map((i) => i.path)]);
    await Promise.all([...paths].map((p) => fs.unlink(p).catch(() => {})));
  }
  res.json({ ok: true });
});

export default router;
