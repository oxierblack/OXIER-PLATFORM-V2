const ctx = (() => {
  try { return new (window.AudioContext || (window as any).webkitAudioContext)(); } catch { return null; }
})();

function beep(freq: number, dur: number, vol: number, type: OscillatorType = 'sine', delay = 0) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
  gain.gain.setValueAtTime(0, ctx.currentTime + delay);
  gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + delay + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + dur);
  osc.start(ctx.currentTime + delay);
  osc.stop(ctx.currentTime + delay + dur + 0.05);
}

export function playOpen() {
  beep(440, 0.12, 0.08, 'sine');
  beep(554, 0.12, 0.08, 'sine', 0.08);
}

export function playClose() {
  beep(554, 0.12, 0.06, 'sine');
  beep(440, 0.18, 0.06, 'sine', 0.1);
}

export function playWin() {
  beep(523, 0.1, 0.1, 'sine');
  beep(659, 0.1, 0.1, 'sine', 0.1);
  beep(784, 0.2, 0.1, 'sine', 0.2);
}

export function playLoss() {
  beep(330, 0.15, 0.08, 'sawtooth');
  beep(262, 0.25, 0.08, 'sawtooth', 0.15);
}

export function playClick() {
  beep(800, 0.04, 0.04, 'square');
}

export function resumeAudio() {
  if (ctx && ctx.state === 'suspended') ctx.resume();
}
