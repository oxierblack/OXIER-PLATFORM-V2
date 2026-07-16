import { create } from 'zustand';
import type { Market, Trade, Transaction, Screen, ActiveOverlay, Theme } from '../types';
import type { TF } from './markets';
import { apiFetch } from './api';

const DEMO_BAL_KEY  = 'ox_demo_bal';
const REAL_BAL_KEY  = 'ox_real_bal';
const TRADES_KEY    = 'ox_trades';
const THEME_KEY     = 'ox_theme';
const TX_KEY        = 'ox_transactions';

interface UserInfo { email: string; name: string; token: string; }
interface IndicatorSettings { [id: string]: Record<string, number>; }

interface StoreState {
  screen: Screen;
  setScreen: (s: Screen) => void;

  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;

  walType: 'demo' | 'real';
  setWalType: (t: 'demo' | 'real') => void;

  demoBalance: number;
  realBalance: number;
  setDemoBalance: (n: number) => void;
  setRealBalance: (n: number) => void;
  balance: () => number;
  adjustBalance: (delta: number, type?: 'demo' | 'real') => void;

  markets: Market[];
  setMarkets: (m: Market[]) => void;
  currentMarket: Market | null;
  setCurrentMarket: (m: Market) => void;

  currentTF: TF;
  setCurrentTF: (tf: TF) => void;

  amount: number;
  setAmount: (n: number) => void;
  expMin: number;
  expDisp: string;
  setExpiry: (min: number, disp: string) => void;

  trades: Trade[];
  addTrade: (t: Trade) => void;
  resolveTrade: (id: string, exit: number, won: boolean) => void;
  earlyCloseTrade: (id: string, exit: number) => void;
  saveTrades: () => void;

  transactions: Transaction[];
  addTransaction: (t: Transaction) => void;
  updateTransactionStatus: (id: string, status: Transaction['status']) => void;

  overlay: ActiveOverlay;
  setOverlay: (o: ActiveOverlay) => void;

  toast: string;
  showToast: (msg: string) => void;

  confirm: { title: string; body: string; onConfirm: () => void } | null;
  showConfirm: (title: string, body: string, onConfirm: () => void) => void;
  closeConfirm: () => void;

  userInfo: UserInfo | null;
  setUserInfo: (u: UserInfo | null) => void;

  activeInds: string[];
  toggleInd: (id: string) => void;

  indicatorSettings: IndicatorSettings;
  setIndicatorParam: (id: string, key: string, value: number) => void;

  chartExpanded: boolean;
  setChartExpanded: (v: boolean) => void;

  pendingDeposit: { method: string; wallet: any; amount: string } | null;
  setPendingDeposit: (d: { method: string; wallet: any; amount: string } | null) => void;

  soundEnabled: boolean;
  setSoundEnabled: (v: boolean) => void;

