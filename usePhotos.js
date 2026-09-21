import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase.js';

/** Fotos da tela inicial + erro de leitura (lidas uma vez por visita para não gastar leituras à toa). */
export function usePhotosState(refreshKey = 0) {
  const [photos, setPhotos] = useState([]);
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    getDocs(collection(db, 'photos'))
      .then((s) => {
        if (!alive) return;
        setPhotos(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.order || 0) - (b.order || 0)));
        setError('');
      })
      .catch((e) => {
        console.error('Erro ao ler fotos', e);
        if (alive) setError(e.code || 'erro');
      });
    return () => { alive = false; };
  }, [refreshKey]);
  return { photos, error };
}

/** Só a lista de fotos (usada na tela inicial do cliente). */
export function usePhotos(refreshKey = 0) {
  return usePhotosState(refreshKey).photos;
}
