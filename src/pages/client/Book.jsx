import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useCatalog } from '../../context/CatalogContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useDays } from '../../hooks/useDays.js';
import { nextFree, slotsFor } from '../../lib/availability.js';
import { cancelAppointment, createAppointment } from '../../lib/bookings.js';
import { CATS } from '../../lib/defaults.js';
import { addDays, brl, brl0, dayLabel, DAYS, fromKey, hm, key, MONTHS, startOfToday, todayKey } from '../../lib/time.js';
import { Avatar, Pole, Ticket } from '../../components/ui.jsx';
import { whatsappUrl } from '../../lib/time.js';

const TITLES = ['Escolha os serviços', 'Com quem?', 'Quando?', 'Confere aí'];
const NAMES = ['Serviços', 'Barbeiro', 'Horário', 'Confirmar'];

export default function Book() {
  const { user, profile } = useAuth();
  const { services, barbers, settings, ready } = useCatalog();
  const { state } = useLocation();
  const nav = useNavigate();
  const toast = useToast();

  const [step, setStep] = useState(state?.services ? 3 : 1);
  const [ids, setIds] = useState(state?.services || []);
  const [barberSel, setBarberSel] = useState(state?.barberId || null);
  const [date, setDate] = useState(null);
  const [slot, setSlot] = useState(null);
  const [done, setDone] = useState(null);
  const [busy, setBusy] = useState(false);

  const dates = useMemo(() => Array.from({ length: 14 }, (_, i) => key(addDays(startOfToday(), i))), []);
  const { days } = useDays(dates);

  const byId = useMemo(() => Object.fromEntries(services.map((s) => [s.id, s])), [services]);
  const picked = ids.filter((i) => byId[i]);
  const total = picked.reduce((a, i) => a + byId[i].price, 0);
  const dur = picked.reduce((a, i) => a + byId[i].dur, 0);
  const eligible = barbers.filter((b) => picked.every((i) => byId[i].barberIds?.includes(b.id)));
  const pool = barberSel === 'any' ? eligible : eligible.filter((b) => b.id === barberSel);

  const toggle = (id) => { setIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id])); setBarberSel(null); setSlot(null); setDate(null); };
  const comboHint = services.find((s) => s.includes && !ids.includes(s.id) && s.includes.every((i) => ids.includes(i)));
  const useCombo = () => { setIds((p) => [...p.filter((x) => !comboHint.includes.includes(x)), comboHint.id]); setBarberSel(null); setSlot(null); };

  const hasSlots = (dk) => slotsFor({ barbers: pool, dk, dur, daysMap: days, settings }).length > 0;
  const activeDate = step === 3 ? (date && hasSlots(date) ? date : dates.find(hasSlots) || dates[0]) : date;
  const slots = step === 3 ? slotsFor({ barbers: pool, dk: activeDate, dur, daysMap: days, settings }) : [];

  const back = () => { if (done) return; if (step > 1) { setStep(step - 1); if (step < 4) setSlot(null); } else nav('/app'); };

  async function confirm() {
    setBusy(true);
    try {
      const barber = barbers.find((b) => b.id === slot.barberId);
      const ap = await createAppointment({
        barber, dk: activeDate, start: slot.start, dur,
        client: { id: user.uid, name: profile.name, phone: profile.phone },
        services: picked.map((i) => byId[i]), total, createdBy: user.uid, status: 'agendado', settings,
      });
      if (state?.resched) {
        try { await cancelAppointment(state.resched, { byUid: user.uid, byName: profile.name }); } catch (e) { console.error(e); }
      }
      setDone(ap);
    } catch (e) {
      if (e.message === 'SLOT_TAKEN') { toast('Esse horário acabou de ser ocupado. Escolha outro.'); setSlot(null); setStep(3); }
      else { console.error(e); toast('Não foi possível agendar. Tente de novo.'); }
    } finally { setBusy(false); }
  }

  if (!ready) return <div className="screen"><p className="empty" style={{ marginTop: 40 }}>Carregando...</p></div>;
  if (!barbers.length || !services.length) {
    return (
      <div className="screen">
        <h1 className="page-title">Em breve</h1>
        <p className="empty">A barbearia ainda está montando a agenda. Volte daqui a pouco.</p>
        <Link to="/app" className="btn ghost">Voltar</Link>
      </div>
    );
  }

  if (done) {
    const msg = `Agendei na Barbearia do Ratão: ${done.serviceNames.join(' + ')}, ${dayLabel(done.date)} às ${hm(done.start)} com ${done.barberName.split(' ')[0]}.`;
    return (
      <div className="screen done">
        <h2 className="wordmark" style={{ fontSize: 96, paddingTop: 24 }}>Tá marcado.</h2>
        <p>{done.barberName.split(' ')[0]} já foi avisado.</p>
        <Ticket ap={done} />
        <a className="btn wide" target="_blank" rel="noopener noreferrer" href={whatsappUrl('', msg)}>Enviar no WhatsApp</a>
        <Link className="btn ghost wide" to="/app/meus">Ver meus horários</Link>
      </div>
    );
  }

  const ticketAp = slot && {
    date: activeDate, start: slot.start, total,
    serviceNames: picked.map((i) => byId[i].name),
    barberName: barbers.find((b) => b.id === slot.barberId)?.name,
  };

  return (
    <>
      <header className="bk-head">
        <button className="iconbtn" onClick={back} aria-label="Voltar">‹</button>
        <div><h2>{TITLES[step - 1]}</h2><p>Passo {step} de 4</p></div>
      </header>
      <Pole step={step} names={NAMES} />

      <div className="screen" style={{ paddingTop: 14 }}>
        {step === 1 && (
          <>
            {comboHint && (
              <div className="hint"><span>{comboHint.name} sai por <b>{brl0(comboHint.price)}</b>.{comboHint.saves ? ` Você economiza ${brl0(comboHint.saves)}.` : ''}</span><button className="btn sm" onClick={useCombo}>Trocar</button></div>
            )}
            {CATS.map((c) => {
              const list = services.filter((s) => s.cat === c);
              if (!list.length) return null;
              return (
                <div className="list" key={c}>
                  <h2 className="sec-title" style={{ fontSize: 24, marginTop: 8 }}>{c}</h2>
                  {list.map((s) => (
                    <button key={s.id} className="svc" aria-pressed={ids.includes(s.id)} onClick={() => toggle(s.id)}>
                      <span className="chk">{ids.includes(s.id) ? '✓' : ''}</span>
                      <span className="nm"><b>{s.name}</b><small>{s.dur} min</small>{s.saves ? <span className="tagsave">economiza {brl0(s.saves)}</span> : null}</span>
                      <span className="pr">{brl0(s.price)}</span>
                    </button>
                  ))}
                </div>
              );
            })}
          </>
        )}

        {step === 2 && (
          eligible.length === 0 ? (
            <div className="empty">Nenhum barbeiro faz essa combinação de serviços de uma vez. Volte e escolha em horários separados.</div>
          ) : (
            <div className="list">
              {[{ id: 'any' }, ...eligible].map((b) => {
                const group = b.id === 'any' ? eligible : [b];
                const nf = nextFree({ barbers: group, dur, daysMap: days, settings, dates });
                return (
                  <button key={b.id} className="bcard" aria-pressed={barberSel === b.id} onClick={() => { setBarberSel(b.id); setSlot(null); setDate(null); setStep(3); }}>
                    {b.id === 'any'
                      ? <span className="avatar stripes" style={{ '--c': 'var(--accent)', color: '#fff', width: 54, height: 54, fontSize: 26 }}>?</span>
                      : <Avatar barber={b} />}
                    <span className="nm"><b>{b.id === 'any' ? 'Qualquer disponível' : b.name}</b><small>{b.id === 'any' ? 'O primeiro que estiver livre' : b.spec}</small></span>
                    {nf ? <div className="nx">Próximo livre<b>{hm(nf.start)}</b>{dayLabel(nf.dk)}</div> : <div className="nx">Sem horário<br />nos próximos dias</div>}
                  </button>
                );
              })}
            </div>
          )
        )}

        {step === 3 && (
          <>
            <div className="days" role="group" aria-label="Dia">
              {dates.map((d) => {
                const dd = fromKey(d);
                return (
                  <button key={d} className="day" aria-pressed={activeDate === d} disabled={!hasSlots(d)} onClick={() => { setDate(d); setSlot(null); }}>
                    <small>{d === todayKey() ? 'Hoje' : DAYS[dd.getDay()]}</small><b>{dd.getDate()}</b><small>{MONTHS[dd.getMonth()]}</small>
                  </button>
                );
              })}
            </div>
            {slots.length ? (
              <>
                <div className="slots">
                  {slots.map((s) => (
                    <button key={s.start} className="slot" aria-pressed={slot?.start === s.start} onClick={() => { setDate(activeDate); setSlot(s); }}>{hm(s.start)}</button>
                  ))}
                </div>
                <p className="fine">Só aparecem horários livres para {dur} min de atendimento.</p>
              </>
            ) : <div className="empty">Sem horários nesse dia. Escolha outro dia ou outro barbeiro.</div>}
          </>
        )}

        {step === 4 && ticketAp && (
          <>
            <Ticket ap={ticketAp} />
            <div className="money"><small>Duração total</small><b>{dur} min</b></div>
            <p className="fine">Você ganha 1 carimbo quando o atendimento for concluído. Cancelamento sem ocorrência até {Math.round(settings.cancelMin / 60)} horas antes.</p>
          </>
        )}
      </div>

      <div className="actionbar">
        {step === 1 && <><div className="sum"><b>{brl(total)}</b><small>{picked.length} serviço{picked.length === 1 ? '' : 's'}, {dur} min</small></div><button className="btn" disabled={!picked.length} onClick={() => setStep(2)}>Continuar</button></>}
        {step === 2 && <><div className="sum"><b>{brl(total)}</b><small>{dur} min</small></div><button className="btn" disabled={!barberSel} onClick={() => setStep(3)}>Continuar</button></>}
        {step === 3 && <><div className="sum"><b>{slot ? hm(slot.start) : '--:--'}</b><small>{slot ? `${dayLabel(activeDate)}, com ${barbers.find((b) => b.id === slot.barberId)?.short}` : 'Escolha um horário'}</small></div><button className="btn" disabled={!slot} onClick={() => setStep(4)}>Continuar</button></>}
        {step === 4 && <button className="btn wide" disabled={busy} onClick={confirm}>{busy ? 'Agendando...' : state?.resched ? 'Confirmar novo horário' : 'Confirmar agendamento'}</button>}
      </div>
    </>
  );
}
