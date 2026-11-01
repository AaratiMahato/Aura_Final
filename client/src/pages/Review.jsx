import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FiEdit3, FiHash, FiCopy, FiSend, FiCamera, FiX, FiRefreshCw } from 'react-icons/fi';
import { FaFacebookF, FaInstagram } from 'react-icons/fa';
import api, { errorText } from '../api';
import { useAuth } from '../context/AuthContext';
import { Chip, PageHead, Stepper, Tile } from '../components/ui';
import { postImages } from '../photos';

export default function Review() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [post, setPost] = useState(null);
  const [caption, setCaption] = useState('');
  const [tags, setTags] = useState([]);
  const [platforms, setPlatforms] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [instruction, setInstruction] = useState('');
  const [rewriting, setRewriting] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    api.get(`/posts/${id}`).then(({ data }) => {
      setPost(data);
      setCaption(data.caption);
      setTags(data.hashtags);
    }).catch((e) => setError(errorText(e)));
  }, [id]);

  useEffect(() => {
    if (!user) return;
    setPlatforms(user.meta.facebook
      ? [user.meta.facebook && 'facebook', user.meta.instagram && 'instagram'].filter(Boolean)
      : ['facebook', 'instagram']);
  }, [user]);

  const toggle = (p) => setPlatforms((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));

  const publish = async () => {
    setBusy(true);
    setError('');
    try {
      const { data } = await api.post(`/posts/${id}/publish`, { caption, hashtags: tags, platforms });
      nav('/published', { state: { post: data } });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const rewrite = async () => {
    setRewriting(true);
    setError('');
    try {
      const { data } = await api.post(`/posts/${id}/regenerate`, { instruction });
      setCaption(data.caption);
      setTags(data.hashtags);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setRewriting(false);
    }
  };

  const copyPost = async () => {
    await navigator.clipboard.writeText(`${caption}\n\n${tags.join(' ')}`);
    setCopied('post');
    setTimeout(() => setCopied(false), 1500);
  };

  const copyAll = async () => {
    await navigator.clipboard.writeText(tags.join(' '));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (!post) return error ? <div className="alert">{error}</div> : <div className="splash">Loading…</div>;
  const connected = user.meta.facebook;
  const photos = postImages(post);

  return (
    <>
      <PageHead title="Review and polish your automated post" sub="AI-Generated Content" />
      <Stepper step={2} />
      <div className="grid">
        <div className="col-side">
          <div className="gallery">
            <img className="photo big" src={photos[Math.min(active, photos.length - 1)]} alt={`Your upload ${active + 1}`} />
            {photos.length > 1 && <span className="count-badge">{active + 1} / {photos.length}</span>}
          </div>
          {photos.length > 1 && (
            <div className="thumbs">
              {photos.map((src, i) => (
                <button type="button" key={src} className={`thumb-item ${i === active ? 'on' : ''}`} onClick={() => setActive(i)} aria-label={`Show photo ${i + 1}`}>
                  <img src={src} alt="" />
                </button>
              ))}
            </div>
          )}
          <div className="chips">
            <Chip icon={FiCamera}>{photos.length} photo{photos.length === 1 ? '' : 's'}</Chip>
            <Chip icon={FiEdit3}>{caption.length} chars</Chip>
            <Chip icon={FiHash}>{tags.length} tags</Chip>
          </div>
        </div>
        <div className="col-main">
          <div className="card">
            <div className="row between">
              <b className="card-title tight"><Tile icon={FiEdit3} size={32} /> Your Caption</b>
              <span className="muted">{caption.length} / 2200</span>
            </div>
            <textarea className="textarea" rows={6} maxLength={2200} value={caption} onChange={(e) => setCaption(e.target.value)} />
            <div className="row gap wrap mt-s">
              <input className="rewrite-input" value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="Ask AI to change it, e.g. shorter, more playful (optional)" maxLength={200} />
              <button className="btn ghost" onClick={rewrite} disabled={rewriting}><FiRefreshCw size={18} /> {rewriting ? 'Rewriting…' : 'Rewrite with AI'}</button>
            </div>
          </div>
          <div className="card">
            <div className="row between">
              <b className="card-title tight"><Tile icon={FiHash} size={32} /> SEO Optimized Hashtags</b>
              <button className="link" onClick={copyAll}><FiCopy size={16} /> {copied === true ? 'Copied' : 'Copy all'}</button>
            </div>
            <div className="chips">
              {tags.map((t) => (
                <Chip key={t} icon={FiX} onClick={() => setTags(tags.filter((x) => x !== t))} title="Remove hashtag">{t}</Chip>
              ))}
            </div>
          </div>
          <div className="row wrap gap">
            <b>Publish to{user.meta.pageName ? ` ${user.meta.pageName}` : ''}</b>
            <Chip icon={FaFacebookF} onClick={() => toggle('facebook')} active={platforms.includes('facebook')}>Facebook</Chip>
            <Chip icon={FaInstagram} onClick={() => toggle('instagram')} active={platforms.includes('instagram')}>Instagram</Chip>
            <span className="grow" />
            <button className="btn ghost" onClick={copyPost}><FiCopy size={18} /> {copied === 'post' ? 'Copied' : 'Copy post text'}</button>
            <button className="btn primary" onClick={publish} disabled={busy || !platforms.length}>
              <FiSend size={18} /> {busy ? 'Publishing…' : 'Publish Post'}
            </button>
          </div>
          {!connected && <div className="muted" style={{ fontSize: 13, margin: '10px 0' }}>Demo mode: Facebook is not connected, so publishing is simulated and nothing is actually posted.</div>}
          {error && <div className="alert" role="alert">{error}</div>}
          <small className="muted">Post will be published immediately</small>
        </div>
      </div>
    </>
  );
}
