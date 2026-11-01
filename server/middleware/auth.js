import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// Session length in minutes (default 3). Each request refreshes it, so it expires after 3 minutes of inactivity.
export const SESSION_MINUTES = Number(process.env.SESSION_MINUTES) || 3;

export const signToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: `${SESSION_MINUTES}m` });

export const setAuthCookie = (res, token) =>
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_MINUTES * 60 * 1000,
  });

export const userPayload = (user) => ({ ...user.toSafe(), sessionMinutes: SESSION_MINUTES });

export async function requireAuth(req, res, next) {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ error: 'Not signed in' });
  let id;
  try {
    ({ id } = jwt.verify(token, process.env.JWT_SECRET));
  } catch {
    res.clearCookie('token');
    return res.status(401).json({ error: 'Your session expired. Please sign in again.', expired: true });
  }
  const user = await User.findById(id);
  if (!user) return res.status(401).json({ error: 'Account not found', expired: true });
  setAuthCookie(res, signToken(user.id)); // keep session alive while the user is active
  req.user = user;
  next();
}
