import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { Logo, ThemeButton } from '../../components/ui.jsx';

export default function ClientLayout() {
  const { profile } = useAuth();
  const { pathname } = useLocation();
  const booking = pathname.startsWith('/app/agendar');
  const staff = profile.role !== 'client';
  return (
    <>
      <header className="top">
        <div className="brand"><Logo /><span>Barbearia do Ratão</span></div>
        <div className="ml-auto flex items-center gap-2">
          {staff && <NavLink to="/painel" className="btn sm ghost">Voltar ao painel</NavLink>}
          <ThemeButton />
        </div>
      </header>
      <div className="stage">
        <aside className="poster" aria-hidden="true"><div className="vpole stripes" /><div className="vtext">BARBEARIA DO RATÃO</div></aside>
        <div className="phone">
          <Outlet />
          {!booking && (
            <nav className="tabbar" aria-label="Navegação">
              <NavLink to="/app" end className={({ isActive }) => (isActive ? 'active' : '')}><span>⌂</span>Início</NavLink>
              <NavLink to="/app/agendar" className="go"><span>✂</span>Agendar</NavLink>
              <NavLink to="/app/meus" className={({ isActive }) => (isActive ? 'active' : '')}><span>☰</span>Meus horários</NavLink>
              <NavLink to="/app/perfil" className={({ isActive }) => (isActive ? 'active' : '')}><span>☺</span>Perfil</NavLink>
            </nav>
          )}
        </div>
        <aside className="info">
          <h3>Regras rápidas</h3>
          <p>Cancele até 2 horas antes sem custo. Depois disso, o cancelamento e a falta ficam registrados no seu histórico.</p>
        </aside>
      </div>
    </>
  );
}
