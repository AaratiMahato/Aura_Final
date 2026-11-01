import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FiCheck, FiLink, FiPlus, FiShield } from 'react-icons/fi';
import { FaFacebookF, FaInstagram } from 'react-icons/fa';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { PageHead, Tile } from '../components/ui';

const ERRORS = {
  denied: 'Permission was not granted.',
  nopage: 'No Facebook Page found. You need to manage a Page to publish.',
  meta: 'Could not connect to Meta. Check your app settings and try again.',
  user: 'Your session expired. Sign in again.',
};

export default function Connect() {
  const { user, refresh } = useAuth();
  const [params] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [providers, setProviders] = useState({ facebook: true });
  useEffect(() => { api.get('/auth/providers').then(({ data }) => setProviders(data)); }, []);
  const err = ERRORS[params.get('error')];
  const m = user.meta;

  const choose = async (e) => {
    setBusy(true);
    try {
      await api.post('/accounts/meta/select', { pageId: e.target.value });
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    await api.delete('/accounts/meta');
    await refresh();
    setBusy(false);
  };

  const Card = ({ icon, name, on, status, note }) => (
    <div className="card grow">
      <div className="row gap wrap">
        <Tile icon={icon} size={64} />
        <div className="grow">
          <div className="acc-name">{name}</div>
          <div className={`status ${on ? 'on' : ''}`}>{on ? <FiCheck size={14} /> : <FiLink size={14} />} {status}</div>
        </div>
        {on ? (
          <button className="btn ghost" onClick={disconnect} disabled={busy}><FiLink size={18} /> Disconnect</button>
        ) : providers.facebook ? (
          <a className="btn primary" href="/api/accounts/meta/connect"><FiPlus size={18} /> Connect</a>
        ) : (
          <span className="muted">Add FACEBOOK_APP_ID in server/.env</span>
        )}
      </div>
      <p className="muted mt-s">{note}</p>
    </div>
  );

  return (
    <>
      <PageHead title="Connect Accounts" sub="One-Click Meta Publishing" />
      {params.get('connected') && <div className="ok">Meta account connected.</div>}
      {err && <div className="alert" role="alert">{err}</div>}
      {providers.facebook && !providers.cloudinary && <div className="alert">Instagram posting needs the free Cloudinary keys in server/.env (see KEYS-GUIDE.md). Facebook posting works without them.</div>}
      <div className="row gap wrap top">
        <Card icon={FaFacebookF} name="Facebook" on={m.facebook}
          status={m.facebook ? `Connected: ${m.pageName}` : 'Not connected'}
          note="Posts publish to your Facebook business page." />
        <Card icon={FaInstagram} name="Instagram" on={m.instagram}
          status={m.instagram ? `Connected: @${m.igUsername}` : m.facebook ? 'No Instagram business account linked to this page' : 'Not connected'}
          note="Connect your Instagram business account (linked to your Facebook page) to publish there too." />
      </div>
      {m.pages?.length > 1 && (
        <div className="card mt-s">
          <label className="field">Post to this Facebook Page{m.instagram ? ' (and its linked Instagram)' : ''}
            <span>
              <FaFacebookF size={16} />
              <select value={m.pageId || ''} onChange={choose} disabled={busy}>
                {m.pages.map((pg) => (
                  <option key={pg.pageId} value={pg.pageId}>{pg.pageName}{pg.igUsername ? ` — @${pg.igUsername}` : ''}</option>
                ))}
              </select>
            </span>
          </label>
        </div>
      )}
      <div className="row gap note">
        <Tile icon={FiShield} size={40} soft />
        <span>Post will be published immediately to every connected account you select on the review step.</span>
      </div>
    </>
  );
}
