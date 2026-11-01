import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { FaFacebookF, FaInstagram, FaGoogle } from 'react-icons/fa';
import { FiCamera, FiZap, FiSend, FiMail, FiLock, FiUser } from 'react-icons/fi';
import api, { errorText } from '../api';
import { useAuth } from '../context/AuthContext';
import { Tile } from '../components/ui';

export default function Login() {
  const { user, setUser, loading } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/dashboard';
  const notice = location.state?.notice;
  const [params] = useSearchParams();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const ERR = {
    'facebook-not-configured': 'Facebook login is not set up yet. Add FACEBOOK_APP_ID and FACEBOOK_APP_SECRET in server/.env.',
    'instagram-not-configured': 'Instagram login is not set up yet. Add INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET in server/.env.',
    'google-not-configured': 'Google login is not set up yet. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in server/.env.',
    'facebook-denied': 'Facebook permission was cancelled.',
    'instagram-denied': 'Instagram permission was cancelled.',
    instagram: 'Instagram login failed. Check the backend terminal for details.',
    facebook: 'Facebook login failed. Check the backend terminal for details.',
    google: 'Google login failed. Check the backend terminal for details.',
  };
  const expired = sessionStorage.getItem('sessionExpired');
  if (expired) sessionStorage.removeItem('sessionExpired');
  const [error, setError] = useState(
    expired ? 'Your session expired after 3 minutes of inactivity. Please sign in again.' : ERR[params.get('error')] || ''
  );
  const [busy, setBusy] = useState(false);
  const [providers, setProviders] = useState(null); // null until the server answers
  useEffect(() => { api.get('/auth/providers').then(({ data }) => setProviders(data)).catch(() => {}); }, []);

  if (!loading && user) return <Navigate to={from} replace />;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { data } = await api.post(`/auth/${mode === 'login' ? 'login' : 'register'}`, form);
      setUser(data);
      nav(from, { replace: true });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  // The three social buttons are always shown. If a provider has no keys yet (or the server is down),
  // clicking explains why instead of leaving the page.
  const oauth = [
    ['Facebook', FaFacebookF, '/api/auth/facebook', 'facebook'],
    ['Instagram', FaInstagram, '/api/auth/instagram', 'instagram'],
    ['Google', FaGoogle, '/api/auth/google', 'google'],
  ];
  const social = (key) => (e) => {
    if (!providers) {
      e.preventDefault();
      setError('Cannot reach the server or database. Start MongoDB and the backend (npm run dev), then refresh this page.');
    } else if (!providers[key]) {
      e.preventDefault();
      setError(ERR[`${key}-not-configured`]);
    }
  };

  return (
    <div className="login">
      <section className="login-left">
        <span className="brand"><Tile icon={FiCamera} size={44} /> AURA PRO</span>
        <div>
          <h1>AI Captions for Any Business Page</h1>
          <p>Photographers, makeup artists, artists and brands: upload a photo, let AI write a caption and SEO hashtags for your business, then post to Facebook and Instagram in one click.</p>
          <div className="login-steps">
            {[[FiCamera, 'Upload photo'], [FiZap, 'AI generates caption'], [FiSend, 'Publish']].map(([I, t]) => (
              <div key={t}><Tile icon={I} size={40} soft /> {t}</div>
            ))}
          </div>
        </div>
        <small>© 2025 Aura Pro AI. All rights reserved.</small>
      </section>
      <section className="login-right">
        <form className="login-form" onSubmit={submit}>
          <h2>{mode === 'login' ? 'Welcome Back' : 'Create account'}</h2>
          <p className="muted">{oauth.length ? 'Select your preferred login method' : 'Sign in with your email'}</p>
          {notice && !error && <div className="ok">{notice}</div>}
          {oauth.map(([n, I, href, key]) => (
            <a key={n} className="btn ghost wide left" href={href} onClick={social(key)}>
              <Tile icon={I} size={34} /> Continue with {n}
            </a>
          ))}
          {oauth.length > 0 && <div className="or">or</div>}
          {mode === 'register' && (
            <label className="field">Name
              <span><FiUser size={18} /><input value={form.name} onChange={set('name')} placeholder="Your name" /></span>
            </label>
          )}
          <label className="field">Email Address
            <span><FiMail size={18} /><input type="email" required value={form.email} onChange={set('email')} placeholder="name@company.com" /></span>
          </label>
          <label className="field">Password
            <span><FiLock size={18} /><input type="password" required minLength={8} value={form.password} onChange={set('password')} placeholder="At least 8 characters" /></span>
          </label>
          {error && <div className="alert" role="alert">{error}</div>}
          <button className="btn primary wide" disabled={busy}>
            <FiMail size={18} /> {busy ? 'Please wait…' : mode === 'login' ? 'Sign In with Email' : 'Create account'}
          </button>
          <button type="button" className="link" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
            {mode === 'login' ? 'New here? Create an account' : 'Already have an account? Sign in'}
          </button>
          <p className="fine">By continuing you agree to our Terms of Service and Privacy Policy</p>
        </form>
      </section>
    </div>
  );
}
