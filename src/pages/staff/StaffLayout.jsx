import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { Logo, ThemeButton } from '../../components/ui.jsx';

export default function StaffLayout() {
  const { profile, logout } = useAuth();
  const admin = profile.role === 'admin';
  const cls = ({ isActive }) => (isActive ? 'active' : '');
  return (
    <>
      <header className="top">
        <div className="brand"><Logo /><span>Ratão</span></div>
        <nav className="nav" aria-label="Menu">
          <NavLink to="/painel/agenda" className={cls}>Agenda</NavLink>
          {admin && <NavLink to="/painel/equipe" className={cls}>Equipe</NavLink>}
          <NavLink to="/app" className={cls}>Ver como cliente</NavLink>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <span className="fine hidden sm:inline">{profile.name}</span>
          <button className="btn sm ghost" onClick={logout}>Sair</button>
          <ThemeButton />
        </div>
      </header>
      <main className="content"><Outlet /></main>
    </>
  );
}
