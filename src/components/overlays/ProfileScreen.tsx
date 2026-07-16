import { useState, useEffect } from 'react';
import { useStore } from '../../lib/store';

const BACKEND = 'https://oxier-backend-production.up.railway.app';

// Simple PIN stored as hash in localStorage
function hashPin(pin: string): string {
  let h = 0;
  for (let i = 0; i < pin.length; i++) { h = (Math.imul(31, h) + pin.charCodeAt(i)) | 0; }
  return h.toString(36);
}

export default function ProfileScreen() {
  const setOverlay  = useStore(s => s.setOverlay);
  const userInfo    = useStore(s => s.userInfo);
  const setUserInfo = useStore(s => s.setUserInfo);
  const showToast   = useStore(s => s.showToast);
  const trades      = useStore(s => s.trades);

  const [tab, setTab]       = useState<'info'|'security'|'danger'>('info');
  const [name, setName]     = useState(userInfo?.name || '');
  const [saving, setSaving] = useState(false);

  // PIN / Passkey states
  const [pinSet, setPinSet]           = useState(false);
  const [pinDialog, setPinDialog]     = useState<'setup'|'verify'|null>(null);
  const [newPin, setNewPin]           = useState('');
  const [confirmPin, setConfirmPin]   = useState('');
  const [enterPin, setEnterPin]       = useState('');
  const [pinError, setPinError]       = useState('');
  const [passkeySupported, setPasskeySupported] = useState(false);
  const [passkeyReg, setPasskeyReg]   = useState(false);

  // Delete account states
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleteStep, setDeleteStep]     = useState<'confirm'|'otp'>('confirm');
  const [deleteOtp, setDeleteOtp]       = useState('');
  const [deletePass, setDeletePass]     = useState('');
  const [deleting, setDeleting]         = useState(false);
  const [sendingOtp, setSendingOtp]     = useState(false);

  const resolved = trades.filter(t => t.resolved);
  const wins     = resolved.filter(t => t.won);
  const totalPnl = resolved.reduce((a, t) => a + (t.profit || 0), 0);
  const email    = userInfo?.email || '';
  const initials = (userInfo?.name || 'T').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  useEffect(() => {
    setPinSet(!!localStorage.getItem('ox_pin'));
    setPasskeySupported(!!(window.PublicKeyCredential));
    setPasskeyReg(!!localStorage.getItem('ox_passkey'));
  }, []);

  // ─── Profile save ──────────────────────────────────────────────────────────
  async function save() {
    if (!name.trim()) { showToast('Name cannot be empty'); return; }
    setSaving(true);
    await new Promise(r => setTimeout(r, 600));
    setUserInfo({ ...userInfo!, name: name.trim() });
    showToast('Profile updated!');
    setSaving(false);
  }

  // ─── PIN setup ────────────────────────────────────────────────────────────
  function setupPin() {
    if (!newPin || newPin.length < 4) { setPinError('PIN must be at least 4 digits'); return; }
    if (newPin !== confirmPin)        { setPinError('PINs do not match'); return; }
    localStorage.setItem('ox_pin', hashPin(newPin));
    setPinSet(true); setPinDialog(null); setNewPin(''); setConfirmPin(''); setPinError('');
    showToast('PIN set successfully');
  }

  function removePin() {
    localStorage.removeItem('ox_pin');
    setPinSet(false); showToast('PIN removed');
  }

  // ─── Passkey registration via WebAuthn ────────────────────────────────────
  async function registerPasskey() {
    if (!passkeySupported) { showToast('WebAuthn not supported on this browser'); return; }
    try {
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);
      const userId = new TextEncoder().encode(email);
      const cred = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: 'OXIER Trading', id: location.hostname },
          user: { id: userId, name: email, displayName: userInfo?.name || 'Trader' },
          pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
          authenticatorSelection: { userVerification: 'preferred', residentKey: 'preferred' },
          timeout: 60000,
        },
      }) as PublicKeyCredential;
      const rawId = btoa(String.fromCharCode(...new Uint8Array(cred.rawId)));
      localStorage.setItem('ox_passkey', rawId);
      setPasskeyReg(true);
      showToast('Passkey registered! You can now use biometrics to authenticate.');
    } catch (err: any) {
      if (err.name !== 'NotAllowedError') showToast('Passkey registration failed: ' + err.message);
    }
  }

  async function removePasskey() {
    localStorage.removeItem('ox_passkey');
    setPasskeyReg(false);
    showToast('Passkey removed');
  }

  // ─── Delete account ───────────────────────────────────────────────────────
  async function sendDeleteOtp() {
    if (!userInfo?.token) { showToast('Not logged in'); return; }
    setSendingOtp(true);
    try {
      const res = await fetch(`${BACKEND}/api/auth/send-delete-otp`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${userInfo.token}`, 'Content-Type': 'application/json' },
      });
      if (res.ok) { setDeleteStep('otp'); showToast('OTP sent to your email'); }
      else showToast('Failed to send OTP');
    } catch { showToast('Network error'); }
    setSendingOtp(false);
  }

  async function deleteAccount() {
    if (!deleteOtp || !deletePass) { showToast('Enter your password and OTP'); return; }
    if (!userInfo?.token) return;
    setDeleting(true);
    try {
      const res = await fetch(`${BACKEND}/api/auth/delete-account`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${userInfo.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: deletePass, code: deleteOtp }),
      });
      if (res.ok) {
        showToast('Account deleted');
        setUserInfo(null);
        localStorage.removeItem('ox_user');
        localStorage.removeItem('ox_pin');
        localStorage.removeItem('ox_passkey');
        setOverlay(null);
      } else {
        const d = await res.json().catch(() => ({}));
        showToast(d?.message || 'Failed to delete account');
      }
    } catch { showToast('Network error'); }
    setDeleting(false);
  }

  // ─── PIN numeric keypad ───────────────────────────────────────────────────
  function PinPad({ value, onChange, label, maxLen = 6 }: { value: string; onChange: (v: string) => void; label: string; maxLen?: number }) {
    const digits = '123456789 0⌫'.split(' ').flatMap(r => r.split(''));
    return (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:12 }}>
        <div style={{ fontSize:12, color:'var(--t4)', fontWeight:600 }}>{label}</div>
        <div style={{ display:'flex', gap:8 }}>
          {Array.from({ length: maxLen }).map((_, i) => (
            <div key={i} style={{ width:12, height:12, borderRadius:'50%', background: i < value.length ? 'var(--g0)' : 'var(--bg2)', border:'2px solid var(--border)' }} />
          ))}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, width:180 }}>
          {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((k, i) => (
            <button
              key={i}
              disabled={!k}
              onClick={() => {
                if (k === '⌫') onChange(value.slice(0,-1));
                else if (k && value.length < maxLen) onChange(value + k);
              }}
              style={{
                height:44, borderRadius:10, border:'1px solid var(--border)', background: k ? 'var(--bg2)' : 'transparent',
                color:'var(--t1)', fontSize:18, fontWeight:600, cursor: k ? 'pointer' : 'default', fontFamily:'inherit',
              }}
            >{k}</button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="fullscreen">
      <div className="fs-header">
        <button className="fs-back" onClick={() => setOverlay('panel')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <span className="fs-title">My Profile</span>
      </div>
      <div className="fs-body">
        {/* Avatar */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8, marginBottom:20 }}>
          <div style={{ width:72, height:72, borderRadius:'50%', background:'linear-gradient(135deg,var(--g0),var(--g2))', display:'flex', alignItems:'center', justifyContent:'center', fontSize:26, fontWeight:800, color:'#04060C', border:'3px solid rgba(0,230,118,.3)', boxShadow:'0 0 20px rgba(0,230,118,.2)' }}>{initials}</div>
          <div style={{ fontSize:18, fontWeight:700, color:'var(--t1)' }}>{userInfo?.name || 'Trader'}</div>
          <div style={{ fontSize:12, color:'var(--t4)' }}>{email}</div>
        </div>

        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:20 }}>
          {[
            { label:'Trades',   val: resolved.length },
            { label:'Win Rate', val: resolved.length ? `${Math.round(wins.length/resolved.length*100)}%` : '—' },
            { label:'P&L',      val: `${totalPnl >= 0 ? '+' : ''}$${Math.abs(totalPnl).toFixed(0)}`, color: totalPnl >= 0 ? 'var(--g0)' : 'var(--red)' },
          ].map((s,i) => (
            <div key={i} style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--r2)', padding:'12px 8px', textAlign:'center' }}>
              <div style={{ fontSize:16, fontWeight:800, color: s.color || 'var(--t1)', fontFamily:'JetBrains Mono' }}>{s.val}</div>
              <div style={{ fontSize:10, color:'var(--t4)', marginTop:3 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="profile-tabs" style={{ marginBottom:16 }}>
          {(['info','security','danger'] as const).map(t => (
            <button key={t} className={`profile-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}
              style={{ fontFamily:'inherit', color: t === 'danger' && tab === t ? 'var(--red)' : undefined }}>
              {t === 'info' ? 'Info' : t === 'security' ? 'Security' : '⚠ Delete'}
            </button>
          ))}
        </div>

        {/* Info tab */}
        {tab === 'info' && (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div className="auth-field">
              <label>Display Name</label>
              <input className="auth-input" value={name} onChange={e => setName(e.target.value)} placeholder="Your Name" />
            </div>
            <div className="auth-field">
              <label>Email Address</label>
              <input className="auth-input" value={email} readOnly style={{ opacity:.6 }} />
            </div>
            <button className={`auth-btn ${saving ? 'loading' : ''}`} onClick={save} disabled={saving}>
              {saving ? '' : 'Save Changes'}
            </button>
          </div>
        )}

        {/* Security tab */}
        {tab === 'security' && (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {/* PIN */}
            <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--r2)', padding:16 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                <span style={{ fontSize:20 }}>🔢</span>
                <div>
                  <div style={{ fontSize:14, fontWeight:700, color:'var(--t1)' }}>PIN Code</div>
                  <div style={{ fontSize:11, color:'var(--t4)' }}>Secure access with a numeric PIN</div>
                </div>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                {pinSet
                  ? <>
                      <button onClick={() => { setPinDialog('setup'); setNewPin(''); setConfirmPin(''); setPinError(''); }}
                        style={{ flex:1, padding:'8px 0', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg1)', color:'var(--t1)', fontWeight:600, cursor:'pointer', fontSize:12, fontFamily:'inherit' }}>Change PIN</button>
                      <button onClick={removePin}
                        style={{ flex:1, padding:'8px 0', borderRadius:8, border:'1px solid rgba(255,61,87,.3)', background:'rgba(255,61,87,.1)', color:'var(--red)', fontWeight:600, cursor:'pointer', fontSize:12, fontFamily:'inherit' }}>Remove</button>
                    </>
                  : <button onClick={() => { setPinDialog('setup'); setNewPin(''); setConfirmPin(''); setPinError(''); }}
                      style={{ width:'100%', padding:'9px 0', borderRadius:8, border:'1px solid rgba(0,230,118,.3)', background:'rgba(0,230,118,.1)', color:'var(--g0)', fontWeight:700, cursor:'pointer', fontSize:13, fontFamily:'inherit' }}>
                      Set up PIN
                    </button>
                }
              </div>
            </div>

            {/* Passkey / WebAuthn */}
            <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--r2)', padding:16 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                <span style={{ fontSize:20 }}>🔑</span>
                <div>
                  <div style={{ fontSize:14, fontWeight:700, color:'var(--t1)' }}>Passkey / Biometric</div>
                  <div style={{ fontSize:11, color:'var(--t4)' }}>
                    {passkeySupported ? 'Use fingerprint, Face ID, or device PIN' : 'Not supported on this browser'}
                  </div>
                </div>
              </div>
              {passkeySupported && (
                passkeyReg
                  ? <div style={{ display:'flex', gap:8 }}>
                      <div style={{ flex:1, padding:'9px 12px', borderRadius:8, background:'rgba(0,230,118,.08)', border:'1px solid rgba(0,230,118,.2)', color:'var(--g0)', fontSize:12, fontWeight:600 }}>
                        ✓ Passkey registered
                      </div>
                      <button onClick={removePasskey}
                        style={{ padding:'9px 12px', borderRadius:8, border:'1px solid rgba(255,61,87,.3)', background:'rgba(255,61,87,.1)', color:'var(--red)', fontWeight:600, cursor:'pointer', fontSize:12, fontFamily:'inherit' }}>Remove</button>
                    </div>
                  : <button onClick={registerPasskey}
                      style={{ width:'100%', padding:'9px 0', borderRadius:8, border:'1px solid rgba(59,130,246,.3)', background:'rgba(59,130,246,.1)', color:'#3B82F6', fontWeight:700, cursor:'pointer', fontSize:13, fontFamily:'inherit' }}>
                      Register Passkey
                    </button>
              )}
            </div>

            {/* Change password */}
            <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--r2)', padding:16 }}>
              <div style={{ fontSize:14, fontWeight:700, color:'var(--t1)', marginBottom:4 }}>Change Password</div>
              <div style={{ fontSize:11, color:'var(--t4)', marginBottom:10 }}>Update your account password via email</div>
              <button onClick={() => showToast('Password reset link sent to your email!')}
                style={{ width:'100%', padding:'9px 0', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg1)', color:'var(--t1)', fontWeight:600, cursor:'pointer', fontSize:13, fontFamily:'inherit' }}>
                Send Reset Link
              </button>
            </div>
          </div>
        )}

        {/* Danger zone tab */}
        {tab === 'danger' && (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div style={{ background:'rgba(255,61,87,.06)', border:'1px solid rgba(255,61,87,.2)', borderRadius:'var(--r2)', padding:16 }}>
              <div style={{ fontSize:14, fontWeight:700, color:'var(--red)', marginBottom:6 }}>⚠ Delete Account</div>
              <div style={{ fontSize:13, color:'var(--t3)', marginBottom:12 }}>
                This action is <strong style={{ color:'var(--red)' }}>permanent and irreversible</strong>.
                All your data, trade history, and balances will be permanently deleted.
              </div>
              <button
                onClick={() => { setDeleteDialog(true); setDeleteStep('confirm'); setDeleteOtp(''); setDeletePass(''); }}
                style={{ width:'100%', padding:'11px 0', borderRadius:8, border:'1px solid rgba(255,61,87,.4)', background:'rgba(255,61,87,.15)', color:'var(--red)', fontWeight:700, cursor:'pointer', fontSize:14, fontFamily:'inherit' }}>
                Delete My Account
              </button>
            </div>
          </div>
        )}
      </div>

      {/* PIN setup dialog */}
      {pinDialog === 'setup' && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', zIndex:50, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'var(--bg1)', borderRadius:16, padding:24, minWidth:260, border:'1px solid var(--border)' }}>
            <div style={{ fontSize:16, fontWeight:700, color:'var(--t1)', marginBottom:16, textAlign:'center' }}>
              {!newPin || newPin.length < 4 ? 'Enter new PIN' : 'Confirm PIN'}
            </div>
            {(!newPin || newPin.length < 4)
              ? <PinPad value={newPin} onChange={setNewPin} label="New PIN (4-6 digits)" maxLen={6} />
              : <PinPad value={confirmPin} onChange={setConfirmPin} label="Confirm PIN" maxLen={6} />
            }
            {pinError && <div style={{ color:'var(--red)', fontSize:12, textAlign:'center', marginTop:8 }}>{pinError}</div>}
            <div style={{ display:'flex', gap:8, marginTop:16 }}>
              <button onClick={() => { setPinDialog(null); setNewPin(''); setConfirmPin(''); setPinError(''); }}
                style={{ flex:1, padding:'10px 0', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg2)', color:'var(--t3)', cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>Cancel</button>
              {newPin.length >= 4 && confirmPin.length >= 4 && (
                <button onClick={setupPin}
                  style={{ flex:1, padding:'10px 0', borderRadius:8, border:'none', background:'var(--g0)', color:'#04060C', fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Save PIN</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete account dialog */}
      {deleteDialog && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.7)', zIndex:50, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'var(--bg1)', borderRadius:16, padding:24, minWidth:300, maxWidth:360, border:'1px solid rgba(255,61,87,.3)' }}>
            <div style={{ fontSize:16, fontWeight:700, color:'var(--red)', marginBottom:8, textAlign:'center' }}>🗑 Delete Account</div>
            {deleteStep === 'confirm' ? (
              <>
                <div style={{ fontSize:13, color:'var(--t3)', textAlign:'center', marginBottom:16 }}>
                  First, we'll send a verification OTP to <strong>{email}</strong>
                </div>
                <div className="auth-field" style={{ marginBottom:12 }}>
                  <label>Current Password</label>
                  <input className="auth-input" type="password" value={deletePass} onChange={e => setDeletePass(e.target.value)} placeholder="Enter your password" />
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={() => setDeleteDialog(false)}
                    style={{ flex:1, padding:'10px 0', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg2)', color:'var(--t3)', cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>Cancel</button>
                  <button onClick={sendDeleteOtp} disabled={sendingOtp || !deletePass}
                    style={{ flex:1, padding:'10px 0', borderRadius:8, border:'none', background:'rgba(255,61,87,.8)', color:'#fff', fontWeight:700, cursor:'pointer', fontFamily:'inherit', opacity: sendingOtp || !deletePass ? .5 : 1 }}>
                    {sendingOtp ? 'Sending…' : 'Send OTP'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize:13, color:'var(--t3)', textAlign:'center', marginBottom:16 }}>
                  Enter the OTP sent to your email
                </div>
                <div className="auth-field" style={{ marginBottom:12 }}>
                  <label>Verification Code</label>
                  <input className="auth-input" value={deleteOtp} onChange={e => setDeleteOtp(e.target.value)} placeholder="6-digit OTP" maxLength={6} style={{ fontFamily:'JetBrains Mono', letterSpacing:4 }} />
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={() => setDeleteDialog(false)}
                    style={{ flex:1, padding:'10px 0', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg2)', color:'var(--t3)', cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>Cancel</button>
                  <button onClick={deleteAccount} disabled={deleting || !deleteOtp}
                    style={{ flex:1, padding:'10px 0', borderRadius:8, border:'none', background:'var(--red)', color:'#fff', fontWeight:700, cursor:'pointer', fontFamily:'inherit', opacity: deleting || !deleteOtp ? .5 : 1 }}>
                    {deleting ? 'Deleting…' : 'Confirm Delete'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
