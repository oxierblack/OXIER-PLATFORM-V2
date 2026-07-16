import { useEffect, useState } from 'react';
import { useStore } from '../lib/store';
import { DEFAULT_MARKETS, getDecimals } from '../lib/markets';

export default function SplashScreen() {
  const setScreen        = useStore(s => s.setScreen);
  const setMarkets       = useStore(s => s.setMarkets);
  const setCurrentMarket = useStore(s => s.setCurrentMarket);
  const userInfo         = useStore(s => s.userInfo);
  const [progress, setProgress] = useState(0);
  const [status, setStatus]     = useState('Connecting to markets...');

  useEffect(() => {
    let p = 0;
    const iv = setInterval(() => {
      p = Math.min(p + Math.random() * 8 + 3, 88);
      setProgress(p);
    }, 100);

    async function load() {
      try {
        setStatus('Fetching live prices...');
        // Use our curated DEFAULT_MARKETS list + enrich with live prices from Binance
        const symbols = DEFAULT_MARKETS
          .filter(m => m.category === 'Crypto')
          .map(m => m.symbol);

        const tickers = await fetch('https://api.binance.com/api/v3/ticker/24hr')
          .then(r => r.json())
          .catch(() => []);

        const tickerMap = new Map(
          Array.isArray(tickers) ? tickers.map((t: any) => [t.symbol, t]) : []
        );

        const markets = DEFAULT_MARKETS.map(m => {
          const t: any = tickerMap.get(m.symbol);
          const price = t ? parseFloat(t.lastPrice) || m.price : m.price;
          return {
            ...m,
            price,
            change:   t ? parseFloat(t.priceChangePercent) || 0 : (Math.random() - 0.5) * 4,
            high24:   t ? parseFloat(t.highPrice) || price * 1.02 : price * 1.02,
            low24:    t ? parseFloat(t.lowPrice)  || price * 0.98 : price * 0.98,
            volume24: t ? parseFloat(t.volume) || 0 : 0,
            volume:   t ? parseFloat(t.quoteVolume) || 0 : 0,
            dec:      getDecimals(price),
          };
        });

        setStatus('Preparing platform...');
        setProgress(95);
        setMarkets(markets);
        setCurrentMarket(markets[0]);
        clearInterval(iv);
        await new Promise(r => setTimeout(r, 300));
        setProgress(100);
        await new Promise(r => setTimeout(r, 400));
        setScreen(userInfo ? 'trading' : 'login');
      } catch {
        setStatus('Using demo data...');
        // Fallback — use DEFAULT_MARKETS as-is
        const markets = DEFAULT_MARKETS.map(m => ({
          ...m,
          change:   (Math.random() - 0.5) * 4,
          high24:   m.price * 1.02,
          low24:    m.price * 0.98,
          volume24: Math.random() * 1e7,
          volume:   Math.random() * 1e8,
        }));
        setMarkets(markets);
        setCurrentMarket(markets[0]);
        clearInterval(iv);
        setProgress(100);
        await new Promise(r => setTimeout(r, 300));
        setScreen(userInfo ? 'trading' : 'login');
      }
    }

    load();
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="splash">
      <div className="splash-bg" />
      <div className="splash-grid" />
      <div className="splash-logo-wrap">
        <div className="splash-logo">OX</div>
        <div className="splash-logo-text">OXIER</div>
        <div className="splash-tagline">Professional Trading Platform</div>
      </div>
      <div className="splash-progress-wrap">
        <div className="splash-progress-bar">
          <div className="splash-progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <div className="splash-status">{status}</div>
      </div>
      <div className="splash-version">v3.0.0 · Powered by Binance</div>
    </div>
  );
}
