// One shared <audio> element for everything (voice clips, soundboard, song). Using a single element
// lets us "unlock" it once inside the sign-in tap so iOS Safari allows later programmatic playback.
// The profile song is the background music: a clip that cuts in hands back to it once it is done.
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
let bgm = null;               // { src, at, resume, loop }: the background music, and where a clip interrupted it
let seekTo = 0;               // position to jump to once the next load has its metadata (picking the bgm back up)
const listeners = new Set();  // (src|null, playing) => void, for UI state

export const player = {
  get src() { return current?.src || null; },
  get playing() { return !!current && !audio.paused; },
  unlock() {
    // Called synchronously inside a user gesture: playing a short silent clip whitelists this element on iOS,
    // so later play() calls (welcome clip after the sign-in animation, fanmail) work without another tap.
    // Nothing to do when something is loaded already: that took a gesture too, and swapping the src would kill it.
    if (current) return;
    try { audio.src = silentWav(); const p = audio.play(); if (p) p.then(() => audio.pause()).catch(() => { }); } catch { }
  },
  // Toggles pause when `src` is already the current clip. Resolves to true once playback really started;
  // browsers refuse play() outside a user gesture (autoplay policy), which resolves to false.
  play(src, { onTick, onEnd, at = 0 } = {}) {
    if (current && current.src === src && !audio.paused) { audio.pause(); return Promise.resolve(false); }
    if (current && current.src === src && audio.paused && audio.currentTime > 0 && !audio.ended) return audio.play().then(() => true, () => false);
    stop(false);
    current = { src, onTick, onEnd };
    seekTo = at;
    audio.src = src;
    audio.loop = !!(bgm && src === bgm.src && bgm.loop);   // only the background music loops, never a clip
    audio.currentTime = 0;
    const started = audio.play().then(() => true, err => { console.warn('play', err); stop(); if (bgm && src === bgm.src) bgm.resume = false; return false; });
    emit();
    return started;
  },
  stop,
  // The background music (the profile song). Start it with play(); a clip that interrupts it pauses it,
  // and resume() (called automatically when that clip ends) continues where it left off.
  setBgm(src, { loop = false } = {}) { bgm = src ? { src, at: 0, resume: false, loop } : null; },
  resume() { if (bgm?.resume) { bgm.resume = false; player.play(bgm.src, { at: bgm.at }); } },
  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
};
function stop(notify = true, ended = false) {
  if (bgm && current?.src === bgm.src) { bgm.resume = !ended && !audio.paused; bgm.at = ended ? 0 : audio.currentTime; }
  if (!audio.paused) audio.pause();
  seekTo = 0;
  const was = current; current = null;
  was?.onEnd?.();
  if (notify) emit();
  if (ended) player.resume();
}
function emit() { for (const fn of listeners) fn(player.src, player.playing); }
audio.addEventListener('loadedmetadata', () => { if (seekTo) { audio.currentTime = seekTo; seekTo = 0; } });
audio.addEventListener('timeupdate', () => current?.onTick?.(audio.currentTime, audio.duration || 0));
audio.addEventListener('ended', () => stop(true, true));
audio.addEventListener('pause', () => emit());
audio.addEventListener('play', () => emit());
audio.addEventListener('error', () => stop());
