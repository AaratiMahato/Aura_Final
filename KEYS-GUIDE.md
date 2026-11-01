# Where to get every key (put them in server/.env, then restart start.bat)

Instagram does NOT have its own separate key. Facebook and Instagram posting both use ONE Meta app (steps 3 and 4).

## 1. MONGODB_URI (database)
1. mongodb.com/atlas -> sign up -> create a free cluster.
2. Database Access -> Add user (username + password).
3. Network Access -> Add IP -> "Allow access from anywhere".
4. Connect -> Drivers -> copy the string. Replace <password> and put `/aura_pro` before the `?`:
   `mongodb+srv://user:PASSWORD@cluster0.xxxxx.mongodb.net/aura_pro?retryWrites=true&w=majority`

## 2. GEMINI_API_KEY
aistudio.google.com/apikey -> Create API key.

## 3. GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET (Google login)
1. console.cloud.google.com -> create a project.
2. APIs & Services -> OAuth consent screen -> External -> fill app name + your email. Add yourself under Test users.
3. Credentials -> Create credentials -> OAuth client ID -> Web application.
4. Authorized redirect URI: `http://localhost:5000/api/auth/google/callback`
5. Copy Client ID and Client secret.

## 4. FACEBOOK_APP_ID / FACEBOOK_APP_SECRET (Facebook + Instagram posting)
Before you start you need:
- A Facebook Page you are admin of.
- An Instagram **Professional** account (Business or Creator): Instagram app -> Settings -> Account type and tools -> Switch to professional account.
- Link them: Facebook Page -> Settings -> Linked accounts -> Instagram -> Connect.

Then:
1. developers.facebook.com -> My Apps -> Create app -> type **Business** (or "Other" -> Business).
2. Add products / use cases: **Facebook Login** and the Page + Instagram publishing permissions
   (pages_show_list, pages_read_engagement, pages_manage_posts, instagram_basic, instagram_content_publish, business_management).
3. Facebook Login -> Settings -> Valid OAuth Redirect URIs, add both:
   - `http://localhost:5000/api/auth/facebook/callback`
   - `http://localhost:5000/api/accounts/meta/callback`
4. App settings -> Basic: copy **App ID** and **App Secret**. Add a Privacy Policy URL (any page you own is fine while testing).
5. Keep the app in **Development mode**. As the app admin you can connect and post to your own Page and Instagram with no App Review.
   Other people can use it only after you add them under App roles (Tester) or complete Meta App Review.

Meta renames menus often. If something is not where this says, search the Meta developer docs for "Instagram Content Publishing".

## 4b. INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET ("Continue with Instagram" button)
Instagram login uses Meta's "Instagram API with Instagram Login". It needs its own ID and secret, which are NOT the Facebook ones from step 4. You can add it to the same Meta app.
1. developers.facebook.com -> your app -> **Add product -> Instagram** -> open **API setup with Instagram login**.
2. In that page, section **Set up Instagram business login -> Business login settings**:
   - OAuth redirect URIs: add `http://localhost:5000/api/auth/instagram/callback` and save.
   - Copy the **Instagram App ID** and **Instagram app secret** into `INSTAGRAM_APP_ID` and `INSTAGRAM_APP_SECRET`.
3. Only Instagram **Professional** accounts (Business or Creator) can log in. Personal accounts cannot.
4. While the app is in Development mode, add the Instagram account under **App roles -> Roles -> Instagram Testers**, then accept the invite in the Instagram app (Settings -> Website permissions -> Apps and websites -> Tester invites).
5. Restart. The terminal should print `Instagram login : ON`.

If Meta refuses `http://localhost` as a redirect URI, run the whole app through an https tunnel:
`npm run build`, then set `SERVER_URL` and `CLIENT_URL` in server/.env to your https address (for example your ngrok URL, pointing at port 5000), set `NODE_ENV=production`, run `npm start`, and use that same https address for the redirect URI (`https://YOUR-ADDRESS/api/auth/instagram/callback`) and for opening the app.

Instagram does not share an email address, so a new Instagram login creates its own account. Posting to Instagram still works through the Facebook Page connection (Connect Accounts), exactly as before.

## Seeing your data in MongoDB Compass
Open Compass -> New connection -> paste the same value as `MONGODB_URI` (local default: `mongodb://localhost:27017`) -> Connect -> database `aura_pro`.
- `users`: every sign-in (email, Google, Facebook, Instagram). Passwords are bcrypt hashes; Facebook/Instagram tokens are AES-256 encrypted.
- `posts`: every photo, caption, hashtags and publish result.
Press the refresh button in Compass after a login to see the new document.

## 5. CLOUDINARY_* (so Instagram can fetch your photo, free)
1. cloudinary.com -> sign up free.
2. Dashboard shows **Cloud name**, **API Key**, **API Secret**. Copy all three.

## 6. Check it works
Start the app. The terminal prints which features are ON or OFF:
```
AI captions (Gemini)      : ON
Google login              : ON
Facebook login + posting  : ON
Instagram image hosting   : ON
```
Then: sign in -> Connect Accounts -> Connect -> approve -> upload photo -> Publish Post.

## Common errors
- "Redirect URI mismatch": the URL in Google/Meta must match exactly, including http and :5000.
- Instagram says no business account: link the Instagram to the Facebook Page (see above), then Disconnect and Connect again.
- "(#10) Application does not have permission": permission missing from the app, or you are not an admin/tester of it.
- Use `localhost` everywhere (never 127.0.0.1).

## Facebook login notes
- "Continue with Facebook" signs you in and also connects your Page + linked Instagram in one step.
- Valid OAuth Redirect URIs in your Meta app must include BOTH:
  - `http://localhost:5000/api/auth/facebook/callback`
  - `http://localhost:5000/api/accounts/meta/callback`
- Meta says "Invalid Scopes" or blocks login? Set `FACEBOOK_LOGIN_ONLY=true` in server/.env (login works, Page/Instagram connect comes later from Connect Accounts after you add the permissions to the app).
- In Development mode only people with a role on the app (Admin/Developer/Tester) can log in with Facebook.

## Facebook error: "Invalid Scopes: email, pages_show_list ..."
Your Meta app does not have those permissions yet. Quick fix: keep `FACEBOOK_SCOPES=public_profile` in server/.env and restart (login works, email and Pages come later).
Full fix, in developers.facebook.com -> your app -> **Use cases** -> Customize:
1. Use case **Authenticate and request data from users with Facebook Login**: add the **email** permission.
2. Use case **Manage everything on your Page**: add pages_show_list, pages_read_engagement, pages_manage_posts.
3. Use case **Manage messaging & content on Instagram**: add instagram_basic, instagram_content_publish.
4. Add business_management (Manage business use case), then remove `FACEBOOK_SCOPES` from server/.env and restart.
Meta renames these menus often; if one is missing, search the Meta docs for the permission name.

## Facebook page says "Switching accounts"
Facebook is asking you to continue as the account that owns/has a role on your app. Click **Continue**. In Development mode only people added under App roles (Admin, Developer, Tester) can log in.
