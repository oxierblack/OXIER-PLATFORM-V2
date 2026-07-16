import { useState } from 'react';
import { useStore } from '../../lib/store';

const PRESETS = [
  { label: '30s', sec: 30 },
  { label: '1m',  sec: 60 },
  { label: '2m',  sec: 120 },
  { label: '3m',  sec: 180 },
  { label: '5m',  sec: 300 },
  { label: '10m', sec: 600 },
  { label: '15m', sec: 900 },
  { label: '30m', sec: 1800 },
  { label: '1h',  sec: 3600 },
  { label: '2h',  sec: 7200 },
  { label: '4h',  sec: 14400 },
  { label: '1d',  sec: 86400 },
];

const AMT_PRESETS = [5, 10, 25, 50, 100, 250, 500, 1000];

export default function ExpiryOverlay() {
  const setOverlay = useStore(s => s.setOverlay);
  const expMin = useStore(s => s.expMin);
  const expDisp = useStore(s => s.expDisp);
  const setExpiry = useStore(s => s.setExpiry);
  const amount = useStore(s => s.amount);
  const setAmount = useStore(s => s.setAmount);
  const balance = useStore(s => s.balance);
  const showToast = useStore(s => s.showToast);

  const [amtStr, setAmtStr] = useState(amount.toString());
  const [section, setSection] = useState<'expiry' | 'amount'>('amount');

  function applyAmt() {
    const v = parseFloat(amtStr);
    if (isNaN(v) || v <= 0) { showToast('Enter a valid amount'); return; }
    const max = balance();
    if (v > max) { showToast('Amount exceeds available balance'); setAmtStr(Math.floor(max).toString()); return; }
    setAmount(v);
    setOverlay('none');
  }

  function numPress(k: string) {
    if (k === 'C') { setAmtStr(''); return; }
    if (k === '⌫') { setAmtStr(s => s.slice(0, -1) || ''); return; }
    if (k === '.' && amtStr.includes('.')) return;
    setAmtStr(s => (s + k).replace(/^0+(\d)/, '$1'));
  }

  const NUMPAD = ['7','8','9','4','5','6','1','2','3','C','0','⌫'];

  return (
    <div className="overlay-bg" onClick={() => setOverlay('none')}>
      <div className="overlay-sheet" style={{ maxHeight: '85vh' }} onClick={e => e.stopPropagation()}>
        <div className="overlay-handle" />
        <div className="overlay-header">
          <span className="overlay-title">Amount & Expiry</span>
          <button className="overlay-close" onClick={() => setOverlay('none')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="overlay-body">
          <div style={{ display:'flex', gap: 8, marginBottom: 4 }}>
            {(['amount','expiry'] as const).map(s => (
              <button key={s} className={`hist-tab ${section === s ? 'active' : ''}`} onClick={() => setSection(s)} style={{ flex: 1, background:'none', border:'1.5px solid var(--border2)', padding:'9px', borderRadius:'var(--r2)', fontFamily:'inherit' }}>
                {s === 'amount' ? 'Amount' : 'Expiry'}
              </button>
            ))}
          </div>

          {section === 'amount' && (
            <>
              <div style={{ background:'var(--bg2)', border:'1.5px solid var(--border2)', borderRadius:'var(--r2)', padding:'12px 16px', textAlign:'center', marginBottom: 8 }}>
                <div style={{ fontSize: 11, color:'var(--t4)', fontWeight:700, letterSpacing:'.5px', marginBottom:4 }}>INVESTMENT AMOUNT</div>
                <div style={{ fontSize: 28, fontWeight: 900, fontFamily: 'JetBrains Mono', color:'var(--t1)' }}>
                  ${amtStr || '0'}
                </div>
                <div style={{ fontSize: 11, color:'var(--t4)', marginTop:4 }}>Balance: ${balance().toFixed(2)}</div>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6, marginBottom:8 }}>
                {AMT_PRESETS.map(p => (
                  <button key={p} className={`exp-item ${parseFloat(amtStr) === p ? 'active' : ''}`} onClick={() => setAmtStr(p.toString())}>
                    ${p}
                  </button>
                ))}
              </div>

              <div className="numpad-grid">
                {NUMPAD.map(k => (
                  <button
                    key={k}
                    className="numpad-key"
                    onClick={() => numPress(k)}
                    style={{ color: k === 'C' ? 'var(--red)' : k === '⌫' ? 'var(--t3)' : undefined }}
                  >{k}</button>
                ))}
              </div>

              <button className="auth-btn" style={{ marginTop: 12 }} onClick={applyAmt}>
                Set Amount ${amtStr || '0'}
              </button>
            </>
          )}

          {section === 'expiry' && (
            <>
              <div style={{ textAlign:'center', marginBottom:8 }}>
                <div style={{ fontSize: 11, color:'var(--t4)', fontWeight:700, letterSpacing:'.5px', marginBottom:4 }}>CURRENT EXPIRY</div>
                <div style={{ fontSize: 28, fontWeight: 900, fontFamily: 'JetBrains Mono', color:'var(--g0)' }}>{expDisp}</div>
              </div>
              <div className="exp-items">
                {PRESETS.map(p => (
                  <div
                    key={p.sec}
                    className={`exp-item ${expDisp === p.label ? 'active' : ''}`}
                    onClick={() => { setExpiry(p.sec / 60, p.label); setOverlay('none'); }}
                  >{p.label}</div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
