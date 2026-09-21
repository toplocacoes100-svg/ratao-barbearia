import { useEffect, useMemo, useState } from 'react';
import { collection, doc, limit, onSnapshot, orderBy, query, serverTimestamp, where, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useCatalog } from '../../context/CatalogContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { EXPENSE_CATS, periodRange, summarize } from '../../lib/finance.js';
import { brl, brl0, dayLabel, fromKey, todayKey } from '../../lib/time.js';
import { Modal } from '../../components/ui.jsx';
import { useSubscriptions } from '../../hooks/useSubscriptions.js';

const fmtDate = (dk) => { const d = fromKey(dk); return d.toLocaleDateString('pt-BR'); };

export default function Finance() {
  const { user, profile } = useAuth();
  const { allBarbers } = useCatalog();
  const toast = useToast();
  const [period, setPeriod] = useState('mes');
  const [[from, to], setRange] = useState(periodRange('mes'));
  const [appts, setAppts] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [closures, setClosures] = useState([]);
  const [form, setForm] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const subs = useSubscriptions();

  const pick = (p) => { setPeriod(p); setRange(periodRange(p)); };

  useEffect(() => {
    const fail = (e) => { console.error(e); toast('Não foi possível carregar o financeiro'); };
    const u1 = onSnapshot(query(collection(db, 'appointments'), where('date', '>=', from), where('date', '<=', to)), (s) => setAppts(s.docs.map((d) => ({ id: d.id, ...d.data() }))), fail);
    const u2 = onSnapshot(query(collection(db, 'expenses'), where('date', '>=', from), where('date', '<=', to)), (s) => setExpenses(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => b.date.localeCompare(a.date))), fail);
    return () => { u1(); u2(); };
  }, [from, to]);
  useEffect(() => onSnapshot(query(collection(db, 'commissionClosures'), orderBy('paidAt', 'desc'), limit(15)), (s) => setClosures(s.docs.map((d) => ({ id: d.id, ...d.data() }))), (e) => console.error(e)), []);

  // mensalidades recebidas dentro do período (pela data do recebimento)
  const subPayments = useMemo(() => subs.flatMap((s) => Object.values(s.paid || {}).filter((p) => p.date >= from && p.date <= to)), [subs, from, to]);
  const S = useMemo(() => summarize({ appts, expenses, barbers: allBarbers, from, to, subPayments }), [appts, expenses, allBarbers, from, to, subPayments]);
  const days = Object.entries(S.byDay);
  const maxDay = Math.max(1, ...days.map(([, v]) => v));
  const maxM = Math.max(1, ...Object.values(S.byMethod));
  const noMethod = S.byMethod['Não informado'] > 0;

  /* ---------- despesas ---------- */
  async function saveExpense() {
    const f = form;
    const amount = parseFloat(String(f.amount).replace(',', '.'));
    if (!f.description.trim()) { toast('Descreva a despesa'); return; }
    if (!(amount > 0)) { toast('Informe um valor maior que zero'); return; }
    try {
      const b = writeBatch(db);
      b.set(doc(collection(db, 'expenses')), { description: f.description.trim(), amount, date: f.date, category: f.category, kind: f.kind, createdBy: user.uid, createdAt: serverTimestamp() });
      await b.commit();
      toast('Despesa lançada'); setForm(null);
    } catch (e) { console.error(e); toast('Não foi possível lançar'); }
  }
  async function deleteExpense() {
    const e = confirm.expense;
    try {
      const b = writeBatch(db);
      b.delete(doc(db, 'expenses', e.id));
      b.set(doc(collection(db, 'logs')), { text: `Despesa excluída: ${e.description}, ${brl(e.amount)}, ${fmtDate(e.date)}.`, by: user.uid, byName: profile.name, at: serverTimestamp() });
      await b.commit();
      toast('Despesa excluída');
    } catch (ex) { console.error(ex); toast('Não foi possível excluir'); }
    setConfirm(null);
  }

  /* ---------- fechamento de comissão ---------- */
  async function closeCommission() {
    const c = confirm.commission;
    if (c.dueIds.length > 480) { toast('Período grande demais. Feche por semana.'); setConfirm(null); return; }
    try {
      const b = writeBatch(db);
      const ref = doc(collection(db, 'commissionClosures'));
      b.set(ref, { barberId: c.barberId, barberName: c.name, from, to, percent: c.percent, base: c.dueBase, amount: c.due, count: c.dueIds.length, by: user.uid, byName: profile.name, paidAt: serverTimestamp() });
      c.dueIds.forEach((id) => b.update(doc(db, 'appointments', id), { commissionClosureId: ref.id }));
      b.set(doc(collection(db, 'logs')), { text: `Comissão fechada: ${c.name}, ${fmtDate(from)} a ${fmtDate(to)}, ${brl(c.due)} (${c.dueIds.length} atendimentos).`, by: user.uid, byName: profile.name, at: serverTimestamp() });
      await b.commit();
      toast('Comissão fechada');
    } catch (ex) { console.error(ex); toast('Não foi possível fechar a comissão'); }
    setConfirm(null);
  }

  const P = (id, l) => <button className="pillbtn" aria-pressed={period === id} onClick={() => pick(id)}>{l}</button>;

  return (
    <>
      <div className="head-row">
        <div><h1>Financeiro</h1><p className="fine">Entram no faturamento os atendimentos concluídos e as mensalidades recebidas.</p></div>
        <div className="toolbar">
          <div className="pills" role="group" aria-label="Período">{P('hoje', 'Hoje')}{P('semana', 'Semana')}{P('mes', 'Mês')}</div>
          <input type="date" value={from} max={to} onChange={(e) => { setPeriod('custom'); setRange([e.target.value, to]); }} aria-label="De" />
          <input type="date" value={to} min={from} onChange={(e) => { setPeriod('custom'); setRange([from, e.target.value]); }} aria-label="Até" />
        </div>
      </div>

      <div className="kpis">
        <div className="kpi"><small>Faturamento</small><b>{brl0(S.revenue)}</b></div>
        <div className="kpi"><small>Despesas</small><b>{brl0(S.expenseTotal)}</b></div>
        <div className="kpi"><small>Comissões</small><b>{brl0(S.commissionTotal)}</b></div>
        <div className="kpi"><small>Resultado</small><b className={S.result < 0 ? 'neg' : ''}>{brl0(S.result)}</b></div>
      </div>
      <p className="fine">{S.count} atendimento{S.count === 1 ? '' : 's'} concluído{S.count === 1 ? '' : 's'}{S.coveredCount ? ` (${S.coveredCount} cobertos por plano de mensalista)` : ''}, ticket médio avulso de {S.avulsoCount ? brl(S.avgTicket) : '—'}. Faturamento = avulsos {brl(S.avulsoRevenue)} + mensalidades {brl(S.subRevenue)}. Resultado = faturamento menos despesas e comissões.</p>

      <div className="grid2">
        <section className="panel">
          <h3>Faturamento por dia</h3>
          {days.length <= 45 ? (
            <div className="bars">{days.map(([d, v]) => (
              <div key={d} className={`bar ${d === todayKey() ? 'now' : ''}`} title={`${dayLabel(d)}: ${brl(v)}`}><i style={{ height: `${Math.round(v / maxDay * 100)}%` }} />{days.length <= 31 && <small>{fromKey(d).getDate()}</small>}</div>
            ))}</div>
          ) : <p className="fine">Período longo demais para o gráfico. Escolha até 45 dias.</p>}
        </section>
        <section className="panel">
          <h3>Formas de pagamento</h3>
          {Object.keys(S.byMethod).length ? Object.entries(S.byMethod).sort((a, b) => b[1] - a[1]).map(([m, v]) => (
            <div className="hbar" key={m}><div className="l"><span>{m}</span><span>{brl(v)}</span></div><div className="t"><i style={{ width: `${v / maxM * 100}%` }} /></div></div>
          )) : <p className="fine">Sem atendimentos concluídos no período.</p>}
          {noMethod && <p className="fine">"Não informado" são atendimentos concluídos antes de a forma de pagamento existir.</p>}
        </section>
      </div>

      <section className="panel">
        <h3>Comissões dos barbeiros</h3>
        <div className="tblwrap" style={{ border: 0 }}>
          <table>
            <thead><tr><th>Barbeiro</th><th className="num">Atend.</th><th className="num">Base</th><th className="num">%</th><th className="num">Comissão</th><th className="num">Já paga</th><th className="num">A pagar</th><th /></tr></thead>
            <tbody>
              {S.commissions.length === 0 && <tr><td colSpan={8}><div className="empty" style={{ border: 0 }}>Nenhum atendimento concluído no período.</div></td></tr>}
              {S.commissions.map((c) => (
                <tr key={c.barberId}>
                  <td><b>{c.name}</b></td><td className="num">{c.count}</td><td className="num">{brl(c.base)}</td><td className="num">{c.percent}%</td>
                  <td className="num">{brl(c.commission)}</td><td className="num">{brl(c.paid)}</td><td className="num"><b>{brl(c.due)}</b></td>
                  <td><button className="btn sm" disabled={c.due <= 0} onClick={() => setConfirm({ type: 'commission', commission: c })}>Fechar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="fine" style={{ marginTop: 10 }}>Fechar marca esses atendimentos como pagos e guarda o fechamento no histórico. A comissão só conta atendimentos concluídos e usa o valor de tabela, inclusive nos atendimentos de mensalistas.</p>
      </section>

      <section className="panel">
        <div className="head-row" style={{ marginBottom: 10 }}>
          <h3 style={{ margin: 0 }}>Despesas do período</h3>
          <button className="btn sm" onClick={() => setForm({ description: '', amount: '', date: todayKey() > to ? to : todayKey() < from ? from : todayKey(), category: 'Aluguel', kind: 'Fixa' })}>Lançar despesa</button>
        </div>
        <div className="tblwrap" style={{ border: 0 }}>
          <table>
            <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Tipo</th><th className="num">Valor</th><th /></tr></thead>
            <tbody>
              {expenses.length === 0 && <tr><td colSpan={6}><div className="empty" style={{ border: 0 }}>Nenhuma despesa lançada no período.</div></td></tr>}
              {expenses.map((e) => (
                <tr key={e.id}><td>{fmtDate(e.date)}</td><td>{e.description}</td><td>{e.category}</td><td>{e.kind}</td><td className="num">{brl(e.amount)}</td>
                  <td><button className="btn sm ghost" onClick={() => setConfirm({ type: 'expense', expense: e })}>Excluir</button></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <h3>Últimos fechamentos de comissão</h3>
        {closures.length ? closures.map((c) => (
          <div className="logrow" key={c.id} style={{ display: 'flex', gap: 14, padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
            <span className="fine" style={{ minWidth: 90 }}>{c.paidAt?.toDate ? c.paidAt.toDate().toLocaleDateString('pt-BR') : ''}</span>
            <span><b>{c.barberName}</b>, {fmtDate(c.from)} a {fmtDate(c.to)}, {c.count} atendimentos</span>
            <b style={{ marginLeft: 'auto' }}>{brl(c.amount)}</b>
          </div>
        )) : <p className="fine">Nenhum fechamento ainda.</p>}
      </section>

      {form && (
        <Modal title="Lançar despesa" onClose={() => setForm(null)} actions={[{ label: 'Voltar', kind: 'ghost', onClick: () => setForm(null) }, { label: 'Lançar', onClick: saveExpense }]}>
          <label className="field">Descrição<input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Ex.: Aluguel de setembro" /></label>
          <div className="formgrid">
            <label className="field">Valor (R$)<input inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></label>
            <label className="field">Data<input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
            <label className="field">Categoria<select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{EXPENSE_CATS.map((c) => <option key={c}>{c}</option>)}</select></label>
            <label className="field">Tipo<select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}><option>Fixa</option><option>Variável</option></select></label>
          </div>
        </Modal>
      )}

      {confirm?.type === 'expense' && (
        <Modal title="Excluir despesa?" onClose={() => setConfirm(null)} actions={[{ label: 'Voltar', kind: 'ghost', onClick: () => setConfirm(null) }, { label: 'Excluir', kind: 'danger', onClick: deleteExpense }]}>
          <p>{confirm.expense.description}, {brl(confirm.expense.amount)}. A exclusão fica no registro.</p>
        </Modal>
      )}
      {confirm?.type === 'commission' && (
        <Modal title="Fechar comissão?" onClose={() => setConfirm(null)} actions={[{ label: 'Voltar', kind: 'ghost', onClick: () => setConfirm(null) }, { label: 'Fechar comissão', onClick: closeCommission }]}>
          <p>{confirm.commission.name} recebe <b>{brl(confirm.commission.due)}</b> por {confirm.commission.dueIds.length} atendimento{confirm.commission.dueIds.length > 1 ? 's' : ''}, de {fmtDate(from)} a {fmtDate(to)}. Depois de fechado, esses atendimentos não entram mais no "a pagar".</p>
        </Modal>
      )}
    </>
  );
}
