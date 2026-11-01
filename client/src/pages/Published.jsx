import { Link, Navigate, useLocation } from 'react-router-dom';
import { FiCheck, FiCamera, FiFolder, FiAlertTriangle, FiEdit3, FiHash } from 'react-icons/fi';
import { FaFacebookF, FaInstagram } from 'react-icons/fa';
import { postImages } from '../photos';

const NAMES = { facebook: 'Facebook', instagram: 'Instagram' };
const ICONS = { facebook: FaFacebookF, instagram: FaInstagram };

const joinNames = (list) => list.map((p) => NAMES[p]).join(' & ');

export default function Published() {
  const { state } = useLocation();
  const post = state?.post;
  if (!post) return <Navigate to="/history" replace />;

  const photos = postImages(post);
  const ok = post.status === 'published';
  const posted = post.platforms.filter((p) => post.results?.[p]?.ok);
  const failed = post.platforms.filter((p) => !post.results?.[p]?.ok);
  const caption = post.caption || '';
  const preview = caption.length > 70 ? `${caption.slice(0, 70).trim()}…` : caption;

  return (
    <div className="success-wrap">
      <div className="success-card">
        <div className={`success-seal ${ok ? '' : 'bad'}`}>
          {ok ? <FiCheck size={40} strokeWidth={2.5} /> : <FiAlertTriangle size={36} />}
        </div>

        <h1 className="success-title">{ok ? 'Post Published!' : 'Publishing failed'}</h1>
        <p className="success-sub">
          {ok
            ? `Your ${photos.length > 1 ? `${photos.length} photos` : 'photo'} and caption have been posted to ${joinNames(posted)} successfully.`
            : 'Nothing was posted. See the details below.'}
        </p>

        {ok && failed.length > 0 && (
          <div className="alert" style={{ width: '100%', textAlign: 'left' }}>
            {failed.map((p) => `${NAMES[p]}: ${post.results?.[p]?.error || 'failed'}`).join(' · ')}
          </div>
        )}
        {!ok && post.platforms.map((p) => post.results?.[p]?.error && (
          <div className="alert" key={p} style={{ width: '100%', textAlign: 'left' }}>
            {NAMES[p]}: {post.results[p].error}
          </div>
        ))}

        <div className="success-preview">
          <div className="stack-thumb">
            <img src={photos[0]} alt="" />
            {photos.length > 1 && <span className="count-badge sm">+{photos.length - 1}</span>}
          </div>
          <div className="success-preview-text">
            <p>{preview}</p>
            <div className="success-platforms">
              {post.platforms.map((p) => {
                const Icon = ICONS[p];
                return <Icon key={p} size={16} title={NAMES[p]} className={post.results?.[p]?.ok ? '' : 'off'} />;
              })}
            </div>
          </div>
        </div>

        <div className="success-stats">
          <span><FiCamera size={15} /> {photos.length} photo{photos.length === 1 ? '' : 's'}</span>
          <span><FiEdit3 size={15} /> {caption.length} chars</span>
          <span><FiHash size={15} /> {post.hashtags?.length || 0} tags</span>
        </div>

        <div className="success-actions">
          {!ok && <Link to={`/review/${post._id}`} className="btn primary">Edit and try again</Link>}
          <Link to="/dashboard" className={`btn ${ok ? 'primary' : 'ghost'}`}><FiCamera size={18} /> Create New Post</Link>
          <Link to="/history" className="btn ghost"><FiFolder size={18} /> View Post History</Link>
        </div>
      </div>
    </div>
  );
}
