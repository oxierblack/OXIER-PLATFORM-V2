import { useState, useEffect, useRef } from 'react';
import { useStore } from '../lib/store';
import { getFlagUrl, fmt } from '../lib/markets';
import { playClick, resumeAudio } from '../lib/sounds';
import type { Market } from '../types';

function AssetIcon({ market, size = 24 }: { market: Market; size?: number }) {
  const [err, setErr] = useState(false);
  if (err) {
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%',
        background: `linear-gradient(135deg, #1e3a5f, #2a5a8f)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.35, fontWeight: 700, color: '#fff',
        flexShrink: 0, border: '1px solid rgba(255,255,255,.1)',
      }}>
        {market.base.slice(0, 2)}
      </div>
    );
  }
  return (
    <img
      src={getFlagUrl(market.base)}
      width={size} height={size}
      style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      onError={() => setErr(true)}
    />
  );
}

function MarketsModal({ onClose }: { onClose: () => void }) {
  const markets         = useStore(s => s.markets);
  const currentMarket   = useStore(s => s.currentMarket);
  const setCurrentMarket = useStore(s => s.setCurrentMarket);

  const [search, setSearch] = useState('');
  const [cat, setCat]       = useState('All');
  const cats = ['All', 'Crypto', 'Forex', 'Gold'];

  const filtered = markets.filter(m => {
    const matchCat    = cat === 'All' || m.category === cat;
    const matchSearch = !search
      || m.name.toLowerCase().includes(search.toLowerCase())
      || m.base.toLowerCase().includes(search.toLowerCase())
      || m.symbol.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="markets-modal">
      <div className="markets-header">
        <button className="markets-back" onClick={onClose}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <span className="markets-title">Markets</span>
        <span style={{ fontSize: 11, color: 'var(--t4)', marginLeft: 'auto', fontWeight: 600 }}>
          {filtered.length} pairs
        </span>
      </div>

      <div className="markets-search-wrap">
        <div className="markets-search-wrap-inner">
          <svg className="markets-search-ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            className="markets-search"
            placeholder="Search markets..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
          />
        </div>
      </div>

      <div className="markets-cats">
        {cats.map(c => (
          <div key={c} className={`markets-cat ${cat === c ? 'active' : ''}`} onClick={() => setCat(c)}>
            {c}
          </div>
        ))}
      </div>

      <div className="markets-list">
        {filtered.slice(0, 100).map(m => (
          <div
            key={m.id}
            className={`market-row ${currentMarket?.id === m.id ? 'active' : ''}`}
            onClick={() => { playClick(); setCurrentMarket(m); onClose(); }}
          >
            <AssetIcon market={m} size={38} />
            <div className="market-row-info">
              <div className="market-row-name">{m.base}</div>
              <div className="market-row-sub">{m.name} · {m.category}</div>
            </div>
            <div className="market-row-right">
              <div className="market-row-price">{fmt(m.price, m.dec)}</div>
              <div className={`market-row-change ${m.change >= 0 ? 'up' : 'down'}`}>
                {m.change >= 0 ? '+' : ''}{m.change.toFixed(2)}%
              </div>
            </div>
            <div className="market-row-payout">{m.payout}%</div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--t4)' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>No markets found</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Try a different search term</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AssetBar() {
  const markets         = useStore(s => s.markets);
  const currentMarket   = useStore(s => s.currentMarket);
  const setCurrentMarket = useStore(s => s.setCurrentMarket);
  const trades          = useStore(s => s.trades);
  const expMin          = useStore(s => s.expMin);
  const setLivePrice    = useStore(s => s.setLivePrice);

  const [showMarkets, setShowMarkets] = useState(false);
  const [livePrice, setLivePriceLocal] = useState<number | null>(null);
  const [prevPrice, setPrevPrice]     = useState<number | null>(null);
  const wsRef   = useRef<WebSocket | null>(null);
  const countdown = useRef<NodeJS.Timeout | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);

  const activeTrade = trades.find(t => !t.resolved);

  useEffect(() => {
    if (activeTrade) {
      const update = () => {
        const left = Math.max(0, Math.floor((activeTrade.expiryAt - Date.now()) / 1000));
        setTimeLeft(left);
      };
      update();
      countdown.current = setInterval(update, 1000);
      return () => { if (countdown.current) clearInterval(countdown.current); };
    } else {
      setTimeLeft(expMin * 60);
    }
  }, [activeTrade, expMin]);

  useEffect(() => {
    if (!currentMarket) return;
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    setLivePriceLocal(null);
    useStore.getState().setLivePrice(null);
    const sym = currentMarket.symbol.toLowerCase();
    const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${sym}@trade`);
    ws.onmessage = (e) => {
      const d = JSON.parse(e.data);
      const p = parseFloat(d.p);
      setLivePriceLocal(prev => { setPrevPrice(prev); return p; });
      setLivePrice(p);
    };
    wsRef.current = ws;
    return () => { ws.close(); };
  }, [currentMarket?.symbol]);

  if (!currentMarket) return <div className="assetbar" />;

  const price    = livePrice ?? currentMarket.price;
  const priceDir = livePrice !== null && prevPrice !== null
    ? (livePrice > prevPrice ? 'up' : livePrice < prevPrice ? 'down' : '')
    : '';
  const total = expMin * 60;
  const perc  = total > 0 ? timeLeft / total : 0;
  const circumference = 2 * Math.PI * 13;

  // Show 6 other markets in the quick-scroll bar
  const topMarkets = markets
    .filter(m => m.id !== currentMarket.id)
    .slice(0, 6);

  return (
    <>
      <div className="assetbar">
        {/* Current asset */}
        <div className="asset-pick-btn" onClick={() => { resumeAudio(); playClick(); setShowMarkets(true); }}>
          <AssetIcon market={currentMarket} size={30} />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span className="asset-pick-name">{currentMarket.base}/USDT</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--g0)" strokeWidth="2.5">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className={`asset-pick-price ${priceDir}`}>
                {fmt(price, currentMarket.dec)}
              </span>
              <span className={`asset-pick-change ${currentMarket.change >= 0 ? 'up' : 'down'}`}>
                {currentMarket.change >= 0 ? '+' : ''}{currentMarket.change.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>

        {/* Quick-access markets */}
        <div className="asset-mini-scroll">
          {topMarkets.map(m => (
            <div
              key={m.id}
              className={`asset-mini ${currentMarket.id === m.id ? 'active' : ''}`}
              onClick={() => { playClick(); setCurrentMarket(m); }}
            >
              <AssetIcon market={m} size={20} />
              <div>
                <div className="asset-mini-name">{m.base}</div>
                <div className="asset-mini-price">{fmt(m.price, m.dec)}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Countdown timer */}
        <div className="countdown-wrap">
          <div className="countdown-ring">
            <svg width="38" height="38" viewBox="0 0 38 38">
              <circle className="track" cx="19" cy="19" r="14" />
              <circle
                className="fill"
                cx="19" cy="19" r="14"
                strokeDasharray={`${perc * 2 * Math.PI * 14} ${2 * Math.PI * 14}`}
              />
            </svg>
            <span className="countdown-num">
              {timeLeft >= 3600
                ? `${Math.ceil(timeLeft / 3600)}h`
                : timeLeft >= 60
                ? `${Math.ceil(timeLeft / 60)}m`
                : `${timeLeft}s`}
            </span>
          </div>
        </div>
      </div>

      {showMarkets && <MarketsModal onClose={() => setShowMarkets(false)} />}
    </>
  );
}
