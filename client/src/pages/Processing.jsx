import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { FiEye, FiEdit3, FiHash, FiSend, FiCheck, FiZap, FiImage } from 'react-icons/fi';
import api, { errorText } from '../api';
import { Tile } from '../components/ui';

const ROWS = [
  ['Reading image content...', FiEye],
  ['Writing caption', FiEdit3],
  ['Generating SEO hashtags', FiHash],
  ['Post to Meta', FiSend],
];

export default function Processing() {
  const { state } = useLocation();
  const nav = useNavigate();
  const started = useRef(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const files = state?.files || [];
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [state]); // eslint-disable-line react-hooks/exhaustive-deps
  const preview = previews[0];

  useEffect(() => {
    if (!state?.files?.length || started.current) return;
    started.current = true;
    const timer = setInterval(() => setStep((s) => Math.min(s + 1, state.autoPost ? 3 : 2)), 2500);
    const fd = new FormData();
    state.files.forEach((f) => fd.append('photos', f));
    fd.append('businessName', state.businessName || '');
    fd.append('tone', state.tone || '');
    ['businessType', 'audience', 'location', 'keywords', 'callToAction'].forEach((k) => fd.append(k, state[k] || ''));
    fd.append('autoPost', state.autoPost ? 'true' : 'false');
    api
      .post('/posts/generate', fd)
      .then(({ data }) =>
        data.status === 'draft'
          ? nav(`/review/${data._id}`, { replace: true })
          : nav('/published', { replace: true, state: { post: data } })
      )
      .catch((e) => setError(errorText(e)))
      .finally(() => clearInterval(timer));
    return () => clearInterval(timer);
  }, [state, nav]);

  if (!state?.files?.length) return <Navigate to="/dashboard" replace />;

  return (
    <div className="center narrow">
      <Tile icon={FiZap} size={72} />
      <h1 className="mt">AI is reading your {files.length > 1 ? 'photos' : 'image'}...</h1>
      <p className="muted">{files.length > 1 ? `Looking at all ${files.length} photos together — this can take a little longer` : 'This usually takes 5–10 seconds'}</p>
      <div className="split">
        <div className="photo-wrap">
          {preview ? <img src={preview} alt="Uploaded" className="photo" /> : <div className="photo ph"><FiImage size={32} /></div>}
          {files.length > 1 && <span className="count-badge">{files.length} photos</span>}
          {!error && <div className="scan" />}
        </div>
        <div className="card list">
          <b className="eyebrow">VISUAL CONTEXT RECOGNITION</b>
          {ROWS.map(([label, Icon], i) => {
            const state_ = error ? 'wait' : i < step ? 'done' : i === step ? 'active' : 'wait';
            return (
              <div key={label} className={`prow ${state_}`}>
                <Tile icon={Icon} size={40} soft={state_ === 'wait'} />
                <span>{label}</span>
                {state_ === 'done' && <FiCheck size={18} />}
                {state_ === 'active' && <small>In progress</small>}
                {state_ === 'wait' && <small>Waiting</small>}
              </div>
            );
          })}
        </div>
      </div>
      {error && (
        <div className="stack mt">
          <div className="alert" role="alert">{error}</div>
          <button className="btn ghost" onClick={() => nav('/dashboard')}>Back to dashboard</button>
        </div>
      )}
    </div>
  );
}
