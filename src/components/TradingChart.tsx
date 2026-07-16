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
      const p = indicatorSettings.rsi?.period || 14;
      const s = subChart.addLineSeries({ color:'#F59E0B', lineWidth:2 });
      s.setData(calcRSI(bars, p));
      s.createPriceLine({ price:70, color:'rgba(255,61,87,.5)', lineWidth:1, lineStyle:2, axisLabelVisible:true, title:'70' });
      s.createPriceLine({ price:30, color:'rgba(0,230,118,.5)', lineWidth:1, lineStyle:2, axisLabelVisible:true, title:'30' });
      s.createPriceLine({ price:50, color:'rgba(255,255,255,.15)', lineWidth:1, lineStyle:2, axisLabelVisible:false });
    } else if (id === 'macd') {
      const md = calcMACD(bars);
      const hist = subChart.addHistogramSeries({ priceScaleId:'right' });
      hist.setData(md.hist);
      subChart.addLineSeries({ color:'#3B82F6', lineWidth:2 }).setData(md.macd);
      subChart.addLineSeries({ color:'#EC4899', lineWidth:1.5 }).setData(md.signal);
    } else if (id === 'stoch') {
      const kP = indicatorSettings.stoch?.k || 14;
      const sd = calcStoch(bars, kP);
      const kL = subChart.addLineSeries({ color:'#06B6D4', lineWidth:2 });
      kL.setData(sd.k);
      subChart.addLineSeries({ color:'#F97316', lineWidth:1.5, lineStyle:1 }).setData(sd.d);
      kL.createPriceLine({ price:80, color:'rgba(255,61,87,.4)', lineWidth:1, lineStyle:2, axisLabelVisible:true, title:'80' });
      kL.createPriceLine({ price:20, color:'rgba(0,230,118,.4)', lineWidth:1, lineStyle:2, axisLabelVisible:true, title:'20' });
    } else if (id === 'cci') {
      const p = indicatorSettings.cci?.period || 14;
      const s = subChart.addLineSeries({ color:'#10B981', lineWidth:2 });
      s.setData(calcCCI(bars, p));
      s.createPriceLine({ price:100, color:'rgba(255,61,87,.4)', lineWidth:1, lineStyle:2, axisLabelVisible:true, title:'+100' });
      s.createPriceLine({ price:-100, color:'rgba(0,230,118,.4)', lineWidth:1, lineStyle:2, axisLabelVisible:true, title:'-100' });
    } else if (id === 'atr') {
      const p = indicatorSettings.atr?.period || 14;
      subChart.addLineSeries({ color:'#EC4899', lineWidth:2 }).setData(calcATR(bars, p));
    } else if (id === 'williams') {
      const p = indicatorSettings.williams?.period || 14;
      const s = subChart.addLineSeries({ color:'#F97316', lineWidth:2 });
      s.setData(calcWilliams(bars, p));
      s.createPriceLine({ price:-20, color:'rgba(255,61,87,.4)', lineWidth:1, lineStyle:2, axisLabelVisible:true, title:'-20' });
      s.createPriceLine({ price:-80, color:'rgba(0,230,118,.4)', lineWidth:1, lineStyle:2, axisLabelVisible:true, title:'-80' });
    } else if (id === 'volume') {
      subChart.addHistogramSeries({ priceScaleId:'right', priceFormat:{ type:'volume' } }).setData(calcVolume(bars));
    }
  }

  // ─── Short timeframe live simulation ─────────────────────────────────────
  function connectShortTFTimer(mainSeries: any, chart: any) {
    if (!currentMarket) return;
    const tfSec = TIMEFRAMES[currentTF].sec;
    let lastBar = barsRef.current[barsRef.current.length - 1];
    let tickCount = 0;
    const totalTicks = Math.ceil(tfSec / 0.5);

    // Fetch real price from Binance
    let currentPrice = lastBar?.close || currentMarket.price;
    const fetchPrice = async () => {
      try {
        const r = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${currentMarket.symbol}`);
        if (r.ok) { const d = await r.json(); currentPrice = parseFloat(d.price); }
      } catch {}
    };
    fetchPrice();

    shortTFTimerRef.current = setInterval(async () => {
      tickCount++;
      const now = Math.floor(Date.now() / 1000);
      const barStart = Math.floor(now / tfSec) * tfSec;

      await fetchPrice();

      if (!lastBar || barStart > lastBar.time) {
        // New candle
        const newBar = { time: barStart, open: currentPrice, high: currentPrice, low: currentPrice, close: currentPrice, volume: 0 };
        barsRef.current.push(newBar);
        if (barsRef.current.length > 1000) barsRef.current.shift();
        lastBar = newBar;
      } else {
        // Update current candle
        lastBar.close = currentPrice;
        lastBar.high = Math.max(lastBar.high, currentPrice);
        lastBar.low = Math.min(lastBar.low, currentPrice);
      }

      const upd = chartType === 'Candles' ? lastBar : { time: lastBar.time, value: lastBar.close };
      try { mainSeries.update(upd); } catch {}
    }, 500);
  }

  // ─── WebSocket for normal timeframes ──────────────────────────────────────
  function connectWS(mainSeries: any, chart: any) {
    if (!currentMarket) return;
    const sym = currentMarket.symbol.toLowerCase();
    const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${sym}@kline_${TIMEFRAMES[currentTF].binance}`);
    ws.onmessage = (e) => {
      const d = JSON.parse(e.data), k = d.k;
      const bar = {
        time: k.t/1000, open: parseFloat(k.o), high: parseFloat(k.h),
        low: parseFloat(k.l), close: parseFloat(k.c), volume: parseFloat(k.v),
      };
      const bars = barsRef.current;
      const last = bars[bars.length-1];
      if (last && bar.time === last.time) bars[bars.length-1] = bar;
      else { bars.push(bar); if (bars.length > 1000) bars.shift(); }
      const upd = chartType === 'Candles' ? bar : { time: bar.time, value: bar.close };
      try { mainSeries.update(upd); } catch {}
    };
    wsRef.current = ws;
  }

  useEffect(() => {
    buildChart();
    return () => {
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
      if (shortTFTimerRef.current) { clearInterval(shortTFTimerRef.current); shortTFTimerRef.current = null; }
    };
  }, [buildChart]);

  // Resize observer
  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(() => {
      if (chartRef.current && containerRef.current)
        chartRef.current.resize(containerRef.current.clientWidth, containerRef.current.clientHeight);
      if (subChartRef.current && subContainerRef.current)
        subChartRef.current.resize(subContainerRef.current.clientWidth, subContainerRef.current.clientHeight);
      redrawCanvas();
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [lwcReady, hasSubChart, redrawCanvas]);

  // Keep canvas sized
  useEffect(() => {
    const canvas = canvasRef.current, cont = containerRef.current;
    if (!canvas || !cont) return;
    const sync = () => { canvas.width = cont.clientWidth; canvas.height = cont.clientHeight; redrawCanvas(); };
    sync();
    const obs = new ResizeObserver(sync);
    obs.observe(cont);
    return () => obs.disconnect();
  }, [hasSubChart, redrawCanvas]);

  // ─── Canvas mouse events ───────────────────────────────────────────────────
  function _canvasPos(e: React.MouseEvent<HTMLCanvasElement>) {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function onCanvasMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!drawMode) {
      const pos = _canvasPos(e);
      const hit = findDrawingAt(pos.x, pos.y);
      setSelectedId(hit?.id || null);
      return;
    }
    const pos = _canvasPos(e);
    const dp  = pixelToData(pos.x, pos.y);
    if (!dp) return;
    isDrawingRef.current  = true;
    activeDrawRef.current = {
      id: Date.now().toString(), tool: drawMode,
      p1: dp, p2: dp,
      color: drawColor, width: drawWidth, style: drawStyle,
      finished: false,
    };
    redrawCanvas();
  }

  function onCanvasMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!isDrawingRef.current || !activeDrawRef.current) return;
    const pos = _canvasPos(e);
    const dp  = pixelToData(pos.x, pos.y);
    if (!dp) return;
    activeDrawRef.current.p2 = dp;
    redrawCanvas();
  }

  function onCanvasMouseUp(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!isDrawingRef.current || !activeDrawRef.current) return;
    const pos = _canvasPos(e);
    const dp  = pixelToData(pos.x, pos.y);
    if (dp) activeDrawRef.current.p2 = dp;
    const finished = { ...activeDrawRef.current, finished: true };
    setDrawings(prev => [...prev, finished]);
    activeDrawRef.current = null;
    isDrawingRef.current  = false;
    redrawCanvas();
  }

  function onCanvasRightClick(e: React.MouseEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const pos = _canvasPos(e);
    const hit = findDrawingAt(pos.x, pos.y);
    if (hit) { setEditDraw(hit); setSelectedId(hit.id); }
  }

  function findDrawingAt(px: number, py: number): Drawing | null {
    for (const d of [...drawingsRef.current].reverse()) {
      const p1 = dataToPixel(d.p1);
      if (!p1) continue;
      if (d.tool === 'hline') { if (Math.abs(py - p1.y) < 8) return d; }
      else if (d.tool === 'vline') { if (Math.abs(px - p1.x) < 8) return d; }
      else {
        const p2 = dataToPixel(d.p2);
        if (!p2) continue;
        if (pointToSegmentDist(px, py, p1.x, p1.y, p2.x, p2.y) < 8) return d;
      }
    }
    return null;
  }

  function pointToSegmentDist(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
    const dx = x2-x1, dy = y2-y1;
    const lenSq = dx*dx + dy*dy;
    if (lenSq === 0) return Math.sqrt((px-x1)**2 + (py-y1)**2);
    const t = Math.max(0, Math.min(1, ((px-x1)*dx + (py-y1)*dy) / lenSq));
    return Math.sqrt((px - (x1+t*dx))**2 + (py - (y1+t*dy))**2);
  }

  const subInds = activeInds.filter(id => ['rsi','macd','stoch','williams','cci','atr','volume'].includes(id));
  const subLabel: Record<string,string> = { rsi:'RSI', macd:'MACD', stoch:'Stochastic', cci:'CCI', atr:'ATR', williams:'Williams %R', volume:'Volume' };

  const allToolsFlat = TOOL_GROUPS.flatMap(g => g.tools);

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>

      {/* ── Timeframe + Chart-type bar ─────────────────────────────────────── */}
      <div className="tf-bar">
        {TFS.map(tf => (
          <button
            key={tf}
            className={`tf-btn ${currentTF === tf ? 'active' : ''} ${(SHORT_TFS as string[]).includes(tf) ? 'tf-short' : ''}`}
            onClick={() => setCurrentTF(tf)}
          >{tf}</button>
        ))}
        <div style={{ width:1, height:16, background:'var(--border)', margin:'0 4px', flexShrink:0 }} />
        {CHART_TYPES.map(ct => (
          <button
            key={ct}
            className={`tf-btn ${chartType === ct ? 'active' : ''}`}
            onClick={() => setChartType(ct)}
            style={{ fontSize:10 }}
          >{ct}</button>
        ))}
      </div>

      {/* ── Chart body ────────────────────────────────────────────────────── */}
      <div style={{ flex:1, position:'relative', minHeight:0 }}>
        <div
          ref={containerRef}
          style={{ width:'100%', height: hasSubChart ? 'calc(100% - 130px)' : '100%', position:'relative' }}
        >
          {/* CRITICAL FIX: canvas only captures events when drawMode is active */}
          <canvas
            ref={canvasRef}
            style={{
              position:'absolute', inset:0, zIndex:10,
              // When drawMode is null → pointerEvents:none → chart receives scroll/zoom
              // When drawMode is set → pointerEvents:all → drawing mode works
              pointerEvents: drawMode ? 'all' : 'none',
              cursor: drawMode ? 'crosshair' : 'default',
            }}
            onMouseDown={onCanvasMouseDown}
            onMouseMove={onCanvasMouseMove}
            onMouseUp={onCanvasMouseUp}
            onContextMenu={onCanvasRightClick}
          />
        </div>

        {/* Sub chart */}
        {hasSubChart && subInds.length > 0 && (
          <div style={{ position:'absolute', bottom:0, left:0, right:0, height:130, display:'flex', flexDirection:'column' }}>
            <div style={{
              padding:'4px 10px', fontSize:10, fontWeight:700,
              color:'var(--t4)', background:'var(--bg1)',
              borderTop:'1px solid var(--border)', display:'flex', gap:8,
            }}>
              {subInds.map(id => (
                <span
                  key={id}
                  style={{ color: id === subInds[0] ? 'var(--g0)' : 'var(--t4)', cursor:'pointer' }}
                  onClick={() => useStore.setState(s => ({ activeInds: [id, ...s.activeInds.filter(x => x !== id)] }))}
                >
                  {subLabel[id] || id.toUpperCase()}
                </span>
              ))}
            </div>
            <div ref={subContainerRef} style={{ flex:1 }} />
          </div>
        )}

        {/* ── Drawing tools toggle button ─────────────────────────────────── */}
        <button
          onClick={() => setToolsOpen(o => !o)}
          style={{
            position:'absolute', left: toolsOpen ? 208 : 6, top:8, zIndex:30,
            width:28, height:28, borderRadius:8,
            border:`1px solid ${toolsOpen ? 'var(--g0)' : 'var(--border2)'}`,
            background: toolsOpen ? 'rgba(0,230,118,.15)' : 'var(--bg2)',
            color: toolsOpen ? 'var(--g0)' : 'var(--t3)',
            fontSize:14, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
            transition:'all .2s', boxShadow:'0 2px 8px rgba(0,0,0,.3)',
          }}
          title={toolsOpen ? 'Close Tools' : 'Drawing Tools'}
        >
          {toolsOpen
            ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
            : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          }
        </button>

        {/* ── Drawing tools panel ────────────────────────────────────────── */}
        {toolsOpen && (
          <div style={{
            position:'absolute', left:6, top:8, zIndex:29, width:200,
            background:'var(--bg1)', border:'1px solid var(--border2)', borderRadius:12,
            padding:0, boxShadow:'0 8px 32px rgba(0,0,0,.5)',
            overflow:'hidden',
          }}>
            {/* Panel header */}
            <div style={{ padding:'10px 12px 8px', borderBottom:'1px solid var(--border)' }}>
              <div style={{ fontSize:11, fontWeight:800, color:'var(--t3)', letterSpacing:'.8px', textTransform:'uppercase', marginBottom:8 }}>Drawing Tools</div>

              {/* Color palette */}
              <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:8 }}>
                {DEFAULT_COLORS.map(c => (
                  <div
                    key={c}
                    onClick={() => setDrawColor(c)}
                    style={{
                      width:18, height:18, borderRadius:4, background:c, cursor:'pointer',
                      border: drawColor === c ? '2px solid #fff' : '2px solid transparent',
                      boxShadow: drawColor === c ? `0 0 6px ${c}80` : 'none',
                      transition:'all .15s',
                    }}
                  />
                ))}
                <input
                  type="color" value={drawColor}
                  onChange={e => setDrawColor(e.target.value)}
                  style={{ width:18, height:18, borderRadius:4, border:'none', cursor:'pointer', padding:0, background:'none' }}
                  title="Custom color"
                />
              </div>

              {/* Line width */}
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                <span style={{ fontSize:10, color:'var(--t4)', fontWeight:600, width:36 }}>Width</span>
                <input
                  type="range" min={1} max={5} step={0.5} value={drawWidth}
                  onChange={e => setDrawWidth(parseFloat(e.target.value))}
                  style={{ flex:1, accentColor:'var(--g0)' }}
                />
                <span style={{ fontSize:10, color:'var(--t3)', fontWeight:700, width:16, textAlign:'right' }}>{drawWidth}</span>
              </div>

              {/* Line style */}
              <div style={{ display:'flex', gap:4 }}>
                {(['solid','dashed','dotted'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setDrawStyle(s)}
                    style={{
                      flex:1, padding:'4px 0', borderRadius:5, fontSize:9, fontWeight:700,
                      border:`1px solid ${drawStyle === s ? 'var(--g0)' : 'var(--border)'}`,
                      background: drawStyle === s ? 'rgba(0,230,118,.1)' : 'transparent',
                      color: drawStyle === s ? 'var(--g0)' : 'var(--t4)', cursor:'pointer', fontFamily:'inherit',
                    }}
                  >{s === 'solid' ? '─' : s === 'dashed' ? '╌' : '┄'}</button>
                ))}
              </div>
            </div>

            {/* Tool groups */}
            <div style={{ maxHeight:260, overflowY:'auto' }}>
              {TOOL_GROUPS.map(group => (
                <div key={group.label}>
                  <div style={{ padding:'6px 12px 3px', fontSize:9, fontWeight:800, color:'var(--t4)', letterSpacing:'.8px', textTransform:'uppercase' }}>
                    {group.label}
                  </div>
                  {group.tools.map(({ id, label, icon }) => {
                    const isActive = drawMode === id;
                    const color = id ? TOOL_COLORS[id] : 'var(--g0)';
                    return (
                      <button
                        key={label}
                        onClick={() => setDrawMode(d => d === id ? null : id)}
                        style={{
                          display:'flex', alignItems:'center', gap:8, padding:'7px 12px', width:'100%',
                          border:'none', background: isActive ? `${color}15` : 'transparent',
                          color: isActive ? color : 'var(--t3)', fontSize:12, fontWeight:600,
                          cursor:'pointer', fontFamily:'inherit', textAlign:'left',
                          borderLeft: isActive ? `2px solid ${color}` : '2px solid transparent',
                          transition:'all .12s',
                        }}
                      >
                        <span style={{ fontFamily:'monospace', fontSize:14, width:16, textAlign:'center', color: isActive ? color : 'var(--t4)' }}>{icon}</span>
                        {label}
                        {isActive && <span style={{ marginLeft:'auto', fontSize:9, background:color+'30', color, padding:'2px 5px', borderRadius:4 }}>ON</span>}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Clear / actions */}
            {drawings.length > 0 && (
              <div style={{ borderTop:'1px solid var(--border)', padding:'8px 8px' }}>
                <button
                  onClick={() => { setDrawings([]); setSelectedId(null); drawingsRef.current = []; redrawCanvas(); }}
                  style={{
                    width:'100%', padding:'6px', borderRadius:6, border:'1px solid rgba(255,61,87,.3)',
                    background:'rgba(255,61,87,.08)', color:'var(--red)', fontSize:11,
                    fontWeight:700, cursor:'pointer', fontFamily:'inherit',
                  }}
                >
                  🗑 Clear all ({drawings.length})
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Edit drawing dialog ─────────────────────────────────────────── */}
        {editDraw && (
          <div style={{
            position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)',
            background:'var(--bg1)', border:'1px solid var(--border2)', borderRadius:14,
            padding:16, zIndex:40, minWidth:220, boxShadow:'0 12px 48px rgba(0,0,0,.6)',
          }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
              <div style={{ fontSize:13, fontWeight:800, color:'var(--t1)' }}>Edit {editDraw.tool}</div>
              <button onClick={() => setEditDraw(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--t4)', fontSize:16 }}>×</button>
            </div>

            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:10, color:'var(--t4)', fontWeight:700, letterSpacing:'.5px', marginBottom:6 }}>COLOR</div>
              <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                {DEFAULT_COLORS.map(c => (
                  <div
                    key={c}
                    onClick={() => {
                      setDrawings(prev => prev.map(d => d.id === editDraw.id ? { ...d, color: c } : d));
                      setEditDraw(prev => prev ? { ...prev, color: c } : null);
                    }}
                    style={{ width:22, height:22, borderRadius:6, background:c, cursor:'pointer', border: editDraw.color === c ? '2px solid #fff' : '2px solid transparent' }}
                  />
                ))}
              </div>
            </div>

            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:10, color:'var(--t4)', fontWeight:700, letterSpacing:'.5px', marginBottom:6 }}>WIDTH</div>
              <input
                type="range" min={1} max={5} step={0.5} value={editDraw.width}
                onChange={e => {
                  const w = parseFloat(e.target.value);
                  setDrawings(prev => prev.map(d => d.id === editDraw.id ? { ...d, width: w } : d));
                  setEditDraw(prev => prev ? { ...prev, width: w } : null);
                  setTimeout(redrawCanvas, 10);
                }}
                style={{ width:'100%', accentColor:'var(--g0)' }}
              />
            </div>

            <div style={{ display:'flex', gap:6 }}>
              <button
                onClick={() => { setDrawings(prev => prev.filter(d => d.id !== editDraw.id)); setSelectedId(null); setEditDraw(null); }}
                style={{ flex:1, padding:'9px 0', borderRadius:8, border:'1px solid rgba(255,61,87,.3)', background:'rgba(255,61,87,.08)', color:'var(--red)', fontWeight:700, cursor:'pointer', fontSize:12, fontFamily:'inherit' }}
              >Delete</button>
              <button
                onClick={() => setEditDraw(null)}
                style={{ flex:1, padding:'9px 0', borderRadius:8, border:'1px solid var(--border2)', background:'var(--bg2)', color:'var(--t1)', fontWeight:700, cursor:'pointer', fontSize:12, fontFamily:'inherit' }}
              >Close</button>
            </div>
          </div>
        )}

        {loading && (
          <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,.35)', zIndex:10, pointerEvents:'none' }}>
            <div className="spinner" />
          </div>
        )}
      </div>
    </div>
  );
}
