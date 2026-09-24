import { useState } from 'react';

// Imagens da marca. O normal é carregar o arquivo de public/img. Se ele não estiver no site
// (por exemplo, a pasta não subiu no GitHub), usa a cópia que vai dentro do código.
// A cópia só é baixada quando precisa, então não pesa quando o arquivo está no lugar.
const RESERVA = {
  emblema: () => import('../lib/brandEmblema.js'),
  letreiro: () => import('../lib/brandLetreiro.js'),
};

export default function BrandImg({ name, alt, ...props }) {
  const [src, setSrc] = useState(`/img/ratao-${name}.webp`);
  const [tentou, setTentou] = useState(false);
  async function onError() {
    if (tentou) return;
    setTentou(true);
    try { setSrc((await RESERVA[name]()).default); } catch { /* sem a reserva, fica o texto alternativo */ }
  }
  return <img src={src} alt={alt} onError={onError} {...props} />;
}
