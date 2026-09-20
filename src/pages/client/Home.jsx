import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCatalog } from '../../context/CatalogContext.jsx';
import { useMyAppointments } from '../../hooks/useMyAppointments.js';
import { useDays } from '../../hooks/useDays.js';
import { nextFree } from '../../lib/availability.js';
import { addDays, dayLabel, hm, key, minsUntil, startOfToday } from '../../lib/time.js';
import { Logo, Ticket } from '../../components/ui.jsx';

export default function Home() {
  const nav = useNavigate();
  const { barbers, services, settings } = useCatalog();
  const { list } = useMyAppointments();
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
      <section className="hero">
        <div className="hero-brand"><Logo size={34} /><span>Barbearia do</span></div>
        <h1 className="wordmark">RATÃO</h1>
        <p className="tag">Escolha, toque, marcou.</p>
      </section>

      {nf && nb && (
        <section className="slab">
          <p>Próximo horário livre</p>
          <div className="big">{hm(nf.start)}</div>
          <p>{dayLabel(nf.dk)}, com {nb.short || nb.name}</p>
          <div className="row">
            <Link to="/app/agendar" className="btn dark">Agendar agora</Link>
            {last && <button className="btn dark-ghost" onClick={repeat}>Repetir último</button>}
          </div>
        </section>
      )}
      {!nf && (
        <section className="slab">
          <p>Vamos marcar seu horário</p>
          <div className="row"><Link to="/app/agendar" className="btn dark">Agendar agora</Link></div>
        </section>
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
