import { useState } from 'react';
import { useStore } from '../../lib/store';
import type { Indicator } from '../../types';

const INDICATORS: Indicator[] = [
  {
    id: 'rsi',
    name: 'RSI',
    desc: 'Relative Strength Index — momentum oscillator',
    color: '#F59E0B',
    subChart: true,
    params: [{ key: 'period', label: 'Period', value: 14, min: 5, max: 50, step: 1 }],
  },
  {
    id: 'macd',
    name: 'MACD',
    desc: 'Moving Average Convergence Divergence',
    color: '#3B82F6',
    subChart: true,
    params: [
      { key: 'fast', label: 'Fast Period', value: 12, min: 3, max: 50, step: 1 },
      { key: 'slow', label: 'Slow Period', value: 26, min: 6, max: 100, step: 1 },
      { key: 'signal', label: 'Signal Period', value: 9, min: 3, max: 30, step: 1 },
    ],
  },
  {
    id: 'bb',
    name: 'Bollinger Bands',
    desc: 'Volatility bands around a moving average',
    color: '#007BFF',
    subChart: false,
    params: [
      { key: 'period', label: 'Period', value: 20, min: 5, max: 100, step: 1 },
      { key: 'mult', label: 'Std Dev', value: 2, min: 1, max: 4, step: 0.5 },
    ],
  },
  {
    id: 'ema20',
    name: 'EMA',
    desc: 'Exponential Moving Average',
    color: '#F59E0B',
    subChart: false,
    params: [{ key: 'period', label: 'Period', value: 20, min: 3, max: 200, step: 1 }],
  },
  {
    id: 'sma20',
    name: 'SMA',
    desc: 'Simple Moving Average',
    color: '#8B5CF6',
    subChart: false,
    params: [{ key: 'period', label: 'Period', value: 20, min: 3, max: 200, step: 1 }],
  },
  {
    id: 'cci',
    name: 'CCI',
    desc: 'Commodity Channel Index',
    color: '#10B981',
    subChart: true,
    params: [{ key: 'period', label: 'Period', value: 14, min: 5, max: 50, step: 1 }],
  },
  {
    id: 'atr',
    name: 'ATR',
    desc: 'Average True Range — volatility indicator',
    color: '#EC4899',
    subChart: true,
    params: [{ key: 'period', label: 'Period', value: 14, min: 5, max: 50, step: 1 }],
  },
  {
    id: 'stoch',
    name: 'Stochastic',
    desc: 'Stochastic Oscillator',
    color: '#06B6D4',
    subChart: true,
    params: [
      { key: 'k', label: '%K Period', value: 14, min: 5, max: 50, step: 1 },
      { key: 'd', label: '%D Period', value: 3, min: 1, max: 20, step: 1 },
    ],
  },
  {
    id: 'williams',
    name: 'Williams %R',
    desc: 'Williams Percent Range oscillator',
    color: '#F97316',
    subChart: true,
    params: [{ key: 'period', label: 'Period', value: 14, min: 5, max: 50, step: 1 }],
  },
  {
    id: 'volume',
    name: 'Volume',
    desc: 'Trading volume histogram',
    color: '#6B7280',
    subChart: true,
  },
];

function ParamsEditor({ ind }: { ind: Indicator }) {
  const indicatorSettings = useStore(s => s.indicatorSettings);
  const setIndicatorParam = useStore(s => s.setIndicatorParam);
  const settings = indicatorSettings[ind.id] || {};

  if (!ind.params || ind.params.length === 0) return null;

  return (
    <div className="ind-params">
      {ind.params.map(param => {
        const cur = settings[param.key] ?? param.value;
        return (
          <div key={param.key} className="ind-param-row">
            <span className="ind-param-label">{param.label}</span>
            <div className="ind-param-controls">
              <button
                className="ind-param-btn"
                onClick={() => setIndicatorParam(ind.id, param.key, Math.max(param.min, cur - param.step))}
              >−</button>
              <span className="ind-param-val">{cur}</span>
              <button
                className="ind-param-btn"
                onClick={() => setIndicatorParam(ind.id, param.key, Math.min(param.max, cur + param.step))}
              >+</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function IndicatorsOverlay() {
  const setOverlay = useStore(s => s.setOverlay);
  const activeInds = useStore(s => s.activeInds);
  const toggleInd = useStore(s => s.toggleInd);
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="overlay-bg" onClick={() => setOverlay('none')}>
      <div className="overlay-sheet" style={{ maxHeight: '88vh' }} onClick={e => e.stopPropagation()}>
        <div className="overlay-handle" />
        <div className="overlay-header">
          <span className="overlay-title">Indicators</span>
          <div style={{ fontSize: 12, color: 'var(--t4)', marginRight: 8 }}>
            {activeInds.length} active
          </div>
          <button className="overlay-close" onClick={() => setOverlay('none')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="overlay-body">
          <div className="ind-grid">
            {INDICATORS.map(ind => {
              const isActive = activeInds.includes(ind.id);
              const isExpanded = expanded === ind.id && isActive;
              return (
                <div key={ind.id} className={`ind-card ${isActive ? 'active' : ''}`}>
                  <div className="ind-card-header" onClick={() => {
                    if (isActive && ind.params?.length) setExpanded(e => e === ind.id ? null : ind.id);
                    else if (!isActive) toggleInd(ind.id);
                  }}>
                    <div className="ind-ico" style={{ background: `${ind.color}18`, color: ind.color }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                      </svg>
                    </div>
                    <div className="ind-info">
                      <div className="ind-name">{ind.name}</div>
                      <div className="ind-desc">{ind.desc}</div>
                    </div>
                    {ind.params && isActive && (
                      <span style={{ fontSize: 10, color: 'var(--t4)', marginRight: 6 }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          {isExpanded ? <polyline points="18 15 12 9 6 15"/> : <polyline points="6 9 12 15 18 9"/>}
                        </svg>
                      </span>
                    )}
                    <div
                      className={`ind-toggle ${isActive ? 'on' : ''}`}
                      onClick={e => { e.stopPropagation(); toggleInd(ind.id); if (!isActive === false) setExpanded(null); }}
                    >
                      <div className="ind-toggle-dot" />
                    </div>
                  </div>
                  {isExpanded && <ParamsEditor ind={ind} />}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
