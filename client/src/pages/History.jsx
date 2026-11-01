import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiPlus, FiCheck, FiAlertTriangle, FiEdit3, FiTrash2 } from 'react-icons/fi';
import { FaFacebookF, FaInstagram } from 'react-icons/fa';
import api from '../api';
import { PageHead } from '../components/ui';
import { postImages } from '../photos';

const badge = { published: ['Published', FiCheck], failed: ['Failed', FiAlertTriangle], draft: ['Draft', FiEdit3] };

export default function History() {
  const [posts, setPosts] = useState(null);
  useEffect(() => { api.get('/posts').then(({ data }) => setPosts(data)); }, []);

  const remove = async (id) => {
    await api.delete(`/posts/${id}`);
    setPosts((p) => p.filter((x) => x._id !== id));
  };

  return (
    <>
      <PageHead title="Post History" sub={posts ? `${posts.length} post${posts.length === 1 ? '' : 's'}` : ' '}>
        <Link to="/dashboard" className="btn primary"><FiPlus size={18} /> New Post</Link>
      </PageHead>
      <div className="card flush">
        {posts?.length === 0 && <p className="muted pad">No posts yet. Create your first one.</p>}
        {posts?.map((p) => {
          const [label, Icon] = badge[p.status];
          return (
            <div className="hrow" key={p._id}>
              <div className="stack-thumb">
                <img className="thumb" src={postImages(p)[0]} alt="" />
                {postImages(p).length > 1 && <span className="count-badge sm">+{postImages(p).length - 1}</span>}
              </div>
              <div className="grow">
                <div>{p.caption.slice(0, 120)}{p.caption.length > 120 ? '…' : ''}</div>
                <small className="muted">{new Date(p.createdAt).toLocaleString()}</small>
              </div>
              <span className="icons">
                {p.platforms.includes('facebook') && <FaFacebookF size={20} />}
                {p.platforms.includes('instagram') && <FaInstagram size={20} />}
              </span>
              <span className={`badge ${p.status}`}><Icon size={14} /> {label}</span>
              <button className="icon-btn" onClick={() => remove(p._id)} aria-label="Delete post"><FiTrash2 size={18} /></button>
            </div>
          );
        })}
      </div>
    </>
  );
}
