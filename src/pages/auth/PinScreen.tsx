import { useState } from 'react';
import { useStore } from '../../lib/store';

const PIN_LEN = 4;
const KEYS = ['1','2','3','4','5','6','7','8','9','','0','del'];

export default function PinScreen() {
  const setScreen = useStore(s => s.setScreen);
  const showToast = useStore(s => s.showToast);
  const [pin, setPin] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<string[] | null>(null);
  const [confirming, setConfirming] = useState(false);

  function press(k: string) {
    if (k === '') return;
    const cur = confirming ? confirm || [] : pin;
    if (k === 'del') {
      if (confirming) setConfirm(cur.slice(0, -1));
      else setPin(cur.slice(0, -1));
      return;
    }
    if (cur.length >= PIN_LEN) return;
    const next = [...cur, k];
    if (!confirming) {
      setPin(next);
      if (next.length === PIN_LEN) {
        setTimeout(() => { setConfirming(true); setConfirm([]); }, 300);
      }
    } else {
      const nc = next;
      setConfirm(nc);
      if (nc.length === PIN_LEN) {
        setTimeout(() => {
          if (nc.join('') === pin.join('')) {
            localStorage.setItem('ox_pin', nc.join(''));
            showToast('PIN set successfully!');
            setScreen('trading');
          } else {
            showToast('PINs do not match — try again');
            setPin([]); setConfirm([]); setConfirming(false);
          }
        }, 200);
      }
    }
  }

  const dots = confirming ? confirm || [] : pin;

  return (
    <div className="auth-screen">
      <div className="auth-hero">
        <div className="auth-hero-glow" />
        <div className="auth-logo" style={{ background: 'linear-gradient(135deg,#8B5CF6,#6D28D9)' }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
          </svg>
        </div>
        <h1>{confirming ? 'Confirm your PIN' : 'Set your PIN'}</h1>
        <p>{confirming ? 'Enter your PIN once more to confirm' : 'Choose a 4-digit PIN to secure your account'}</p>
      </div>
      <div className="auth-body" style={{ alignItems: 'center' }}>
        <div className="pin-dots">
          {Array(PIN_LEN).fill(0).map((_, i) => (
            <div key={i} className={`pin-dot ${i < dots.length ? 'filled' : ''}`} />
          ))}
        </div>
        <div className="pin-keypad">
          {KEYS.map((k, i) => (
            <button
              key={i}
              className={`pin-key ${k === 'del' ? 'del' : ''}`}
              onClick={() => press(k)}
              style={{ visibility: k === '' ? 'hidden' : 'visible' }}
            >
              {k === 'del' ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 4H8l-7 8 7 8h13a2 2 0 002-2V6a2 2 0 00-2-2z"/>
                  <line x1="18" y1="9" x2="12" y2="15"/><line x1="12" y1="9" x2="18" y2="15"/>
                </svg>
              ) : k}
            </button>
          ))}
        </div>
        <div className="pin-skip" onClick={() => setScreen('trading')}>Skip for now</div>
      </div>
    </div>
  );
}
