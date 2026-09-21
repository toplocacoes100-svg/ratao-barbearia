import { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';

export default function Profile() {
  const { user, profile, logout } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(profile.name || '');
  const [phone, setPhone] = useState(profile.phone || '');
  const [busy, setBusy] = useState(false);

  async function save(e) {
    e.preventDefault(); setBusy(true);
    try { await updateDoc(doc(db, 'users', user.uid), { name: name.trim(), phone: phone.trim() }); toast('Dados salvos'); }
    catch { toast('Não foi possível salvar'); }
    finally { setBusy(false); }
  }
  return (
    <div className="screen">
      <h1 className="page-title">Perfil</h1>
      <form onSubmit={save} className="flex flex-col gap-3">
        <label className="field">Nome<input required value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label className="field">WhatsApp<input required type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
        <label className="field">E-mail<input value={profile.email || user.email} disabled /></label>
        <button className="btn" disabled={busy}>Salvar</button>
      </form>
      <button className="btn ghost" onClick={logout}>Sair da conta</button>
    </div>
  );
}
