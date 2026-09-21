import { useCallback, useEffect, useRef, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase.js';
import { addDays, dayLabel, hm, key, startOfToday } from '../lib/time.js';

// Dois bipes curtos (o navegador só libera som depois que a pessoa toca em algum botão)
export function beep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [0, 0.22].forEach((t) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.frequency.value = 880; g.gain.value = 0.15;
      o.connect(g); g.connect(ctx.destination);
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.15);
    });
    setTimeout(() => ctx.close(), 700);
  } catch { /* sem som, o aviso na tela continua */ }
}

/**
 * Fica de olho nos próximos 7 dias do barbeiro e avisa quando:
 *  - entra um agendamento novo feito por outra pessoa (cliente ou dono);
 *  - um agendamento é cancelado.
 * Funciona enquanto a tela do Modo barbeiro estiver aberta. Não avisa dos encaixes que o próprio barbeiro faz.
 */
export function useBookingAlerts({ bid, uid }) {
  const [alerts, setAlerts] = useState([]);
  const [soundOn, setSoundOn] = useState(() => { try { return localStorage.getItem('alertSound') === '1'; } catch { return false; } });
  const soundRef = useRef(soundOn);
  useEffect(() => { soundRef.current = soundOn; }, [soundOn]);

  useEffect(() => {
    if (!bid) return undefined;
    const dates = Array.from({ length: 7 }, (_, i) => key(addDays(startOfToday(), i)));
    const q = query(collection(db, 'appointments'), where('barberId', '==', bid), where('date', 'in', dates));
    const known = new Map();
    let first = true;
    return onSnapshot(q, (snap) => {
      if (first) { snap.docs.forEach((d) => known.set(d.id, d.data().status)); first = false; return; }
      const fresh = [];
      snap.docChanges().forEach((ch) => {
        const d = ch.doc.data(); const id = ch.doc.id;
        const when = `${dayLabel(d.date).toLowerCase()} às ${hm(d.start)}`;
        if (ch.type === 'added' && !known.has(id) && d.createdBy !== uid && ['agendado', 'confirmado'].includes(d.status)) {
          fresh.push({ id: `n-${id}`, date: d.date, title: 'Novo agendamento', body: `${d.clientName}, ${when}: ${(d.serviceNames || []).join(' + ')}` });
        }
        if (ch.type === 'modified' && d.status === 'cancelado' && known.get(id) && known.get(id) !== 'cancelado') {
          fresh.push({ id: `c-${id}-${Date.now()}`, date: d.date, title: 'Agendamento cancelado', body: `${d.clientName}, ${when}` });
        }
        known.set(id, d.status);
      });
      if (!fresh.length) return;
      setAlerts((prev) => [...fresh, ...prev].slice(0, 5));
      if (soundRef.current) beep();
      try {
        if ('Notification' in window && Notification.permission === 'granted') fresh.forEach((a) => new Notification(a.title, { body: a.body }));
      } catch { /* alguns celulares só permitem notificação em app instalado */ }
    }, (e) => console.error('Erro nos avisos', e));
  }, [bid, uid]);

  const dismiss = useCallback((id) => setAlerts((prev) => prev.filter((a) => a.id !== id)), []);
  const enable = useCallback(() => {
    try { localStorage.setItem('alertSound', '1'); } catch { /* ignora */ }
    setSoundOn(true); beep();
    try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); } catch { /* ignora */ }
  }, []);
  const disable = useCallback(() => { try { localStorage.setItem('alertSound', '0'); } catch { /* ignora */ } setSoundOn(false); }, []);

  return { alerts, dismiss, soundOn, enable, disable };
}
