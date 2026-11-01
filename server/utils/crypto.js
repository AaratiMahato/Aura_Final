import crypto from 'crypto';

// Key is derived from JWT_SECRET (or TOKEN_ENC_KEY if you set one), so no extra setup is needed
const key = () =>
  crypto.createHash('sha256').update(process.env.TOKEN_ENC_KEY || process.env.JWT_SECRET || '').digest();

export function encrypt(text) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([c.update(text, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString('hex')).join('.');
}

export function decrypt(payload) {
  const [iv, tag, enc] = payload.split('.').map((h) => Buffer.from(h, 'hex'));
  const d = crypto.createDecipheriv('aes-256-gcm', key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString('utf8');
}
