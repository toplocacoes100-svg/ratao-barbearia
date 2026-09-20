import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase.js';

/** Fotos da tela inicial (lidas uma vez por visita para não gastar leituras à toa). */
export function usePhotos(refreshKey = 0) {
  const [photos, setPhotos] = useState([]);
  useEffect(() => {
    let alive = true;
    getDocs(collection(db, 'photos'))
      .then((s) => alive && setPhotos(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.order || 0) - (b.order || 0))))
      .catch((e) => console.error('Erro ao ler fotos', e));
    return () => { alive = false; };
  }, [refreshKey]);
  return photos;
}
