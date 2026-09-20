import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../firebase.js';
import { useToast } from '../../context/ToastContext.jsx';
import { addDays, brl, brl0, dayLabel, fromKey, hm, key, startOfToday, whatsappUrl } from '../../lib/time.js';
import { Modal, Pill } from '../../components/ui.jsx';

const WINDOW = 180; // o histórico considera os últimos 180 dias (economiza leituras do banco)
const DAY = 864e5;

export default function ClientsTab() {
  const toast = useToast();
  const [users, setUsers] = useState(null);
  const [appts, setAppts] = useState(null);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('todos');
  const [openId, setOpenId] = useState(null);

  useEffect(() => onSnapshot(
    collection(db, 'users'),
    (s) => setUsers(s.docs.map((d) => ({ id: d.id, ...d.data() })).filter((u) => u.role === 'client')),
    (e) => { console.error(e); toast('Não foi possível carregar os clientes'); setUsers([]); },
  ), []);

  useEffect(() => {
    let alive = true;
    getDocs(query(collection(db, 'appointments'), where('date', '>=', key(addDays(startOfToday(), -WINDOW)))))
      .then((s) => alive && setAppts(s.docs.map((d) => ({ id: d.id, ...d.data() }))))
      .catch((e) => { console.error(e); if (alive) setAppts([]); });
    return () => { alive = false; };
  }, []);

  const rows = useMemo(() => {
    if (!users) return [];
    const byClient = {};
    (appts || []).forEach((a) => { if (a.clientId) (byClient[a.clientId] ||= []).push(a); });
    const today = key(new Date());
    return users.map((u) => {
      const list = (byClient[u.id] || []).sort((x, y) => y.date.localeCompare(x.date) || y.start - x.start);
      const done = list.filter((a) => a.status === 'concluido');
      const last = done[0]?.date || null;
      return {
        u, list, visits: done.length,
        spent: done.reduce((s, a) => s + Number(a.total || 0), 0),
        last, days: last ? Math.round((startOfToday() - fromKey(last)) / DAY) : null,
        upcoming: list.filter((a) => ['agendado', 'confirmado'].includes(a.status) && a.date >= today).length,
        occ: list.filter((a) => a.status === 'faltou' || a.late).length,
        created: u.createdAt?.toDate ? u.createdAt.toDate() : null,
      };
    }).sort((a, b) => (b.created?.getTime() || 0) - (a.created?.getTime() || 0));
  }, [users, appts]);

  const shown = rows.filter((r) => {
    const t = q.trim().toLowerCase();
    if (t && !(r.u.name || '').toLowerCase().includes(t) && !(r.u.phone || '').includes(t) && !(r.u.email || '').toLowerCase().includes(t)) return false;
    if (filter === 'sem') return r.visits === 0;
    if (['30', '45', '60'].includes(filter)) return r.days !== null && r.days > Number(filter);
    return true;
  });

  const newThisWeek = rows.filter((r) => r.created && Date.now() - r.created.getTime() < 7 * DAY).length;
  const open = rows.find((r) => r.u.id === openId);
  const F = (id, label) => <button className="pillbtn" aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>;
  const site = window.location.origin;

  const msgFor = (r) => {
    const first = (r.u.name || '').split(' ')[0];
    return r.days !== null && r.days > 30
      ? `Oi, ${first}! Faz um tempo que você não passa aqui na Barbearia do Ratão. Bora marcar um horário? ${site}`
      : `Oi, ${first}! Aqui é da Barbearia do Ratão. Qualquer coisa é só chamar. Para agendar: ${site}`;
  };

  return (
    <>
      <div className="head-row">
        <div>
          <h1>Clientes do app</h1>
          <p className="fine">{users ? `${rows.length} conta${rows.length === 1 ? '' : 's'} de cliente, ${newThisWeek} nova${newThisWeek === 1 ? '' : 's'} nos últimos 7 dias.` : 'Carregando...'}</p>
        </div>
      </div>

      <div className="toolbar">
        <input type="search" placeholder="Buscar por nome, telefone ou e-mail" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar cliente" style={{ flex: 1, minWidth: 220 }} />
        <div className="pills" role="group" aria-label="Filtro">
          {F('todos', 'Todos')}{F('sem', 'Sem visitas ainda')}{F('30', 'Sem voltar há 30+ dias')}{F('45', '45+')}{F('60', '60+')}
        </div>
      </div>

      <div className="tblwrap">
        <table>
          <thead><tr><th>Cliente</th><th>WhatsApp</th><th>Cadastro</th><th className="num">Visitas</th><th>Última visita</th><th /></tr></thead>
          <tbody>
            {users && shown.length === 0 && (
              <tr><td colSpan={6}><div className="empty" style={{ border: 0 }}>{rows.length ? 'Nenhum cliente com esse filtro.' : 'Ainda ninguém criou conta. Divulgue o link ou o QR Code na aba ao lado.'}</div></td></tr>
            )}
            {shown.map((r) => (
              <tr key={r.u.id}>
                <td><b>{r.u.name}</b><small>{r.u.email}</small></td>
                <td>{r.u.phone || '—'}</td>
                <td>{r.created ? r.created.toLocaleDateString('pt-BR') : '—'}</td>
                <td className="num">{appts ? r.visits : '—'}</td>
                <td>
                  {!appts ? '—' : r.last ? `há ${r.days} dia${r.days === 1 ? '' : 's'}` : <span className="fine">sem visita</span>}
                  {r.occ > 0 && <small className="warn">{r.occ} ocorrência{r.occ > 1 ? 's' : ''}</small>}
                </td>
                <td><button className="btn sm ghost" onClick={() => setOpenId(r.u.id)}>Ver</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="fine">O histórico considera os últimos {WINDOW} dias. Quem não aparece com visita pode ter vindo antes disso ou ainda não ter agendado.</p>

      {open && (
        <Modal title={open.u.name} onClose={() => setOpenId(null)} actions={[{ label: 'Fechar', kind: 'ghost', onClick: () => setOpenId(null) }]}>
          <dl className="kv">
            <dt>WhatsApp</dt><dd>{open.u.phone || '—'}</dd>
            <dt>E-mail</dt><dd>{open.u.email}</dd>
            <dt>Cadastro</dt><dd>{open.created ? open.created.toLocaleDateString('pt-BR') : '—'}</dd>
            <dt>Visitas</dt><dd>{open.visits}, somando {brl(open.spent)}</dd>
            <dt>Última visita</dt><dd>{open.last ? `${dayLabel(open.last)}${open.days ? `, há ${open.days} dias` : ''}` : 'sem visita registrada'}</dd>
            <dt>Próximos</dt><dd>{open.upcoming ? `${open.upcoming} horário${open.upcoming > 1 ? 's' : ''} marcado${open.upcoming > 1 ? 's' : ''}` : 'nenhum'}</dd>
            <dt>Ocorrências</dt><dd>{open.occ ? <span className="warn">{open.occ} (faltas ou cancelamentos fora do prazo)</span> : 'nenhuma'}</dd>
          </dl>
          {open.u.phone && <div className="linkrow"><a className="btn sm" target="_blank" rel="noopener noreferrer" href={whatsappUrl(open.u.phone, msgFor(open))}>Chamar no WhatsApp</a></div>}
          <h3 style={{ fontSize: 22, marginTop: 6 }}>Últimos agendamentos</h3>
          {open.list.length ? open.list.slice(0, 8).map((a) => (
            <div key={a.id} className="logrow" style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--line)', alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="fine" style={{ minWidth: 92 }}>{dayLabel(a.date)} {hm(a.start)}</span>
              <span style={{ flex: 1 }}>{(a.serviceNames || []).join(' + ')}</span>
              <Pill status={a.status} />
              <b>{brl0(a.total)}</b>
            </div>
          )) : <p className="fine">Nenhum agendamento nos últimos {WINDOW} dias.</p>}
        </Modal>
      )}
    </>
  );
}
