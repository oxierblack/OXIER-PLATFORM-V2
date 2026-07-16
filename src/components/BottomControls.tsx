import { useState, useCallback, useEffect } from 'react';
import { useStore } from '../lib/store';
import { playOpen, playWin, playLoss, resumeAudio } from '../lib/sounds';
import { fmt } from '../lib/markets';

export default function BottomControls() {
  const amount        = useStore(s => s.amount);
  const setAmount     = useStore(s => s.setAmount);
  const expMin        = useStore(s => s.expMin);
  const expDisp       = useStore(s => s.expDisp);
  const walType       = useStore(s => s.walType);
  const balance       = useStore(s => s.balance);
  const adjustBalance = useStore(s => s.adjustBalance);
  const currentMarket = useStore(s => s.currentMarket);
  const addTrade      = useStore(s => s.addTrade);
  const resolveTrade  = useStore(s => s.resolveTrade);
  const setOverlay    = useStore(s => s.setOverlay);
  const showToast     = useStore(s => s.showToast);
  const soundEnabled  = useStore(s => s.soundEnabled);
  const trades        = useStore(s => s.trades);

  const [lastResult, setLastResult] = useState<{ won: boolean; profit: number; market: string } | null>(null);
  const [trading, setTrading] = useState(false);
  const [, forceTick] = useState(0);

  const openTrades = trades.filter(t => !t.resolved);

  // Tick every second so the nearest-expiry countdown below stays live
  // instead of only updating when something else re-renders the component.
  useEffect(() => {
    if (openTrades.length === 0) return;
    const iv = setInterval(() => forceTick(t => t + 1), 1000);
    return () => clearInterval(iv);
  }, [openTrades.length]);

  const nearestTrade = openTrades.length
    ? openTrades.reduce((a, b) => a.expiryAt < b.expiryAt ? a : b)
    : null;
  const nearestSecsLeft = nearestTrade ? Math.max(0, Math.floor((nearestTrade.expiryAt - Date.now()) / 1000)) : 0;
  const nearestMins = Math.floor(nearestSecsLeft / 60);
  const nearestSecs = nearestSecsLeft % 60;
  const payout     = currentMarket?.payout || 82;
  const profit     = (amount * payout / 100).toFixed(2);
  const bal        = balance();

  const openTrade = useCallback(async (side: 'buy' | 'sell') => {
    resumeAudio();
    if (!currentMarket) { showToast('Select a market first'); return; }
    if (amount <= 0) { showToast('Enter a valid amount'); return; }
    if (amount > bal) {
      showToast(walType === 'demo' ? 'Insufficient demo balance' : 'Add funds to continue');
      if (walType === 'real') setTimeout(() => setOverlay('deposit'), 500);
      return;
    }
    if (trading) return;
    setTrading(true);
    setLastResult(null);

    const now = Date.now();
    const id = `t_${now}_${Math.random().toString(36).slice(2)}`;
    // Use the same live ticker price the user sees on screen (not the
    // stale snapshot from when the market list loaded), so the entry
    // marker lands on the actual current candle instead of drifting.
    const entryPrice = useStore.getState().livePrice ?? currentMarket.price;
    const trade = {
      id, mktId: currentMarket.id, mktName: currentMarket.name,
      side, amount, entry: entryPrice,
      dec: currentMarket.dec, payout,
      walType, openedAt: now,
      expiryAt: now + expMin * 60 * 1000,
      resolved: false,
    };

    addTrade(trade);
    adjustBalance(-amount);
    if (soundEnabled) playOpen();
    showToast(`${side === 'buy' ? '▲ BUY' : '▼ SELL'} opened · ${expDisp} · $${amount}`);

    setTimeout(async () => {
      let exitPrice = useStore.getState().livePrice ?? currentMarket.price;
      try {
        const r = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${currentMarket.symbol}`);
        if (r.ok) { const d = await r.json(); exitPrice = parseFloat(d.price); }
      } catch { /* keep the live price we already have as the fallback */ }

      const priceWent = exitPrice > trade.entry ? 'up' : 'down';
      const won = side === 'buy' ? priceWent === 'up' : priceWent === 'down';
      const p = won ? trade.amount * (payout / 100) : -trade.amount;

      resolveTrade(id, exitPrice, won);
      if (won) adjustBalance(trade.amount + trade.amount * (payout / 100));
      if (soundEnabled) { if (won) playWin(); else playLoss(); }
      setLastResult({ won, profit: p, market: currentMarket.name });
      setTrading(false);
      showToast(won ? `WIN +$${(trade.amount * payout / 100).toFixed(2)}` : `LOSS -$${trade.amount.toFixed(2)}`);
    }, expMin * 60 * 1000);
  }, [currentMarket, amount, bal, walType, expMin, expDisp, payout, soundEnabled, trading]);

  function addRipple(e: React.MouseEvent<HTMLButtonElement>) {
    const btn = e.currentTarget;
    const rip = document.createElement('span');
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    rip.className = 'rip';
    rip.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - rect.left - size/2}px;top:${e.clientY - rect.top - size/2}px`;
    btn.appendChild(rip);
    setTimeout(() => rip.remove(), 600);
  }

  return (
    <div className="bottom-area">
      {/* Trade result card */}
      {lastResult && (
        <div className={`tr-result-card ${lastResult.won ? 'win' : 'loss'}`}>
          <div className="tr-result-header">
            <div className="tr-result-icon">
              {lastResult.won
                ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              }
            </div>
            <div>
              <div className="tr-result-label">{lastResult.won ? '✓ TRADE WON' : '✗ TRADE LOST'}</div>
              <div className="tr-result-sub">{lastResult.market}</div>
            </div>
          </div>
          <div className={`tr-result-amount ${lastResult.won ? 'win' : 'loss'}`}>
            {lastResult.won ? '+' : '-'}${Math.abs(lastResult.profit).toFixed(2)}
          </div>
        </div>
      )}

      {/* Amount + Expiry */}
      <div className="amount-row">
        <div className="amount-display" onClick={() => setOverlay('expiry' as any)}>
          <div>
            <div className="amount-label">Amount</div>
            <div className="amount-val">${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
          </div>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--t4)" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
        </div>

        {/* Quick amount buttons */}
        <div style={{ display:'flex', gap:4 }}>
          {[25,50,100].map(v => (
            <button
              key={v}
              onClick={() => setAmount(v)}
              style={{
                padding:'0 8px', height:'100%', minHeight:48,
                background: amount === v ? 'rgba(0,230,118,.1)' : 'var(--bg2)',
                border:`1px solid ${amount === v ? 'rgba(0,230,118,.3)' : 'var(--border2)'}`,
                borderRadius:'var(--r3)', color: amount === v ? 'var(--g0)' : 'var(--t4)',
                fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit',
                transition:'all .15s',
              }}
            >${v}</button>
          ))}
        </div>

        <div className="expiry-display" onClick={() => setOverlay('expiry' as any)}>
          <div>
            <div className="expiry-label">Expiry</div>
            <div className="expiry-val">{expDisp}</div>
          </div>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--t4)" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      </div>

      {/* Payout info strip */}
      <div style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'4px 2px', marginBottom:8,
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:10, color:'var(--t4)' }}>Payout</span>
          <span style={{ fontSize:12, fontWeight:800, color:'var(--g0)' }}>{payout}%</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:10, color:'var(--t4)' }}>Profit</span>
          <span style={{ fontSize:12, fontWeight:800, color:'var(--g0)', fontFamily:'JetBrains Mono, monospace' }}>+${profit}</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:10, color:'var(--t4)' }}>Balance</span>
          <span style={{ fontSize:12, fontWeight:700, color:'var(--t2)', fontFamily:'JetBrains Mono, monospace' }}>${bal.toFixed(2)}</span>
        </div>
      </div>

      {/* Trade buttons */}
      <div className="trade-btns">
        <button
          className="trade-btn buy"
          onClick={(e) => { addRipple(e); openTrade('buy'); }}
          disabled={trading}
          style={{ opacity: trading ? .6 : 1 }}
        >
          <svg className="trade-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="18 15 12 9 6 15"/>
          </svg>
          <div>
            <div style={{ fontSize:14, fontWeight:900, letterSpacing:.5 }}>BUY UP</div>
            <div className="trade-btn-sub">+${profit}</div>
          </div>
        </button>
        <button
          className="trade-btn sell"
          onClick={(e) => { addRipple(e); openTrade('sell'); }}
          disabled={trading}
          style={{ opacity: trading ? .6 : 1 }}
        >
          <div>
            <div style={{ fontSize:14, fontWeight:900, letterSpacing:.5 }}>SELL DOWN</div>
            <div className="trade-btn-sub">+${profit}</div>
          </div>
          <svg className="trade-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
      </div>

      {/* Active trades indicator */}
      {openTrades.length > 0 && (
        <div style={{
          marginTop:8, display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'6px 8px', borderRadius:'var(--r3)',
          background:'rgba(0,230,118,.05)', border:'1px solid rgba(0,230,118,.12)',
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <div style={{ width:6, height:6, borderRadius:'50%', background:'var(--g0)', boxShadow:'0 0 6px var(--g0)', animation:'pulseDot 1.5s infinite' }} />
            <span style={{ fontSize:11, color:'var(--t3)', fontWeight:600 }}>
              {openTrades.length} active trade{openTrades.length > 1 ? 's' : ''}
            </span>
            {nearestTrade && (
              <span style={{ fontSize:11, color:'var(--g0)', fontWeight:800, fontFamily:'JetBrains Mono, monospace' }}>
                · {nearestMins}:{nearestSecs.toString().padStart(2,'0')}
              </span>
            )}
          </div>
          <span
            style={{ fontSize:11, color:'var(--g0)', fontWeight:700, cursor:'pointer' }}
            onClick={() => setOverlay('history')}
          >View →</span>
        </div>
      )}
    </div>
  );
}
