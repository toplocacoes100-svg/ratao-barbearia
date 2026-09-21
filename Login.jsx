import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Splash } from '../components/ui.jsx';

const MSG = {
  'auth/invalid-credential': 'E-mail ou senha incorretos.',
  'auth/wrong-password': 'E-mail ou senha incorretos.',
  'auth/user-not-found': 'E-mail ou senha incorretos.',
  'auth/email-already-in-use': 'Esse e-mail já tem conta. Use "Entrar".',
  'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
  'auth/invalid-email': 'Esse e-mail não parece válido.',
  'auth/too-many-requests': 'Muitas tentativas. Espere um pouco e tente de novo.',
  'auth/network-request-failed': 'Sem internet. Confira a conexão.',
};

export default function Login() {
  const { user, profile, loading, login, register, resetPassword } = useAuth();
  const [mode, setMode] = useState('entrar');
  const [f, setF] = useState({ name: '', phone: '', email: '', password: '' });
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  if (loading) return <Splash />;
  if (user && profile) return <Navigate to="/" replace />;

  async function submit(e) {
    e.preventDefault();
    setErr(''); setInfo(''); setBusy(true);
    try {
      if (mode === 'entrar') await login(f.email.trim(), f.password);
      else await register({ name: f.name.trim(), phone: f.phone.trim(), email: f.email.trim(), password: f.password });
    } catch (ex) {
      setErr(MSG[ex.code] || 'Não deu certo. Tente de novo.');
    } finally { setBusy(false); }
  }
  async function forgot() {
    if (!f.email) { setErr('Digite seu e-mail primeiro.'); return; }
    setErr('');
    try { await resetPassword(f.email.trim()); setInfo('Enviamos um link para redefinir a senha no seu e-mail.'); }
    catch (ex) { setErr(MSG[ex.code] || 'Não foi possível enviar o e-mail.'); }
  }

  return (
    <main className="loginpage force-dark">
      <div className="loginwrap">
        <img className="loginart" src="/img/ratao-emblema.webp" alt="Ratão Barbearia: estilo, atitude e confiança" width="900" height="963" fetchPriority="high" />
        <div className="loginform">
          <div className="pills" role="group" aria-label="Entrar ou criar conta">
            <button className="pillbtn" aria-pressed={mode === 'entrar'} onClick={() => setMode('entrar')}>Entrar</button>
            <button className="pillbtn" aria-pressed={mode === 'criar'} onClick={() => setMode('criar')}>Criar conta</button>
          </div>
          <form onSubmit={submit} className="flex flex-col gap-3">
            {mode === 'criar' && (
              <>
                <label className="field">Nome<input required value={f.name} onChange={set('name')} autoComplete="name" /></label>
                <label className="field">WhatsApp<input required type="tel" value={f.phone} onChange={set('phone')} placeholder="(11) 90000-0000" autoComplete="tel" /></label>
              </>
            )}
            <label className="field">E-mail<input required type="email" value={f.email} onChange={set('email')} autoComplete="email" /></label>
            <label className="field">Senha<input required type="password" minLength={6} value={f.password} onChange={set('password')} autoComplete={mode === 'entrar' ? 'current-password' : 'new-password'} /></label>
            {err && <div className="err" role="alert">{err}</div>}
            {info && <div className="hint">{info}</div>}
            <button className="btn wide" disabled={busy}>{busy ? 'Aguarde...' : mode === 'entrar' ? 'Entrar' : 'Criar minha conta'}</button>
            {mode === 'entrar' && <button type="button" className="linkbtn" onClick={forgot}>Esqueci minha senha</button>}
          </form>
        </div>
      </div>
    </main>
  );
}
