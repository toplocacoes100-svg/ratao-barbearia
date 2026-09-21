import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useCatalog } from '../../context/CatalogContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useMyAppointments } from '../../hooks/useMyAppointments.js';
import { cancelAppointment } from '../../lib/bookings.js';
import { dayLabel, hm, minsUntil } from '../../lib/time.js';
import { Modal, Pill, STATUS, Ticket } from '../../components/ui.jsx';

export default function Mine() {
  const { user, profile } = useAuth();
  const { settings } = useCatalog();
  const { list, ready } = useMyAppointments();
  const toast = useToast();
  const nav = useNavigate();
  const [target, setTarget] = useState(null);

  const upcoming = list.filter((a) => ['agendado', 'confirmado'].includes(a.status) && minsUntil(a.date, a.start) > -60);
  const history = list.filter((a) => !upcoming.includes(a) && a.status !== 'atendimento').reverse().slice(0, 15);
  const late = target ? minsUntil(target.date, target.start) < settings.cancelMin : false;

  const resched = (a) => nav('/app/agendar', { state: { services: a.serviceIds, barberId: a.barberId, resched: { id: a.id, barberId: a.barberId, date: a.date, start: a.start, clientName: a.clientName, barberName: a.barberName } } });

  async function doCancel() {
    try {
      await cancelAppointment(target, { late, byUid: user.uid, byName: profile.name });
      toast('Horário cancelado');
    } catch (e) { console.error(e); toast('Não foi possível cancelar'); }
    setTarget(null);
  }

  return (
    <div className="screen">
      <h1 className="page-title">Meus horários</h1>
      <div className="list">
        {!ready ? <p className="fine">Carregando...</p> : upcoming.length ? upcoming.map((a) => {
          const free = minsUntil(a.date, a.start) >= settings.cancelMin;
          return (
            <Ticket key={a.id} ap={a} extra={
              <div className="acts">
                <button className="btn sm ghost" disabled={!free} title={free ? '' : 'Remarcar só com antecedência'} onClick={() => resched(a)}>Remarcar</button>
                <button className="btn sm ghost" onClick={() => setTarget(a)}>Cancelar</button>
              </div>
            } />
          );
        }) : (
          <div className="empty">Você não tem horários marcados.<br /><Link to="/app/agendar" className="btn" style={{ marginTop: 12 }}>Agendar agora</Link></div>
        )}
      </div>

      <h2 className="sec-title">Histórico</h2>
      <div className="list">
        {history.length ? history.map((a) => (
          <div key={a.id} className="row-ap" style={{ '--c': `var(${STATUS[a.status].v})` }}>
            <div className="m">
              <b>{a.serviceNames.join(' + ')}</b>
              <small>{dayLabel(a.date)} às {hm(a.start)} com {a.barberName.split(' ')[0]}</small>
              <span><Pill status={a.status} />{a.late && <small className="warn"> fora do prazo</small>}</span>
            </div>
            {a.status === 'concluido' && (
              <button className="btn sm ghost" onClick={() => nav('/app/agendar', { state: { services: a.serviceIds, barberId: a.barberId } })}>Repetir</button>
            )}
          </div>
        )) : <div className="empty">Seu histórico aparece aqui.</div>}
      </div>

      {target && (
        <Modal title="Cancelar horário?" onClose={() => setTarget(null)} actions={[
          { label: 'Voltar', kind: 'ghost', onClick: () => setTarget(null) },
          { label: 'Cancelar horário', kind: 'danger', onClick: doCancel },
        ]}>
          <p>
            {late
              ? `Faltam menos de ${Math.round(settings.cancelMin / 60)} horas. Cancelar agora registra uma ocorrência no seu histórico.`
              : `${dayLabel(target.date)} às ${hm(target.start)} com ${target.barberName.split(' ')[0]} será cancelado.`}
          </p>
        </Modal>
      )}
    </div>
  );
}
