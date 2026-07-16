import { useState } from 'react';
import { useStore } from '../../lib/store';

const EVENTS = [
  {
    id: 'e1',
    type: 'tournament',
    title: 'Weekly Trading Championship',
    date: 'June 30 — July 6, 2026',
    desc: 'Compete with thousands of traders! Top 3 traders with highest profit percentage win exclusive prizes. Free entry with real account.',
    prize: '$50,000 Prize Pool',
    progress: 68,
    participants: 4283,
    color: '#F59E0B',
    ico: '🏆',
    joined: false,
  },
  {
    id: 'e2',
    type: 'promo',
    title: 'Summer Deposit Bonus',
    date: 'Valid until July 31, 2026',
    desc: 'Deposit during summer and get up to 100% bonus on your first deposit. Use code SUMMER24 to activate the maximum bonus.',
    prize: 'Up to 100% Bonus',
    progress: 45,
    participants: 9812,
    color: '#3B82F6',
    ico: '🎁',
    joined: false,
  },
  {
    id: 'e3',
    type: 'tournament',
    title: 'Crypto Volatility Cup',
    date: 'July 7 — July 14, 2026',
    desc: 'Special tournament focused exclusively on crypto pairs. Higher payouts and special bonuses for the duration of the event.',
    prize: '$25,000 + Special Payouts',
    progress: 20,
    participants: 1543,
    color: '#8B5CF6',
    ico: '⚡',
    joined: false,
  },
  {
    id: 'e4',
    type: 'promo',
    title: 'Refer & Earn Program',
    date: 'Ongoing',
    desc: 'Invite your friends and earn 10% commission on every trade they make. No limits on earnings!',
    prize: '10% Commission',
    progress: 100,
    participants: 22500,
    color: '#10B981',
    ico: '💰',
    joined: true,
  },
];

export default function EventsOverlay() {
  const setOverlay = useStore(s => s.setOverlay);
  const showToast = useStore(s => s.showToast);
  const [coupon, setCoupon] = useState('');
  const [joined, setJoined] = useState<Record<string, boolean>>({});

  function join(id: string, title: string) {
    setJoined(prev => ({ ...prev, [id]: true }));
    showToast(`Joined: ${title}`);
  }

  function applyCoupon() {
    const codes: Record<string, string> = { 'SUMMER24': '100% bonus activated!', 'OXIER10': '10% extra bonus activated!', 'VIP50': '50% bonus + VIP access!' };
    const msg = codes[coupon.toUpperCase()];
    if (msg) showToast(msg); else showToast('Invalid coupon code');
    setCoupon('');
  }

  return (
    <div className="overlay-bg" onClick={() => setOverlay('none')}>
      <div className="overlay-sheet" style={{ maxHeight: '88vh' }} onClick={e => e.stopPropagation()}>
        <div className="overlay-handle" />
        <div className="overlay-header">
          <span className="overlay-title">Events & Promotions</span>
          <button className="overlay-close" onClick={() => setOverlay('none')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="overlay-body">
          <div className="event-coupon">
            <input
              className="coupon-input"
              placeholder="Enter coupon code..."
              value={coupon}
              onChange={e => setCoupon(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && applyCoupon()}
            />
            <button className="coupon-btn" onClick={applyCoupon}>Apply</button>
          </div>

          {EVENTS.map(ev => (
            <div key={ev.id} className="event-card">
              <div className="event-header">
                <div className="event-ico" style={{ background: `${ev.color}14`, fontSize: 24 }}>{ev.ico}</div>
                <div>
                  <div className="event-title">{ev.title}</div>
                  <div className="event-date">{ev.date}</div>
                </div>
              </div>
              <div className="event-desc">{ev.desc}</div>
              <div className="event-progress">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span className="event-prize" style={{ color: ev.color }}>{ev.prize}</span>
                  <span style={{ fontSize: 11, color: 'var(--t4)' }}>{ev.participants.toLocaleString()} joined</span>
                </div>
                <div className="event-progress-bar">
                  <div className="event-progress-fill" style={{ width: `${ev.progress}%`, background: `linear-gradient(90deg,${ev.color}99,${ev.color})` }} />
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                {(joined[ev.id] || ev.joined) ? (
                  <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--g0)', fontWeight: 700 }}>
                    Joined
                  </div>
                ) : (
                  <button
                    onClick={() => join(ev.id, ev.title)}
                    style={{ width: '100%', padding: '10px', borderRadius: 'var(--r3)', background: `${ev.color}18`, border: `1px solid ${ev.color}44`, color: ev.color, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}
                  >
                    {ev.type === 'tournament' ? 'Join Tournament' : 'Claim Bonus'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
