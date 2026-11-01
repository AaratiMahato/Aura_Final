import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiUpload, FiPlus, FiEdit3, FiZap, FiCamera, FiBriefcase, FiUsers, FiMapPin, FiTag, FiMessageCircle, FiX } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { PageHead, Stepper, Tile } from '../components/ui';
import { BUSINESS_TYPES } from '../data';
import { MAX_PHOTOS } from '../photos';

const MAX = 50 * 1024 * 1024;

export default function Dashboard() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const input = useRef();
  const [files, setFiles] = useState([]);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState('');
  const [businessName, setBusinessName] = useState(user?.businessName || '');
  const [tone, setTone] = useState(user?.captionTone || 'Warm & professional');
  const savedType = user?.businessType || 'Photography';
  const known = BUSINESS_TYPES.includes(savedType);
  const [typeChoice, setTypeChoice] = useState(known ? savedType : 'Other');
  const [customType, setCustomType] = useState(known ? '' : savedType);
  const [audience, setAudience] = useState(user?.audience || '');
  const [location, setLocation] = useState(user?.location || '');
  const [keywords, setKeywords] = useState(user?.keywords || '');
  const [callToAction, setCallToAction] = useState(user?.callToAction || '');
  const [autoPost, setAutoPost] = useState(Boolean(user?.autoPost));
  const businessType = typeChoice === 'Other' ? customType.trim() || 'Small business' : typeChoice;
  const canPost = Boolean(user?.meta?.facebook);

  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  const pick = (list) => {
    if (requireLogin()) return;
    const incoming = Array.from(list || []);
    if (!incoming.length) return;
    const valid = incoming.filter((f) => /^image\/(jpeg|png|gif|webp)$/.test(f.type));
    const sized = valid.filter((f) => f.size <= MAX);
    let msg = '';
    if (valid.length < incoming.length) msg = 'Some files were skipped: only JPG, PNG, GIF or WEBP images are allowed';
    else if (sized.length < valid.length) msg = 'Some images were skipped: each image must be 50MB or smaller';
    const room = MAX_PHOTOS - files.length;
    if (sized.length > room) msg = `You can add up to ${MAX_PHOTOS} photos per post`;
    setError(msg);
    if (room > 0 && sized.length) setFiles((cur) => [...cur, ...sized.slice(0, room)]);
  };
  // Guests can look around, but must sign in before choosing photos
  const requireLogin = () => {
    if (loading) return true; // still checking the session: do nothing yet
    if (user) return false;
    nav('/login', { state: { from: '/dashboard', notice: 'Please sign in to upload your photos.' } });
    return true;
  };
  const removeAt = (i) => { setError(''); setFiles((cur) => cur.filter((_, idx) => idx !== i)); };

  return (
    <>
      <p className="eyebrow">WORKSPACE</p>
      <PageHead
        title={user?.businessName || 'Aura Pro'}
        sub="Upload one or more photos — AI reads them and writes a caption + SEO hashtags made for your type of business."
      />
      <Stepper step={1} />
      {user && !canPost && (
        <div className="ok">
          Connect your Facebook / Instagram page to post straight from here. <Link to="/connect" className="inline-link">Connect accounts</Link>
        </div>
      )}
      <div className="grid">
        <div className="col-main">
          <div className="card">
            <h3 className="card-title"><Tile icon={FiPlus} size={32} /> New Post</h3>
            <div
              className={`dropzone ${drag ? 'drag' : ''}`}
              onClick={() => { if (!requireLogin()) input.current.click(); }}
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files); }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && !requireLogin() && input.current.click()}
            >
              {files.length ? (
                <>
                  <Tile icon={FiPlus} size={40} />
                  <b>{files.length < MAX_PHOTOS ? 'Add more photos' : 'Photo limit reached'}</b>
                  <small>{files.length} of {MAX_PHOTOS} photos selected</small>
                </>
              ) : (
                <>
                  <Tile icon={FiUpload} size={64} />
                  <b>Drop your photos here</b>
                  <span>or click to browse (select several at once)</span>
                  <small>JPG PNG GIF WEBP up to 50MB each · max {MAX_PHOTOS} photos</small>
                  {!user && !loading && <small><b>Sign in required to upload</b></small>}
                </>
              )}
              <input ref={input} type="file" accept="image/jpeg,image/png,image/gif,image/webp" multiple hidden onChange={(e) => { pick(e.target.files); e.target.value = ''; }} />
            </div>
            {files.length > 0 && (
              <div className="thumbs">
                {previews.map((src, i) => (
                  <div className="thumb-item" key={src}>
                    <img src={src} alt={`Selected photo ${i + 1}`} />
                    {i === 0 && <span className="cover-tag">Cover</span>}
                    <button type="button" className="thumb-x" onClick={() => removeAt(i)} aria-label={`Remove photo ${i + 1}`}><FiX size={14} /></button>
                  </div>
                ))}
              </div>
            )}
            {error && <div className="alert" role="alert">{error}</div>}
          </div>
          <button
            className="btn primary"
            disabled={!files.length}
            title={!user ? 'Sign in to upload' : undefined}
            onClick={() => nav('/processing', { state: { files, businessName, tone, businessType, audience, location, keywords, callToAction, autoPost: autoPost && canPost } })}
          >
            <FiUpload size={18} /> {files.length > 1 ? `Upload ${files.length} Photos` : 'Upload Photo'}
          </button>
        </div>
        <div className="col-side">
          <div className="card">
            <h3 className="card-title"><Tile icon={FiEdit3} size={32} /> Business Settings</h3>
            <div className="stack">
              <label className="field">Your business / page name
                <span><FiCamera size={18} /><input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="e.g. Luna Studios" /></span>
              </label>
              <label className="field">Type of business
                <span><FiBriefcase size={18} />
                  <select value={typeChoice} onChange={(e) => setTypeChoice(e.target.value)}>
                    {BUSINESS_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    <option value="Other">Other (type your own)</option>
                  </select>
                </span>
              </label>
              {typeChoice === 'Other' && (
                <label className="field">Describe your business
                  <span><FiBriefcase size={18} /><input value={customType} onChange={(e) => setCustomType(e.target.value)} placeholder="e.g. Mehndi artist" maxLength={80} /></span>
                </label>
              )}
              <label className="field">Caption tone
                <span><FiZap size={18} /><input value={tone} onChange={(e) => setTone(e.target.value)} placeholder="Warm & professional" /></span>
              </label>
              <label className="field">Target audience (optional)
                <span><FiUsers size={18} /><input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="e.g. brides-to-be, young families" maxLength={200} /></span>
              </label>
              <label className="field">Location (optional)
                <span><FiMapPin size={18} /><input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Rhyl, North Wales" maxLength={120} /></span>
              </label>
              <label className="field">Keywords to include (optional)
                <span><FiTag size={18} /><input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="e.g. bridal, natural glow" maxLength={200} /></span>
              </label>
              <label className="field">Call to action (optional)
                <span><FiMessageCircle size={18} /><input value={callToAction} onChange={(e) => setCallToAction(e.target.value)} placeholder="e.g. DM us to book" maxLength={160} /></span>
              </label>
              <label className={`check ${canPost ? '' : 'off'}`}>
                <input type="checkbox" checked={autoPost && canPost} disabled={!canPost} onChange={(e) => setAutoPost(e.target.checked)} />
                <span>Post automatically after AI writes the caption (skips the review step)</span>
              </label>
            </div>
          </div>
          <div className="card">
            <h3 className="card-title"><Tile icon={FiZap} size={32} /> AI-Generated Caption &amp; SEO Hashtags</h3>
            <p className="muted">Your caption and hashtags will appear here once you upload your photos...</p>
          </div>
        </div>
      </div>
    </>
  );
}
