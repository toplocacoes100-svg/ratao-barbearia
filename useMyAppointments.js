import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase.js';
import { useAuth } from '../context/AuthContext.jsx';

export function useMyAppointments() {
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!user) return undefined;
    const q = query(collection(db, 'appointments'), where('clientId', '==', user.uid));
    return onSnapshot(q, (s) => {
      setList(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start));
      setReady(true);
    }, (e) => { console.error(e); setReady(true); });
  }, [user?.uid]);
  return { list, ready };
}
