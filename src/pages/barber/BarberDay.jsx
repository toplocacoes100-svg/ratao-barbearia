import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../firebase.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useCatalog } from '../../context/CatalogContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { freeGaps } from '../../lib/availability.js';
import { createAppointment, markNoShow, setStatus } from '../../lib/bookings.js';
import { addDays, brl, brl0, dayLabel, fromKey, hm, key, nowMin, todayKey } from '../../lib/time.js';
import { Avatar, Logo, Modal, Pill, STATUS, ThemeButton } from '../../components/ui.jsx';
import PayDialog from '../../components/PayDialog.jsx';
import ShareCardDialog from '../../components/ShareCardDialog.jsx';
import { useBookingAlerts } from '../../hooks/useBookingAlerts.js';
import { useSubscriptions } from '../../hooks/useSubscriptions.js';
import { findSubscription } from '../../lib/subscriptions.js';

export default function BarberDay() {
  const { user, profile, logout } = useAuth();
  const { barbers, allBarbers, services, settings, ready } = useCatalog();
  const toast = useToast();
  const subs = useSubscriptions();
  const isAdmin = profile.role === 'admin';

  // O barbeiro vê só a agenda dele; o dono pode escolher de quem ver.
  const [pick, setPick] = useState('');
  const bid = isAdmin ? (pick || barbers[0]?.id || '') : (profile.barberId || '');
  const barber = allBarbers.find((b) => b.id === bid);

  const [date, setDate] = useState(todayKey());
  const [appts, setAppts] = useState([]);
  const [blks, setBlks] = useState([]);
  const [dlg, setDlg] = useState(null);
  const [tick, setTick] = useState(0);
  const { alerts, dismiss, soundOn, enable, disable } = useBookingAlerts({ bid, uid: user.uid });

  // atualiza os horários livres a cada minuto (o "agora" anda)
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!bid) return undefined;
    const c = [where('date', '==', date), where('barberId', '==', bid)];
    const fail = (e) => { console.error(e); toast('Não foi possível carregar a agenda'); };
    const u1 = onSnapshot(query(collection(db, 'appointments'), ...c), (s) => setAppts(s.docs.map((d) => ({ id: d.id, ...d.data() }))), fail);
    const u2 = onSnapshot(query(collection(db, 'blocks'), ...c), (s) => setBlks(s.docs.map((d) => ({ id: d.id, ...d.data() }))), fail);
    return () => { u1(); u2(); };
  }, [bid, date]);

  const items = useMemo(() => {
    if (!barber) return { works: false, list: [] };
    const wd = fromKey(date).getDay();
    const works = Boolean(settings.hours?.[wd]) && !(barber.off || []).includes(wd);
    const aps = appts.filter((a) => a.status !== 'cancelado').map((a) => ({ type: 'ap', start: a.start, ap: a }));
    const gaps = freeGaps({ barber, dk: date, appts, blocks: blks, settings, nowMinutes: nowMin() }).map((g) => ({ type: 'gap', ...g }));
    const extras = [];
    if (works && barber.lunch) extras.push({ type: 'lunch', start: barber.lunch.start, end: barber.lunch.end });
    blks.forEach((b) => extras.push({ type: 'block', start: b.start, end: b.end, reason: b.reason }));
    const order = { ap: 0, lunch: 1, block: 1, gap: 2 };
    return { works, list: [...aps, ...gaps, ...extras].sort((a, b) => a.start - b.start || order[a.type] - order[b.type]) };
  }, [appts, blks, barber, date, settings, tick]);

  if (!ready) return <div className="splash force-dark"><Logo size={72} /><p>Carregando...</p></div>;

  const by = { byUid: user.uid, byName: profile.name };
  const alive = appts.filter((a) => !['cancelado', 'faltou'].includes(a.status));
  const done = appts.filter((a) => a.status === 'concluido');
  const revenue = done.reduce((s, a) => s + Number(a.total || 0), 0);
  const commission = revenue * Number(barber?.commissionService || 0) / 100;
  const target = dlg?.id ? appts.find((a) => a.id === dlg.id) : null;
  const isToday = date === todayKey();
  const canAct = date <= todayKey();

  const run = async (fn, ok) => {
    try { await fn(); toast(ok); } catch (e) { console.error(e); toast('Não foi possível concluir. Tente de novo.'); }
    setDlg(null);
  };

  return (
    <>
      <header className="top">
        <div className="brand"><Logo /><span>Modo barbeiro</span></div>
        <div className="flex items-center gap-2" style={{ marginLeft: 'auto' }}>
          <Link to="/painel/agenda" className="btn sm ghost">Agenda completa</Link>
          <button className="btn sm ghost" onClick={logout}>Sair</button>
          <ThemeButton />
        </div>
      </header>

      <main className="bday">
        {isAdmin && (
          <label className="field">Ver a agenda de
            <select value={bid} onChange={(e) => setPick(e.target.value)}>
              {barbers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
        )}

        {!barber ? (
          <div className="empty">{isAdmin ? 'Ainda não há barbeiros cadastrados.' : 'Seu login ainda não foi ligado a um barbeiro. Peça ao dono para vincular você na aba Acessos.'}</div>
        ) : (
          <>
            <div className="bhead">
              <Avatar barber={barber} size={56} />
              <div><h1>{barber.short || barber.name}</h1><p className="fine">{barber.spec}</p></div>
            </div>

            <div className="datenav">
              <button className="iconbtn" onClick={() => setDate(key(addDays(fromKey(date), -1)))} aria-label="Dia anterior">‹</button>
              <div style={{ textAlign: 'center' }}>
                <b>{dayLabel(date)}</b>
                {!isToday && <button className="linkbtn" style={{ display: 'block', margin: '0 auto' }} onClick={() => setDate(todayKey())}>Voltar para hoje</button>}
              </div>
              <button className="iconbtn" onClick={() => setDate(key(addDays(fromKey(date), 1)))} aria-label="Próximo dia">›</button>
            </div>

            <div className="alertline">
              {soundOn
                ? <span className="fine">Avisos com som ligados. <button className="linkbtn" onClick={disable}>Desligar</button></span>
                : <button className="btn sm ghost" onClick={enable}>Ativar som e notificações de novos agendamentos</button>}
            </div>
            {alerts.map((a) => (
              <div key={a.id} className="alertbar" role="alert">
                <div><b>{a.title}</b><span>{a.body}</span></div>
                <div className="alertacts">
                  <button className="btn sm" onClick={() => { setDate(a.date); dismiss(a.id); }}>Ver</button>
                  <button className="btn sm ghost" onClick={() => dismiss(a.id)}>Fechar</button>
                </div>
              </div>
            ))}

            <div className="sumstrip">
              <div><small>Concluídos</small><b>{done.length} de {alive.length}</b></div>
              <div><small>Faturado</small><b>{brl0(revenue)}</b></div>
              <div><small>Sua comissão</small><b>{brl0(commission)}</b></div>
            </div>

            {!items.works && <div className="empty">Sem expediente nesse dia.</div>}

            <div className="list">
              {items.works && items.list.length === 0 && <div className="empty">Nenhum atendimento e nenhum horário livre por aqui.</div>}
              {items.list.map((it, i) => {
                if (it.type === 'lunch') return <div key={`l${i}`} className="muterow">Almoço, {hm(it.start)} às {hm(it.end)}</div>;
                if (it.type === 'block') return <div key={`b${i}`} className="muterow">Bloqueado, {hm(it.start)} às {hm(it.end)}{it.reason ? ` (${it.reason})` : ''}</div>;
                if (it.type === 'gap') {
                  return (
                    <div key={`g${i}`} className="gapcard">
                      <div><b>Horário livre</b><span className="fine" style={{ display: 'block' }}>{hm(it.start)} às {hm(it.end)}, {it.end - it.start} min</span></div>
                      <button className="btn" onClick={() => setDlg({ type: 'encaixe', gap: it })}>Encaixar</button>
                    </div>
                  );
                }
                const a = it.ap;
                const open = ['agendado', 'confirmado', 'atendimento'].includes(a.status);
                return (
                  <article key={a.id} className="apcard" style={{ '--c': `var(${STATUS[a.status].v})` }}>
                    <div className="aptime"><b>{hm(a.start)}</b><small>{hm(a.end)}</small></div>
                    <div className="apmain">
                      <b>{a.clientName}{a.walkin && <span className="tagsave" style={{ marginLeft: 8 }}>encaixe</span>}{findSubscription(subs, a) && <span className="tagsave" style={{ marginLeft: 8 }}>mensalista</span>}</b>
                      <span>{(a.serviceNames || []).join(' + ')}</span>
                      <div className="aprow"><Pill status={a.status} /><b>{brl(a.total)}</b>{a.payMethod && <small className="fine">{a.payMethod}</small>}</div>
                    </div>
                    {open && canAct && (
                      <div className="apacts">
                        <button className="btn" onClick={() => setDlg({ type: 'pay', id: a.id })}>Dar baixa</button>
                        {a.status !== 'atendimento' && <button className="btn ghost" onClick={() => run(() => setStatus(a, 'atendimento'), 'Atendimento iniciado')}>Iniciar</button>}
                        {a.status !== 'atendimento' && <button className="btn ghost" onClick={() => setDlg({ type: 'noshow', id: a.id })}>Faltou</button>}
                        <button className="btn ghost" onClick={() => setDlg({ type: 'card', id: a.id })}>Enviar banner</button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </>
        )}
      </main>

      {dlg?.type === 'pay' && target && <PayDialog ap={target} subs={subs} toast={toast} onClose={() => setDlg(null)} />}

      {dlg?.type === 'card' && target && barber && <ShareCardDialog ap={target} barber={barber} settings={settings} chat={target.clientPhone ? { phone: target.clientPhone } : null} toast={toast} onClose={() => setDlg(null)} />}

      {dlg?.type === 'noshow' && target && (
        <Modal title="Marcar falta?" onClose={() => setDlg(null)} actions={[
          { label: 'Voltar', kind: 'ghost', onClick: () => setDlg(null) },
          { label: 'Marcar falta', kind: 'danger', onClick: () => run(() => markNoShow(target, by), 'Falta registrada') },
        ]}>
          <p>{target.clientName} não compareceu. O horário fica livre para um encaixe e a falta entra no histórico dele.</p>
        </Modal>
      )}

      {dlg?.type === 'encaixe' && barber && (
        <EncaixeDialog gap={dlg.gap} barber={barber} services={services} settings={settings} date={date} uid={user.uid} toast={toast} onClose={() => setDlg(null)} />
      )}
    </>
  );
}

/* ---------- encaixe: cliente sem hora marcada num horário livre ---------- */
function EncaixeDialog({ gap, barber, services, settings, date, uid, toast, onClose }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [ids, setIds] = useState([]);
  const [startSel, setStartSel] = useState(null);
  const [startNow, setStartNow] = useState(true);

  const mine = services.filter((s) => s.barberIds?.includes(barber.id));
  const byId = Object.fromEntries(mine.map((s) => [s.id, s]));
  const picked = ids.filter((i) => byId[i]);
  const dur = picked.reduce((a, i) => a + byId[i].dur, 0);
  const total = picked.reduce((a, i) => a + byId[i].price, 0);
  const len = gap.end - gap.start;

  const starts = [];
  if (dur > 0) for (let s = gap.start; s + dur <= gap.end; s += 15) starts.push(s);
  const start = starts.includes(startSel) ? startSel : starts[0];
  const canNow = date === todayKey() && start !== undefined && start <= nowMin() + 10;

  const toggle = (id) => setIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  async function save() {
    if (!picked.length || start === undefined) { toast('Escolha o serviço'); return; }
    try {
      await createAppointment({
        barber, dk: date, start, dur,
        client: { id: null, name: name.trim() || 'Encaixe', phone: phone.trim() },
        services: picked.map((i) => byId[i]), total, createdBy: uid,
        status: canNow && startNow ? 'atendimento' : 'confirmado', settings, extra: { walkin: true },
      });
      toast('Encaixe registrado');
      onClose();
    } catch (e) {
      console.error(e);
      toast(e.message === 'SLOT_TAKEN' ? 'Esse horário acabou de ser ocupado' : 'Não foi possível encaixar');
    }
  }

  return (
    <Modal title="Encaixar cliente" onClose={onClose} actions={[{ label: 'Voltar', kind: 'ghost', onClick: onClose }, { label: 'Encaixar', onClick: save }]}>
      <p className="fine">Horário livre das {hm(gap.start)} às {hm(gap.end)} ({len} min).</p>
      <label className="field">Nome do cliente (opcional)<input value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" /></label>
      <label className="field">WhatsApp (opcional)<input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
      <div className="field">Serviços
        <div className="checks">
          {mine.map((s) => (
            <label key={s.id}>
              <input type="checkbox" checked={ids.includes(s.id)} disabled={!ids.includes(s.id) && dur + s.dur > len} onChange={() => toggle(s.id)} />
              {s.name} ({s.dur} min, {brl0(s.price)})
            </label>
          ))}
        </div>
      </div>
      {picked.length > 0 && (
        <p><b>{dur} min</b>, total <b>{brl(total)}</b></p>
      )}
      {starts.length > 1 && (
        <label className="field">Começa às
          <select value={start} onChange={(e) => setStartSel(Number(e.target.value))}>
            {starts.map((s) => <option key={s} value={s}>{hm(s)}</option>)}
          </select>
        </label>
      )}
      {canNow && (
        <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input type="checkbox" checked={startNow} onChange={(e) => setStartNow(e.target.checked)} />
          Cliente já está aqui, começar agora
        </label>
      )}
    </Modal>
  );
}
