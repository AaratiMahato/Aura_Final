import { FiCamera, FiZap, FiSend } from 'react-icons/fi';

export const Tile = ({ icon: Icon, size = 44, soft = false }) => (
  <span className={`tile ${soft ? 'soft' : ''}`} style={{ width: size, height: size, borderRadius: size / 3 }}>
    <Icon size={size / 2} />
  </span>
);

export const Chip = ({ icon: Icon, children, onClick, active = true, title }) => {
  const Tag = onClick ? 'button' : 'span';
  return (
    <Tag className={`chip ${active ? '' : 'off'}`} onClick={onClick} title={title} type={onClick ? 'button' : undefined}>
      {Icon && <Icon size={14} />}
      {children}
    </Tag>
  );
};

const STEPS = [
  ['Upload photos', FiCamera],
  ['AI generates caption', FiZap],
  ['Publish', FiSend],
];

export const Stepper = ({ step }) => (
  <div className="stepper">
    {STEPS.map(([label, Icon], i) => (
      <div key={label} className={`step ${i + 1 <= step ? '' : 'idle'}`}>
        <Tile icon={Icon} size={36} soft={i + 1 > step} />
        {label}
      </div>
    ))}
  </div>
);

export const PageHead = ({ title, sub, children }) => (
  <div className="page-head">
    <div>
      <h1>{title}</h1>
      {sub && <p className="muted">{sub}</p>}
    </div>
    {children}
  </div>
);
