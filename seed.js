import { doc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase.js';
import { DEFAULT_SETTINGS, SEED_BARBERS, SEED_SERVICES } from './defaults.js';

/** Grava configurações, 3 barbeiros e 9 serviços de exemplo (só o dono consegue). */
export async function seedDemo() {
  const b = writeBatch(db);
  b.set(doc(db, 'settings', 'shop'), DEFAULT_SETTINGS);
  SEED_BARBERS.forEach(({ id, ...d }) => b.set(doc(db, 'barbers', id), d));
  SEED_SERVICES.forEach(({ id, ...d }) => b.set(doc(db, 'services', id), d));
  await b.commit();
}
