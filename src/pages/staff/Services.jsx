import { useState } from 'react';
import { collection, doc, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useCatalog } from '../../context/CatalogContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { CATS } from '../../lib/defaults.js';
import { brl0 } from '../../lib/time.js';
import { Modal } from '../../components/ui.jsx';

export default function Services() {
  const { user, profile } = useAuth();
  const { allServices, allBarbers } = useCatalog();
  const toast = useToast();
  const [form, setForm] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const blank = () => ({ name: '', cat: 'Cabelo', price: '', dur: 30, barberIds: allBarbers.map((b) => b.id), includes: [], active: true });
  const edit = (s) => setForm({ id: s.id, name: s.name, cat: s.cat || 'Outros', price: s.price, dur: s.dur, barberIds: s.barberIds || [], includes: s.includes || [], active: s.active !== false });
  const setF = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const toggleIn = (k, v) => setForm((f) => ({ ...f, [k]: f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v] }));

  async function save() {
    const f = form;
    const price = parseFloat(String(f.price).replace(',', '.')), dur = Number(f.dur);
    if (!f.name.trim()) { toast('Informe o nome do serviço'); return; }
    if (!(price >= 0)) { toast('Informe um preço válido'); return; }
    if (!(dur >= 5)) { toast('A duração precisa ser de pelo menos 5 minutos'); return; }
    const isCombo = f.cat === 'Combo' && f.includes.length > 0;
    const sum = f.includes.reduce((a, id) => a + Number(allServices.find((s) => s.id === id)?.price || 0), 0);
    try {
      const ref = f.id ? doc(db, 'services', f.id) : doc(collection(db, 'services'));
      await writeBatch(db).set(ref, {
        name: f.name.trim(), cat: f.cat, price, dur, barberIds: f.barberIds, active: f.active,
        includes: isCombo ? f.includes : [], saves: isCombo ? Math.max(0, sum - price) : 0,
      }, { merge: true }).commit();
      toast(f.id ? 'Serviço atualizado' : 'Serviço cadastrado');
      setForm(null);
    } catch (e) { console.error(e); toast('Não foi possível salvar'); }
  }
  async function toggleActive(s) {
    try { await updateDoc(doc(db, 'services', s.id), { active: s.active === false }); toast(s.active === false ? 'Serviço ativado' : 'Serviço desativado'); }
    catch (e) { console.error(e); toast('Não foi possível alterar'); }
  }
  async function doDelete() {
    const s = confirm;
    try {
      const b = writeBatch(db);
      b.delete(doc(db, 'services', s.id));
      b.set(doc(collection(db, 'logs')), { text: `Serviço excluído: ${s.name} (${brl0(s.price)}).`, by: user.uid, byName: profile.name, at: serverTimestamp() });
      await b.commit();
      toast('Serviço excluído');
    } catch (e) { console.error(e); toast('Não foi possível excluir'); }
    setConfirm(null);
  }

  return (
    <>
      <div className="head-row">
        <div><h1>Serviços</h1><p className="fine">Preços, durações e quem faz cada serviço. Mudou o preço aqui, vale para os próximos agendamentos.</p></div>
        <button className="btn" onClick={() => setForm(blank())}>Novo serviço</button>
      </div>

      <div className="tblwrap">
        <table>
          <thead><tr><th>Serviço</th><th>Categoria</th><th className="num">Preço</th><th className="num">Duração</th><th>Quem faz</th><th>Situação</th><th /></tr></thead>
          <tbody>
            {allServices.length === 0 && <tr><td colSpan={7}><div className="empty" style={{ border: 0 }}>Nenhum serviço ainda. Clique em "Novo serviço" ou carregue os dados de exemplo na aba Acessos.</div></td></tr>}
            {[...allServices].sort((a, b) => CATS.indexOf(a.cat) - CATS.indexOf(b.cat) || a.name.localeCompare(b.name)).map((s) => (
              <tr key={s.id}>
                <td><b>{s.name}</b>{s.saves ? <small>Combo, economiza {brl0(s.saves)}</small> : null}</td>
                <td>{s.cat}</td>
                <td className="num">{brl0(s.price)}</td>
                <td className="num">{s.dur} min</td>
                <td>{(s.barberIds || []).map((id) => allBarbers.find((b) => b.id === id)?.short).filter(Boolean).join(', ') || <span className="warn">Ninguém</span>}</td>
                <td><span className="pill" style={{ '--c': s.active === false ? 'var(--st-cancelado)' : 'var(--st-concluido)' }}>{s.active === false ? 'Inativo' : 'Ativo'}</span></td>
                <td><div className="actions-cell">
                  <button className="btn sm ghost" onClick={() => edit(s)}>Editar</button>
                  <button className="btn sm ghost" onClick={() => toggleActive(s)}>{s.active === false ? 'Ativar' : 'Desativar'}</button>
                  <button className="btn sm ghost" onClick={() => setConfirm(s)}>Excluir</button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {form && (
        <Modal title={form.id ? 'Editar serviço' : 'Novo serviço'} onClose={() => setForm(null)} actions={[{ label: 'Voltar', kind: 'ghost', onClick: () => setForm(null) }, { label: 'Salvar', onClick: save }]}>
          <label className="field">Nome<input value={form.name} onChange={setF('name')} /></label>
          <div className="formgrid">
            <label className="field">Categoria<select value={form.cat} onChange={setF('cat')}>{CATS.map((c) => <option key={c}>{c}</option>)}</select></label>
            <label className="field">Preço (R$)<input inputMode="decimal" value={form.price} onChange={setF('price')} placeholder="45" /></label>
            <label className="field">Duração (min)<input type="number" min="5" step="5" value={form.dur} onChange={setF('dur')} /></label>
          </div>
          <div className="field">Quem faz
            <div className="checks">{allBarbers.map((b) => <label key={b.id}><input type="checkbox" checked={form.barberIds.includes(b.id)} onChange={() => toggleIn('barberIds', b.id)} />{b.name}</label>)}</div>
          </div>
          {form.cat === 'Combo' && (
            <div className="field">Serviços que o combo inclui (o desconto é calculado sozinho)
              <div className="checks">{allServices.filter((s) => s.cat !== 'Combo' && s.id !== form.id).map((s) => <label key={s.id}><input type="checkbox" checked={form.includes.includes(s.id)} onChange={() => toggleIn('includes', s.id)} />{s.name} ({brl0(s.price)})</label>)}</div>
            </div>
          )}
        </Modal>
      )}

      {confirm && (
        <Modal title="Excluir serviço?" onClose={() => setConfirm(null)} actions={[{ label: 'Voltar', kind: 'ghost', onClick: () => setConfirm(null) }, { label: 'Excluir', kind: 'danger', onClick: doDelete }]}>
          <p>"{confirm.name}" deixa de existir na lista. Os atendimentos antigos continuam com o nome e o valor da época. Se só quer parar de oferecer, use <b>Desativar</b>. A exclusão fica no registro.</p>
        </Modal>
      )}
    </>
  );
}
