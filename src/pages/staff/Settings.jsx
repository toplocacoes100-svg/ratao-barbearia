import { useEffect, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../../firebase.js';
import { useCatalog } from '../../context/CatalogContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { usePhotosState } from '../../hooks/usePhotos.js';
import { fileToDataUrl } from '../../lib/image.js';
import { hm } from '../../lib/time.js';
import { Modal } from '../../components/ui.jsx';
import ClientsTab from './ClientsTab.jsx';
import ShareTab from './ShareTab.jsx';

const WEEK = [[1, 'Segunda'], [2, 'Terça'], [3, 'Quarta'], [4, 'Quinta'], [5, 'Sexta'], [6, 'Sábado'], [0, 'Domingo']];
const MAX_PHOTOS = 8;

// Traduz o erro do envio de foto para uma explicação que dá para agir em cima
function photoError(ex) {
  if (ex?.code === 'permission-denied') return 'Sem permissão para gravar. Publique as regras novas do Firestore (arquivo firestore.rules) e tente de novo.';
  if (ex?.message === 'IMAGE_UNREADABLE') return 'Não consegui abrir essa imagem. Use uma foto JPG ou PNG.';
  if (ex?.message === 'IMAGE_TOO_BIG') return 'Essa foto é pesada demais. Tente outra.';
  return `Não foi possível enviar a foto (${ex?.code || ex?.message || 'erro desconhecido'}).`;
}
const toMin = (v) => { const [h, m] = v.split(':').map(Number); return h * 60 + m; };

// Aba "Geral": fotos, horário de funcionamento e regras
function General() {
  const { settings } = useCatalog();
  const toast = useToast();

  /* ---------- horário de funcionamento e regras ---------- */
  const [hours, setHours] = useState({});
  const [rules, setRules] = useState({});
  const sKey = JSON.stringify(settings);
  useEffect(() => {
    setHours(Object.fromEntries(WEEK.map(([d]) => [d, settings.hours?.[d] ? { ...settings.hours[d] } : null])));
    setRules({ name: settings.name, buffer: settings.buffer, minAdvance: settings.minAdvance, cancelH: settings.cancelMin / 60, step: settings.step });
  }, [sKey]);

  const setDay = (d, patch) => setHours((h) => ({ ...h, [d]: patch }));

  async function save() {
    for (const [d, label] of WEEK) {
      const h = hours[d];
      if (h && h.close <= h.open) { toast(`${label}: o fechamento precisa ser depois da abertura`); return; }
    }
    try {
      await setDoc(doc(db, 'settings', 'shop'), {
        name: rules.name.trim() || 'Barbearia do Ratão',
        buffer: Number(rules.buffer) || 0,
        minAdvance: Number(rules.minAdvance) || 0,
        cancelMin: Math.round((Number(rules.cancelH) || 0) * 60),
        step: Number(rules.step) || 30,
        hours: Object.fromEntries(WEEK.map(([d]) => [d, hours[d] || null])),
      }, { merge: true });
      toast('Configurações salvas');
    } catch (e) { console.error(e); toast('Não foi possível salvar'); }
  }

  /* ---------- fotos da tela inicial ---------- */
  const [refresh, setRefresh] = useState(0);
  const { photos, error: photosError } = usePhotosState(refresh);
  const [busy, setBusy] = useState(false);
  const [del, setDel] = useState(null);

  async function upload(e) {
    const files = [...e.target.files];
    e.target.value = '';
    if (!files.length) return;
    if (photos.length + files.length > MAX_PHOTOS) { toast(`Cabem até ${MAX_PHOTOS} fotos. Remova alguma antes.`); return; }
    setBusy(true);
    try {
      for (const f of files) {
        if (!f.type.startsWith('image/')) { toast('Envie só arquivos de imagem'); continue; }
        const dataUrl = await fileToDataUrl(f, { maxSide: 1100 });
        await addDoc(collection(db, 'photos'), { dataUrl, order: Date.now(), createdAt: serverTimestamp() });
      }
      toast('Foto publicada na tela inicial');
      setRefresh((n) => n + 1);
    } catch (ex) {
      console.error(ex);
      toast(photoError(ex));
    } finally { setBusy(false); }
  }
  async function remove() {
    try { await deleteDoc(doc(db, 'photos', del.id)); toast('Foto removida'); setRefresh((n) => n + 1); }
    catch (e) { console.error(e); toast('Não foi possível remover'); }
    setDel(null);
  }

  return (
    <>
      <div className="head-row"><div><h1>Configurações</h1><p className="fine">Fotos, horários de funcionamento e regras de agendamento.</p></div></div>

      <section className="panel">
        <h3>Fotos da tela inicial</h3>
        <p className="fine" style={{ marginBottom: 12 }}>Aparecem no fundo da tela inicial do cliente e trocam sozinhas a cada 5 segundos. Funcionam melhor fotos na horizontal ou quadradas, com boa luz. Até {MAX_PHOTOS} fotos; elas são reduzidas automaticamente antes de enviar.</p>
        {photosError && (
          <div className="infobox" style={{ marginBottom: 12 }}>
            {photosError === 'permission-denied'
              ? <>As fotos não carregaram porque as <b>regras novas do Firestore ainda não foram publicadas</b>. Cole o conteúdo do arquivo <b>firestore.rules</b> em Firestore, aba Regras, e clique em Publicar.</>
              : <>Não foi possível carregar as fotos agora ({photosError}). Atualize a página e tente de novo.</>}
          </div>
        )}
        <div className="thumbs" style={{ marginBottom: 14 }}>
          {photos.map((p) => (
            <div className="thumb" key={p.id}>
              <img src={p.dataUrl} alt="Foto da tela inicial" />
              <button className="btn sm danger" onClick={() => setDel(p)} aria-label="Remover foto">Remover</button>
            </div>
          ))}
          {!photos.length && <div className="empty" style={{ gridColumn: '1 / -1' }}>Nenhuma foto ainda. A tela inicial fica só com o visual padrão.</div>}
        </div>
        <label className="btn" style={{ cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1 }}>
          {busy ? 'Enviando...' : 'Adicionar fotos'}
          <input type="file" accept="image/*" multiple hidden disabled={busy || photos.length >= MAX_PHOTOS} onChange={upload} />
        </label>
      </section>

      <section className="panel">
        <h3>Horário de funcionamento</h3>
        <p className="fine" style={{ marginBottom: 8 }}>Marque os dias em que a barbearia abre. Dia aberto aceita agendamento; dia desmarcado aparece como fechado para o cliente. A folga de cada barbeiro fica na aba Barbeiros.</p>
        {WEEK.map(([d, label]) => {
          const h = hours[d];
          return (
            <div className="hoursrow" key={d}>
              <label className="on"><input type="checkbox" checked={Boolean(h)} onChange={(e) => setDay(d, e.target.checked ? { open: d === 0 ? 540 : 540, close: d === 0 ? 840 : 1140 } : null)} />{label}</label>
              {h ? (
                <div className="t">
                  <input type="time" value={hm(h.open)} onChange={(e) => setDay(d, { ...h, open: toMin(e.target.value) })} aria-label={`${label}: abre`} />
                  <span>até</span>
                  <input type="time" value={hm(h.close)} onChange={(e) => setDay(d, { ...h, close: toMin(e.target.value) })} aria-label={`${label}: fecha`} />
                </div>
              ) : <span className="fine">Fechado</span>}
            </div>
          );
        })}
      </section>

      <section className="panel">
        <h3>Regras</h3>
        <div className="formgrid">
          <label className="field">Nome da barbearia<input value={rules.name || ''} onChange={(e) => setRules({ ...rules, name: e.target.value })} /></label>
          <label className="field">Intervalo entre atendimentos (min)<input type="number" min="0" step="5" value={rules.buffer ?? ''} onChange={(e) => setRules({ ...rules, buffer: e.target.value })} /></label>
          <label className="field">Antecedência mínima para agendar (min)<input type="number" min="0" step="15" value={rules.minAdvance ?? ''} onChange={(e) => setRules({ ...rules, minAdvance: e.target.value })} /></label>
          <label className="field">Cancelar sem ocorrência até (horas antes)<input type="number" min="0" step="0.5" value={rules.cancelH ?? ''} onChange={(e) => setRules({ ...rules, cancelH: e.target.value })} /></label>
          <label className="field">Horários oferecidos de quanto em quanto tempo
            <select value={rules.step ?? 30} onChange={(e) => setRules({ ...rules, step: Number(e.target.value) })}>
              <option value={15}>15 minutos</option><option value={30}>30 minutos</option><option value={60}>1 hora</option>
            </select>
          </label>
        </div>
      </section>

      <div><button className="btn" onClick={save}>Salvar horários e regras</button></div>

      {del && (
        <Modal title="Remover foto?" onClose={() => setDel(null)} actions={[{ label: 'Voltar', kind: 'ghost', onClick: () => setDel(null) }, { label: 'Remover', kind: 'danger', onClick: remove }]}>
          <p>A foto sai da tela inicial dos clientes.</p>
        </Modal>
      )}
    </>
  );
}

// Configurações com abas: Geral, Clientes do app e Link/QR Code
export default function Settings() {
  const [tab, setTab] = useState('geral');
  const T = (id, label) => <button className="pillbtn" role="tab" aria-selected={tab === id} aria-pressed={tab === id} onClick={() => setTab(id)}>{label}</button>;
  return (
    <>
      <div className="pills" role="tablist" aria-label="Seções das configurações">
        {T('geral', 'Geral')}{T('clientes', 'Clientes do app')}{T('divulgacao', 'Link e QR Code')}
      </div>
      {tab === 'geral' && <General />}
      {tab === 'clientes' && <ClientsTab />}
      {tab === 'divulgacao' && <ShareTab />}
    </>
  );
}
