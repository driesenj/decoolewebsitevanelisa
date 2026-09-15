// Synthesised MSN-flavoured sound effects (no copyrighted samples): sign-in chime, message ding, nudge buzz.
let ctx;
function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
function tone(freq, at, dur, { type = 'sine', gain = 0.12, glide } = {}) {
  const c = ac();
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, at);
  if (glide) o.frequency.exponentialRampToValueAtTime(glide, at + dur);
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(gain, at + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(c.destination);
  o.start(at); o.stop(at + dur + 0.05);
}
export const sfx = {
  unlock() { try { ac(); } catch { } },
  signin() {
    try { const t = ac().currentTime; [659, 830, 988, 1319].forEach((f, i) => tone(f, t + i * 0.13, 0.45, { type: 'triangle', gain: 0.1 })); tone(1319, t + 0.55, 0.9, { type: 'sine', gain: 0.06 }); } catch { }
  },
  ding() {
    try { const t = ac().currentTime; tone(1318, t, 0.22, { gain: 0.1 }); tone(1760, t + 0.09, 0.45, { gain: 0.07 }); } catch { }
  },
  nudge() {
    try {
      const c = ac(), t = c.currentTime;
      const o = c.createOscillator(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
      o.type = 'sawtooth'; o.frequency.value = 72;
      lfo.type = 'square'; lfo.frequency.value = 26; lg.gain.value = 0.08;
      lfo.connect(lg).connect(g.gain);
      g.gain.setValueAtTime(0.09, t); g.gain.linearRampToValueAtTime(0.0001, t + 0.75);
      o.connect(g).connect(c.destination);
      o.start(t); lfo.start(t); o.stop(t + 0.8); lfo.stop(t + 0.8);
    } catch { }
  },
  pop() { try { const t = ac().currentTime; tone(600, t, 0.08, { type: 'square', gain: 0.05, glide: 1200 }); } catch { } },
  tada() {
    try { const t = ac().currentTime; [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, t + i * 0.09, 0.5, { type: 'triangle', gain: 0.08 })); } catch { }
  },
};
