import { useState, useEffect } from 'react';
import { useStore } from '../../lib/store';

type SignalDir = 'buy' | 'sell';

interface Signal {
  id: string;
  market: string;
  base: string;
  dir: SignalDir;
  tf: string;
  strength: number;
  accuracy: number;
  win: number;
  total: number;
  reason: string;
  generatedAt: number;
  expiresIn: number;
}

function genSignals(markets: any[]): Signal[] {
  const top = markets.slice(0, 12);
  return top.map((m, i) => {
    const dir: SignalDir = Math.random() > 0.5 ? 'buy' : 'sell';
    const tfs = ['1m','5m','15m','1h'];
    const reasons = [
      'RSI oversold + support bounce',
      'MACD bullish crossover detected',
      'Bollinger band squeeze breakout',
      'EMA 20/50 golden cross',
      'Strong volume spike + trend',
      'Support/resistance flip',
      'Stochastic divergence signal',
    ];
    return {
      id: `sig_${i}`,
      market: m.name,
      base: m.base,
      dir,
      tf: tfs[Math.floor(Math.random() * tfs.length)],
      strength: 60 + Math.floor(Math.random() * 35),
      accuracy: 65 + Math.floor(Math.random() * 25),
      win: Math.floor(Math.random() * 120) + 40,
      total: Math.floor(Math.random() * 60) + 90,
      reason: reasons[Math.floor(Math.random() * reasons.length)],
      generatedAt: Date.now() - Math.floor(Math.random() * 300000),
      expiresIn: Math.floor(Math.random() * 5) + 1,
    };
  });
}

export default function SignalsOverlay() {
  const setOverlay = useStore(s => s.setOverlay);
  const markets = useStore(s => s.markets);
  const setCurrentMarket = useStore(s => s.setCurrentMarket);
  const setAmount = useStore(s => s.setAmount);
  const showToast = useStore(s => s.showToast);
  const amount = useStore(s => s.amount);

  const [signals, setSignals] = useState<Signal[]>([]);
  const [filter, setFilter] = useState<'all' | 'buy' | 'sell'>('all');

  useEffect(() => {
    setSignals(genSignals(markets));
    const iv = setInterval(() => setSignals(genSignals(markets)), 30000);
    return () => clearInterval(iv);
  }, [markets]);

  const filtered = signals.filter(s => filter === 'all' || s.dir === filter);

  function useSignal(sig: Signal) {
    const market = markets.find(m => m.name === sig.market);
    if (market) {
      setCurrentMarket(market);
      showToast(`Signal loaded: ${sig.dir.toUpperCase()} ${sig.base}`);
      setOverlay('none');
    }
  }

  function timeAgo(ts: number) {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return `${s}s ago`;
    return `${Math.floor(s / 60)}m ago`;
  }

  return (
    <div className="overlay-bg" onClick={() => setOverlay('none')}>
      <div className="overlay-sheet" style={{ maxHeight: '88vh' }} onClick={e => e.stopPropagation()}>
        <div className="overlay-handle" />
        <div className="overlay-header">
          <span className="overlay-title">Trade Signals</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 8 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--g0)', display: 'inline-block', boxShadow: '0 0 6px var(--g0)', animation: 'pulseDot 2s infinite' }} />
            <span style={{ fontSize: 11, color: 'var(--g0)', fontWeight: 700 }}>LIVE</span>
          </div>
          <button className="overlay-close" onClick={() => setOverlay('none')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div style={{ padding: '8px 16px 0' }}>
          <div className="signal-filter-row">
            {(['all','buy','sell'] as const).map(f => (
              <div key={f} className={`signal-filter ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </div>
            ))}
            <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--t4)', alignSelf: 'center' }}>
              {filtered.length} signals
            </div>
          </div>
        </div>

        <div className="overlay-body">
          {filtered.map(sig => (
            <div key={sig.id} className="signal-card">
              <div className="signal-header">
                <span className={`signal-dir ${sig.dir}`}>{sig.dir.toUpperCase()}</span>
                <span className="signal-market">{sig.base}</span>
                <span className="signal-tf">{sig.tf}</span>
                <span style={{ fontSize: 10, color: 'var(--t4)' }}>{timeAgo(sig.generatedAt)}</span>
              </div>

              <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 8, fontStyle: 'italic' }}>
                {sig.reason}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: 'var(--t4)', fontWeight: 600 }}>Strength {sig.strength}%</span>
                <span style={{ fontSize: 10, color: 'var(--t4)' }}>Expires in {sig.expiresIn}m</span>
              </div>
              <div className="signal-strength-bar">
                <div className={`signal-strength-fill ${sig.dir}`} style={{ width: `${sig.strength}%` }} />
              </div>

              <div className="signal-metrics">
                <div className="signal-metric">
                  <div className="signal-metric-label">Accuracy</div>
                  <div className="signal-metric-val" style={{ color: 'var(--g0)' }}>{sig.accuracy}%</div>
                </div>
                <div className="signal-metric">
                  <div className="signal-metric-label">Win/Total</div>
                  <div className="signal-metric-val">{sig.win}/{sig.total}</div>
                </div>
                <div className="signal-metric">
                  <div className="signal-metric-label">Timeframe</div>
                  <div className="signal-metric-val">{sig.tf}</div>
                </div>
              </div>

              <div className="signal-btns">
                <button className="signal-btn buy" onClick={() => useSignal(sig)}>
                  Use Signal (BUY)
                </button>
                <button className="signal-btn sell" onClick={() => { setCurrentMarket(markets.find(m => m.name === sig.market)!); setOverlay('none'); }}>
                  Open Market
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
