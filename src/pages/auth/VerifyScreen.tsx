import { useState, useRef } from 'react';
import { useStore } from '../../lib/store';

const BACKEND = 'https://oxier-backend-production.up.railway.app';
const OTP_LEN = 6;

export default function VerifyScreen() {
  const setScreen = useStore(s => s.setScreen);
  const setUserInfo = useStore(s => s.setUserInfo);
  const showToast = useStore(s => s.showToast);

  const [digits, setDigits] = useState<string[]>(Array(OTP_LEN).fill(''));
  const [loading, setLoading] = useState(false);
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const email = localStorage.getItem('ox_reg_email') || '';

  function handleKey(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      const nd = [...digits];
      if (nd[i]) { nd[i] = ''; setDigits(nd); }
      else if (i > 0) { refs.current[i - 1]?.focus(); }
    }
  }

  function handleChange(i: number, val: string) {
    const ch = val.replace(/\D/g, '').slice(-1);
    const nd = [...digits]; nd[i] = ch; setDigits(nd);
    if (ch && i < OTP_LEN - 1) refs.current[i + 1]?.focus();
  }

  function handlePaste(e: React.ClipboardEvent) {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LEN);
    if (text.length === OTP_LEN) { setDigits(text.split('')); refs.current[OTP_LEN - 1]?.focus(); }
  }

  async function handleVerify() {
    const code = digits.join('');
    if (code.length < OTP_LEN) { showToast('Enter the complete OTP code'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: code }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.token) {
          setUserInfo({ email, name: data.name || email.split('@')[0], token: data.token });
        }
        setScreen('pin');
      } else {
        showToast(data.message || 'Invalid OTP code');
        setDigits(Array(OTP_LEN).fill(''));
        refs.current[0]?.focus();
      }
    } catch {
      showToast('Connection error');
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    try {
      await fetch(`${BACKEND}/api/auth/resend-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      showToast('OTP resent to ' + email);
    } catch {
      showToast('Could not resend OTP');
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-hero">
        <div className="auth-hero-glow" />
        <div className="auth-logo" style={{ background: 'linear-gradient(135deg,#3B82F6,#2563EB)' }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
            <rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>
          </svg>
        </div>
        <h1>Verify your email</h1>
        <p>We sent a 6-digit code to<br /><strong style={{ color:'var(--t2)' }}>{email || 'your email'}</strong></p>
      </div>
      <div className="auth-body">
        <div className="otp-inputs" onPaste={handlePaste}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={el => refs.current[i] = el}
              className="otp-input"
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => handleKey(i, e)}
              autoFocus={i === 0}
            />
          ))}
        </div>
        <button
          className={`auth-btn ${loading ? 'loading' : ''}`}
          onClick={handleVerify}
          disabled={loading}
        >
          {loading ? '' : 'Verify Email'}
        </button>
        <div className="auth-link">
          Didn't receive the code?{' '}
          <span onClick={resend}>Resend OTP</span>
        </div>
        <div className="auth-link">
          <span onClick={() => setScreen('login')}>Back to login</span>
        </div>
      </div>
    </div>
  );
}
