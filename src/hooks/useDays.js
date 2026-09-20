import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase.js';

/** Horários ocupados (sem dados pessoais) dos dias pedidos, em tempo real. */
export function useDays(dates) {
  const [days, setDays] = useState(() => new Map());
  const [ready, setReady] = useState(false);
  const k = dates.join(',');
  useEffect(() => {
    if (!dates.length) { setDays(new Map()); setReady(true); return undefined; }
    const q = query(collection(db, 'days'), where('date', 'in', dates));
    return onSnapshot(q, (s) => {
      const m = new Map();
      s.forEach((d) => m.set(d.id, d.data()));
      setDays(m); setReady(true);
    }, (e) => { console.error(e); setReady(true); });
  }, [k]);
  return { days, ready };
}
