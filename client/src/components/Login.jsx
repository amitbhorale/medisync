import React, { useState } from 'react';
import { api } from '../api';
import { useAuth } from '../App';

export default function Login() {
  const { loginUser } = useAuth();
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form Fields
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('Male');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please fill in all fields.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const data = await api.login(username, password);
      loginUser(data.token, data.user);
    } catch (err) {
      setError(err.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!username || !password || !name || !phone) {
      setError('Name, Username, Password, and Phone are required.');
      return;
    }
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      await api.register({
        username,
        password,
        name,
        age: parseInt(age) || 30,
        gender,
        phone,
        address
      });
      setSuccess('Account created successfully! You can now log in.');
      setIsRegistering(false);
      setPassword(''); // clear password field
    } catch (err) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const fillCredentials = (role) => {
    setError('');
    if (role === 'Doctor') {
      setUsername('doctor');
      setPassword('doctor123');
    } else if (role === 'Staff') {
      setUsername('staff');
      setPassword('staff123');
    } else if (role === 'Patient') {
      setUsername('patient');
      setPassword('patient123');
    }
  };

  return (
    <div style={{
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '100vh', 
      padding: '20px', 
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)'
    }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '480px', pointerEvents: 'auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <span style={{ fontSize: '3rem' }}>🏥</span>
          <h1 style={{ color: '#fff', fontSize: '2rem', marginTop: '10px' }}>MediSync</h1>
          <p style={{ color: '#94a3b8', fontSize: '0.95rem', marginTop: '4px' }}>
            Clinic Management & Telehealth System
          </p>
        </div>

        {error && (
          <div style={{ 
            backgroundColor: 'rgba(239, 68, 68, 0.15)', 
            border: '1px solid #ef4444', 
            color: '#fca5a5', 
            padding: '12px', 
            borderRadius: '8px', 
            marginBottom: '16px',
            fontSize: '0.9rem'
          }}>
            ⚠️ {error}
          </div>
        )}

        {success && (
          <div style={{ 
            backgroundColor: 'rgba(34, 197, 94, 0.15)', 
            border: '1px solid #22c55e', 
            color: '#86efac', 
            padding: '12px', 
            borderRadius: '8px', 
            marginBottom: '16px',
            fontSize: '0.9rem'
          }}>
            ✅ {success}
          </div>
        )}

        {!isRegistering ? (
          // LOGIN FORM
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label" style={{ color: '#cbd5e1' }}>Username</label>
              <input 
                type="text" 
                className="form-input" 
                style={{ color: '#fff', backgroundColor: '#1e293b', borderColor: '#334155' }}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. doctor"
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ color: '#cbd5e1' }}>Password</label>
              <input 
                type="password" 
                className="form-input" 
                style={{ color: '#fff', backgroundColor: '#1e293b', borderColor: '#334155' }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loading}
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '8px' }} disabled={loading}>
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>

            <p style={{ color: '#94a3b8', fontSize: '0.9rem', textAlign: 'center', marginTop: '20px' }}>
              Are you a new patient?{' '}
              <button 
                type="button" 
                onClick={() => { setIsRegistering(true); setError(''); }}
                style={{ color: '#06b6d4', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600 }}
              >
                Register Here
              </button>
            </p>
          </form>
        ) : (
          // REGISTRATION FORM
          <form onSubmit={handleRegister}>
            <div className="form-group">
              <label className="form-label" style={{ color: '#cbd5e1' }}>Full Name</label>
              <input 
                type="text" 
                className="form-input" 
                style={{ color: '#fff', backgroundColor: '#1e293b', borderColor: '#334155' }}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. John Doe"
                disabled={loading}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" style={{ color: '#cbd5e1' }}>Username</label>
                <input 
                  type="text" 
                  className="form-input" 
                  style={{ color: '#fff', backgroundColor: '#1e293b', borderColor: '#334155' }}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="john_doe"
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ color: '#cbd5e1' }}>Password</label>
                <input 
                  type="password" 
                  className="form-input" 
                  style={{ color: '#fff', backgroundColor: '#1e293b', borderColor: '#334155' }}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" style={{ color: '#cbd5e1' }}>Age</label>
                <input 
                  type="number" 
                  className="form-input" 
                  style={{ color: '#fff', backgroundColor: '#1e293b', borderColor: '#334155' }}
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="34"
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ color: '#cbd5e1' }}>Gender</label>
                <select 
                  className="form-input" 
                  style={{ color: '#fff', backgroundColor: '#1e293b', borderColor: '#334155' }}
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  disabled={loading}
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ color: '#cbd5e1' }}>Phone Number</label>
              <input 
                type="text" 
                className="form-input" 
                style={{ color: '#fff', backgroundColor: '#1e293b', borderColor: '#334155' }}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 555-0199"
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ color: '#cbd5e1' }}>Address</label>
              <input 
                type="text" 
                className="form-input" 
                style={{ color: '#fff', backgroundColor: '#1e293b', borderColor: '#334155' }}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="742 Evergreen Terrace, Springfield"
                disabled={loading}
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '8px' }} disabled={loading}>
              {loading ? 'Creating Account...' : 'Register'}
            </button>

            <p style={{ color: '#94a3b8', fontSize: '0.9rem', textAlignment: 'center', marginTop: '20px', textAlign: 'center' }}>
              Already registered?{' '}
              <button 
                type="button" 
                onClick={() => { setIsRegistering(false); setError(''); }}
                style={{ color: '#06b6d4', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600 }}
              >
                Sign In Instead
              </button>
            </p>
          </form>
        )}

        {/* Demo Quick Logins */}
        {!isRegistering && (
          <div style={{ marginTop: '28px', paddingTop: '20px', borderTop: '1px solid #334155' }}>
            <p style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px', textAlign: 'center' }}>
              Select Demo Credentials
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              <button onClick={() => fillCredentials('Doctor')} className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '8px', color: '#fff', backgroundColor: '#334155', borderColor: '#475569' }}>
                👨‍⚕️ Doctor
              </button>
              <button onClick={() => fillCredentials('Staff')} className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '8px', color: '#fff', backgroundColor: '#334155', borderColor: '#475569' }}>
                👩‍💼 Staff
              </button>
              <button onClick={() => fillCredentials('Patient')} className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '8px', color: '#fff', backgroundColor: '#334155', borderColor: '#475569' }}>
                🏥 Patient
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
