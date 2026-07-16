// ── Timeframes ─────────────────────────────────────────────────────────────
export const TIMEFRAMES = {
  '5s':  { binance: '1m',  sec: 5,     simOnly: true  },
  '10s': { binance: '1m',  sec: 10,    simOnly: true  },
  '30s': { binance: '1m',  sec: 30,    simOnly: true  },
  '1m':  { binance: '1m',  sec: 60,    simOnly: false },
  '3m':  { binance: '3m',  sec: 180,   simOnly: false },
  '5m':  { binance: '5m',  sec: 300,   simOnly: false },
  '15m': { binance: '15m', sec: 900,   simOnly: false },
  '30m': { binance: '30m', sec: 1800,  simOnly: false },
  '1h':  { binance: '1h',  sec: 3600,  simOnly: false },
  '2h':  { binance: '2h',  sec: 7200,  simOnly: false },
  '4h':  { binance: '4h',  sec: 14400, simOnly: false },
} as const;

export type TF = keyof typeof TIMEFRAMES;

// Short timeframes that use simulated data (Binance doesn't support these natively)
export const SHORT_TFS: TF[] = ['5s', '10s', '30s'];

export function getDecimals(price: number): number {
  if (price >= 10000) return 2;
  if (price >= 100)   return 2;
  if (price >= 10)    return 3;
  if (price >= 1)     return 4;
  if (price >= 0.1)   return 5;
  if (price >= 0.01)  return 6;
  return 8;
}

export function getCategory(base: string): 'Crypto' | 'Forex' | 'Gold' | 'Stocks' {
  const goldBases = ['PAXG', 'XAUT'];
  const forexBases = ['EUR','GBP','AUD','CAD','CHF','JPY','NZD','TRY','BRL','MXN','SGD','HKD','NOK','SEK','DKK','PLN','CZK'];
  if (goldBases.includes(base)) return 'Gold';
  if (forexBases.includes(base)) return 'Forex';
  return 'Crypto';
}

export function getFlagColor(base: string): string {
  const map: Record<string, string> = {
    'BTC':'#F7931A','ETH':'#627EEA','BNB':'#F0B90B','SOL':'#9945FF','XRP':'#346AA9',
    'ADA':'#0033AD','DOGE':'#C2A633','DOT':'#E6007A','MATIC':'#8247E5','LTC':'#BFBBBB',
    'TRX':'#FF0013','AVAX':'#E84142','LINK':'#2A5ADA','ATOM':'#2E3148','UNI':'#FF007A',
    'EUR':'#003399','GBP':'#012169','AUD':'#00008B','CAD':'#FF0000','JPY':'#BC002D',
    'PAXG':'#E2A23B','XAUT':'#D4AF37','TON':'#0088CC','SUI':'#4CA2FF','ARB':'#28A0F0',
    'OP':'#FF0420','INJ':'#00B2FF','APT':'#B3B3B3','NEAR':'#000000','FTM':'#1969FF',
    'SAND':'#04ADEF','MANA':'#FF2D55','AXS':'#0055D5','CHZ':'#CD0124','ENJ':'#7866D5',
    'VET':'#15BDFF','ALGO':'#000000','THETA':'#2AB8E6','FIL':'#0090FF','EGLD':'#23F7DD',
    'XLM':'#14B6E7','IOTA':'#131F37','ZEC':'#ECB244','XMR':'#FF6600','DASH':'#008CE7',
  };
  return map[base] || '#2a3a5e';
}

const overrides: Record<string, string> = {
  'ton':    'https://i.ibb.co/S4RSYZjM/image.png',
  'xlm':    'https://i.ibb.co/k2v65TWY/image.png',
  'hmstr':  'https://i.ibb.co/3ynGyxFd/image.png',
  'jto':    'https://i.ibb.co/xSmTQrKx/image.png',
};

export function getFlagUrl(base: string): string {
  const lower = base.toLowerCase();
  if (overrides[lower]) return overrides[lower];
  return `https://assets.coincap.io/assets/icons/${lower}@2x.png`;
}

