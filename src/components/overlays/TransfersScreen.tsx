import { useState, useEffect } from 'react';
import { useStore } from '../../lib/store';
import { apiFetch } from '../../lib/api';
import type { Transaction } from '../../types';

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function statusColor(s: string) {
  if (s === 'completed') return 'var(--g0)';
  if (s === 'processing') return '#F59E0B';
  if (s === 'rejected')  return 'var(--red)';
  return '#60A5FA';
}
function statusLabel(s: string) {
  if (s === 'completed')  return 'Completed';
  if (s === 'processing') return 'Processing';
  if (s === 'rejected')   return 'Rejected';
  return 'Pending';
}

export default function TransfersScreen() {
  const setOverlay         = useStore(s => s.setOverlay);
  const showToast          = useStore(s => s.showToast);
  const realBalance        = useStore(s => s.realBalance);
  const setRealBalance     = useStore(s => s.setRealBalance);
  const transactions       = useStore(s => s.transactions);
  const addTransaction     = useStore(s => s.addTransaction);
  const [tab, setTab]      = useState<'history' | 'withdraw'>('history');
  const [method, setMethod]= useState('vodafone');
  const [amount, setAmount]= useState('');
  const [account, setAccount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [filterType, setFilterType] = useState<'all'|'deposit'|'withdrawal'>('all');

  useEffect(() => {
    apiFetch('/api/wallet/transactions')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          data.forEach((t: any) => {
            addTransaction({
              id: t.id || t._id,
              type: t.type === 'withdraw' ? 'withdrawal' : t.type,
              desc: t.description || t.desc || `${t.type} ${t.method || ''}`.trim(),
              amount: t.amount,
              status: t.status,
              date: t.createdAt ? new Date(t.createdAt).getTime() : Date.now(),
              method: t.method,
              currency: t.currency || 'USD',
            });
          });
        }
      })
      .catch(() => {});
  }, []);

  const withdrawMethods = [
    { id:'vodafone', label:'Vodafone Cash' },
    { id:'instapay', label:'InstaPay' },
    { id:'bank',     label:'Bank Wire' },
    { id:'usdt',     label:'USDT TRC20' },
    { id:'btc',      label:'Bitcoin' },
  ];

  const filtered = transactions.filter(tx => filterType === 'all' ? true : tx.type === filterType);

  async function submitWithdraw() {
    const v = parseFloat(amount);
    if (!amount || isNaN(v) || v < 10) { showToast('Minimum withdrawal is $10'); return; }
    if (v > realBalance)               { showToast('Insufficient real balance'); return; }
    if (!account.trim())               { showToast('Enter your account / wallet address'); return; }
    setSubmitting(true);
    try {
      const res = await apiFetch('/api/wallet/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: v, method, account: account.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { showToast(data.message || 'Withdrawal failed'); return; }

      const tx: Transaction = {
        id:     data.id || data.transactionId || `wd_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
        type:   'withdrawal',
        desc:   `${withdrawMethods.find(m => m.id === method)?.label || method} Withdrawal`,
        amount: -v,
        status: 'pending',
        date:   Date.now(),
        method,
        currency: method === 'usdt' ? 'USDT' : method === 'btc' ? 'BTC' : 'USD',
      };
      addTransaction(tx);
      setRealBalance(Math.max(0, realBalance - v));
      showToast('Withdrawal request submitted! Processing in 1–3 business days.');
      setAmount(''); setAccount('');
      setTab('history');
    } catch {
      showToast('Connection error — please try again');
    } finally {
      setSubmitting(false);
    }
  }

  const totalDeposited  = transactions.filter(t => t.type === 'deposit'    && t.status === 'completed').reduce((a, t) => a + Math.abs(t.amount), 0);
  const totalWithdrawn  = transactions.filter(t => t.type === 'withdrawal' && t.status === 'completed').reduce((a, t) => a + Math.abs(t.amount), 0);
  const pendingCount    = transactions.filter(t => t.status === 'pending' || t.status === 'processing').length;

  return (
    <div className="fullscreen">
      <div className="fs-header">
        <button className="fs-back" onClick={() => setOverlay('panel')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <span className="fs-title">Transfers</span>
      </div>

      <div className="fs-body">
        {/* Quick action cards */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:14 }}>
          <div style={{ background:'rgba(0,230,118,.06)', border:'1px solid rgba(0,230,118,.2)', borderRadius:'var(--r2)', padding:14, cursor:'pointer' }} onClick={() => setOverlay('deposit')}>
            <div style={{ fontSize:11, color:'var(--t4)', fontWeight:700, textTransform:'uppercase', letterSpacing:'.4px' }}>Deposit</div>
            <div style={{ fontSize:17, fontWeight:800, color:'var(--g0)', marginTop:4, fontFamily:'JetBrains Mono' }}>+ Add Funds</div>
          </div>
          <div style={{ background:'rgba(59,130,246,.06)', border:'1px solid rgba(59,130,246,.2)', borderRadius:'var(--r2)', padding:14, cursor:'pointer' }} onClick={() => setTab('withdraw')}>
            <div style={{ fontSize:11, color:'var(--t4)', fontWeight:700, textTransform:'uppercase', letterSpacing:'.4px' }}>Withdraw</div>
            <div style={{ fontSize:17, fontWeight:800, color:'#3B82F6', marginTop:4, fontFamily:'JetBrains Mono' }}>${realBalance.toFixed(2)}</div>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:14 }}>
          {[
            { label:'Deposited', val:`$${totalDeposited.toFixed(0)}`, color:'var(--g0)' },
            { label:'Withdrawn', val:`$${totalWithdrawn.toFixed(0)}`, color:'var(--red)' },
            { label:'Pending',   val:String(pendingCount),           color:'#F59E0B' },
          ].map(s => (
            <div key={s.label} style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--r2)', padding:'10px 12px', textAlign:'center' }}>
              <div style={{ fontSize:15, fontWeight:800, color:s.color, fontFamily:'JetBrains Mono' }}>{s.val}</div>
              <div style={{ fontSize:10, color:'var(--t4)', fontWeight:700, marginTop:2, textTransform:'uppercase', letterSpacing:'.3px' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="profile-tabs">
          {(['history','withdraw'] as const).map(t => (
            <button key={t} className={`profile-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)} style={{ fontFamily:'inherit' }}>
              {t === 'history' ? 'Transaction History' : 'Withdraw Funds'}
            </button>
          ))}
        </div>

        {/* ── HISTORY TAB ── */}
        {tab === 'history' && (
          <>
            <div style={{ display:'flex', gap:6, marginBottom:10 }}>
              {(['all','deposit','withdrawal'] as const).map(f => (
                <button key={f} onClick={() => setFilterType(f)}
                  style={{ fontSize:11, padding:'4px 10px', borderRadius:20, border:'1px solid', cursor:'pointer', fontFamily:'inherit', fontWeight:600,
                    borderColor: filterType===f ? 'var(--g0)' : 'var(--border)',
                    background:  filterType===f ? 'rgba(0,230,118,.08)' : 'transparent',
                    color:       filterType===f ? 'var(--g0)' : 'var(--t4)',
                  }}>
                  {f === 'all' ? 'All' : f === 'deposit' ? 'Deposits' : 'Withdrawals'}
                </button>
              ))}
            </div>

            {filtered.length === 0 ? (
              <div style={{ textAlign:'center', padding:'40px 0', color:'var(--t4)' }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin:'0 auto 12px', opacity:.4 }}><path d="M9 17H7A5 5 0 017 7h10a5 5 0 010 10h-2"/><path d="M12 12v5m0 0l-2-2m2 2l2-2"/></svg>
                <div style={{ fontSize:14 }}>No transactions yet</div>
                <div style={{ fontSize:12, marginTop:4 }}>Your deposit &amp; withdrawal history will appear here</div>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {filtered.map(tx => (
                  <TxCard key={tx.id} tx={tx} />
                ))}
              </div>
            )}
          </>
        )}

        {/* ── WITHDRAW TAB ── */}
        {tab === 'withdraw' && (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div style={{ background:'rgba(245,158,11,.06)', border:'1px solid rgba(245,158,11,.2)', borderRadius:'var(--r2)', padding:12, fontSize:12, color:'#F59E0B' }}>
              Available real balance: <strong>${realBalance.toFixed(2)}</strong> · Processing: 1–3 business days
            </div>

            <div className="auth-field">
              <label>Withdrawal Method</label>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {withdrawMethods.map(m => (
                  <div key={m.id} className={`dep-tab ${method === m.id ? 'active' : ''}`}
                    style={{ flex:'0 0 auto', fontSize:12 }}
                    onClick={() => setMethod(m.id)}>
                    {m.label}
                  </div>
                ))}
              </div>
            </div>

            <div className="auth-field">
              <label>Amount (USD)</label>
              <input className="dep-input" type="number" min={10} placeholder="Minimum $10" value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
            <div className="auth-field">
              <label>
                {method === 'bank' ? 'Bank Account / IBAN'
                  : method === 'usdt' ? 'USDT Address (TRC20)'
                  : method === 'btc' ? 'Bitcoin Address'
                  : method === 'instapay' ? 'InstaPay ID'
                  : 'Vodafone Cash Number'}
              </label>
              <input className="auth-input"
                placeholder={method === 'bank' ? 'Enter IBAN or account number' : 'Enter wallet / account address'}
                value={account} onChange={e => setAccount(e.target.value)} />
            </div>

            <div style={{ background:'rgba(255,61,87,.04)', border:'1px solid rgba(255,61,87,.12)', borderRadius:'var(--r2)', padding:'10px 12px', fontSize:12, color:'var(--t3)', lineHeight:1.6 }}>
              <strong style={{ color:'var(--t2)' }}>Important:</strong> Withdrawals are processed within 1–3 business days. Minimum withdrawal is $10. Your real balance must cover the requested amount.
            </div>

            <button className={`auth-btn ${submitting ? 'loading' : ''}`} onClick={submitWithdraw} disabled={submitting}>
              {submitting ? '' : 'Submit Withdrawal Request'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function TxCard({ tx }: { tx: Transaction }) {
  const isIn = tx.amount > 0;
  const typeColor = isIn ? 'var(--g0)' : 'var(--red)';
  const typeBg    = isIn ? 'rgba(0,230,118,.08)' : 'rgba(255,61,87,.08)';

  return (
    <div className="transfer-card" style={{ flexDirection:'column', gap:0, padding:'14px 14px 10px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <div style={{ width:40, height:40, borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', background: typeBg, flexShrink:0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={typeColor} strokeWidth="2">
            {isIn
              ? <><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></>
              : <><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></>
            }
          </svg>
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:14, fontWeight:700, color:'var(--t1)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{tx.desc}</div>
          <div style={{ fontSize:11, color:'var(--t4)', marginTop:2 }}>{formatDate(tx.date)}</div>
        </div>
        <div style={{ textAlign:'right', flexShrink:0 }}>
          <div style={{ fontSize:15, fontWeight:800, color: typeColor, fontFamily:'JetBrains Mono' }}>
            {isIn ? '+' : ''}{Math.abs(tx.amount).toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 })}
            <span style={{ fontSize:10, fontWeight:400, marginLeft:3 }}>{tx.currency || 'USD'}</span>
          </div>
        </div>
      </div>
      <div style={{ marginTop:8, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          {tx.method && <span style={{ fontSize:10, color:'var(--t4)', background:'var(--bg2)', padding:'2px 7px', borderRadius:4, fontWeight:600 }}>{tx.method}</span>}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:5 }}>
          {(tx.status === 'pending' || tx.status === 'processing') && (
            <div className="spinner" style={{ width:10, height:10, borderWidth:1.5, borderColor:'rgba(245,158,11,.2)', borderTopColor:'#F59E0B' }} />
          )}
          <span style={{ fontSize:11, fontWeight:700, color: statusColor(tx.status) }}>{statusLabel(tx.status)}</span>
        </div>
      </div>
    </div>
  );
}
