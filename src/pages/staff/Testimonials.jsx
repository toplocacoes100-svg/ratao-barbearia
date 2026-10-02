import { useEffect, useMemo, useState } from 'react';
import { collection, deleteDoc, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Modal } from '../../components/ui.jsx';

const stars = (n) => '★'.repeat(n || 5) + '☆'.repeat(5 - (n || 5));

const fmtDate = (ts) => {
  if (!ts?.toDate) return '';
  return ts.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export default function Testimonials() {
  const toast = useToast();
  const [items, setItems] = useState(null);
  const [confirm, setConfirm] = useState(null);

  useEffect(() => onSnapshot(
    collection(db, 'testimonials'),
    (s) => setItems(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (e) => { console.error(e); setItems([]); },
  ), []);

  const pending = useMemo(
    () => (items || []).filter((t) => t.status === 'pending').sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)),
    [items],
  );
  const approved = useMemo(
    () => (items || []).filter((t) => t.status === 'approved').sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)),
    [items],
  );

  async function approve(t) {
    await updateDoc(doc(db, 'testimonials', t.id), { status: 'approved' });
    toast('Depoimento aprovado — já está visível no site.');
  }

  async function remove() {
    const t = confirm.item;
    setConfirm(null);
    await deleteDoc(doc(db, 'testimonials', t.id));
    toast('Depoimento removido.');
  }

  if (items === null) return <div className="empty">Carregando depoimentos...</div>;

  return (
    <>
      <div className="head-row">
        <div><h1>Depoimentos</h1><p className="fine">Depoimentos que os clientes enviam pelo site institucional, para cada barbeiro. Só aparecem no site depois de aprovados aqui.</p></div>
      </div>

      <section className="panel">
        <div className="head-row" style={{ marginBottom: 10 }}>
          <h3 style={{ margin: 0 }}>Pendentes de aprovação</h3>
          <span className="pill" style={{ '--c': 'var(--st-atendimento)' }}>{pending.length}</span>
        </div>
        {pending.length === 0 && <div className="empty" style={{ border: 0 }}>Nenhum depoimento esperando revisão.</div>}
        {pending.map((t) => (
          <div key={t.id} className="card" style={{ marginBottom: 10 }}>
            <div className="head-row" style={{ marginBottom: 4 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                {t.photo && <img src={t.photo} alt="" style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', flex: 'none' }} />}
                <div>
                  <b>{t.name}</b> <small className="fine">para {t.barberName} · {fmtDate(t.createdAt)}</small>
                  <div style={{ color: 'var(--accent)' }}>{stars(t.rating)}</div>
                </div>
              </div>
              <div className="actions-cell">
                <button className="btn sm" onClick={() => approve(t)}>Aprovar</button>
                <button className="btn sm ghost" onClick={() => setConfirm({ item: t })}>Rejeitar</button>
              </div>
            </div>
            <p style={{ margin: 0 }}>{t.text}</p>
          </div>
        ))}
      </section>

      <section className="panel">
        <div className="head-row" style={{ marginBottom: 10 }}>
          <h3 style={{ margin: 0 }}>Aprovados</h3>
          <span className="pill" style={{ '--c': 'var(--st-concluido)' }}>{approved.length}</span>
        </div>
        {approved.length === 0 && <div className="empty" style={{ border: 0 }}>Nenhum depoimento aprovado ainda.</div>}
        {approved.map((t) => (
          <div key={t.id} className="card" style={{ marginBottom: 10 }}>
            <div className="head-row" style={{ marginBottom: 4 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                {t.photo && <img src={t.photo} alt="" style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', flex: 'none' }} />}
                <div>
                  <b>{t.name}</b> <small className="fine">para {t.barberName} · {fmtDate(t.createdAt)}</small>
                  <div style={{ color: 'var(--accent)' }}>{stars(t.rating)}</div>
                </div>
              </div>
              <button className="btn sm ghost" onClick={() => setConfirm({ item: t })}>Remover do site</button>
            </div>
            <p style={{ margin: 0 }}>{t.text}</p>
          </div>
        ))}
      </section>

      {confirm && (
        <Modal title="Remover este depoimento?" onClose={() => setConfirm(null)} actions={[{ label: 'Voltar', kind: 'ghost', onClick: () => setConfirm(null) }, { label: 'Remover', kind: 'danger', onClick: remove }]}>
          <p>"{confirm.item.text}"</p>
          <p className="fine">— {confirm.item.name}, para {confirm.item.barberName}</p>
        </Modal>
      )}
    </>
  );
}
