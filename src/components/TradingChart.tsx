import { useEffect, useRef, useState, useCallback } from 'react';
import { useStore } from '../lib/store';
import {
  TIMEFRAMES, fetchBinanceKlines, genSimData, genShortTFData, SHORT_TFS,
  calcRSI, calcMACD, calcBB, calcEMA, calcSMA,
  calcCCI, calcATR, calcStoch, calcWilliams, calcVolume,
} from '../lib/markets';
import type { TF } from '../lib/markets';

// All timeframes in display order
const TFS: TF[] = ['5s','10s','30s','1m','3m','5m','15m','30m','1h','2h','4h'];
const CHART_TYPES = ['Candles', 'Line', 'Area'];

declare const LightweightCharts: any;

function loadLWC(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof LightweightCharts !== 'undefined') { resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/lightweight-charts@4.1.3/dist/lightweight-charts.standalone.production.js';
    s.onload = () => resolve();
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

// ─── Drawing types ────────────────────────────────────────────────────────────
type DrawTool = 'trendline'|'hline'|'ray'|'rectangle'|'fibonacci'|'channel'|'vline'|'arrow'|'triangle'|'pitchfork';

interface DataPoint { logical: number; price: number; }
interface Drawing {
  id: string;
  tool: DrawTool;
  p1: DataPoint;
  p2: DataPoint;
  p3?: DataPoint;
  color: string;
  width: number;
  style: 'solid'|'dashed'|'dotted';
  finished: boolean;
}

const DEFAULT_COLORS = [
  '#F59E0B','#60A5FA','#A78BFA','#34D399','#F472B6',
  '#22D3EE','#ef4444','#ffffff','#fb923c','#86efac',
];

const TOOL_COLORS: Record<DrawTool, string> = {
  trendline: '#F59E0B', hline: '#60A5FA', ray: '#A78BFA',
  rectangle: '#34D399', fibonacci: '#F472B6', channel: '#22D3EE',
  vline: '#FB923C', arrow: '#FBBF24', triangle: '#86efac', pitchfork: '#f97316',
};

const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
const FIB_COLORS = ['#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#8b5cf6','#ec4899'];

// ─── Tool groups ──────────────────────────────────────────────────────────────
interface Tool { id: DrawTool | null; label: string; icon: string; }

const TOOL_GROUPS: { label: string; tools: Tool[] }[] = [
  {
    label: 'Lines',
    tools: [
      { id: null,        label: 'Cursor',     icon: '↖' },
      { id: 'trendline', label: 'Trend Line', icon: '↗' },
      { id: 'ray',       label: 'Ray',        icon: '→' },
      { id: 'hline',     label: 'H-Line',     icon: '—' },
      { id: 'vline',     label: 'V-Line',     icon: '|' },
      { id: 'arrow',     label: 'Arrow',      icon: '⇗' },
    ],
  },
  {
    label: 'Shapes',
    tools: [
      { id: 'rectangle', label: 'Rectangle', icon: '▭' },
      { id: 'triangle',  label: 'Triangle',  icon: '△' },
      { id: 'channel',   label: 'Channel',   icon: '≡' },
    ],
  },
  {
    label: 'Patterns',
    tools: [
      { id: 'fibonacci', label: 'Fibonacci', icon: 'ϕ' },
      { id: 'pitchfork', label: 'Pitchfork', icon: '⑃' },
    ],
  },
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function TradingChart() {
  const currentMarket     = useStore(s => s.currentMarket);
  const currentTF         = useStore(s => s.currentTF);
  const setCurrentTF      = useStore(s => s.setCurrentTF);
  const activeInds        = useStore(s => s.activeInds);
  const indicatorSettings = useStore(s => s.indicatorSettings);
  const theme             = useStore(s => s.theme);
  const trades            = useStore(s => s.trades);

  const containerRef    = useRef<HTMLDivElement>(null);
  const subContainerRef = useRef<HTMLDivElement>(null);
  const chartRef        = useRef<any>(null);
  const subChartRef     = useRef<any>(null);
  const mainSeriesRef   = useRef<any>(null);
  const wsRef           = useRef<WebSocket | null>(null);
  const barsRef         = useRef<any[]>([]);
  const priceLinesRef   = useRef<Map<string, any>>(new Map());
  const shortTFTimerRef = useRef<any>(null);

  const [lwcReady, setLwcReady]       = useState(false);
  const [chartType, setChartType]     = useState('Candles');
  const [hasSubChart, setHasSubChart] = useState(false);
  const [loading, setLoading]         = useState(true);
  const [drawMode, setDrawMode]       = useState<DrawTool | null>(null);
  const [toolsOpen, setToolsOpen]     = useState(false);
  const [drawings, setDrawings]       = useState<Drawing[]>([]);
  const [selectedId, setSelectedId]   = useState<string | null>(null);
  const [editDraw, setEditDraw]       = useState<Drawing | null>(null);
  const [drawColor, setDrawColor]     = useState('#F59E0B');
  const [drawWidth, setDrawWidth]     = useState(1.5);
  const [drawStyle, setDrawStyle]     = useState<'solid'|'dashed'|'dotted'>('solid');

  // Canvas drawing overlay
  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const drawingsRef    = useRef<Drawing[]>([]);
  const activeDrawRef  = useRef<Drawing | null>(null);
  const isDrawingRef   = useRef(false);

  const isDark      = theme === 'dark';
  const bg          = isDark ? '#080C16' : '#FFFFFF';
  const gridColor   = isDark ? 'rgba(255,255,255,.03)' : 'rgba(0,0,0,.04)';
  const borderColor = isDark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.08)';
  const textColor   = isDark ? 'rgba(240,246,252,.5)' : 'rgba(10,14,26,.5)';

  // Keep drawingsRef in sync
  useEffect(() => { drawingsRef.current = drawings; }, [drawings]);
  useEffect(() => { loadLWC().then(() => setLwcReady(true)).catch(() => {}); }, []);

  // ─── Coordinate conversion helpers ────────────────────────────────────────
  function pixelToData(x: number, y: number): DataPoint | null {
    if (!chartRef.current || !mainSeriesRef.current) return null;
    try {
      const logical = chartRef.current.timeScale().coordinateToLogical(x);
      const price   = mainSeriesRef.current.coordinateToPrice(y);
      if (logical == null || price == null) return null;
      return { logical, price };
    } catch { return null; }
  }

  function dataToPixel(dp: DataPoint): { x: number; y: number } | null {
    if (!chartRef.current || !mainSeriesRef.current) return null;
    try {
      const x = chartRef.current.timeScale().logicalToCoordinate(dp.logical);
      const y = mainSeriesRef.current.priceToCoordinate(dp.price);
      if (x == null || y == null) return null;
      return { x, y };
    } catch { return null; }
  }

  // ─── Canvas redraw ────────────────────────────────────────────────────────
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const all = [...drawingsRef.current];
    if (activeDrawRef.current) all.push(activeDrawRef.current);

    for (const d of all) {
      const px1 = dataToPixel(d.p1);
      const px2 = dataToPixel(d.p2);
      if (!px1) continue;
      const isSelected = d.id === selectedId;

      ctx.strokeStyle = d.color;
      ctx.lineWidth = isSelected ? d.width + 1 : d.width;

      // Apply line style
      if (d.style === 'dashed') ctx.setLineDash([8, 4]);
      else if (d.style === 'dotted') ctx.setLineDash([2, 4]);
      else ctx.setLineDash([]);

      if (d.tool === 'trendline') {
        if (!px2) continue;
        ctx.beginPath(); ctx.moveTo(px1.x, px1.y); ctx.lineTo(px2.x, px2.y); ctx.stroke();
        _dot(ctx, px1, d.color); _dot(ctx, px2, d.color);

      } else if (d.tool === 'hline') {
        ctx.beginPath(); ctx.moveTo(0, px1.y); ctx.lineTo(canvas.width, px1.y); ctx.stroke();
        // Price label
        ctx.fillStyle = d.color + 'CC';
        ctx.fillRect(canvas.width - 70, px1.y - 10, 70, 18);
        ctx.fillStyle = '#fff';
        ctx.font = '10px JetBrains Mono, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(d.p1.price.toFixed(5), canvas.width - 35, px1.y + 3);
        ctx.textAlign = 'left';

      } else if (d.tool === 'vline') {
        ctx.beginPath(); ctx.moveTo(px1.x, 0); ctx.lineTo(px1.x, canvas.height); ctx.stroke();

      } else if (d.tool === 'ray') {
        if (!px2) continue;
        const dx = px2.x - px1.x, dy = px2.y - px1.y;
        const len = Math.sqrt(dx*dx + dy*dy);
        if (len > 1) {
          const t = Math.max(canvas.width, canvas.height) * 5 / len;
          ctx.beginPath(); ctx.moveTo(px1.x, px1.y); ctx.lineTo(px1.x + dx*t, px1.y + dy*t); ctx.stroke();
          _dot(ctx, px1, d.color);
        }

      } else if (d.tool === 'arrow') {
        if (!px2) continue;
        const dx = px2.x - px1.x, dy = px2.y - px1.y;
        const angle = Math.atan2(dy, dx);
        ctx.beginPath(); ctx.moveTo(px1.x, px1.y); ctx.lineTo(px2.x, px2.y); ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(px2.x, px2.y);
        ctx.lineTo(px2.x - 14*Math.cos(angle-0.4), px2.y - 14*Math.sin(angle-0.4));
        ctx.moveTo(px2.x, px2.y);
        ctx.lineTo(px2.x - 14*Math.cos(angle+0.4), px2.y - 14*Math.sin(angle+0.4));
        ctx.stroke();

      } else if (d.tool === 'rectangle') {
        if (!px2) continue;
        ctx.strokeRect(px1.x, px1.y, px2.x - px1.x, px2.y - px1.y);
        ctx.fillStyle = d.color + '18';
        ctx.fillRect(px1.x, px1.y, px2.x - px1.x, px2.y - px1.y);

      } else if (d.tool === 'triangle') {
        if (!px2) continue;
        const midX = (px1.x + px2.x) / 2;
        ctx.beginPath();
        ctx.moveTo(midX, px1.y);
        ctx.lineTo(px2.x, px2.y);
        ctx.lineTo(px1.x, px2.y);
        ctx.closePath();
        ctx.stroke();
        ctx.fillStyle = d.color + '15';
        ctx.fill();

      } else if (d.tool === 'channel') {
        if (!px2) continue;
        const heightDiff = (px2.y - px1.y);
        ctx.beginPath(); ctx.moveTo(px1.x, px1.y); ctx.lineTo(px2.x, px2.y); ctx.stroke();
        const offset = heightDiff * 0.5;
        ctx.setLineDash([4, 3]);
        ctx.beginPath(); ctx.moveTo(px1.x, px1.y + offset); ctx.lineTo(px2.x, px2.y + offset); ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(px1.x, px1.y - offset); ctx.lineTo(px2.x, px2.y - offset); ctx.stroke();
        ctx.fillStyle = d.color + '08';
        ctx.fillRect(px1.x, px1.y - offset, px2.x - px1.x, offset * 2);

      } else if (d.tool === 'fibonacci') {
        if (!px2) continue;
        const priceRange = d.p2.price - d.p1.price;
        const left = Math.min(px1.x, px2.x);
        const right = Math.max(px1.x, px2.x);
        FIB_LEVELS.forEach((lvl, i) => {
          const lvlPrice = d.p1.price + priceRange * lvl;
          const lvlData  = { logical: d.p1.logical, price: lvlPrice };
          const lvlPx    = dataToPixel(lvlData);
          if (!lvlPx) return;
          ctx.strokeStyle = FIB_COLORS[i % FIB_COLORS.length];
          ctx.lineWidth = lvl === 0 || lvl === 1 ? 1.5 : 1;
          ctx.setLineDash(lvl === 0.5 ? [4,3] : []);
          ctx.beginPath(); ctx.moveTo(left, lvlPx.y); ctx.lineTo(right, lvlPx.y); ctx.stroke();
          ctx.fillStyle = FIB_COLORS[i % FIB_COLORS.length];
          ctx.font = '9px JetBrains Mono, monospace';
          ctx.setLineDash([]);
          ctx.fillText(`${(lvl * 100).toFixed(1)}%`, right + 4, lvlPx.y + 3);
        });
        ctx.strokeStyle = d.color; ctx.lineWidth = 1; ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(px1.x, px1.y); ctx.lineTo(px1.x, px2.y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(px2.x, px1.y); ctx.lineTo(px2.x, px2.y); ctx.stroke();

      } else if (d.tool === 'pitchfork') {
        if (!px2) continue;
        const midY = (px1.y + px2.y) / 2;
        const midX = px1.x;
        const tip  = { x: midX, y: midY };
        ctx.beginPath(); ctx.moveTo(tip.x, tip.y); ctx.lineTo(px2.x, (px1.y + px2.y)/2); ctx.stroke();
        ctx.setLineDash([4, 3]);
        ctx.beginPath(); ctx.moveTo(midX, px1.y); ctx.lineTo(px2.x + (px2.x - midX) * 0.3, px1.y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(midX, px2.y); ctx.lineTo(px2.x + (px2.x - midX) * 0.3, px2.y); ctx.stroke();
        ctx.setLineDash([]);
        _dot(ctx, px1, d.color); _dot(ctx, px2, d.color);
      }

      // Selection highlight
      if (isSelected) {
        ctx.strokeStyle = '#ffffff33';
        ctx.lineWidth = 6;
        ctx.setLineDash([]);
        if (px2 && d.tool !== 'hline' && d.tool !== 'vline') {
          ctx.beginPath(); ctx.moveTo(px1.x, px1.y); ctx.lineTo(px2.x, px2.y); ctx.stroke();
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  function _dot(ctx: CanvasRenderingContext2D, p: {x:number;y:number}, color: string) {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#fff6'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI*2); ctx.stroke();
  }

  // ─── LWC scroll/zoom → redraw ──────────────────────────────────────────────
  useEffect(() => {
    if (!chartRef.current) return;
    const unsub = chartRef.current.timeScale().subscribeVisibleLogicalRangeChange(() => {
      redrawCanvas();
    });
    return () => { try { unsub?.(); } catch {} };
  }, [redrawCanvas, lwcReady]);

  useEffect(() => { redrawCanvas(); }, [drawings, redrawCanvas]);

  // ─── Open trade price lines ────────────────────────────────────────────────
  useEffect(() => {
    if (!mainSeriesRef.current) return;
    const open = trades.filter(t => !t.resolved);
    priceLinesRef.current.forEach((pl, id) => {
      if (!open.find(t => t.id === id)) {
        try { mainSeriesRef.current.removePriceLine(pl); } catch {}
        priceLinesRef.current.delete(id);
      }
    });
    for (const trade of open) {
      if (!priceLinesRef.current.has(trade.id)) {
        try {
          const pl = mainSeriesRef.current.createPriceLine({
            price: trade.entry,
            color: trade.side === 'buy' ? '#00E676' : '#FF3D57',
            lineWidth: 1, lineStyle: 2, axisLabelVisible: true,
            title: `${trade.side === 'buy' ? '▲ BUY' : '▼ SELL'} ${trade.entry.toFixed(trade.dec)}`,
          });
          priceLinesRef.current.set(trade.id, pl);
        } catch {}
      }
    }
  }, [trades]);

  // ─── Build / rebuild chart ─────────────────────────────────────────────────
  const buildChart = useCallback(() => {
    if (!lwcReady || !containerRef.current || !currentMarket) return;
    priceLinesRef.current.clear();
    if (shortTFTimerRef.current) { clearInterval(shortTFTimerRef.current); shortTFTimerRef.current = null; }
    if (subChartRef.current) { try { subChartRef.current.remove(); } catch {} subChartRef.current = null; }
    if (chartRef.current)    { try { chartRef.current.remove(); }    catch {} chartRef.current    = null; }
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }

    const chart = LightweightCharts.createChart(containerRef.current, {
      layout: { background: { color: bg }, textColor },
      grid: { vertLines: { color: gridColor }, horzLines: { color: gridColor } },
      rightPriceScale: { borderColor, scaleMargins: { top: 0.08, bottom: 0.08 } },
      timeScale: { borderColor, timeVisible: true, secondsVisible: true },
      crosshair: { mode: 1 },
      // CRITICAL: handleScroll and handleScale must be true so chart can zoom/pan
      handleScroll: true,
      handleScale: true,
      width:  containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
    });
    chartRef.current = chart;

    let mainSeries: any;
    if (chartType === 'Candles') {
      mainSeries = chart.addCandlestickSeries({
        upColor:'#00E676', downColor:'#FF3D57',
        wickUpColor:'#00E676', wickDownColor:'#FF3D57',
        borderVisible: false,
      });
    } else if (chartType === 'Line') {
      mainSeries = chart.addLineSeries({ color:'#00E676', lineWidth:2 });
    } else {
      mainSeries = chart.addAreaSeries({
        topColor:'rgba(0,230,118,.15)', bottomColor:'rgba(0,230,118,0)',
        lineColor:'#00E676', lineWidth:2,
      });
    }
    mainSeriesRef.current = mainSeries;

    const hasSubInd = activeInds.some(id => ['rsi','macd','stoch','williams','cci','atr','volume'].includes(id));
    setHasSubChart(hasSubInd);

    chart.timeScale().subscribeVisibleLogicalRangeChange(() => redrawCanvas());

    loadData(chart, mainSeries, hasSubInd);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lwcReady, currentMarket, currentTF, chartType, theme, activeInds, indicatorSettings]);

  async function loadData(chart: any, mainSeries: any, hasSubInd: boolean) {
    if (!currentMarket) return;
    setLoading(true);
    let bars: any[];
    const isShortTF = (SHORT_TFS as string[]).includes(currentTF);

    try {
      if (isShortTF) {
        // For short timeframes: fetch 1m bars and subdivide
        const oneMBars = await fetchBinanceKlines(currentMarket.symbol, '1m', 200);
        const tfSec = TIMEFRAMES[currentTF].sec;
        bars = genShortTFData(oneMBars, tfSec);
      } else {
        bars = await fetchBinanceKlines(currentMarket.symbol, TIMEFRAMES[currentTF].binance, 500);
      }
    } catch {
      bars = genSimData(currentMarket.price, currentTF, 500);
    }

    barsRef.current = bars;
    const data = chartType === 'Candles' ? bars : bars.map(b => ({ time: b.time, value: b.close }));
    try { mainSeries.setData(data); } catch {}
    chart.timeScale().fitContent();
    setLoading(false);
    applyMainIndicators(chart, bars);
    if (hasSubInd) buildSubChart(bars);

    if (isShortTF) {
      connectShortTFTimer(mainSeries, chart);
    } else {
      connectWS(mainSeries, chart);
    }
    setTimeout(() => redrawCanvas(), 100);
  }

  function applyMainIndicators(chart: any, bars: any[]) {
    const mainInd = activeInds.filter(id => ['bb','ema20','sma20'].includes(id));
    for (const id of mainInd) {
      if (id === 'bb') {
        const p = indicatorSettings.bb?.period || 20, m = indicatorSettings.bb?.mult || 2;
        const bb = calcBB(bars, p, m);
        const up = chart.addLineSeries({ color:'rgba(59,130,246,.8)', lineWidth:1 });
        const lo = chart.addLineSeries({ color:'rgba(59,130,246,.8)', lineWidth:1 });
        const mi = chart.addLineSeries({ color:'rgba(59,130,246,.4)', lineWidth:1, lineStyle:1 });
        up.setData(bb.upper); lo.setData(bb.lower); mi.setData(bb.mid);
      } else if (id === 'ema20') {
        const p = indicatorSettings.ema20?.period || 20;
        chart.addLineSeries({ color:'#F59E0B', lineWidth:1.5 }).setData(calcEMA(bars, p));
      } else if (id === 'sma20') {
        const p = indicatorSettings.sma20?.period || 20;
        chart.addLineSeries({ color:'#8B5CF6', lineWidth:1.5, lineStyle:2 }).setData(calcSMA(bars, p));
      }
    }
  }

  function buildSubChart(bars: any[]) {
    if (!subContainerRef.current) return;
    if (subChartRef.current) { try { subChartRef.current.remove(); } catch {} subChartRef.current = null; }
    const subInds = activeInds.filter(id => ['rsi','macd','stoch','williams','cci','atr','volume'].includes(id));
    if (!subInds.length) return;

    const subChart = LightweightCharts.createChart(subContainerRef.current, {
      layout: { background: { color: bg }, textColor },
      grid: { vertLines: { color: gridColor }, horzLines: { color: gridColor } },
      rightPriceScale: { borderColor, scaleMargins: { top:0.08, bottom:0.08 } },
      timeScale: { borderColor, visible: false },
      crosshair: { mode: 1 },
      handleScroll: true, handleScale: false,
      width:  subContainerRef.current.clientWidth,
      height: subContainerRef.current.clientHeight,
    });
    subChartRef.current = subChart;

    if (chartRef.current) {
      chartRef.current.timeScale().subscribeVisibleLogicalRangeChange((range: any) => {
        if (range && subChartRef.current) try { subChartRef.current.timeScale().setVisibleLogicalRange(range); } catch {}
      });
    }

    const id = subInds[0];
    if (id === 'rsi') {
      const p = indicatorSettings.rsi?.
