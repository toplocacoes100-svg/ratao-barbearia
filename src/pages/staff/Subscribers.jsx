import { useEffect, useMemo, useState } from 'react';
import { collection, deleteField, doc, onSnapshot, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useCatalog } from '../../context/CatalogContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useSubscriptions } from '../../hooks/useSubscriptions.js';
import { PAY_METHODS } from '../../lib/finance.js';
import { mKey } from '../../lib/subscriptions.js';
import { brl, brl0, fromKey, todayKey, whatsappUrl } from '../../lib/time.js';
import { Modal } from '../../components/ui.jsx';

const monthOf = (ym) => new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
const STATUS = {
  pago: { label: 'Pago', c: 'var(--st-concluido)' },
  pendente: { label: 'Pendente', c: 'var(--st-atendimento)' },
  vencido: { label: 'Vencido', c: 'var(--st-faltou)' },
  pausado: { label: 'Pausado', c: 'var(--st-cancelado)' },
};

export default function Subscribers() {
  const { user, profile } = useAuth();
  const { allServices } = useCatalog();
  const toast = useToast();
  const subs = useSubscriptions();
  const [plans, setPlans] = useState([]);
  const [clients, setClients] = useState([]);
  const [subForm, setSubForm] = useState(null);
  const [planForm, setPlanForm] = useState(null);
  const [payForm, setPayForm] = useState(null);
  const [confirm, setConfirm] = useState(null);

  useEffect(() => onSnapshot(collection(db, 'plans'), (s) => setPlans(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.name || '').localeCompare(b.name || ''))), (e) => console.error(e)), []);
  useEffect(() => onSnapshot(collection(db, 'users'), (s) => setClients(s.docs.map((d) => ({ id: d.id, ...d.data() })).filter((u) => u.role === 'client').sort((a, b) => (a.name || '').localeCompare(b.name || ''))), (e) => console.error(e)), []);

  const today = todayKey();
  const k = mKey(today);
  const dayNow = fromKey(today).getDate();
  const by = { by: user.uid, byName: profile.name };
  const log = (b, text) => b.set(doc(collection(db, 'logs')), { text, ...by, at: serverTimestamp() });

  const rows = useMemo(() => subs.map((s) => {
    const paid = s.paid?.[k];
    const status = s.active === false ? 'pausado' : paid ? 'pago' : dayNow > Number(s.dueDay || 1) ? 'vencido' : 'pendente';
    return { s, paid, used: Number(s.usage?.[k] || 0), status };
  }).sort((a, b) => (a.s.name || '').localeCompare(b.s.name || '')), [subs, k, dayNow]);

  const active = rows.filter((r) => r.s.active !== false);
  const received = active.reduce((t, r) => t + Number(r.paid?.amount || 0), 0);
  const toReceive = active.filter((r) => !r.paid).reduce((t, r) => t + Number(r.s.price || 0), 0);
  const overdue = active.filter((r) => r.status === 'vencido').length;

  /* ---------- planos ---------- */
  const setP = (key2) => (e) => setPlanForm({ ...planForm, [key2]: e.target.value });
  const toggleIn = (setter, form, field, v) => setter({ ...form, [field]: form[field].includes(v) ? form[field].filter((x) => x !== v) : [...form[field], v] });

  async function savePlan() {
    const f = planForm;
    const price = parseFloat(String(f.price).replace(',', '.'));
    if (!f.name.trim()) { toast('Dê um nome ao plano'); return; }
    if (!(price >= 0)) { toast('Informe o valor mensal'); return; }
    try {
      const ref = f.id ? doc(db, 'plans', f.id) : doc(collection(db, 'plans'));
      await writeBatch(db).set(ref, { name: f.name.trim(), price, visits: Math.max(0, Number(f.visits) || 0), serviceIds: f.serviceIds, active: true }, { merge: true }).commit();
      toast(f.id ? 'Plano atualizado' : 'Plano criado'); setPlanForm(null);
    } catch (e) { console.error(e); toast('Não foi possível salvar o plano'); }
  }
  function askDeletePlan(p) {
    const n = subs.filter((s) => s.planId === p.id).length;
    setConfirm({ type: 'plan', plan: p, n });
  }
  async function deletePlan() {
    const p = confirm.plan;
    try {
      const b = writeBatch(db);
      b.delete(doc(db, 'plans', p.id));
      log(b, `Plano excluído: ${p.name} (${brl(p.price)}).`);
      await b.commit(); toast('Plano excluído');
    } catch (e) { console.error(e); toast('Não foi possível excluir'); }
    setConfirm(null);
  }

  /* ---------- mensalistas ---------- */
  const fromPlan = (p) => ({ planId: p.id, price: p.price, visits: p.visits, serviceIds: p.serviceIds || [] });
  const newSub = () => setSubForm({ clientId: '', name: '', phone: '', dueDay: 5, ...(plans[0] ? fromPlan(plans[0]) : { planId: '', price: '', visits: 4, serviceIds: [] }) });
  const editSub = (s) => setSubForm({ id: s.id, clientId: s.clientId || '', name: s.name || '', phone: s.phone || '', planId: s.planId || '', price: s.price, visits: s.visits ?? 0, serviceIds: s.serviceIds || [], dueDay: s.dueDay || 5 });
  const setS = (key2) => (e) => setSubForm({ ...subForm, [key2]: e.target.value });

  function pickAccount(id) {
    const c = clients.find((x) => x.id === id);
    setSubForm((f) => ({ ...f, clientId: id, ...(c ? { name: c.name || f.name, phone: c.phone || f.phone } : {}) }));
  }
  function pickPlan(id) {
    const p = plans.find((x) => x.id === id);
    setSubForm((f) => ({ ...f, ...(p ? fromPlan(p) : { planId: '' }) }));
  }

  async function saveSub() {
    const f = subForm;
    const price = parseFloat(String(f.price).replace(',', '.'));
    if (!f.name.trim()) { toast('Informe o nome do mensalista'); return; }
    if (!f.phone.trim()) { toast('Informe o WhatsApp (é por ele que o sistema reconhece o mensalista)'); return; }
    if (!(price >= 0)) { toast('Informe o valor mensal'); return; }
    const plan = plans.find((p) => p.id === f.planId);
    const data = {
      name: f.name.trim(), phone: f.phone.trim(), clientId: f.clientId || null,
      planId: f.planId || null, planName: plan?.name || 'Plano', price, visits: Math.max(0, Number(f.visits) || 0),
      serviceIds: f.serviceIds, dueDay: Math.min(28, Math.max(1, Number(f.dueDay) || 1)),
    };
    try {
      const ref = f.id ? doc(db, 'subscriptions', f.id) : doc(collection(db, 'subscriptions'));
      const b = writeBatch(db);
      b.set(ref, f.id ? data : { ...data, active: true, startDate: todayKey(), createdAt: serverTimestamp(), usage: {}, paid: {} }, { merge: true });
      await b.commit();
      toast(f.id ? 'Mensalista atualizado' : 'Mensalista cadastrado'); setSubForm(null);
    } catch (e) { console.error(e); toast('Não foi possível salvar'); }
  }
  async function toggleActive(s) {
    try {
      const b = writeBatch(db);
      b.update(doc(db, 'subscriptions', s.id), { active: s.active === false });
      await b.commit(); toast(s.active === false ? 'Mensalista reativado' : 'Mensalista pausado');
    } catch (e) { console.error(e); toast('Não foi possível alterar'); }
  }
  async function deleteSub() {
    const s = confirm.sub;
    try {
      const b = writeBatch(db);
      b.delete(doc(db, 'subscriptions', s.id));
      log(b, `Mensalista excluído: ${s.name} (${s.planName}, ${brl(s.price)}).`);
      await b.commit(); toast('Mensalista excluído');
    } catch (e) { console.error(e); toast('Não foi possível excluir'); }
    setConfirm(null);
  }

  /* ---------- pagamento da mensalidade ---------- */
  const openPay = (s) => setPayForm({ sub: s, month: today.slice(0, 7), amount: s.price, method: 'Pix', date: today });
  const payKey = (f) => `m${f.month.slice(0, 4)}${f.month.slice(5, 7)}`;
  async function savePay() {
    const f = payForm;
    const amount = parseFloat(String(f.amount).replace(',', '.'));
    if (!(amount > 0)) { toast('Informe o valor recebido'); return; }
    if (!f.month || !f.date) { toast('Informe o mês e a data'); return; }
    try {
      const b = writeBatch(db);
      b.update(doc(db, 'subscriptions', f.sub.id), { [`paid.${payKey(f)}`]: { amount, method: f.method, date: f.date, by: user.uid } });
      log(b, `Mensalidade recebida: ${f.sub.name}, ${brl(amount)} (${f.method}), referente a ${monthOf(f.month)}.`);
      await b.commit(); toast('Pagamento registrado'); setPayForm(null);
    } catch (e) { console.error(e); toast('Não foi possível registrar'); }
  }
  async function undoPay() {
    const f = payForm;
    try {
      const b = writeBatch(db);
      b.update(doc(db, 'subscriptions', f.sub.id), { [`paid.${payKey(f)}`]: deleteField() });
      log(b, `Pagamento desfeito: ${f.sub.name}, mensalidade de ${monthOf(f.month)}.`);
      await b.commit(); toast('Pagamento desfeito'); setPayForm(null);
    } catch (e) { console.error(e); toast('Não foi possível desfazer'); }
  }
  const chargeMsg = (s) => `Oi, ${(s.name || '').split(' ')[0]}! Tudo bem? Passando para lembrar da mensalidade do plano ${s.planName} (${brl(s.price)}), com vencimento no dia ${s.dueDay}. Qualquer dúvida é só chamar. Barbearia do Ratão`;

  const payMonthPaid = payForm ? payForm.sub.paid?.[payKey(payForm)] : null;

  return (
    <>
      <div className="head-row">
        <div><h1>Mensalistas</h1><p className="fine">Clientes que pagam um valor fixo por mês para ter atendimentos incluídos. Mês de referência: {monthOf(today.slice(0, 7))}.</p></div>
        <button className="btn" onClick={newSub} disabled={!plans.length}>Novo mensalista</button>
      </div>

      <div className="kpis">
        <div className="kpi"><small>Recebido no mês</small><b>{brl0(received)}</b></div>
        <div className="kpi"><small>A receber</small><b>{brl0(toReceive)}</b></div>
        <div className="kpi"><small>Mensalistas ativos</small><b>{active.length}</b></div>
        <div className="kpi"><small>Vencidos</small><b className={overdue ? 'neg' : ''}>{overdue}</b></div>
      </div>

      {!plans.length && <div className="infobox">Para começar, crie um <b>plano</b> aqui embaixo (nome, valor mensal, quantos atendimentos inclui e quais serviços). Depois é só cadastrar o mensalista.</div>}

      <div className="tblwrap">
        <table>
          <thead><tr><th>Mensalista</th><th>Plano</th><th className="num">Valor</th><th>Uso no mês</th><th>Vence</th><th>Situação</th><th /></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7}><div className="empty" style={{ border: 0 }}>Nenhum mensalista ainda.</div></td></tr>}
            {rows.map(({ s, used, status }) => (
              <tr key={s.id}>
                <td><b>{s.name}</b><small>{s.phone}</small></td>
                <td>{s.planName}</td>
                <td className="num">{brl0(s.price)}</td>
                <td>{used}{Number(s.visits) ? ` de ${s.visits}` : ' (ilimitado)'}</td>
                <td>dia {s.dueDay}</td>
                <td><span className="pill" style={{ '--c': STATUS[status].c }}>{STATUS[status].label}</span></td>
                <td><div className="actions-cell">
                  <button className="btn sm" onClick={() => openPay(s)}>Pagamento</button>
                  {(status === 'vencido' || status === 'pendente') && s.phone && (
                    <a className="btn sm ghost" target="_blank" rel="noopener noreferrer" href={whatsappUrl(s.phone, chargeMsg(s))}>Cobrar</a>
                  )}
                  <button className="btn sm ghost" onClick={() => editSub(s)}>Editar</button>
                  <button className="btn sm ghost" onClick={() => toggleActive(s)}>{s.active === false ? 'Reativar' : 'Pausar'}</button>
                  <button className="btn sm ghost" onClick={() => setConfirm({ type: 'sub', sub: s })}>Excluir</button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="fine">Quando o mensalista é atendido, o barbeiro escolhe "Cobrir com o plano" ao dar baixa e o uso do mês sobe sozinho. O uso zera a cada mês. A comissão do barbeiro é calculada sobre o valor de tabela dos serviços.</p>

      <section className="panel">
        <div className="head-row" style={{ marginBottom: 10 }}>
          <h3 style={{ margin: 0 }}>Planos</h3>
          <button className="btn sm" onClick={() => setPlanForm({ name: '', price: '', visits: 4, serviceIds: [] })}>Novo plano</button>
        </div>
        <div className="tblwrap" style={{ border: 0 }}>
          <table>
            <thead><tr><th>Plano</th><th className="num">Valor por mês</th><th>Atendimentos</th><th>Serviços incluídos</th><th /></tr></thead>
            <tbody>
              {plans.length === 0 && <tr><td colSpan={5}><div className="empty" style={{ border: 0 }}>Nenhum plano criado.</div></td></tr>}
              {plans.map((p) => (
                <tr key={p.id}>
                  <td><b>{p.name}</b></td><td className="num">{brl0(p.price)}</td>
                  <td>{Number(p.visits) ? `${p.visits} por mês` : 'ilimitado'}</td>
                  <td>{(p.serviceIds || []).map((id) => allServices.find((s) => s.id === id)?.name).filter(Boolean).join(', ') || 'todos os serviços'}</td>
                  <td><div className="actions-cell">
                    <button className="btn sm ghost" onClick={() => setPlanForm({ id: p.id, name: p.name, price: p.price, visits: p.visits ?? 0, serviceIds: p.serviceIds || [] })}>Editar</button>
                    <button className="btn sm ghost" onClick={() => askDeletePlan(p)}>Excluir</button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {planForm && (
        <Modal title={planForm.id ? 'Editar plano' : 'Novo plano'} onClose={() => setPlanForm(null)} actions={[{ label: 'Voltar', kind: 'ghost', onClick: () => setPlanForm(null) }, { label: 'Salvar', onClick: savePlan }]}>
          <label className="field">Nome do plano<input value={planForm.name} onChange={setP('name')} placeholder="Ex.: Corte 4x por mês" /></label>
          <div className="formgrid">
            <label className="field">Valor por mês (R$)<input inputMode="decimal" value={planForm.price} onChange={setP('price')} /></label>
            <label className="field">Atendimentos por mês<input type="number" min="0" value={planForm.visits} onChange={setP('visits')} /></label>
          </div>
          <p className="fine">Use 0 em "atendimentos por mês" para ilimitado.</p>
          <div className="field">Serviços incluídos (deixe todos desmarcados para valer para qualquer serviço)
            <div className="checks">{allServices.map((s) => <label key={s.id}><input type="checkbox" checked={planForm.serviceIds.includes(s.id)} onChange={() => toggleIn(setPlanForm, planForm, 'serviceIds', s.id)} />{s.name}</label>)}</div>
          </div>
        </Modal>
      )}

      {subForm && (
        <Modal title={subForm.id ? 'Editar mensalista' : 'Novo mensalista'} onClose={() => setSubForm(null)} actions={[{ label: 'Voltar', kind: 'ghost', onClick: () => setSubForm(null) }, { label: 'Salvar', onClick: saveSub }]}>
          <label className="field">Ligar a uma conta do app (opcional)
            <select value={subForm.clientId} onChange={(e) => pickAccount(e.target.value)}>
              <option value="">Sem conta (só nome e WhatsApp)</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.email})</option>)}
            </select>
          </label>
          <label className="field">Nome<input value={subForm.name} onChange={setS('name')} /></label>
          <label className="field">WhatsApp<input type="tel" value={subForm.phone} onChange={setS('phone')} placeholder="(11) 90000-0000" /></label>
          <label className="field">Plano
            <select value={subForm.planId} onChange={(e) => pickPlan(e.target.value)}>
              {!subForm.planId && <option value="">Escolha...</option>}
              {plans.map((p) => <option key={p.id} value={p.id}>{p.name} ({brl0(p.price)})</option>)}
            </select>
          </label>
          <div className="formgrid">
            <label className="field">Valor por mês (R$)<input inputMode="decimal" value={subForm.price} onChange={setS('price')} /></label>
            <label className="field">Atendimentos por mês<input type="number" min="0" value={subForm.visits} onChange={setS('visits')} /></label>
            <label className="field">Vence no dia<input type="number" min="1" max="28" value={subForm.dueDay} onChange={setS('dueDay')} /></label>
          </div>
          <p className="fine">Você pode ajustar o valor e os atendimentos só para este cliente. O sistema reconhece o mensalista pelo WhatsApp (ou pela conta do app) na hora do agendamento.</p>
        </Modal>
      )}

      {payForm && (
        <Modal title={`Mensalidade de ${payForm.sub.name}`} onClose={() => setPayForm(null)} actions={[{ label: 'Voltar', kind: 'ghost', onClick: () => setPayForm(null) }, { label: payMonthPaid ? 'Atualizar pagamento' : 'Registrar pagamento', onClick: savePay }]}>
          <div className="formgrid">
            <label className="field">Mês de referência<input type="month" value={payForm.month} onChange={(e) => setPayForm({ ...payForm, month: e.target.value })} /></label>
            <label className="field">Valor recebido (R$)<input inputMode="decimal" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} /></label>
            <label className="field">Forma de pagamento<select value={payForm.method} onChange={(e) => setPayForm({ ...payForm, method: e.target.value })}>{PAY_METHODS.map((m) => <option key={m}>{m}</option>)}</select></label>
            <label className="field">Data do recebimento<input type="date" value={payForm.date} onChange={(e) => setPayForm({ ...payForm, date: e.target.value })} /></label>
          </div>
          {payMonthPaid && (
            <div className="infobox">Esse mês já consta como pago ({brl(payMonthPaid.amount)}, {payMonthPaid.method}, em {fromKey(payMonthPaid.date).toLocaleDateString('pt-BR')}).{' '}
              <button className="linkbtn" onClick={undoPay}>Desfazer pagamento</button></div>
          )}
        </Modal>
      )}

      {confirm?.type === 'sub' && (
        <Modal title="Excluir mensalista?" onClose={() => setConfirm(null)} actions={[{ label: 'Voltar', kind: 'ghost', onClick: () => setConfirm(null) }, { label: 'Excluir', kind: 'danger', onClick: deleteSub }]}>
          <p>{confirm.sub.name} sai da lista de mensalistas. Os atendimentos já feitos continuam no histórico. Se só quer parar por um tempo, use <b>Pausar</b>. A exclusão fica no registro.</p>
        </Modal>
      )}
      {confirm?.type === 'plan' && (confirm.n > 0 ? (
        <Modal title="Não dá para excluir agora" onClose={() => setConfirm(null)} actions={[{ label: 'Entendi', onClick: () => setConfirm(null) }]}>
          <p>O plano "{confirm.plan.name}" tem <b>{confirm.n}</b> mensalista{confirm.n > 1 ? 's' : ''}. Mude o plano deles ou exclua os mensalistas primeiro.</p>
        </Modal>
      ) : (
        <Modal title="Excluir plano?" onClose={() => setConfirm(null)} actions={[{ label: 'Voltar', kind: 'ghost', onClick: () => setConfirm(null) }, { label: 'Excluir', kind: 'danger', onClick: deletePlan }]}>
          <p>O plano "{confirm.plan.name}" será apagado. A exclusão fica no registro.</p>
        </Modal>
      ))}
    </>
  );
}
