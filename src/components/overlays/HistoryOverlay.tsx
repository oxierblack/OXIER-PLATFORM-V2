import { useState, useEffect } from 'react';
import { useStore } from '../../lib/store';
import { fmt } from '../../lib/markets';

function formatDate(ts: number) {
  return new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatDur(from: number, to: number) {
  const s = Math.round((to - from) / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.round(s / 60)}m`;
}

export default function HistoryOverlay() {
  const setOverlay = useStore(s => s.setOverlay);
  const trades = useStore(s => s.trades);
  const earlyCloseTrade = useStore(s => s.earlyCloseTrade);
  const adjustBalance = useStore(s => s.adjustBalance);
  const showConfirm = useStore(s => s.showConfirm);
  const showToast = useStore(s => s.showToast);
  const [tab, setTab] = useState<'open' | 'closed'>('open');
  const [, forceTick] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => forceTick(t => t + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  const open = trades.filter(t => !t.resolved).sort((a,b) => b.openedAt - a.openedAt);
  const closed = trades.filter(t => t.resolved).sort((a,b) => (b.resolvedAt||0) - (a.resolvedAt||0));
  const list = tab === 'open' ? open : closed;

  function earlyClose(t: typeof trades[0]) {
    const exit = t.entry * (1 + (Math.random() - 0.5) * 0.005);
    showConfirm('Early Close', `Close this trade now and get back 50% of your investment ($${(t.amount / 2).toFixed(2)})?`, () => {
      earlyCloseTrade(t.id, exit);
      adjustBalance(t.amount / 2, t.walType);
      showToast(`Trade closed. Refunded $${(t.amount / 2).toFixed(2)}`);
    });
  }

  const totalProfit = closed.filter(t => t.won).reduce((a, t) => a + (t.profit || 0), 0);
  const wins = closed.filter(t => t.won).length;
  const losses = closed.filter(t => !t.won && !t.earlyClosed).length;

  return (
    <div className="overlay-bg" onClick={() => setOverlay('none')}>
      <div className="overlay-sheet" style={{ maxHeight: '88vh' }} onClick={e => e.stopPropagation()}>
        <div className="overlay-handle" />
        <div className="overlay-header">
          <span className="overlay-title">Trade History</span>
          <button className="overlay-close" onClick={() => setOverlay('none')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div style={{ padding: '8px 16px 0', display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 8, padding: '6px 12px', background: 'var(--bg2)', borderRadius: 'var(--r3)', flex: 1 }}>
            <span style={{ fontSize: 12, color: 'var(--g0)', fontWeight: 700 }}>W:{wins}</span>
            <span style={{ fontSize: 12, color: 'var(--red)', fontWeight: 700 }}>L:{losses}</span>
            <span style={{ fontSize: 12, color: totalProfit >= 0 ? 'var(--g0)' : 'var(--red)', fontWeight: 700, marginLeft: 'auto', fontFamily: 'JetBrains Mono' }}>
              {totalProfit >= 0 ? '+' : ''}${totalProfit.toFixed(2)}
            </span>
          </div>
        </div>

        <div style={{ padding: '8px 16px 0' }}>
          <div className="hist-tabs">
            <button className={`hist-tab ${tab === 'open' ? 'active' : ''}`} onClick={() => setTab('open')}>
              Active ({open.length})
            </button>
            <button className={`hist-tab ${tab === 'closed' ? 'active' : ''}`} onClick={() => setTab('closed')}>
              Closed ({closed.length})
            </button>
          </div>
        </div>

        <div className="overlay-body">
          {list.length === 0 ? (
            <div className="hist-empty">
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="var(--t4)" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t3)' }}>No {tab} trades</div>
              <div style={{ fontSize: 13, color: 'var(--t4)' }}>
                {tab === 'open' ? 'Place a trade to see it here' : 'Your closed trades will appear here'}
              </div>
            </div>
          ) : (
            list.map(t => {
              const now = Date.now();
              const timeLeft = Math.max(0, Math.floor((t.expiryAt - now) / 1000));
              const mins = Math.floor(timeLeft / 60);
              const secs = timeLeft % 60;
              return (
                <div key={t.id} className="hist-trade">
                  <div className="hist-trade-header">
                    <span className={`hist-side-badge ${t.side}`}>{t.side.toUpperCase()}</span>
                    <span className="hist-market">{t.mktName}</span>
                    <span className={`hist-status ${!t.resolved ? 'active' : t.won ? 'win' : 'loss'}`}>
                      {!t.resolved ? `${mins}:${secs.toString().padStart(2,'0')}` : t.earlyClosed ? 'CLOSED' : t.won ? 'WIN' : 'LOSS'}
                    </span>
                  </div>
                  <div className="hist-trade-body">
                    <div className="hist-field">
                      <div className="hist-field-label">Amount</div>
                      <div className="hist-field-val">${t.amount.toFixed(2)}</div>
                    </div>
                    <div className="hist-field">
                      <div className="hist-field-label">Entry</div>
                      <div className="hist-field-val">{fmt(t.entry, t.dec)}</div>
                    </div>
                    <div className="hist-field">
                      <div className="hist-field-label">{t.resolved ? 'Exit' : 'Payout'}</div>
                      <div className="hist-field-val">{t.resolved ? fmt(t.exit || 0, t.dec) : `${t.payout}%`}</div>
                    </div>
                    <div className="hist-field">
                      <div className="hist-field-label">{t.resolved ? 'Duration' : 'Wallet'}</div>
                      <div className="hist-field-val">{t.resolved ? formatDur(t.openedAt, t.resolvedAt || Date.now()) : t.walType.toUpperCase()}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: 11, color: 'var(--t4)' }}>{formatDate(t.openedAt)}</div>
                    {t.resolved ? (
                      <span className={`hist-pnl ${t.won ? 'win' : 'loss'}`}>
                        {t.won ? '+' : ''}{(t.profit || 0) >= 0 ? '+' : ''}${Math.abs(t.profit || 0).toFixed(2)}
                      </span>
                    ) : (
                      <button className="hist-early-close" onClick={() => earlyClose(t)}>
                        Close Early
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
