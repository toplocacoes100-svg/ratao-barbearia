import { useState } from 'react';
import { arrayRemove, arrayUnion, collection, doc, getDocs, query, serverTimestamp, updateDoc, where, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useCatalog } from '../../context/CatalogContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { fileToDataUrl } from '../../lib/image.js';
import { hm, todayKey } from '../../lib/time.js';
import { Avatar, Modal } from '../../components/ui.jsx';

const WD = [[1, 'Seg'], [2, 'Ter'], [3, 'Qua'], [4, 'Qui'], [5, 'Sex'], [6, 'Sáb'], [0, 'Dom']];
const toMin = (v) => { const [h, m] = v.split(':').map(Number); return h * 60 + m; };

export default function Barbers() {
  const { user, profile } = useAuth();
  const { allBarbers, allServices } = useCatalog();
  const toast = useToast();
  const [form, setForm] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const offLabel = (b) => (b.off?.length ? WD.filter(([d]) => b.off.includes(d)).map(([, l]) => l).join(', ') : 'nenhuma');

  const blank = () => ({
    name: '', short: '', phone: '', spec: '', color: '#D4A94F', photo: null, hasLunch: true, lunchStart: 720, lunchEnd: 780,
    off: [], commissionService: 50, commissionProduct: 15, active: true, serviceIds: allServices.map((s) => s.id),
  });
  const edit = (b) => setForm({
    id: b.id, name: b.name, short: b.short || '', phone: b.phone || '', spec: b.spec || '', color: b.color || '#D4A94F', photo: b.photo || null,
    hasLunch: Boolean(b.lunch), lunchStart: b.lunch?.start ?? 720, lunchEnd: b.lunch?.end ?? 780, off: b.off || [],
    commissionService: b.commissionService ?? 50, commissionProduct: b.commissionProduct ?? 15, active: b.active !== false,
    serviceIds: allServices.filter((s) => s.barberIds?.includes(b.id)).map((s) => s.id),
  });

  async function save() {
    const f = form;
    if (!f.name.trim()) { toast('Informe o nome do barbeiro'); return; }
    if (f.hasLunch && f.lunchEnd <= f.lunchStart) { toast('O almoço precisa terminar depois de começar'); return; }
    try {
      const ref = f.id ? doc(db, 'barbers', f.id) : doc(collection(db, 'barbers'));
      const b = writeBatch(db);
      b.set(ref, {
        name: f.name.trim(), short: (f.short || f.name).trim().split(' ')[0], phone: f.phone.trim(), spec: f.spec.trim(), color: f.color, photo: f.photo || null,
        lunch: f.hasLunch ? { start: f.lunchStart, end: f.lunchEnd } : null, off: f.off,
        commissionService: Number(f.commissionService) || 0, commissionProduct: Number(f.commissionProduct) || 0, active: f.active,
      }, { merge: true });
      allServices.forEach((s) => {
        const has = s.barberIds?.includes(ref.id), want = f.serviceIds.includes(s.id);
        if (want && !has) b.update(doc(db, 'services', s.id), { barberIds: arrayUnion(ref.id) });
        if (!want && has) b.update(doc(db, 'services', s.id), { barberIds: arrayRemove(ref.id) });
      });
      await b.commit();
      toast(f.id ? 'Barbeiro atualizado' : 'Barbeiro cadastrado');
      setForm(null);
    } catch (e) { console.error(e); toast('Não foi possível salvar'); }
  }

  async function toggleActive(b) {
    try { await updateDoc(doc(db, 'barbers', b.id), { active: b.active === false }); toast(b.active === false ? 'Barbeiro ativado' : 'Barbeiro desativado'); }
    catch (e) { console.error(e); toast('Não foi possível alterar'); }
  }

  async function askDelete(b) {
    try {
      const snap = await getDocs(query(collection(db, 'appointments'), where('barberId', '==', b.id)));
      const future = snap.docs.filter((d) => d.data().date >= todayKey() && ['agendado', 'confirmado', 'atendimento'].includes(d.data().status)).length;
      setConfirm({ b, future });
    } catch (e) { console.error(e); toast('Não foi possível verificar os agendamentos'); }
  }
  async function doDelete() {
    const { b } = confirm;
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'barbers', b.id));
      allServices.forEach((s) => s.barberIds?.includes(b.id) && batch.update(doc(db, 'services', s.id), { barberIds: arrayRemove(b.id) }));
      batch.set(doc(collection(db, 'logs')), { text: `Barbeiro excluído: ${b.name}.`, by: user.uid, byName: profile.name, at: serverTimestamp() });
      await batch.commit();
      toast('Barbeiro excluído');
    } catch (e) { console.error(e); toast('Não foi possível excluir'); }
    setConfirm(null);
  }

  async function pickPhoto(e) {
    const file = e.target.files[0]; e.target.value = '';
    if (!file) return;
    try { setForm((f) => ({ ...f })); const url = await fileToDataUrl(file, { maxSide: 256, maxChars: 40000, square: true }); setForm((f) => ({ ...f, photo: url })); }
    catch { toast('Não foi possível usar essa foto'); }
  }
  const setF = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const toggleIn = (k, v) => setForm((f) => ({ ...f, [k]: f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v] }));

  return (
    <>
      <div className="head-row">
        <div><h1>Barbeiros</h1><p className="fine">Quem aparece na agenda e para o cliente escolher.</p></div>
        <button className="btn" onClick={() => setForm(blank())}>Novo barbeiro</button>
      </div>

      <div className="tblwrap">
        <table>
          <thead><tr><th>Barbeiro</th><th>Folgas</th><th className="num">Comissão</th><th>Situação</th><th /></tr></thead>
          <tbody>
            {allBarbers.length === 0 && <tr><td colSpan={5}><div className="empty" style={{ border: 0 }}>Nenhum barbeiro ainda. Clique em "Novo barbeiro" ou carregue os dados de exemplo na aba Acessos.</div></td></tr>}
            {allBarbers.map((b) => (
              <tr key={b.id}>
                <td><div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><Avatar barber={b} size={40} /><div><b>{b.name}</b><small>{b.spec}</small></div></div></td>
                <td>{offLabel(b)}</td>
                <td className="num">{b.commissionService ?? 0}%</td>
                <td><span className="pill" style={{ '--c': b.active === false ? 'var(--st-cancelado)' : 'var(--st-concluido)' }}>{b.active === false ? 'Inativo' : 'Ativo'}</span></td>
                <td><div className="actions-cell">
                  <button className="btn sm ghost" onClick={() => edit(b)}>Editar</button>
                  <button className="btn sm ghost" onClick={() => toggleActive(b)}>{b.active === false ? 'Ativar' : 'Desativar'}</button>
                  <button className="btn sm ghost" onClick={() => askDelete(b)}>Excluir</button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="fine">Dica: <b>Desativar</b> tira o barbeiro da agenda e da escolha do cliente, mas mantém o histórico e o financeiro. <b>Excluir</b> apaga o cadastro de vez.</p>

      {form && (
        <Modal title={form.id ? 'Editar barbeiro' : 'Novo barbeiro'} onClose={() => setForm(null)} actions={[{ label: 'Voltar', kind: 'ghost', onClick: () => setForm(null) }, { label: 'Salvar', onClick: save }]}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Avatar barber={{ ...form, short: form.short || form.name || '?' }} size={64} />
            <label className="btn sm ghost" style={{ cursor: 'pointer' }}>Escolher foto<input type="file" accept="image/*" hidden onChange={pickPhoto} /></label>
            {form.photo && <button className="linkbtn" onClick={() => setForm({ ...form, photo: null })}>Tirar foto</button>}
          </div>
          <label className="field">Nome completo<input value={form.name} onChange={setF('name')} /></label>
          <label className="field">Como o cliente vê (apelido)<input value={form.short} onChange={setF('short')} placeholder="Ex.: Caio" /></label>
          <label className="field">WhatsApp do barbeiro (para o cliente avisá-lo)<input type="tel" value={form.phone} onChange={setF('phone')} placeholder="(11) 90000-0000" /></label>
          <label className="field">Especialidade<input value={form.spec} onChange={setF('spec')} placeholder="Ex.: Degradê e navalha" /></label>
          <label className="field">Cor na agenda<input type="color" value={form.color} onChange={setF('color')} /></label>
          <div className="field">Folgas (dias da semana)
            <div className="daychecks">{WD.map(([d, l]) => <label key={d}><input type="checkbox" checked={form.off.includes(d)} onChange={() => toggleIn('off', d)} />{l}</label>)}</div>
          </div>
          <div className="field">
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--ink)' }}><input type="checkbox" checked={form.hasLunch} onChange={(e) => setForm({ ...form, hasLunch: e.target.checked })} />Tem horário de almoço</label>
            {form.hasLunch && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="time" value={hm(form.lunchStart)} onChange={(e) => setForm({ ...form, lunchStart: toMin(e.target.value) })} /> até
                <input type="time" value={hm(form.lunchEnd)} onChange={(e) => setForm({ ...form, lunchEnd: toMin(e.target.value) })} />
              </div>
            )}
          </div>
          <div className="formgrid">
            <label className="field">Comissão em serviços (%)<input type="number" min="0" max="100" value={form.commissionService} onChange={setF('commissionService')} /></label>
            <label className="field">Comissão em produtos (%)<input type="number" min="0" max="100" value={form.commissionProduct} onChange={setF('commissionProduct')} /></label>
          </div>
          <div className="field">Serviços que faz
            <div className="checks">{allServices.map((s) => <label key={s.id}><input type="checkbox" checked={form.serviceIds.includes(s.id)} onChange={() => toggleIn('serviceIds', s.id)} />{s.name}</label>)}</div>
          </div>
        </Modal>
      )}

      {confirm && (confirm.future > 0 ? (
        <Modal title="Não dá para excluir agora" onClose={() => setConfirm(null)} actions={[{ label: 'Entendi', onClick: () => setConfirm(null) }]}>
          <p>{confirm.b.name} tem <b>{confirm.future}</b> agendamento{confirm.future > 1 ? 's' : ''} pela frente. Cancele ou remarque antes, ou use <b>Desativar</b>, que tira da agenda sem apagar nada.</p>
        </Modal>
      ) : (
        <Modal title="Excluir barbeiro?" onClose={() => setConfirm(null)} actions={[{ label: 'Voltar', kind: 'ghost', onClick: () => setConfirm(null) }, { label: 'Excluir', kind: 'danger', onClick: doDelete }]}>
          <p>{confirm.b.name} será removido da agenda e da lista de serviços. O histórico de atendimentos antigos continua guardado. A exclusão fica no registro.</p>
        </Modal>
      ))}
    </>
  );
}
