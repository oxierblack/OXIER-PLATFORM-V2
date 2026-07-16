import { useState } from 'react';
import { useStore } from '../../lib/store';
import { resumeAudio } from '../../lib/sounds';

const BACKEND = 'https://oxier-backend-production.up.railway.app';

export default function LoginScreen() {
  const setScreen = useStore(s => s.setScreen);
  const setUserInfo = useStore(s => s.setUserInfo);
  const showToast = useStore(s => s.showToast);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  async function handleLogin() {
    if (!email.trim() || !password.trim()) { setErr('Please fill all fields'); return; }
    setErr(''); setLoading(true); resumeAudio();
    try {
      const res = await fetch(`${BACKEND}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        setUserInfo({ email: email.trim().toLowerCase(), name: data.name || email.split('@')[0], token: data.token });
        setScreen('trading');
      } else {
        setErr(data.message || data.error || 'Login failed — check your credentials');
      }
    } catch {
      setErr('Connection error — check your network');
    } finally {
      setLoading(false);
    }
  }

  function demoLogin() {
    resumeAudio();
    setUserInfo({ email: 'demo@oxier.com', name: 'Demo Trader', token: 'demo' });
    setScreen('trading');
  }

  return (
    <div className="auth-screen">
      <div className="auth-hero">
        <div className="auth-hero-glow" />
        <div className="auth-logo">OX</div>
        <h1>Welcome back</h1>
        <p>Sign in to your OXIER account</p>
      </div>
      <div className="auth-body">
        {err && <div className="auth-error">{err}</div>}
        <div className="auth-field" style={{ animationDelay: '.1s' }}>
          <label>Email</label>
          <input
            className="auth-input"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoComplete="email"
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
          />
        </div>
        <div className="auth-field" style={{ animationDelay: '.2s' }}>
          <label>Password</label>
          <div className="auth-pw-wrap">
            <input
              className="auth-input"
              type={showPw ? 'text' : 'password'}
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
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
        <button
          className={`auth-btn ${loading ? 'loading' : ''}`}
          onClick={handleLogin}
          disabled={loading}
          style={{ animationDelay: '.3s' }}
        >
          {loading ? '' : 'Sign In'}
        </button>
        <div className="auth-divider">or</div>
        <button
          className="auth-btn"
          onClick={demoLogin}
          style={{ background: 'var(--bg2)', color: 'var(--t2)', border: '1.5px solid var(--border2)', boxShadow: 'none' }}
        >
          Try Demo Account
        </button>
        <div className="auth-link">
          Don't have an account?{' '}
          <span onClick={() => setScreen('register')}>Create account</span>
        </div>
      </div>
    </div>
  );
}
