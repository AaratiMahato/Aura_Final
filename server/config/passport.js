import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import User from '../models/User.js';

async function findOrCreate(idField, profile) {
  const email = profile.emails?.[0]?.value?.toLowerCase();
  const avatar = profile.photos?.[0]?.value;
  let user = await User.findOne({ [idField]: profile.id });
  if (!user && email) user = await User.findOne({ email });
  if (!user) user = new User({ name: profile.displayName, email, avatar });
  user[idField] = profile.id;
  if (!user.avatar && avatar) user.avatar = avatar;
  if (!user.name) user.name = profile.displayName;
  await user.save();
  return user;
}

const base = process.env.SERVER_URL;

if (process.env.GOOGLE_CLIENT_ID) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${base}/api/auth/google/callback`,
      },
      (_a, _r, profile, done) => findOrCreate('googleId', profile).then((u) => done(null, u), done)
    )
  );
}

