import { Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Processing from './pages/Processing';
import Review from './pages/Review';
import Published from './pages/Published';
import History from './pages/History';
import Connect from './pages/Connect';

// Pages that need an account. Guests are sent to the login page and brought back afterwards.
function Protected() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="splash">Loading…</div>;
  return user ? <Outlet /> : <Navigate to="/login" replace state={{ from: location.pathname }} />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Layout />}>
        {/* Public: anyone can open the dashboard first */}
        <Route path="/dashboard" element={<Dashboard />} />
        {/* Login required */}
        <Route element={<Protected />}>
          <Route path="/processing" element={<Processing />} />
          <Route path="/review/:id" element={<Review />} />
          <Route path="/published" element={<Published />} />
          <Route path="/history" element={<History />} />
          <Route path="/connect" element={<Connect />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
