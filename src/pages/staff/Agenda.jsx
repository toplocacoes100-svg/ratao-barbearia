import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../firebase.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useCatalog } from '../../context/CatalogContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useDays } from '../../hooks/useDays.js';
import { slotsFor } from '../../lib/availability.js';
import { cancelAppointment, createAppointment, createBlock, deleteAppointment, markNoShow, removeBlock, setStatus } from '../../lib/bookings.js';
import { addDays, brl, brl0, dayLabel, DAYS, fromKey, hm, key, MONTHS, nowMin, todayKey, weekDates, whatsappUrl } from '../../lib/time.js';
import { Avatar, Modal, Pill, STATUS } from '../../components/ui.jsx';

const PPM = 1.4; // pixels por minuto

export default function Agenda() {
  const { user, profile } = useAuth();
  const { barbers, services, settings } = useCatalog();
  const toast = useToast();
  const isAdmin = profile.role === 'admin';
  const myBid = isAdmin ? null : profile.barberId;

  const [date, setDate] = useState(todayKey());
  const [mode, setMode] = useState('dia');
  const [sel, setSel] = useState('all');
  const [appts, setAppts] = useState([]);
  const [blks, setBlks] = useState([]);
  const [dialog, setDialog] = useState(null);

  const dates = useMemo(() => (mode === 'dia' ? [date] : weekDates(date)), [date, mode]);
  const focus = myBid || (sel === 'all' ? null : sel);
  const weekBarber = barbers.find((b) => b.id === focus) || barbers[0];
  const colBarbers = mode === 'dia' ? barbers.filter((b) => !focus || b.id === focus) : weekBarber ? [weekBarber] : [];
  const queryBid = mode === 'semana' ? weekBarber?.id : focus;

  useEffect(() => {
    if (!isAdmin && !myBid) return undefined;
    const c = [where('date', 'in', dates)];
    if (queryBid) c.push(where('barberId', '==', queryBid));
    const fail = (e) => { console.error(e); toast('Não foi possível carregar a agenda'); };
    const u1 = onSnapshot(query(collection(db, 'appointments'), ...c), (s) => setAppts(s.docs.map((d) => ({ id: d.id, ...d.data() }))), fail);
    const u2 = onSnapshot(query(collection(db, 'blocks'), ...c), (s) => setBlks(s.docs.map((d) => ({ id: d.id, ...d.data() }))), fail);
    return () => { u1(); u2(); };
  }, [dates.join(','), queryBid, isAdmin, myBid]);

  if (!isAdmin && !myBid) {
    return <div className="empty">Seu login ainda não foi ligado a um barbeiro. Peça ao dono para vincular você na tela Equipe.</div>;
  }

  const hoursVals = Object.values(settings.hours || {});
  const AX0 = Math.floor(Math.min(480, ...hoursVals.map((h) => h.open)) / 60) * 60;
  const AX1 = Math.ceil(Math.max(1140, ...hoursVals.map((h) => h.close)) / 60) * 60;
  const H = (AX1 - AX0) * PPM;
  const y = (m) => (m - AX0) * PPM;
  const ticks = []; for (let m = AX0; m <= AX1; m += 60) ticks.push(m);

  const cols = mode === 'dia'
    ? colBarbers.map((b) => ({ b, dk: date, label: b.short || b.name }))
    : dates.map((dk) => ({ b: colBarbers[0], dk, label: `${DAYS[fromKey(dk).getDay()]} ${fromKey(dk).getDate()}` })).filter((c) => c.b);

  const move = (n) => setDate(key(addDays(fromKey(date), mode === 'semana' ? n * 7 : n)));
  const d = fromKey(date);
  const by = { byUid: user.uid, byName: profile.name };
  const current = dialog?.type === 'appt' ? appts.find((a) => a.id === dialog.id) : null;

  const run = async (fn, ok) => {
    try { await fn(); toast(ok); } catch (e) { console.error(e); toast('Não foi possível concluir a ação'); }
    setDialog(null);
  };
  const ask = (title, text, label, fn, ok) => setDialog({ type: 'confirm', title, text, label, fn, ok });

  function colBody(c) {
    const wd = fromKey(c.dk).getDay(), h = settings.hours?.[wd];
    if (!h) return <div className="shade" style={{ top: 0, height: '100%' }}>Fechado</div>;
    const off = (c.b.off || []).includes(wd);
    return (
      <>
        <div className="shade" style={{ top: 0, height: y(h.open) }} />
        <div className="shade" style={{ top: y(h.close), bottom: 0 }} />
        {off && <div className="shade" style={{ top: y(h.open), height: y(h.close) - y(h.open) }}>Folga</div>}
        {!off && c.b.lunch && <div className="shade" style={{ top: y(c.b.lunch.start), height: (c.b.lunch.end - c.b.lunch.start) * PPM }}>Almoço</div>}
        {!off && blks.filter((b) => b.barberId === c.b.id && b.date === c.dk).map((b) => (
          <button key={b.id} className="blk lock" style={{ top: y(b.start), height: (b.end - b.start) * PPM }} onClick={() => setDialog({ type: 'blk', blk: b })}>
            <b>Bloqueado</b><span>{b.reason}</span>
          </button>
        ))}
        {!off && appts.filter((a) => a.barberId === c.b.id && a.date === c.dk && a.status !== 'cancelado').map((a) => (
          <button key={a.id} className="blk" style={{ '--st': `var(${STATUS[a.status].v})`, top: y(a.start), height: Math.max(20, a.dur * PPM - 2) }} onClick={() => setDialog({ type: 'appt', id: a.id })}>
            <b>{hm(a.start)} {a.clientName}</b><span>{a.serviceNames.join(' + ')}</span>
          </button>
        ))}
        {c.dk === todayKey() && nowMin() >= AX0 && nowMin() <= AX1 && <div className="nowline" style={{ top: y(nowMin()) }} />}
      </>
    );
  }

  return (
    <>
      <div className="head-row">
        <div><h1>Agenda</h1><p className="fine">{mode === 'semana' && weekBarber ? `Semana de ${weekBarber.short || weekBarber.name}, ` : ''}{dayLabel(date)}, {d.getDate()} de {MONTHS[d.getMonth()]}</p></div>
        <div className="toolbar">
          <button className="btn" onClick={() => setDialog({ type: 'manual' })}>Novo agendamento</button>
          <button className="btn ghost" onClick={() => setDialog({ type: 'block' })}>Bloquear horário</button>
        </div>
      </div>

      <div className="toolbar">
        <button className="iconbtn" onClick={() => move(-1)} aria-label="Anterior">‹</button>
        <button className="btn ghost sm" onClick={() => setDate(todayKey())}>Hoje</button>
        <button className="iconbtn" onClick={() => move(1)} aria-label="Próximo">›</button>
        <div className="pills" role="group" aria-label="Visão">
          <button className="pillbtn" aria-pressed={mode === 'dia'} onClick={() => setMode('dia')}>Dia</button>
          <button className="pillbtn" aria-pressed={mode === 'semana'} onClick={() => setMode('semana')}>Semana</button>
        </div>
        {isAdmin && (
          <select value={sel} onChange={(e) => setSel(e.target.value)} aria-label="Barbeiro">
            <option value="all">{mode === 'semana' ? `${barbers[0]?.short || 'Primeiro'} (padrão)` : 'Todos os barbeiros'}</option>
            {barbers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
      </div>

      <div className="legend">{Object.values(STATUS).map((s) => <span key={s.label} style={{ '--c': `var(${s.v})` }}>{s.label}</span>)}</div>

      {!barbers.length ? (
        <div className="empty">Ainda não há barbeiros cadastrados.{isAdmin ? ' Vá em Equipe e carregue os dados de exemplo.' : ''}</div>
      ) : (
        <div className="gridscroll">
          <div className="agenda" style={{ gridTemplateColumns: `52px repeat(${cols.length}, minmax(150px, 1fr))` }}>
            <div className="axis"><div className="hd" /><div className="gbody" style={{ height: H }}>{ticks.map((m) => <div key={m} className="tick" style={{ top: y(m) }}>{hm(m)}</div>)}</div></div>
            {cols.map((c) => (
              <div className="col" key={c.b.id + c.dk}>
                <div className="hd">{mode === 'dia' ? <><Avatar barber={c.b} size={26} />{c.label}</> : c.label}</div>
                <div className="gbody" style={{ height: H }}>{colBody(c)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {current && (
        <Modal title={current.clientName} onClose={() => setDialog(null)} actions={apptActions(current)}>
          <dl className="kv">
            <dt>Status</dt><dd><Pill status={current.status} /></dd>
            <dt>Quando</dt><dd>{dayLabel(current.date)}, {hm(current.start)} às {hm(current.end)}</dd>
            <dt>Barbeiro</dt><dd>{current.barberName}</dd>
            <dt>Serviços</dt><dd>{current.serviceNames.join(' + ')}</dd>
            <dt>Valor</dt><dd>{brl(current.total)}</dd>
            {current.clientPhone && <><dt>WhatsApp</dt><dd>{current.clientPhone}</dd></>}
          </dl>
          <div className="linkrow">
            {current.clientPhone && (
              <a className="btn sm ghost" target="_blank" rel="noopener noreferrer" href={whatsappUrl(current.clientPhone, `Oi, ${current.clientName.split(' ')[0]}! Passando pra lembrar do seu horário ${dayLabel(current.date).toLowerCase()} às ${hm(current.start)} com ${current.barberName.split(' ')[0]} na Barbearia do Ratão. Confirma?`)}>Lembrar no WhatsApp</a>
            )}
            {isAdmin && <button className="btn sm ghost" onClick={() => ask('Excluir agendamento?', `Isso remove de vez o horário de ${current.clientName} (${dayLabel(current.date)}, ${hm(current.start)}). A exclusão fica no registro.`, 'Excluir', () => deleteAppointment(current, by), 'Agendamento excluído')}>Excluir</button>}
          </div>
        </Modal>
      )}

      {dialog?.type === 'confirm' && (
        <Modal title={dialog.title} onClose={() => setDialog(null)} actions={[
          { label: 'Voltar', kind: 'ghost', onClick: () => setDialog(null) },
          { label: dialog.label, kind: 'danger', onClick: () => run(dialog.fn, dialog.ok) },
        ]}><p>{dialog.text}</p></Modal>
      )}

      {dialog?.type === 'blk' && (
        <Modal title="Horário bloqueado" onClose={() => setDialog(null)} actions={[
          { label: 'Fechar', kind: 'ghost', onClick: () => setDialog(null) },
          { label: 'Remover bloqueio', kind: 'danger', onClick: () => run(() => removeBlock(dialog.blk), 'Bloqueio removido') },
        ]}><p>{hm(dialog.blk.start)} às {hm(dialog.blk.end)}{dialog.blk.reason ? `: ${dialog.blk.reason}` : ''}</p></Modal>
      )}

      {dialog?.type === 'manual' && (
        <ManualDialog onClose={() => setDialog(null)} defaultDate={date < todayKey() ? todayKey() : date} services={services} barbers={myBid ? barbers.filter((b) => b.id === myBid) : barbers} settings={settings} uid={user.uid} toast={toast} />
      )}
      {dialog?.type === 'block' && (
        <BlockDialog onClose={() => setDialog(null)} defaultDate={date < todayKey() ? todayKey() : date} barbers={myBid ? barbers.filter((b) => b.id === myBid) : barbers} by={by} toast={toast} />
      )}
    </>
  );

  function apptActions(a) {
    const list = [];
    const open = a.status === 'agendado' || a.status === 'confirmado';
    if (open) {
      list.push({ label: 'Cancelar horário', kind: 'ghost', onClick: () => ask('Cancelar horário?', `${a.clientName}, ${dayLabel(a.date)} às ${hm(a.start)}, será cancelado e o horário fica livre.`, 'Cancelar horário', () => cancelAppointment(a, by), 'Horário cancelado') });
      list.push({ label: 'Marcar falta', kind: 'ghost', onClick: () => ask('Marcar falta?', `${a.clientName} não compareceu. Isso vira ocorrência no histórico do cliente.`, 'Marcar falta', () => markNoShow(a, by), 'Falta registrada') });
    }
    if (a.status === 'agendado') list.push({ label: 'Confirmar presença', onClick: () => run(() => setStatus(a, 'confirmado'), 'Confirmado') });
    if (open) list.push({ label: 'Iniciar atendimento', onClick: () => run(() => setStatus(a, 'atendimento'), 'Atendimento iniciado') });
    if (a.status === 'atendimento') list.push({ label: 'Concluir atendimento', onClick: () => run(() => setStatus(a, 'concluido'), 'Atendimento concluído') });
    if (!list.length) list.push({ label: 'Fechar', kind: 'ghost', onClick: () => setDialog(null) });
    return list;
  }
}

/* ---------- novo agendamento (cliente que ligou ou chegou no balcão) ---------- */
function ManualDialog({ onClose, defaultDate, services, barbers, settings, uid, toast }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [ids, setIds] = useState([]);
  const [bid, setBid] = useState('any');
  const [dk, setDk] = useState(defaultDate);
  const [slotVal, setSlotVal] = useState('');
  const { days } = useDays([dk]);

  const byId = Object.fromEntries(services.map((s) => [s.id, s]));
  const picked = ids.filter((i) => byId[i]);
  const dur = picked.reduce((a, i) => a + byId[i].dur, 0);
  const total = picked.reduce((a, i) => a + byId[i].price, 0);
  const eligible = barbers.filter((b) => picked.every((i) => byId[i].barberIds?.includes(b.id)));
  const pool = bid === 'any' ? eligible : eligible.filter((b) => b.id === bid);
  const slots = picked.length && dk ? slotsFor({ barbers: pool, dk, dur, daysMap: days, settings, admin: true }) : [];
  const k = (s) => `${s.start}|${s.barberId}`;
  const chosen = slots.some((s) => k(s) === slotVal) ? slotVal : slots[0] ? k(slots[0]) : '';

  const toggle = (id) => setIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  async function save() {
    if (!name.trim()) { toast('Informe o nome do cliente'); return; }
    if (!chosen) { toast('Escolha serviços e um horário livre'); return; }
    const [s, b] = chosen.split('|');
    try {
      await createAppointment({ barber: barbers.find((x) => x.id === b), dk, start: +s, dur, client: { id: null, name: name.trim(), phone: phone.trim() }, services: picked.map((i) => byId[i]), total, createdBy: uid, status: 'confirmado', settings });
      toast('Agendamento criado'); onClose();
    } catch (e) {
      toast(e.message === 'SLOT_TAKEN' ? 'Esse horário acabou de ser ocupado' : 'Não foi possível agendar');
    }
  }

  return (
    <Modal title="Novo agendamento" onClose={onClose} actions={[{ label: 'Voltar', kind: 'ghost', onClick: onClose }, { label: 'Agendar', onClick: save }]}>
      <label className="field">Nome do cliente<input value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label className="field">WhatsApp (opcional)<input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
      <div className="field">Serviços
        <div className="checks">{services.map((s) => (
          <label key={s.id}><input type="checkbox" checked={ids.includes(s.id)} onChange={() => toggle(s.id)} />{s.name} ({s.dur} min, {brl0(s.price)})</label>
        ))}</div>
      </div>
      <label className="field">Barbeiro
        <select value={bid} onChange={(e) => setBid(e.target.value)}>
          <option value="any">Qualquer disponível</option>
          {eligible.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </label>
      <label className="field">Data<input type="date" value={dk} min={todayKey()} onChange={(e) => setDk(e.target.value)} /></label>
      <label className="field">Horário
        <select value={chosen} onChange={(e) => setSlotVal(e.target.value)}>
          {slots.length ? slots.map((s) => <option key={k(s)} value={k(s)}>{hm(s.start)} com {barbers.find((b) => b.id === s.barberId)?.short}</option>) : <option value="">{picked.length ? 'Sem horário livre' : 'Escolha os serviços'}</option>}
        </select>
      </label>
    </Modal>
  );
}

/* ---------- bloquear horário (almoço, folga, atestado) ---------- */
function BlockDialog({ onClose, defaultDate, barbers, by, toast }) {
  const [bid, setBid] = useState(barbers[0]?.id || '');
  const [dk, setDk] = useState(defaultDate);
  const [start, setStart] = useState(840);
  const [end, setEnd] = useState(900);
  const [reason, setReason] = useState('');
  const times = []; for (let m = 360; m <= 1260; m += 30) times.push(m);

  async function save() {
    if (!bid || !dk || end <= start) { toast('O fim precisa ser depois do início'); return; }
    try {
      await createBlock({ barber: barbers.find((b) => b.id === bid), dk, start, end, reason: reason.trim(), ...by });
      toast('Horário bloqueado'); onClose();
    } catch (e) {
      toast(e.message === 'SLOT_TAKEN' ? 'Já existe atendimento nesse período' : 'Não foi possível bloquear');
    }
  }
  return (
    <Modal title="Bloquear horário" onClose={onClose} actions={[{ label: 'Voltar', kind: 'ghost', onClick: onClose }, { label: 'Bloquear', onClick: save }]}>
      <label className="field">Barbeiro<select value={bid} onChange={(e) => setBid(e.target.value)}>{barbers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
      <label className="field">Data<input type="date" value={dk} min={todayKey()} onChange={(e) => setDk(e.target.value)} /></label>
      <label className="field">Das<select value={start} onChange={(e) => setStart(+e.target.value)}>{times.map((m) => <option key={m} value={m}>{hm(m)}</option>)}</select></label>
      <label className="field">Até<select value={end} onChange={(e) => setEnd(+e.target.value)}>{times.map((m) => <option key={m} value={m}>{hm(m)}</option>)}</select></label>
      <label className="field">Motivo<input value={reason} maxLength={40} placeholder="Folga, atestado, curso" onChange={(e) => setReason(e.target.value)} /></label>
    </Modal>
  );
}
