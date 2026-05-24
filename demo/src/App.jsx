import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import AdminPage from './pages/AdminPage.jsx';
import ClientPage from './pages/ClientPage.jsx';
import ApproachesPage from './pages/ApproachesPage.jsx';

function Nav() {
  const { pathname } = useLocation();
  return (
    <nav className="topnav">
      <div className="topnav-brand">Offer Hybrid Demo</div>
      <div className="topnav-links">
        <Link className={pathname.startsWith('/admin') ? 'active' : ''} to="/admin">
          Admin
        </Link>
        <Link className={pathname.startsWith('/client') ? 'active' : ''} to="/client">
          Client
        </Link>
        <Link className={pathname.startsWith('/approaches') ? 'active' : ''} to="/approaches">
          A vs B vs C
        </Link>
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <div className="app-shell">
      <Nav />
      <Routes>
        <Route path="/" element={<Navigate to="/admin" replace />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/client" element={<ClientPage />} />
        <Route path="/approaches" element={<ApproachesPage />} />
      </Routes>
    </div>
  );
}
