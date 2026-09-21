import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase.js';

/** Mensalistas em tempo real. Só a equipe (barbeiro e dono) consegue ler. */
export function useSubscriptions() {
  const [subs, setSubs] = useState([]);
  useEffect(() => onSnapshot(
    collection(db, 'subscriptions'),
    (s) => setSubs(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (e) => console.error('Erro ao ler mensalistas', e),
  ), []);
  return subs;
}
