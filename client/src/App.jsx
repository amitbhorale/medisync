import React, { createContext, useContext, useState, useEffect } from 'react';
import Login from './components/Login';
import DoctorDashboard from './components/DoctorDashboard';
import StaffDashboard from './components/StaffDashboard';
import PatientDashboard from './components/PatientDashboard';
import Inventory from './components/Inventory';
import AuditLogs from './components/AuditLogs';

// Create Global Auth & Theme Context
const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export default function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [theme, setTheme] = useState('dark'); // Default to glowing dark theme
  const [view, setView] = useState('dashboard'); // 'dashboard', 'inventory', 'audit-logs'
  const [loading, setLoading] = useState(true);

  // Initialize Auth & Theme
  useEffect(() => {
    const savedToken = localStorage.getItem('medisync_token');
    const savedUser = localStorage.getItem('medisync_user');
    const savedTheme = localStorage.getItem('medisync_theme') || 'dark';

    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
    
    setTheme(savedTheme);
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    setLoading(false);
  }, []);

  const loginUser = (token, userObj) => {
    localStorage.setItem('medisync_token', token);
    localStorage.setItem('medisync_user', JSON.stringify(userObj));
    setToken(token);
    setUser(userObj);
    setView('dashboard');
  };

  const logoutUser = () => {
    localStorage.removeItem('medisync_token');
    localStorage.removeItem('medisync_user');
    setToken(null);
    setUser(null);
    setView('dashboard');
  };

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('medisync_theme', newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#0f172a', color: '#38bdf8' }}>
        <h2 style={{ fontFamily: 'sans-serif', fontWeight: 400 }}>Loading MediSync System...</h2>
      </div>
    );
  }

  // Not logged in -> Show Login Page
  if (!token || !user) {
    return (
      <AuthContext.Provider value={{ user, token, theme, loginUser, logoutUser, toggleTheme }}>
        <Login />
      </AuthContext.Provider>
    );
  }

  // Helper to render pages based on simple state route & auth roles
  const renderView = () => {
    switch (view) {
      case 'dashboard':
        if (user.role === 'Doctor') return <DoctorDashboard />;
        if (user.role === 'Staff') return <StaffDashboard />;
        if (user.role === 'Patient') return <PatientDashboard />;
        return <div>Access Denied</div>;
      case 'inventory':
        if (user.role === 'Doctor' || user.role === 'Staff') {
          return <Inventory />;
        }
        return <div className="glass-panel"><h2>Access Denied</h2><p>Patients do not have access to the medicine inventory.</p></div>;
      case 'audit-logs':
        if (user.role === 'Doctor' || user.role === 'Staff') {
          return <AuditLogs />;
        }
        return <div className="glass-panel"><h2>Access Denied</h2><p>Security log files are restricted to clinic personnel.</p></div>;
      default:
        return <div className="glass-panel"><h2>404 View Not Found</h2></div>;
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, theme, loginUser, logoutUser, toggleTheme }}>
      <div className="app-container">
        {/* Navigation Sidebar */}
        <aside className="sidebar no-print">
          <div className="sidebar-logo">
            <span>🏥</span>
            <span>MediSync</span>
          </div>

          <ul className="sidebar-menu">
            <li>
              <button 
                onClick={() => setView('dashboard')}
                className={`btn sidebar-link ${view === 'dashboard' ? 'active' : ''}`}
                style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'left' }}
              >
                <span>📊</span>
                <span>Dashboard</span>
              </button>
            </li>

            {/* Doctor/Staff Extra links */}
            {(user.role === 'Doctor' || user.role === 'Staff') && (
              <>
                <li>
                  <button 
                    onClick={() => setView('inventory')}
                    className={`btn sidebar-link ${view === 'inventory' ? 'active' : ''}`}
                    style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'left' }}
                  >
                    <span>📦</span>
                    <span>Inventory</span>
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => setView('audit-logs')}
                    className={`btn sidebar-link ${view === 'audit-logs' ? 'active' : ''}`}
                    style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'left' }}
                  >
                    <span>🛡️</span>
                    <span>Audit Logs</span>
                  </button>
                </li>
              </>
            )}
          </ul>

          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Theme Toggle Button */}
            <button onClick={toggleTheme} className="btn btn-secondary" style={{ width: '100%' }}>
              {theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode'}
            </button>
            
            {/* Logout Button */}
            <button onClick={logoutUser} className="btn btn-danger" style={{ width: '100%' }}>
              🚪 Log Out
            </button>
          </div>
        </aside>

        {/* Main Dashboard Panel */}
        <main className="main-content">
          <header className="header no-print">
            <div>
              <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.9rem' }}>Welcome back,</p>
              <h2>{user.name}</h2>
            </div>
            
            <div className="user-profile">
              <div style={{ textAlign: 'right' }}>
                <span className={`badge ${user.role === 'Doctor' ? 'badge-critical' : user.role === 'Staff' ? 'badge-normal' : 'badge-success'}`}>
                  {user.role}
                </span>
                <p style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', marginTop: '2px' }}>
                  {user.department !== 'N/A' ? user.department : 'MediSync Member'}
                </p>
              </div>
              <div className="avatar">
                {user.name.split(' ').pop().charAt(0)}
              </div>
            </div>
          </header>

          {renderView()}
        </main>
      </div>
    </AuthContext.Provider>
  );
}
