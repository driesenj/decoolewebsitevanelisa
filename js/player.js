// One shared <audio> element for everything (voice clips, soundboard, song). Using a single element
// lets us "unlock" it once inside the sign-in tap so iOS Safari allows later programmatic playback.
const audio = document.getElementById('player');
// 0.1 s of 8 kHz mono silence as a WAV blob URL
function silentWav() {
  const n = 800, b = new DataView(new ArrayBuffer(44 + n));
  const str = (o, t) => [...t].forEach((c, i) => b.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); b.setUint32(4, 36 + n, true); str(8, 'WAVEfmt '); b.setUint32(16, 16, true); b.setUint16(20, 1, true); b.setUint16(22, 1, true);
  b.setUint32(24, 8000, true); b.setUint32(28, 8000, true); b.setUint16(32, 1, true); b.setUint16(34, 8, true); str(36, 'data'); b.setUint32(40, n, true);
  for (let i = 0; i < n; i++) b.setUint8(44 + i, 128);
  return URL.createObjectURL(new Blob([b.buffer], { type: 'audio/wav' }));
}
let current = null;           // { src, onTick, onEnd }
const listeners = new Set();  // (src|null) => void, for UI state

export const player = {
  get src() { return current?.src || null; },
  get playing() { return !!current && !audio.paused; },
  unlock() {
    // Called synchronously inside a user gesture: playing a short silent clip whitelists this element on iOS,
    // so later play() calls (welcome clip after the sign-in animation, fanmail) work without another tap.
    try { audio.src = silentWav(); const p = audio.play(); if (p) p.then(() => audio.pause()).catch(() => { }); } catch { }
  },
  play(src, { onTick, onEnd } = {}) {
    if (current && current.src === src && !audio.paused) { audio.pause(); return; }
    if (current && current.src === src && audio.paused && audio.currentTime > 0 && !audio.ended) { audio.play().catch(() => { }); return; }
    stop(false);
    current = { src, onTick, onEnd };
    audio.src = src;
    audio.currentTime = 0;
    audio.play().catch(err => { console.warn('play', err); stop(); });
    emit();
  },
  stop,
  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
};
function stop(notify = true) {
  if (!audio.paused) audio.pause();
  const was = current; current = null;
  was?.onEnd?.();
  if (notify) emit();
}
function emit() { for (const fn of listeners) fn(player.src, player.playing); }
audio.addEventListener('timeupdate', () => current?.onTick?.(audio.currentTime, audio.duration || 0));
audio.addEventListener('ended', () => stop());
audio.addEventListener('pause', () => emit());
audio.addEventListener('play', () => emit());
audio.addEventListener('error', () => stop());
