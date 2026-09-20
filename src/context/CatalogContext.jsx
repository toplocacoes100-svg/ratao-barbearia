import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase.js';
import { DEFAULT_SETTINGS } from '../lib/defaults.js';

const Ctx = createContext(null);
export const useCatalog = () => useContext(Ctx);

// Configurações, barbeiros e serviços em tempo real: mudou no painel, mudou pra todo mundo.
export function CatalogProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [barbers, setBarbers] = useState([]);
  const [services, setServices] = useState([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const fail = (e) => console.error('Erro ao ler catálogo', e);
    const u1 = onSnapshot(doc(db, 'settings', 'shop'), (s) => s.exists() && setSettings({ ...DEFAULT_SETTINGS, ...s.data() }), fail);
    const u2 = onSnapshot(collection(db, 'barbers'), (s) => setBarbers(s.docs.map((d) => ({ id: d.id, ...d.data() }))), fail);
    const u3 = onSnapshot(collection(db, 'services'), (s) => { setServices(s.docs.map((d) => ({ id: d.id, ...d.data() }))); setReady(true); }, (e) => { fail(e); setReady(true); });
    return () => { u1(); u2(); u3(); };
  }, []);

  const value = useMemo(() => ({
    settings, ready,
    allBarbers: barbers,
    barbers: barbers.filter((b) => b.active !== false).sort((a, b) => a.name.localeCompare(b.name)),
    services: services.filter((s) => s.active !== false),
    empty: ready && barbers.length === 0,
  }), [settings, barbers, services, ready]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