export function fmt(n: number, d = 2): string {
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function fmtP(n: number, d = 3): string {
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

export async function fetchBinanceKlines(symbol: string, interval: string, limit = 500) {
  const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
  if (!res.ok) throw new Error('Binance API: ' + res.status);
  const data = await res.json();
  return data.map((d: any[]) => ({
    time: d[0] / 1000,
    open: parseFloat(d[1]),
    high: parseFloat(d[2]),
    low:  parseFloat(d[3]),
    close: parseFloat(d[4]),
    volume: parseFloat(d[5]),
  }));
}

// Generate high-quality simulated candle data for any timeframe
export function genSimData(price: number, tf: TF, count = 500) {
  const bars: any[] = [];
  let p = price || 1000;
  const now = Math.floor(Date.now() / 1000);
  const step = TIMEFRAMES[tf].sec;
  const volatility = step <= 10 ? 0.003 : step <= 60 ? 0.006 : step <= 300 ? 0.010 : 0.018;

  for (let i = count - 1; i >= 0; i--) {
    const t = now - i * step;
    const open = p;
    const chg = (Math.random() - 0.48) * p * volatility;
    const close = Math.max(p * 0.001, p + chg);
    const range = Math.abs(chg) * (0.3 + Math.random() * 0.7);
    const high = Math.max(open, close) + range * 0.5;
    const low  = Math.min(open, close) - range * 0.5;
    bars.push({ time: t, open, high, low, close, volume: Math.random() * 1e6 * (price / 1000) });
    p = close;
  }
  return bars;
}

// Generate short-timeframe data by sub-dividing 1m candles
export function genShortTFData(baseBars: any[], tfSec: number) {
  const result: any[] = [];
  const stepsPerMinute = Math.floor(60 / tfSec);

  for (const bar of baseBars) {
    const priceRange = bar.high - bar.low;
    let p = bar.open;

    for (let i = 0; i < stepsPerMinute; i++) {
      const t = bar.time + i * tfSec;
      const isLast = i === stepsPerMinute - 1;
      const close = isLast ? bar.close : p + (Math.random() - 0.47) * priceRange * 0.3;
      const high = Math.max(p, close) + Math.random() * priceRange * 0.1;
      const low = Math.min(p, close) - Math.random() * priceRange * 0.1;
      result.push({ time: t, open: p, high: Math.min(high, bar.high), low: Math.max(low, bar.low), close, volume: bar.volume / stepsPerMinute });
      p = close;
    }
  }
  return result;
}

// ── Indicator calculations ─────────────────────────────────────────────────

export function calcRSI(bars: any[], period = 14): any[] {
  const closes = bars.map(b => b.close);
  const result: any[] = [];
  for (let i = period; i < closes.length; i++) {
    let gains = 0, losses = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const d = closes[j] - closes[j - 1];
      if (d > 0) gains += d; else losses += Math.abs(d);
    }
    const rs = losses === 0 ? 100 : gains / losses;
    result.push({ time: bars[i].time, value: 100 - 100 / (1 + rs) });
  }
  return result;
}

export function calcMACD(bars: any[]): { macd: any[]; signal: any[]; hist: any[] } {
  const closes = bars.map(b => b.close);
  function ema(data: number[], period: number): number[] {
    const k = 2 / (period + 1);
    const result = [data[0]];
    for (let i = 1; i < data.length; i++) result.push(data[i] * k + result[i - 1] * (1 - k));
    return result;
  }
  const e12 = ema(closes, 12);
  const e26 = ema(closes, 26);
  const macdLine = e12.map((v, i) => v - e26[i]);
  const signalLine = ema(macdLine.slice(26), 9);
  const macd: any[] = [], signal: any[] = [], hist: any[] = [];
  for (let i = 26; i < bars.length; i++) {
    const si = i - 26;
    macd.push({ time: bars[i].time, value: macdLine[i] });
    if (si >= 9) {
      const sv = signalLine[si - 9];
      signal.push({ time: bars[i].time, value: sv });
      hist.push({ time: bars[i].time, value: macdLine[i] - sv, color: macdLine[i] - sv >= 0 ? '#00E676' : '#FF3D57' });
    }
  }
  return { macd, signal, hist };
}

export function calcBB(bars: any[], period = 20, mult = 2): { upper: any[]; lower: any[]; mid: any[] } {
  const upper: any[] = [], lower: any[] = [], mid: any[] = [];
  for (let i = period - 1; i < bars.length; i++) {
    const slice = bars.slice(i - period + 1, i + 1).map(b => b.close);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const std = Math.sqrt(slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period);
    upper.push({ time: bars[i].time, value: mean + mult * std });
    lower.push({ time: bars[i].time, value: mean - mult * std });
    mid.push({ time: bars[i].time, value: mean });
  }
  return { upper, lower, mid };
}

export function calcEMA(bars: any[], period = 20): any[] {
  const k = 2 / (period + 1);
  const result: any[] = [{ time: bars[0].time, value: bars[0].close }];
  for (let i = 1; i < bars.length; i++) {
    result.push({ time: bars[i].time, value: bars[i].close * k + result[i - 1].value * (1 - k) });
  }
  return result.slice(period);
}

export function calcSMA(bars: any[], period = 20): any[] {
  const result: any[] = [];
  for (let i = period - 1; i < bars.length; i++) {
    const slice = bars.slice(i - period + 1, i + 1);
    result.push({ time: bars[i].time, value: slice.reduce((a, b) => a + b.close, 0) / period });
  }
  return result;
}

export function calcCCI(bars: any[], period = 14): any[] {
  const result: any[] = [];
  for (let i = period - 1; i < bars.length; i++) {
    const slice = bars.slice(i - period + 1, i + 1);
    const tp = slice.map(b => (b.high + b.low + b.close) / 3);
    const mean = tp.reduce((a, b) => a + b, 0) / period;
    const mad = tp.reduce((a, b) => a + Math.abs(b - mean), 0) / period;
    result.push({ time: bars[i].time, value: mad === 0 ? 0 : (tp[tp.length - 1] - mean) / (0.015 * mad) });
  }
  return result;
}

export function calcATR(bars: any[], period = 14): any[] {
  const result: any[] = [];
  for (let i = 1; i < bars.length; i++) {
    const tr = Math.max(
      bars[i].high - bars[i].low,
      Math.abs(bars[i].high - bars[i - 1].close),
      Math.abs(bars[i].low - bars[i - 1].close)
    );
    result.push({ time: bars[i].time, value: tr });
  }
  const atr: any[] = [{ time: result[0].time, value: result[0].value }];
  const k = 1 / period;
  for (let i = 1; i < result.length; i++) {
    atr.push({ time: result[i].time, value: result[i].value * k + atr[i - 1].value * (1 - k) });
  }
  return atr.slice(period);
}

export function calcStoch(bars: any[], period = 14): { k: any[]; d: any[] } {
  const k: any[] = [], d: any[] = [];
  for (let i = period - 1; i < bars.length; i++) {
    const slice = bars.slice(i - period + 1, i + 1);
    const low = Math.min(...slice.map(b => b.low));
    const high = Math.max(...slice.map(b => b.high));
    k.push({ time: bars[i].time, value: high === low ? 50 : ((bars[i].close - low) / (high - low)) * 100 });
  }
  for (let i = 2; i < k.length; i++) {
    d.push({ time: k[i].time, value: (k[i].value + k[i - 1].value + k[i - 2].value) / 3 });
  }
  return { k, d };
}

export function calcWilliams(bars: any[], period = 14): any[] {
  const result: any[] = [];
  for (let i = period - 1; i < bars.length; i++) {
    const slice = bars.slice(i - period + 1, i + 1);
    const high = Math.max(...slice.map(b => b.high));
    const low  = Math.min(...slice.map(b => b.low));
    result.push({ time: bars[i].time, value: high === low ? -50 : ((high - bars[i].close) / (high - low)) * -100 });
  }
  return result;
}

export function calcVolume(bars: any[]): any[] {
  return bars.map(b => ({ time: b.time, value: b.volume, color: b.close >= b.open ? 'rgba(0,230,118,.6)' : 'rgba(255,61,87,.6)' }));
}

// ── Extended markets list ──────────────────────────────────────────────────
export const DEFAULT_MARKETS = [
  // ── Crypto – Major ────────────────────────────────────────────────────
  { id:'btc',   symbol:'BTCUSDT',   base:'BTC',   name:'Bitcoin',        category:'Crypto', payout:82, price:67500, dec:2 },
  { id:'eth',   symbol:'ETHUSDT',   base:'ETH',   name:'Ethereum',       category:'Crypto', payout:82, price:3500,  dec:2 },
  { id:'bnb',   symbol:'BNBUSDT',   base:'BNB',   name:'BNB',            category:'Crypto', payout:80, price:605,   dec:2 },
  { id:'sol',   symbol:'SOLUSDT',   base:'SOL',   name:'Solana',         category:'Crypto', payout:84, price:172,   dec:2 },
  { id:'xrp',   symbol:'XRPUSDT',   base:'XRP',   name:'XRP',            category:'Crypto', payout:82, price:0.52,  dec:4 },
  { id:'ada',   symbol:'ADAUSDT',   base:'ADA',   name:'Cardano',        category:'Crypto', payout:80, price:0.44,  dec:4 },
  { id:'doge',  symbol:'DOGEUSDT',  base:'DOGE',  name:'Dogecoin',       category:'Crypto', payout:80, price:0.165, dec:4 },
  { id:'dot',   symbol:'DOTUSDT',   base:'DOT',   name:'Polkadot',       category:'Crypto', payout:80, price:7.2,   dec:3 },
  { id:'link',  symbol:'LINKUSDT',  base:'LINK',  name:'Chainlink',      category:'Crypto', payout:82, price:14.5,  dec:3 },
  { id:'avax',  symbol:'AVAXUSDT',  base:'AVAX',  name:'Avalanche',      category:'Crypto', payout:82, price:38,    dec:3 },
  { id:'atom',  symbol:'ATOMUSDT',  base:'ATOM',  name:'Cosmos',         category:'Crypto', payout:80, price:9.2,   dec:3 },
  { id:'uni',   symbol:'UNIUSDT',   base:'UNI',   name:'Uniswap',        category:'Crypto', payout:80, price:7.8,   dec:3 },
  { id:'ltc',   symbol:'LTCUSDT',   base:'LTC',   name:'Litecoin',       category:'Crypto', payout:80, price:84,    dec:2 },
  { id:'trx',   symbol:'TRXUSDT',   base:'TRX',   name:'TRON',           category:'Crypto', payout:80, price:0.125, dec:4 },
  { id:'matic', symbol:'MATICUSDT', base:'MATIC', name:'Polygon',        category:'Crypto', payout:82, price:0.72,  dec:4 },

  // ── Crypto – Mid Cap ──────────────────────────────────────────────────
  { id:'sui',   symbol:'SUIUSDT',   base:'SUI',   name:'Sui',            category:'Crypto', payout:84, price:4.2,   dec:4 },
  { id:'arb',   symbol:'ARBUSDT',   base:'ARB',   name:'Arbitrum',       category:'Crypto', payout:82, price:1.15,  dec:4 },
  { id:'op',    symbol:'OPUSDT',    base:'OP',    name:'Optimism',       category:'Crypto', payout:82, price:2.1,   dec:4 },
  { id:'inj',   symbol:'INJUSDT',   base:'INJ',   name:'Injective',      category:'Crypto', payout:84, price:28,    dec:3 },
  { id:'apt',   symbol:'APTUSDT',   base:'APT',   name:'Aptos',          category:'Crypto', payout:82, price:10.5,  dec:3 },
  { id:'near',  symbol:'NEARUSDT',  base:'NEAR',  name:'NEAR Protocol',  category:'Crypto', payout:82, price:5.8,   dec:3 },
  { id:'ftm',   symbol:'FTMUSDT',   base:'FTM',   name:'Fantom',         category:'Crypto', payout:82, price:0.72,  dec:4 },
  { id:'sand',  symbol:'SANDUSDT',  base:'SAND',  name:'The Sandbox',    category:'Crypto', payout:80, price:0.48,  dec:4 },
  { id:'mana',  symbol:'MANAUSDT',  base:'MANA',  name:'Decentraland',   category:'Crypto', payout:80, price:0.42,  dec:4 },
  { id:'axs',   symbol:'AXSUSDT',   base:'AXS',   name:'Axie Infinity',  category:'Crypto', payout:82, price:8.5,   dec:3 },
  { id:'chz',   symbol:'CHZUSDT',   base:'CHZ',   name:'Chiliz',         category:'Crypto', payout:80, price:0.082, dec:4 },
  { id:'enj',   symbol:'ENJUSDT',   base:'ENJ',   name:'Enjin Coin',     category:'Crypto', payout:80, price:0.35,  dec:4 },
  { id:'ton',   symbol:'TONUSDT',   base:'TON',   name:'Toncoin',        category:'Crypto', payout:82, price:5.5,   dec:3 },
  { id:'xlm',   symbol:'XLMUSDT',   base:'XLM',   name:'Stellar',        category:'Crypto', payout:80, price:0.115, dec:4 },
  { id:'vet',   symbol:'VETUSDT',   base:'VET',   name:'VeChain',        category:'Crypto', payout:80, price:0.033, dec:5 },
  { id:'algo',  symbol:'ALGOUSDT',  base:'ALGO',  name:'Algorand',       category:'Crypto', payout:80, price:0.175, dec:4 },
  { id:'fil',   symbol:'FILUSDT',   base:'FIL',   name:'Filecoin',       category:'Crypto', payout:82, price:5.8,   dec:3 },
  { id:'egld',  symbol:'EGLDUSDT',  base:'EGLD',  name:'MultiversX',     category:'Crypto', payout:82, price:40,    dec:3 },
  { id:'theta', symbol:'THETAUSDT', base:'THETA', name:'Theta Network',  category:'Crypto', payout:80, price:2.1,   dec:3 },
  { id:'icp',   symbol:'ICPUSDT',   base:'ICP',   name:'Internet Comp.', category:'Crypto', payout:82, price:12.5,  dec:3 },
  { id:'xmr',   symbol:'XMRUSDT',   base:'XMR',   name:'Monero',         category:'Crypto', payout:80, price:155,   dec:2 },
  { id:'aave',  symbol:'AAVEUSDT',  base:'AAVE',  name:'Aave',           category:'Crypto', payout:82, price:92,    dec:2 },
  { id:'mkr',   symbol:'MKRUSDT',   base:'MKR',   name:'Maker',          category:'Crypto', payout:82, price:2200,  dec:2 },

  // ── Forex ─────────────────────────────────────────────────────────────
  { id:'eurusd', symbol:'EURUSDT',  base:'EUR', name:'EUR/USD',  category:'Forex', payout:78, price:1.085,  dec:4 },
  { id:'gbpusd', symbol:'GBPUSDT',  base:'GBP', name:'GBP/USD',  category:'Forex', payout:78, price:1.265,  dec:4 },
  { id:'audusd', symbol:'AUDUSDT',  base:'AUD', name:'AUD/USD',  category:'Forex', payout:78, price:0.653,  dec:4 },
  { id:'usdjpy', symbol:'USDUSDT',  base:'JPY', name:'USD/JPY',  category:'Forex', payout:78, price:149.5,  dec:2 },
  { id:'usdcad', symbol:'USDUSDT',  base:'CAD', name:'USD/CAD',  category:'Forex', payout:78, price:1.355,  dec:4 },
  { id:'usdchf', symbol:'USDUSDT',  base:'CHF', name:'USD/CHF',  category:'Forex', payout:78, price:0.905,  dec:4 },
  { id:'nzdusd', symbol:'USDUSDT',  base:'NZD', name:'NZD/USD',  category:'Forex', payout:78, price:0.607,  dec:4 },

  // ── Gold ──────────────────────────────────────────────────────────────
  { id:'paxg',  symbol:'PAXGUSDT',  base:'PAXG', name:'Gold (PAXG)', category:'Gold', payout:76, price:2340, dec:2 },
  { id:'xaut',  symbol:'XAUTUSDT',  base:'XAUT', name:'Gold (XAUT)', category:'Gold', payout:76, price:2340, dec:2 },
];