  openTradePriceLine: { id: string; entry: number; side: 'buy'|'sell' } | null;
  setOpenTradePriceLine: (v: { id: string; entry: number; side: 'buy'|'sell' } | null) => void;
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;

const savedTheme = (localStorage.getItem(THEME_KEY) as Theme) || 'dark';
if (savedTheme === 'light') document.documentElement.classList.add('light');
else document.documentElement.classList.remove('light');

function loadTx(): Transaction[] {
  try { return JSON.parse(localStorage.getItem(TX_KEY) || '[]'); } catch { return []; }
}
function saveTxToLS(txs: Transaction[]) {
  localStorage.setItem(TX_KEY, JSON.stringify(txs));
}

export const useStore = create<StoreState>((set, get) => ({
  screen: 'splash',
  setScreen: (screen) => set({ screen }),

  theme: savedTheme,
  setTheme: (theme) => {
    localStorage.setItem(THEME_KEY, theme);
    if (theme === 'light') document.documentElement.classList.add('light');
    else document.documentElement.classList.remove('light');
    set({ theme });
  },
  toggleTheme: () => {
    const current = get().theme;
    get().setTheme(current === 'dark' ? 'light' : 'dark');
  },

  walType: 'demo',
  setWalType: (walType) => set({ walType }),

  demoBalance: parseFloat(localStorage.getItem(DEMO_BAL_KEY) || '10000'),
  realBalance: parseFloat(localStorage.getItem(REAL_BAL_KEY) || '0'),
  setDemoBalance: (demoBalance) => { localStorage.setItem(DEMO_BAL_KEY, String(demoBalance)); set({ demoBalance }); },
  setRealBalance: (realBalance) => { localStorage.setItem(REAL_BAL_KEY, String(realBalance)); set({ realBalance }); },
  balance: () => get().walType === 'demo' ? get().demoBalance : get().realBalance,
  adjustBalance: (delta, type) => {
    const t = type || get().walType;
    if (t === 'demo') get().setDemoBalance(Math.max(0, get().demoBalance + delta));
    else get().setRealBalance(Math.max(0, get().realBalance + delta));
  },

  markets: [],
  setMarkets: (markets) => set({ markets }),
  currentMarket: null,
  setCurrentMarket: (currentMarket) => set({ currentMarket }),

  currentTF: '1m',
  setCurrentTF: (currentTF) => set({ currentTF }),

  amount: 10,
  setAmount: (amount) => set({ amount }),
  expMin: 1,
  expDisp: '1m',
  setExpiry: (expMin, expDisp) => set({ expMin, expDisp }),

  trades: (() => { try { return JSON.parse(localStorage.getItem(TRADES_KEY) || '[]'); } catch { return []; } })(),
  addTrade: (t) => { set(s => ({ trades: [...s.trades, t] })); get().saveTrades(); },
  resolveTrade: (id, exit, won) => {
    set(s => ({
      trades: s.trades.map(t => t.id === id
        ? { ...t, resolved: true, exit, won, profit: won ? t.amount * (t.payout / 100) : -t.amount, resolvedAt: Date.now() }
        : t),
    }));
    get().saveTrades();
  },
  earlyCloseTrade: (id, exit) => {
    set(s => ({
      trades: s.trades.map(t => t.id === id
        ? { ...t, resolved: true, exit, won: false, earlyClosed: true, profit: -(t.amount / 2), resolvedAt: Date.now() }
        : t),
    }));
    get().saveTrades();
  },
  saveTrades: () => {
    const recent = get().trades.filter(t => !t.resolved || (Date.now() - (t.resolvedAt || 0)) < 86400000 * 7);
    localStorage.setItem(TRADES_KEY, JSON.stringify(recent));
  },

  transactions: loadTx(),
  addTransaction: (tx) => {
    set(s => { const txs = [tx, ...s.transactions]; saveTxToLS(txs); return { transactions: txs }; });
  },
  updateTransactionStatus: (id, status) => {
    set(s => {
      const txs = s.transactions.map(t => t.id === id ? { ...t, status } : t);
      saveTxToLS(txs);
      return { transactions: txs };
    });
  },

  overlay: 'none',
  setOverlay: (overlay) => set({ overlay }),

  toast: '',
  showToast: (msg) => {
    if (toastTimer) clearTimeout(toastTimer);
    set({ toast: msg });
    toastTimer = setTimeout(() => set({ toast: '' }), 2800);
  },

  confirm: null,
  showConfirm: (title, body, onConfirm) => set({ confirm: { title, body, onConfirm } }),
  closeConfirm: () => set({ confirm: null }),

  userInfo: (() => { try { return JSON.parse(localStorage.getItem('ox_user') || 'null'); } catch { return null; } })(),
  setUserInfo: (userInfo) => {
    localStorage.setItem('ox_user', JSON.stringify(userInfo));
    set({ userInfo });
    if (userInfo?.token && userInfo.token !== 'demo') {
      apiFetch('/api/trade/balance').then(r => r.json()).then(data => {
        if (data && typeof data.demoBalance === 'number') {
          localStorage.setItem('ox_demo_bal', String(data.demoBalance));
          set({ demoBalance: data.demoBalance });
        }
        if (data && typeof data.realBalance === 'number') {
          localStorage.setItem('ox_real_bal', String(data.realBalance));
          set({ realBalance: data.realBalance });
        }
      }).catch(() => {});
      apiFetch('/api/trade/history').then(r => r.json()).then(data => {
        if (Array.isArray(data)) {
          const trades: Trade[] = data.map((t: any) => ({
            id: t.id || t._id,
            mktId: t.mktId || t.symbol || '',
            mktName: t.symbol || t.mktName || '',
            side: (t.direction || t.side || 'buy') as 'buy' | 'sell',
            amount: t.amount,
            entry: t.entryPrice || t.entry || 0,
            exit: t.exitPrice || t.exit,
            payout: t.payout || 80,
            dec: t.dec || 2,
            expiryAt: t.expiryAt ? new Date(t.expiryAt).getTime() : (t.settledAt ? new Date(t.settledAt).getTime() : Date.now()),
            openedAt: t.openedAt ? new Date(t.openedAt).getTime() : Date.now(),
            resolvedAt: t.settledAt ? new Date(t.settledAt).getTime() : undefined,
            resolved: !!t.settledAt,
            won: t.result === 'win',
            profit: t.profit,
            walType: (t.walletType || 'real') as 'demo' | 'real',
          }));
          localStorage.setItem('ox_trades', JSON.stringify(trades));
          set({ trades });
        }
      }).catch(() => {});
    }
  },

  activeInds: [],
  toggleInd: (id) => set(s => ({
    activeInds: s.activeInds.includes(id) ? s.activeInds.filter(x => x !== id) : [...s.activeInds, id],
  })),

  indicatorSettings: {},
  setIndicatorParam: (id, key, value) => set(s => ({
    indicatorSettings: { ...s.indicatorSettings, [id]: { ...(s.indicatorSettings[id] || {}), [key]: value } },
  })),

  chartExpanded: false,
  setChartExpanded: (chartExpanded) => set({ chartExpanded }),

  pendingDeposit: null,
  setPendingDeposit: (pendingDeposit) => set({ pendingDeposit }),

  soundEnabled: true,
  setSoundEnabled: (soundEnabled) => set({ soundEnabled }),

  openTradePriceLine: null,
  setOpenTradePriceLine: (openTradePriceLine) => set({ openTradePriceLine }),
}));
