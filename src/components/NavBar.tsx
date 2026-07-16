import { useStore } from '../lib/store';
import { playClick, resumeAudio } from '../lib/sounds';

const NAV = [
  {
    id: 'chart', label: 'Chart',
    icon: () => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="4" height="16" rx="1"/>
        <rect x="10" y="8" width="4" height="12" rx="1"/>
        <rect x="18" y="2" width="4" height="20" rx="1"/>
      </svg>
    ),
  },
  {
    id: 'history', label: 'History',
    icon: () => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
  },
  {
    id: 'signals', label: 'Signals',
    icon: () => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 20h.01M7 20v-4M12 20v-8M17 20V8M22 4v16"/>
      </svg>
    ),
  },
  {
    id: 'events', label: 'Calendar',
    icon: () => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
  },
  {
    id: 'panel', label: 'Account',
    icon: () => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    ),
  },
];

export default function NavBar() {
  const overlay   = useStore(s => s.overlay);
  const setOverlay = useStore(s => s.setOverlay);
  const trades    = useStore(s => s.trades);
  const openTrades = trades.filter(t => !t.resolved);

  function navPress(id: string) {
    resumeAudio(); playClick();
    if (id === 'chart') setOverlay('none');
    else setOverlay(id as any);
  }

  return (
    <nav className="navbar">
      {NAV.map(n => {
        const active = n.id === 'chart' ? overlay === 'none' : overlay === n.id;
        return (
          <div key={n.id} className={`nav-item ${active ? 'active' : ''}`} onClick={() => navPress(n.id)}>
            <span className="nav-icon">{n.icon()}</span>
            <span className="nav-label">{n.label}</span>
            {n.id === 'history' && openTrades.length > 0 && (
              <span className="nav-badge">{openTrades.length}</span>
            )}
          </div>
        );
      })}
    </nav>
  );
}
