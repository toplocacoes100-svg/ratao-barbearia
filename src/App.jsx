import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { CatalogProvider } from './context/CatalogContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import { configured } from './firebase.js';
import { Splash } from './components/ui.jsx';
import Login from './pages/Login.jsx';
import ClientLayout from './pages/client/ClientLayout.jsx';
import Home from './pages/client/Home.jsx';
import Book from './pages/client/Book.jsx';
import Mine from './pages/client/Mine.jsx';
import Profile from './pages/client/Profile.jsx';
import StaffLayout from './pages/staff/StaffLayout.jsx';
import Agenda from './pages/staff/Agenda.jsx';
import Team from './pages/staff/Team.jsx';
import Settings from './pages/staff/Settings.jsx';
import Barbers from './pages/staff/Barbers.jsx';
import Services from './pages/staff/Services.jsx';
import Finance from './pages/staff/Finance.jsx';

// Bloqueia quem não está logado ou não tem o perfil exigido
function Guard({ roles }) {
  const { user, profile, loading, logout } = useAuth();
  if (loading) return <Splash />;
  if (!user) return <Navigate to="/login" replace />;
  if (!profile) {
    return (
      <div className="splash">
        <p>Finalizando seu cadastro...</p>
        <button className="linkbtn" onClick={logout}>Sair</button>
      </div>
    );
  }
  if (roles && !roles.includes(profile.role)) return <Navigate to="/" replace />;
  return <Outlet />;
}

function Root() {
  const { user, profile, loading } = useAuth();
  if (loading) return <Splash />;
  if (!user) return <Navigate to="/login" replace />;
  if (!profile) return <Splash text="Finalizando seu cadastro..." />;
  return <Navigate to={profile.role === 'client' ? '/app' : '/painel'} replace />;
}

function MissingConfig() {
  return (
    <div className="login">
      <h1 className="page-title" style={{ fontSize: 40 }}>Falta conectar o Firebase</h1>
      <p>Copie o arquivo <b>.env.example</b> para <b>.env</b>, preencha com os dados do seu app web do Firebase e rode <b>npm run dev</b> de novo. O passo a passo está no README.</p>
    </div>
  );
}

export default function App() {
  if (!configured) return <MissingConfig />;
  return (
    <BrowserRouter>
      <AuthProvider>
        <CatalogProvider>
          <ToastProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={<Root />} />
              <Route element={<Guard />}>
                <Route path="/app" element={<ClientLayout />}>
                  <Route index element={<Home />} />
                  <Route path="agendar" element={<Book />} />
                  <Route path="meus" element={<Mine />} />
                  <Route path="perfil" element={<Profile />} />
                </Route>
              </Route>
              <Route element={<Guard roles={['barber', 'admin']} />}>
                <Route path="/painel" element={<StaffLayout />}>
                  <Route index element={<Navigate to="agenda" replace />} />
                  <Route path="agenda" element={<Agenda />} />
                  <Route element={<Guard roles={['admin']} />}>
                    <Route path="equipe" element={<Team />} />
                    <Route path="financeiro" element={<Finance />} />
                    <Route path="servicos" element={<Services />} />
                    <Route path="barbeiros" element={<Barbers />} />
                    <Route path="configuracoes" element={<Settings />} />
                  </Route>
                </Route>
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </ToastProvider>
        </CatalogProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
