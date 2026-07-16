import { useEffect } from 'react';
import { useStore } from '../lib/store';
import TopBar from '../components/TopBar';
import AssetBar from '../components/AssetBar';
import TradingChart from '../components/TradingChart';
import BottomControls from '../components/BottomControls';
import NavBar from '../components/NavBar';

import PanelOverlay from '../components/overlays/PanelOverlay';
import HistoryOverlay from '../components/overlays/HistoryOverlay';
import SignalsOverlay from '../components/overlays/SignalsOverlay';
import IndicatorsOverlay from '../components/overlays/IndicatorsOverlay';
import ExpiryOverlay from '../components/overlays/ExpiryOverlay';
import EventsOverlay from '../components/overlays/EventsOverlay';
import DepositScreen from '../components/overlays/DepositScreen';
import ProfileScreen from '../components/overlays/ProfileScreen';
import TransfersScreen from '../components/overlays/TransfersScreen';

function Toast() {
  const toast = useStore(s => s.toast);
  return (
    <div className="toast-wrap" style={{ pointerEvents: 'none' }}>
      <div className={`toast-msg ${toast ? 'show' : ''}`}>{toast}</div>
    </div>
  );
}

function ConfirmModal() {
  const confirm = useStore(s => s.confirm);
  const closeConfirm = useStore(s => s.closeConfirm);
  if (!confirm) return null;
  return (
    <div className="confirm-modal-bg">
      <div className="confirm-modal">
        <h3>{confirm.title}</h3>
        <p>{confirm.body}</p>
        <div className="confirm-btns">
          <button className="confirm-btn cancel" onClick={closeConfirm}>Cancel</button>
          <button className="confirm-btn ok" onClick={() => { confirm.onConfirm(); closeConfirm(); }}>Confirm</button>
        </div>
      </div>
    </div>
  );
}

export default function TradingPlatform() {
  const overlay = useStore(s => s.overlay);
  const markets = useStore(s => s.markets);
  const currentMarket = useStore(s => s.currentMarket);

  return (
    <div className="trading-layout" style={{ height: '100%' }}>
      <TopBar />
      <AssetBar />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' }}>
        <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
          <TradingChart />
        </div>
        <BottomControls />
      </div>

      <NavBar />

      {/* Overlays */}
      {overlay === 'panel'      && <PanelOverlay />}
      {overlay === 'history'    && <HistoryOverlay />}
      {overlay === 'signals'    && <SignalsOverlay />}
      {overlay === 'indicators' && <IndicatorsOverlay />}
      {overlay === 'expiry'     && <ExpiryOverlay />}
      {overlay === 'events'     && <EventsOverlay />}
      {overlay === 'deposit'    && <DepositScreen />}
      {overlay === 'profile'    && <ProfileScreen />}
      {overlay === 'transfers'  && <TransfersScreen />}

      <Toast />
      <ConfirmModal />
    </div>
  );
}
