import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCatalog } from '../../context/CatalogContext.jsx';
import { useMyAppointments } from '../../hooks/useMyAppointments.js';
import { useDays } from '../../hooks/useDays.js';
import { usePhotos } from '../../hooks/usePhotos.js';
import { nextFree } from '../../lib/availability.js';
import { addDays, dayLabel, hm, key, minsUntil, startOfToday } from '../../lib/time.js';
import { Avatar, Ticket } from '../../components/ui.jsx';

// Letreiro da marca (imagem) no topo. Se o dono publicou fotos em Configurações, elas entram depois dele
// e trocam sozinhas (e param se o aparelho pedir menos movimento).
const BRAND = { id: 'brand', src: '/img/ratao-letreiro.webp', brand: true };
function HeroArt({ photos }) {
  const slides = useMemo(() => [BRAND, ...photos.map((p) => ({ id: p.id, src: p.dataUrl }))], [photos]);
  const [i, setI] = useState(0);
  useEffect(() => {
    if (slides.length < 2 || matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const t = setInterval(() => setI((x) => (x + 1) % slides.length), 5000);
    return () => clearInterval(t);
  }, [slides.length]);
  return (
    <section className="heroart" aria-label="Barbearia do Ratão">
      {slides.map((s, k) => <img key={s.id} src={s.src} alt={s.brand ? 'Barbearia do Ratão' : ''} className={`${s.brand ? 'brand ' : ''}${k === i % slides.length ? 'on' : ''}`} />)}
    </section>
  );
}

export default function Home() {
  const nav = useNavigate();
  const { barbers, services, settings } = useCatalog();
  const { list } = useMyAppointments();
  const photos = usePhotos();
  const dates = useMemo(() => Array.from({ length: 14 }, (_, i) => key(addDays(startOfToday(), i))), []);
  const { days } = useDays(dates);

  const shortest = services.length ? Math.min(...services.map((s) => s.dur)) : 30;
  const nf = barbers.length ? nextFree({ barbers, dur: shortest, daysMap: days, settings, dates }) : null;
  const nb = nf && barbers.find((b) => b.id === nf.barberId);
  const upcoming = list.filter((a) => ['agendado', 'confirmado'].includes(a.status) && minsUntil(a.date, a.start) > -60);
  const last = [...list].reverse().find((a) => a.status === 'concluido');
  const repeat = () => nav('/app/agendar', { state: { services: last.serviceIds, barberId: last.barberId } });

  return (
    <div className="screen">
      <HeroArt photos={photos} />

      {nf && nb ? (
        <section className="slab">
          <p>Próximo horário livre</p>
          <div className="big">{hm(nf.start)}</div>
          <p>{dayLabel(nf.dk)}, com {nb.short || nb.name}</p>
          <div className="row">
            <Link to="/app/agendar" className="btn dark">Agendar agora</Link>
            {last && <button className="btn dark-ghost" onClick={repeat}>Repetir último</button>}
          </div>
        </section>
      ) : (
        <section className="slab">
          <p>Vamos marcar seu horário</p>
          <div className="row"><Link to="/app/agendar" className="btn dark">Agendar agora</Link></div>
        </section>
      )}

      {barbers.length > 0 && (
        <>
          <h2 className="sec-title">Escolha seu barbeiro</h2>
          <div className="barbers-row">
            {barbers.map((b) => {
              const n = nextFree({ barbers: [b], dur: shortest, daysMap: days, settings, dates });
              return (
                <button key={b.id} className="bmini" onClick={() => nav('/app/agendar', { state: { barberId: b.id } })}>
                  <Avatar barber={b} size={64} />
                  <b>{b.short || b.name}</b>
                  <small>{b.spec}</small>
                  <span>{n ? `${dayLabel(n.dk)}, ${hm(n.start)}` : 'Sem horário'}</span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {upcoming[0] && (
        <>
          <h2 className="sec-title">Seu próximo horário</h2>
          <Ticket ap={upcoming[0]} />
        </>
      )}
    </div>
  );
}
