# Aura Pro: AI social media posting for photographers

Upload a photo, Gemini Vision writes a caption + 12 SEO hashtags, you edit, and it posts to your Facebook Page and Instagram business account via the Meta Graph API.

**Stack:** React (Vite) · Node/Express · MongoDB + Mongoose · Passport (Google, Facebook) · Gemini Vision · Meta Graph API

## 1. Requirements

| Need | Details |
|---|---|
| Node.js | v20 or newer (use nvm-windows on Windows) |
| MongoDB | Local Community Server **or** a free MongoDB Atlas cluster (get the connection string) |
| Google Gemini API key | https://aistudio.google.com/apikey |
| Google OAuth client | Google Cloud Console → APIs & Services → Credentials → OAuth client ID (Web). Redirect URI: `http://localhost:5000/api/auth/google/callback` |
| Meta developer app | https://developers.facebook.com → Create app (Business type). Add **Facebook Login**. Valid OAuth redirect URIs: `http://localhost:5000/api/auth/facebook/callback` and `http://localhost:5000/api/accounts/meta/callback` |
| Facebook Page | A Page you manage (your business page) |
| Instagram account | Professional (Business/Creator) account **linked to that Facebook Page** |
| ngrok (or any public HTTPS URL) | Meta downloads your image from a public URL, so `localhost` will not work for publishing |

### Meta permissions
Requested when connecting accounts: `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `instagram_basic`, `instagram_content_publish`, `business_management`.
While your app is in **Development mode** these work for people with a role on the app (Admin/Developer/Tester), so you can build and demo with no App Review. To let other photographers use it, submit the app for Meta App Review.

## 2. Setup

```bash
npm run install:all          # installs root, server, client (run `npm install` in root first for concurrently)
cp server/.env.example server/.env   # then fill in the values
```

Generate secrets:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"   # JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # TOKEN_ENC_KEY
```

Expose the API publicly (for Meta to fetch images) and put the URL in `PUBLIC_BASE_URL`:
```bash
ngrok http 5000
```

Run both servers:
```bash
npm run dev      # API on :5000, web on :5173
```
Open http://localhost:5173

> Use `localhost` consistently (not `127.0.0.1`) so OAuth cookies and redirects match.

## 3. MongoDB connection
`server/config/db.js` connects with `MONGODB_URI`.
- Local: `mongodb://127.0.0.1:27017/aura_pro`
- Atlas: `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/aura_pro?retryWrites=true&w=majority` (add your IP under Network Access)

Collections (Mongoose creates them automatically):
- `users`: name, email, passwordHash, googleId, facebookId, businessName, captionTone, `meta` (Page id/name, encrypted Page token, Instagram user id)
- `posts`: user, imageUrl, caption, hashtags, platforms, status (`draft|published|failed`), per-platform results, publishedAt

## 4. API
| Method | Route | Purpose |
|---|---|---|
| POST | `/api/auth/register` `/login` `/logout` | Email auth (JWT in httpOnly cookie) |
| GET | `/api/auth/google` `/facebook` | OAuth login |
| GET/PATCH | `/api/auth/me` | Current user / business settings |
| GET | `/api/accounts/meta/connect` | Start Meta Page + Instagram connection |
| DELETE | `/api/accounts/meta` | Disconnect |
| POST | `/api/posts/generate` | Upload photo → AI caption + hashtags |
| GET | `/api/posts`, `/api/posts/:id` | History / single post |
| POST | `/api/posts/:id/publish` | Publish to Facebook and/or Instagram |

## 5. Page map (matches the UI design)
Login → Dashboard (upload) → Processing → Review (caption & hashtags) → Published → Post History · Connect Accounts

## 6. Notes
- Photos are re-encoded to JPEG (max 2048px) because Instagram only accepts JPEG.
- Page access tokens are encrypted with AES-256-GCM before being stored.
- "Continue with Instagram" uses Facebook login (Instagram posting goes through Meta).
- Check `GRAPH_VERSION` and `GEMINI_MODEL` in `.env` against the current Meta and Google docs; both change over time.
- For production: HTTPS, set `NODE_ENV=production`, store images in S3/Cloudinary instead of `server/uploads`, and set `CLIENT_URL`/`SERVER_URL`/`PUBLIC_BASE_URL` to your real domains.

## 7. Hosting (single server serves API + React build)
`npm run build` then `npm start` (production mode serves `client/dist` from Express). See the hosting guide in the chat for Render/Railway and VPS steps.
Production env: `NODE_ENV=production`, `CLIENT_URL`, `SERVER_URL`, `PUBLIC_BASE_URL` all set to your https domain (the same value).
