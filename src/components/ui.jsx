import { useEffect, useState } from 'react';
import BrandImg from './BrandImg.jsx';
import { dayLabel, hm, brl } from '../lib/time.js';

export const STATUS = {
  agendado: { label: 'Agendado', v: '--st-agendado' },
  confirmado: { label: 'Confirmado', v: '--st-confirmado' },
  atendimento: { label: 'Em atendimento', v: '--st-atendimento' },
  concluido: { label: 'Concluído', v: '--st-concluido' },
  cancelado: { label: 'Cancelado', v: '--st-cancelado' },
  faltou: { label: 'Faltou', v: '--st-faltou' },
};

export function Logo({ size = 30 }) {
  return <BrandImg name="emblema" alt="" className="app-logo" style={{ width: size, height: size }} />;
}

// Barra de progresso em forma de poste de barbeiro
export function Pole({ step, names }) {
  return (
    <div className="bk-pole">
      <div className="pole" role="progressbar" aria-valuemin={1} aria-valuemax={4} aria-valuenow={step} aria-label="Progresso do agendamento">
        <i className="stripes" style={{ width: `${step * 25}%` }} />
      </div>
      <div className="steps">{names.map((n, i) => (i + 1 === step ? <b key={n}>{n}</b> : <span key={n}>{n}</span>))}</div>
    </div>
  );
}

export const Pill = ({ status }) => (
  <span className="pill" style={{ '--c': `var(${STATUS[status].v})` }}>{STATUS[status].label}</span>
);

export const Avatar = ({ barber, size = 54 }) => (barber.photo
  ? <img className="avatar photo" src={barber.photo} alt="" style={{ '--c': barber.color, width: size, height: size }} />
  : <span className="avatar" style={{ background: barber.color, '--c': barber.color, width: size, height: size, fontSize: size * 0.48 }}>{(barber.short || barber.name)[0]}</span>);

export function Ticket({ ap, extra }) {
  return (
    <article className="ticket">
      <div className="ticket-top">
        <div className="tk-when"><span className="tk-day">{dayLabel(ap.date)}</span><span className="tk-time">{hm(ap.start)}</span></div>
        <div className="tk-info"><b>{(ap.serviceNames || []).join(' + ')}</b><span>com {ap.barberName?.split(' ')[0]}</span></div>
      </div>
      <div className="ticket-bot"><span className="price">{brl(ap.total)}</span>{extra}</div>
    </article>
  );
}

export function Modal({ title, onClose, children, actions = [] }) {
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  const run = async (fn) => { setBusy(true); try { await fn(); } finally { setBusy(false); } };
  return (
    <div>
      <div className="scrim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <h3>{title}</h3>
        <div className="mbody">{children}</div>
        <div className="mact">
          {actions.map((a) => (
            <button key={a.label} className={`btn ${a.kind || ''}`} disabled={busy || a.disabled} onClick={() => run(a.onClick)}>{a.label}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

export const Splash = ({ text = 'Carregando...' }) => (
  <div className="splash force-dark"><Logo size={72} /><p>{text}</p></div>
);

// Alternar claro/escuro (lembra a escolha neste aparelho)
export function ThemeButton() {
  useEffect(() => {
    const t = localStorage.getItem('theme');
    if (t) document.documentElement.dataset.theme = t;
  }, []);
  const toggle = () => {
    const r = document.documentElement;
    const dark = r.dataset.theme ? r.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    r.dataset.theme = dark ? 'light' : 'dark';
    localStorage.setItem('theme', r.dataset.theme);
  };
  return <button className="iconbtn" onClick={toggle} aria-label="Alternar modo claro e escuro">◐</button>;
}
