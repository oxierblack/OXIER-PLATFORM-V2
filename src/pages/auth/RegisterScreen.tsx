import { useState } from 'react';
import { useStore } from '../../lib/store';

const BACKEND = 'https://oxier-backend-production.up.railway.app';

export default function RegisterScreen() {
  const setScreen = useStore(s => s.setScreen);
  const showToast = useStore(s => s.showToast);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  async function handleRegister() {
    if (!name.trim() || !email.trim() || !password) { setErr('Please fill all fields'); return; }
    if (password.length < 6) { setErr('Password must be at least 6 characters'); return; }
    if (password !== confirm) { setErr('Passwords do not match'); return; }
    setErr(''); setLoading(true);
    try {
      const parts = name.trim().split(/\s+/);
      const firstName = parts[0];
      const lastName = parts.slice(1).join(' ') || parts[0];
      const res = await fetch(`${BACKEND}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName, name: name.trim(), email: email.trim().toLowerCase(), password }),
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('ox_reg_email', email.trim().toLowerCase());
        showToast('Account created! Check your email for OTP');
        setScreen('verify');
      } else {
        setErr(data.message || data.error || 'Registration failed');
      }
    } catch {
      setErr('Connection error — check your network');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-hero">
        <div className="auth-hero-glow" />
        <div className="auth-logo">OX</div>
        <h1>Create account</h1>
        <p>Join OXIER and start trading today</p>
      </div>
      <div className="auth-body">
        {err && <div className="auth-error">{err}</div>}
        <div className="auth-field" style={{ animationDelay: '.1s' }}>
          <label>Full Name</label>
          <input className="auth-input" type="text" placeholder="Your Name" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div className="auth-field" style={{ animationDelay: '.15s' }}>
          <label>Email</label>
          <input className="auth-input" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div className="auth-field" style={{ animationDelay: '.2s' }}>
          <label>Password</label>
          <div className="auth-pw-wrap">
            <input
              className="auth-input"
              type={showPw ? 'text' : 'password'}
              placeholder="Min 6 characters"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{ paddingRight: 44 }}
            />
            <button className="auth-pw-eye" onClick={() => setShowPw(v => !v)}>
              {showPw
                ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              }
            </button>
          </div>
        </div>
        <div className="auth-field" style={{ animationDelay: '.25s' }}>
          <label>Confirm Password</label>
          <input
            className="auth-input"
            type="password"
            placeholder="Repeat password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleRegister()}
          />
        </div>
        <button
          className={`auth-btn ${loading ? 'loading' : ''}`}
          onClick={handleRegister}
          disabled={loading}
          style={{ animationDelay: '.3s' }}
        >
          {loading ? '' : 'Create Account'}
        </button>
        <div className="auth-link">
          Already have an account?{' '}
          <span onClick={() => setScreen('login')}>Sign in</span>
        </div>
      </div>
    </div>
  );
}
