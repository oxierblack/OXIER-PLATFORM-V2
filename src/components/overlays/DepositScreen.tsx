import { useState, useRef } from 'react';
import { useStore } from '../../lib/store';
import { apiFetch } from '../../lib/api';
import type { Transaction } from '../../types';

const WALLETS = [
  { id: 'vodafone',  name: 'Vodafone Cash',   logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Vodafone_icon.svg/240px-Vodafone_icon.svg.png', min: 1000, currency: 'EGP', number: '01001234567', fee: '0%' },
  { id: 'instapay',  name: 'InstaPay',         logo: 'https://www.instapay.egypt.net/site/img/logo/instapay-full-logo.svg', min: 1000, currency: 'EGP', number: 'oxier@instapay', fee: '0%' },
  { id: 'fawry',     name: 'Fawry',            logo: 'https://logos-download.com/wp-content/uploads/2022/04/Fawry_Logo.png', min: 1000, currency: 'EGP', number: '5555-OXIER', fee: '1%' },
  { id: 'etisalat',  name: 'Etisalat Cash',    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/Etisalat_Logo.svg/240px-Etisalat_Logo.svg.png', min: 1000, currency: 'EGP', number: '01101234567', fee: '0%' },
];

const CRYPTO = [
  { id: 'usdt-trc20', name: 'USDT (TRC20)', symbol: 'USDT', network: 'Tron',     min: 10,     color: '#26A17B', address: 'TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE' },
  { id: 'usdt-erc20', name: 'USDT (ERC20)', symbol: 'USDT', network: 'Ethereum', min: 20,     color: '#26A17B', address: '0x742d35Cc6634C0532925a3b8D4C98A948e0e7fC2' },
  { id: 'btc',        name: 'Bitcoin',      symbol: 'BTC',  network: 'Bitcoin',  min: 0.0001, color: '#F7931A', address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh' },
  { id: 'eth',        name: 'Ethereum',     symbol: 'ETH',  network: 'Ethereum', min: 0.005,  color: '#627EEA', address: '0x742d35Cc6634C0532925a3b8D4C98A948e0e7fC2' },
];

const BONUS_TIERS = [
  { pct: 20,  name: 'Starter', range: '1,000–2,999 EGP' },
  { pct: 50,  name: 'Premium', range: '3,000–9,999 EGP' },
  { pct: 100, name: 'VIP',     range: '10,000+ EGP' },
];

type DepStep = 'select' | 'amount' | 'confirm' | 'address' | 'submitted';

export default function DepositScreen() {
  const setOverlay      = useStore(s => s.setOverlay);
  const showToast       = useStore(s => s.showToast);
  const addTransaction  = useStore(s => s.addTransaction);

  const [tab, setTab]               = useState<'ewallet' | 'crypto'>('ewallet');
  const [step, setStep]             = useState<DepStep>('select');
  const [selectedWallet, setSelectedWallet] = useState<typeof WALLETS[0] | null>(null);
  const [selectedCrypto, setSelectedCrypto] = useState<typeof CRYPTO[0] | null>(null);
  const [amount, setAmount]         = useState('');
  const [bonus, setBonus]           = useState(BONUS_TIERS[0]);
  const [receiptFile, setReceiptFile]   = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied]         = useState(false);
  const [txId, setTxId]             = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const isCrypto = tab === 'crypto';
  const selected = isCrypto ? selectedCrypto : selectedWallet;
  const minAmt   = isCrypto ? (selectedCrypto?.min || 10) : (selectedWallet?.min || 1000);
  const currency = isCrypto ? selectedCrypto?.symbol : 'EGP';
  const address  = isCrypto ? selectedCrypto?.address : selectedWallet?.number;

  function pickBonus(amt: number) {
    if (amt >= 10000) setBonus(BONUS_TIERS[2]);
    else if (amt >= 3000) setBonus(BONUS_TIERS[1]);
    else setBonus(BONUS_TIERS[0]);
  }

  function handleAmtChange(v: string) { setAmount(v); if (v && !isCrypto) pickBonus(parseFloat(v)); }

  function goToConfirm() {
    const v = parseFloat(amount);
    if (!amount || isNaN(v)) { showToast('Enter a valid amount'); return; }
    if (v < minAmt) { showToast(`Minimum deposit is ${minAmt.toLocaleString()} ${currency}`); return; }
    setStep('confirm');
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setReceiptFile(f);
    setReceiptPreview(URL.createObjectURL(f));
  }

  async function confirmDeposit() {
    if (!receiptFile) { showToast('Please upload your payment receipt first'); return; }
    setSubmitting(true);

    const methodName = isCrypto
      ? `${selectedCrypto?.name} (${selectedCrypto?.network})`
      : selectedWallet?.name || '';

    try {
      const form = new FormData();
      form.append('amount', amount);
      form.append('method', methodName);
      form.append('currency', currency || 'EGP');
      form.append('proof', receiptFile);

      const res = await apiFetch('/api/wallet/deposit', { method: 'POST', body: form });
      const data = await res.json().catch(() => ({}));

      const id = data.id || data.transactionId || `dep_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      setTxId(id);

      const tx: Transaction = {
        id,
        type: 'deposit',
        desc: `${methodName} Deposit`,
        amount: parseFloat(amount),
        status: 'processing',
        date: Date.now(),
        method: methodName,
        currency: currency || 'EGP',
      };
      addTransaction(tx);
      setStep('submitted');
    } catch {
      showToast('Connection error — please try again');
    } finally {
      setSubmitting(false);
    }
  }

  async function copyAddress() {
    if (!address) return;
    await navigator.clipboard.writeText(address).catch(() => {});
    setCopied(true);
    showToast('Address copied!');
    setTimeout(() => setCopied(false), 2000);
  }

  function reset() {
    setStep('select'); setSelectedWallet(null); setSelectedCrypto(null);
    setAmount(''); setReceiptFile(null); setReceiptPreview(null); setTxId('');
  }

  const stepTitle: Record<DepStep, string> = {
    select: 'Deposit Funds', amount: `Deposit — ${selected?.name || ''}`,
    confirm: 'Confirm Deposit', address: 'Payment Details', submitted: 'Deposit Submitted',
  };

  return (
    <div className="overlay-bg" onClick={() => setOverlay('none')}>
      <div className="overlay-sheet" style={{ maxHeight: '92vh' }} onClick={e => e.stopPropagation()}>
        <div className="overlay-handle" />
        <div className="overlay-header">
          <button
            style={{ background:'none', border:'none', color:'var(--t3)', cursor:'pointer', display:'flex', padding:4 }}
            onClick={step === 'select' || step === 'submitted' ? () => setOverlay('none') : reset}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <span className="overlay-title">{stepTitle[step]}</span>
          <button className="overlay-close" onClick={() => setOverlay('none')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="overlay-body">

          {/* ── STEP 1: SELECT METHOD ── */}
          {step === 'select' && (
            <>
              <div className="deposit-tabs">
                <div className={`dep-tab ${tab === 'ewallet' ? 'active' : ''}`} onClick={() => setTab('ewallet')}>E-Wallets (EGP)</div>
                <div className={`dep-tab ${tab === 'crypto' ? 'active' : ''}`} onClick={() => setTab('crypto')}>Crypto</div>
              </div>
              {tab === 'ewallet' && (
                <>
                  <div style={{ padding:'4px 0 2px', fontSize:11, color:'var(--t4)', fontWeight:700, letterSpacing:'.5px', textTransform:'uppercase' }}>Min. 1,000 EGP — Instant credit</div>
                  <div className="wallet-grid">
                    {WALLETS.map(w => (
                      <div key={w.id} className={`wallet-card ${selectedWallet?.id === w.id ? 'active' : ''}`}
                        onClick={() => { setSelectedWallet(w); setStep('amount'); }}>
                        <img src={w.logo} className="wallet-img" onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
                        <div className="wallet-name">{w.name}</div>
                        <div className="wallet-min">Min {w.min.toLocaleString()} {w.currency}</div>
                        {w.fee !== '0%' && <div style={{ fontSize:10, color:'#F59E0B' }}>Fee: {w.fee}</div>}
                      </div>
                    ))}
                  </div>
                </>
              )}
              {tab === 'crypto' && (
                <>
                  <div style={{ padding:'4px 0 2px', fontSize:11, color:'var(--t4)', fontWeight:700, letterSpacing:'.5px', textTransform:'uppercase' }}>Min. $10 — Credit after 1 confirmation</div>
                  <div className="crypto-list">
                    {CRYPTO.map(c => (
                      <div key={c.id} className={`crypto-card ${selectedCrypto?.id === c.id ? 'active' : ''}`}
                        onClick={() => { setSelectedCrypto(c); setStep('address'); }}>
                        <div className="crypto-ico" style={{ background: c.color }}>{c.symbol.slice(0,1)}</div>
                        <div>
                          <div className="crypto-name">{c.name}</div>
                          <div className="crypto-min">Network: {c.network} · Min: {c.min} {c.symbol}</div>
                        </div>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--t4)" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {/* ── STEP 2: AMOUNT ── */}
          {step === 'amount' && selectedWallet && (
            <>
              <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--r2)', padding:14, display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:11, color:'var(--t4)', fontWeight:700 }}>METHOD</div>
                  <div style={{ fontSize:14, fontWeight:700, color:'var(--t1)', marginTop:2 }}>{selectedWallet.name}</div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:11, color:'var(--t4)', fontWeight:700 }}>SEND TO</div>
                  <div style={{ fontSize:13, fontFamily:'JetBrains Mono', color:'var(--g0)', marginTop:2 }}>{selectedWallet.number}</div>
                </div>
              </div>
              <div className="auth-field">
                <label>Amount (EGP)</label>
                <input className="dep-input" type="number" min={selectedWallet.min}
                  placeholder={`Min ${selectedWallet.min.toLocaleString()} EGP`}
                  value={amount} onChange={e => handleAmtChange(e.target.value)} />
              </div>
              <div className="bonus-section">
                <div className="bonus-title">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight:6, verticalAlign:'middle' }}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                  Deposit Bonus
                </div>
                <div className="bonus-tiers">
                  {BONUS_TIERS.map(t => (
                    <div key={t.name} className={`bonus-tier ${bonus.name === t.name ? 'active' : ''}`} onClick={() => setBonus(t)}>
                      <div className="bonus-tier-pct">+{t.pct}%</div>
                      <div className="bonus-tier-name">{t.name}</div>
                      <div className="bonus-tier-range">{t.range}</div>
                    </div>
                  ))}
                </div>
                {amount && parseFloat(amount) >= 1000 && (
                  <div style={{ marginTop:10, padding:'8px 10px', background:'rgba(245,158,11,.06)', borderRadius:8, fontSize:12, color:'#F59E0B' }}>
                    You receive: {parseFloat(amount).toLocaleString()} + {Math.round(parseFloat(amount)*bonus.pct/100).toLocaleString()} bonus = <strong>{Math.round(parseFloat(amount)*(1+bonus.pct/100)).toLocaleString()} EGP</strong>
                  </div>
                )}
              </div>
              <button className="auth-btn" onClick={goToConfirm}>Continue</button>
            </>
          )}

          {/* ── STEP 3: CONFIRM SUMMARY ── */}
          {step === 'confirm' && selectedWallet && (
            <>
              <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--r2)', padding:16, marginBottom:8 }}>
                <div style={{ fontSize:13, fontWeight:700, color:'var(--t3)', marginBottom:12 }}>DEPOSIT SUMMARY</div>
                {[
                  { label:'Method',       val: selectedWallet.name },
                  { label:'Amount',       val: `${parseFloat(amount).toLocaleString()} EGP` },
                  { label:'Bonus',        val: `+${bonus.pct}% (${Math.round(parseFloat(amount)*bonus.pct/100).toLocaleString()} EGP)` },
                  { label:'Total Credit', val: `${Math.round(parseFloat(amount)*(1+bonus.pct/100)).toLocaleString()} EGP`, highlight: true },
                ].map(row => (
                  <div key={row.label} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:'1px solid var(--border)' }}>
                    <span style={{ fontSize:13, color:'var(--t4)' }}>{row.label}</span>
                    <span style={{ fontSize:13, fontWeight:700, color: row.highlight ? 'var(--g0)' : 'var(--t1)' }}>{row.val}</span>
                  </div>
                ))}
              </div>
              <button className="auth-btn" onClick={() => setStep('address')}>Proceed to Payment</button>
            </>
          )}

          {/* ── STEP 4: PAYMENT ADDRESS + RECEIPT UPLOAD ── */}
          {step === 'address' && (
            <>
              <div style={{ background:'rgba(0,230,118,.06)', border:'1px solid rgba(0,230,118,.2)', borderRadius:'var(--r2)', padding:14, marginBottom:8 }}>
                <div style={{ fontSize:11, color:'var(--t4)', fontWeight:700, marginBottom:8 }}>
                  {isCrypto ? 'SEND CRYPTO TO THIS ADDRESS' : 'TRANSFER TO THIS NUMBER'}
                </div>
                <div className="dep-address-box">
                  <div className="dep-address-text">{address}</div>
                  <button className="dep-copy-btn" onClick={copyAddress}>{copied ? 'Copied!' : 'Copy'}</button>
                </div>
                {!isCrypto && selectedWallet && (
                  <div style={{ marginTop:10, fontSize:12, color:'var(--t3)' }}>
                    Send <strong style={{ color:'var(--t1)' }}>{parseFloat(amount).toLocaleString()} EGP</strong> to <strong style={{ color:'var(--g0)' }}>{selectedWallet.name} ({selectedWallet.number})</strong>, then upload your receipt below.
                  </div>
                )}
                {isCrypto && selectedCrypto && (
                  <div style={{ marginTop:10, fontSize:12, color:'var(--t3)' }}>
                    Network: <strong style={{ color:'var(--t1)' }}>{selectedCrypto.network}</strong> · Min: <strong style={{ color:'var(--t1)' }}>{selectedCrypto.min} {selectedCrypto.symbol}</strong>
                  </div>
                )}
              </div>

              <div className="section-label">Upload Payment Receipt</div>
              <div className={`receipt-upload ${receiptFile ? 'has-file' : ''}`} onClick={() => fileRef.current?.click()}>
                {receiptPreview ? (
                  <>
                    <img src={receiptPreview} className="receipt-preview" alt="Receipt" />
                    <div style={{ marginTop:8, fontSize:12, color:'var(--g0)', fontWeight:700 }}>{receiptFile?.name}</div>
                    <div style={{ fontSize:11, color:'var(--t4)', marginTop:2 }}>Tap to change</div>
                  </>
                ) : (
                  <>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--t4)" strokeWidth="1.5" style={{ margin:'0 auto 10px' }}>
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    <div style={{ fontSize:14, fontWeight:600, color:'var(--t2)', marginBottom:4 }}>Tap to upload receipt</div>
                    <div style={{ fontSize:12, color:'var(--t4)' }}>JPG, PNG or PDF · Max 10MB</div>
                  </>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*,application/pdf" style={{ display:'none' }} onChange={handleFile} />

              {receiptFile && (
                <button
                  className={`auth-btn ${submitting ? 'loading' : ''}`}
                  onClick={confirmDeposit}
                  disabled={submitting}
                  style={{ marginTop:12, background:'var(--g0)', color:'#04060C', fontWeight:800, fontSize:16 }}
                >
                  {submitting ? '' : 'Confirm Deposit'}
                </button>
              )}

              <div style={{ marginTop:10, padding:'10px 12px', background:'rgba(59,130,246,.06)', border:'1px solid rgba(59,130,246,.15)', borderRadius:'var(--r2)', fontSize:12, color:'var(--t3)', lineHeight:1.6 }}>
                <strong style={{ color:'var(--t2)', display:'block', marginBottom:2 }}>How it works</strong>
                1. Send the exact amount to the address above<br/>
                2. Upload your payment screenshot<br/>
                3. Click <strong>Confirm Deposit</strong> — our team reviews within <strong style={{ color:'var(--g0)' }}>15–30 minutes</strong>
              </div>
            </>
          )}

          {/* ── STEP 5: SUBMITTED — WAITING ── */}
          {step === 'submitted' && (
            <div style={{ textAlign:'center', padding:'20px 0' }}>
              <div style={{ width:72, height:72, borderRadius:'50%', background:'rgba(0,230,118,.1)', border:'2px solid rgba(0,230,118,.3)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--g0)" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <div style={{ fontSize:20, fontWeight:800, color:'var(--t1)', marginBottom:6 }}>Receipt Submitted!</div>
              <div style={{ fontSize:13, color:'var(--t3)', lineHeight:1.7, marginBottom:20 }}>
                Your deposit request has been received.<br/>
                Our team is reviewing your payment.
              </div>

              {/* Waiting indicator */}
              <div style={{ background:'rgba(245,158,11,.08)', border:'1px solid rgba(245,158,11,.25)', borderRadius:'var(--r2)', padding:'14px 16px', marginBottom:16 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div className="spinner" style={{ width:18, height:18, borderColor:'rgba(245,158,11,.2)', borderTopColor:'#F59E0B' }} />
                  <div style={{ textAlign:'left' }}>
                    <div style={{ fontSize:13, fontWeight:700, color:'#F59E0B' }}>Processing your deposit…</div>
                    <div style={{ fontSize:11, color:'var(--t4)', marginTop:2 }}>Please wait 15–30 minutes for funds to appear</div>
                  </div>
                </div>
              </div>

              {txId && (
                <div style={{ background:'var(--bg2)', borderRadius:'var(--r2)', padding:'10px 14px', marginBottom:16, textAlign:'left' }}>
                  <div style={{ fontSize:10, color:'var(--t4)', fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px' }}>Transaction ID</div>
                  <div style={{ fontSize:12, fontFamily:'JetBrains Mono', color:'var(--t2)', marginTop:4, wordBreak:'break-all' }}>{txId}</div>
                </div>
              )}

              <div style={{ fontSize:12, color:'var(--t4)', lineHeight:1.6, marginBottom:24 }}>
                You will receive a notification once your deposit is confirmed.<br/>
                If not credited after 30 minutes, contact support with your Transaction ID.
              </div>

              <button className="auth-btn" onClick={() => setOverlay('transfers')}>View Transaction History</button>
              <div style={{ marginTop:10 }}>
                <button style={{ background:'none', border:'none', color:'var(--t4)', cursor:'pointer', fontSize:13, fontFamily:'inherit' }} onClick={() => setOverlay('none')}>Close</button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
