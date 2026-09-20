import { useEffect, useState } from 'react';
import { collection, deleteField, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useCatalog } from '../../context/CatalogContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { seedDemo } from '../../lib/seed.js';

const ROLES = { client: 'Cliente', barber: 'Barbeiro', admin: 'Dono (admin)' };

export default function Team() {
  const { user } = useAuth();
  const { allBarbers, services, ready } = useCatalog();
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => onSnapshot(collection(db, 'users'), (s) => setUsers(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.name || '').localeCompare(b.name || ''))), (e) => console.error(e)), []);

  async function load() {
    setBusy(true);
    try { await seedDemo(); toast('Dados de exemplo carregados'); }
    catch (e) { console.error(e); toast('Não foi possível carregar. Confira se as regras foram publicadas.'); }
    finally { setBusy(false); }
  }
  async function change(u, patch) {
    try {
      const data = { ...patch };
      if (patch.role && patch.role !== 'barber') data.barberId = deleteField();
      await updateDoc(doc(db, 'users', u.id), data);
      toast('Acesso atualizado');
    } catch (e) { console.error(e); toast('Não foi possível alterar'); }
  }

  return (
    <>
      <div className="head-row"><div><h1>Equipe e acessos</h1><p className="fine">Defina quem é barbeiro ou dono. Todo mundo que cria conta começa como cliente.</p></div></div>

      {ready && (allBarbers.length === 0 || services.length === 0) && (
        <section className="panel">
          <h3>Primeiros passos</h3>
          <p style={{ marginBottom: 12 }}>A agenda ainda está vazia. Carregue 3 barbeiros e 9 serviços de exemplo para testar. Depois você troca pelos dados reais.</p>
          <button className="btn" onClick={load} disabled={busy}>{busy ? 'Carregando...' : 'Carregar dados de exemplo'}</button>
        </section>
      )}

      <div className="tblwrap">
        <table>
          <thead><tr><th>Pessoa</th><th>Perfil</th><th>Barbeiro vinculado</th></tr></thead>
          <tbody>
            {users.map((u) => {
              const me = u.id === user.uid;
              return (
                <tr key={u.id}>
                  <td><b>{u.name}</b>{me && ' (você)'}<small>{u.email}</small></td>
                  <td>
                    <select value={u.role} disabled={me} aria-label={`Perfil de ${u.name}`} onChange={(e) => change(u, { role: e.target.value })}>
                      {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </td>
                  <td>
                    {u.role === 'barber' ? (
                      <select value={u.barberId || ''} aria-label={`Barbeiro de ${u.name}`} onChange={(e) => change(u, { barberId: e.target.value })}>
                        <option value="" disabled>Escolha...</option>
                        {allBarbers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    ) : <span className="fine">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="fine">Para dar acesso a um barbeiro: ele cria a conta pelo link do app, você troca o perfil dele para "Barbeiro" e escolhe qual barbeiro ele é.</p>
    </>
  );
}
