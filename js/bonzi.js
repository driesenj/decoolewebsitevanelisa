// BonziBUDDY, resurrected from the original MS Agent frames (assets/bonzi/, see scripts/bonzi-sprites.mjs).
// Sits bottom-right above the dock, animates from sprite sheets with the original frame timings, talks in an
// MS Agent balloon (browser TTS when allowed), tells jokes/facts, juggles, and can be sent away.
import { h, pick, store, todo } from './util.js';

const BASE = 'assets/bonzi/';
const W = 200, H = 160;

export function createBonzi({ cfg, onSing }) {
  let anims = null;                 // { name: { cols, frames: [ms, ...] } }
  fetch(BASE + 'anims.json').then(r => r.ok ? r.json() : null).then(j => { anims = j; if (shown) play('show', () => idle()); }).catch(() => { });

  // --- DOM ---------------------------------------------------------------------------------------
  const text = h('div', { class: 'bz-text' });
  const speakBtn = h('button', { class: 'bz-mute', title: 'Stem aan/uit', onclick: () => { store.set('bonzi.mute', !muted()); syncMute(); } });
  const muted = () => store.get('bonzi.mute', false);
  const syncMute = () => { speakBtn.textContent = muted() ? '🔇' : '🔊'; };
  syncMute();
  const menu = h('div', { class: 'bz-menu' },
    h('button', { onclick: () => { say(pick(cfg.jokes), true); play('explain', () => play('giggle', idle)); } }, 'Mop'),
    h('button', { onclick: () => { say(pick(cfg.facts.filter(f => !/TODO/.test(f))), true); play('read', idle); } }, 'Feitje'),
    h('button', { onclick: () => { say(cfg.singLine, false); onSing?.(); play('headphones', idle); } }, 'Zing'),
    h('button', { onclick: () => { say(pick(cfg.lines), true); play(pick(['juggle', 'banana', 'wink', 'think', 'attention']), idle); } }, 'Doe iets'),
    h('button', { class: 'bz-away', onclick: () => hide(true) }, 'Weg'),
    speakBtn);
  const bubble = h('div', { class: 'bz-bubble' }, text, menu);
  const fig = h('div', { class: 'bz-fig', style: { width: W + 'px', height: H + 'px' } });
  const el = h('div', { class: 'bonzi', hidden: true }, bubble, fig);
  document.body.append(el);
  fig.addEventListener('click', () => { say(pick(cfg.lines), true); play(pick(['surprised', 'pleased', 'congratulate', 'hug', 'shoosh']), idle); });

  // --- animation ---------------------------------------------------------------------------------
  let timer = null, current = null, idleTimer = null;
  function play(name, done) {
    const a = anims?.[name];
    if (!a) { done?.(); return; }
    clearTimeout(timer); current = name;
    fig.style.backgroundImage = `url("${BASE}${name}.png")`;
    fig.style.backgroundSize = `${a.cols * W}px auto`;
    let i = 0;
    const step = () => {
      if (current !== name) return;
      if (i >= a.frames.length) { current = null; done?.(); return; }
      fig.style.backgroundPosition = `-${(i % a.cols) * W}px -${Math.floor(i / a.cols) * H}px`;
      timer = setTimeout(step, Math.max(40, a.frames[i++]));
    };
    step();
  }
  function idle() {
    clearTimeout(idleTimer);
    play('rest');
    idleTimer = setTimeout(() => { if (shown && !current) play(pick(['idle', 'blink', 'blink', 'idle', 'wave', 'think']), idle); }, 1500 + Math.random() * 3000);
  }

  // --- speech ------------------------------------------------------------------------------------
  function speak(t) {
    if (muted() || !('speechSynthesis' in window)) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(t.replace(/\(8\)|\(L\)|TODO/g, ''));
      const voices = speechSynthesis.getVoices();
      u.voice = voices.find(v => /^nl[-_]BE/i.test(v.lang)) || voices.find(v => /^nl/i.test(v.lang)) || null;
      u.lang = u.voice?.lang || 'nl-BE'; u.rate = 1.05; u.pitch = 0.7;   // Bonzi was never subtle
      speechSynthesis.speak(u);
    } catch { }
  }
  function say(t, voice = false) {
    if (!t) return;
    text.replaceChildren(...[].concat(todo(t)));
    bubble.classList.remove('pop'); void bubble.offsetWidth; bubble.classList.add('pop');
    if (voice) speak(t);
  }

  // --- show / hide -------------------------------------------------------------------------------
  let shown = false, ambient = null, onChange = null;
  function show(first = false) {
    el.hidden = false; shown = true;
    store.set('bonzi.dismissed', false);
    play('show', () => { play(first ? 'greet' : 'wave', idle); });
    setTimeout(() => say(first ? cfg.intro : pick(cfg.lines), false), first ? 1600 : 900);
    clearInterval(ambient);
    ambient = setInterval(() => { if (shown && !document.hidden) { say(pick(cfg.lines)); play(pick(['explain', 'attention', 'suggest', 'wink']), idle); } }, 90000);
    onChange?.(true);
  }
  function hide(byUser = false) {
    if (!shown) return;
    clearInterval(ambient); clearTimeout(idleTimer);
    if (byUser) { store.set('bonzi.dismissed', true); try { speechSynthesis.cancel(); } catch { } }
    say(byUser ? 'Oké dan. Ik kom terug. (Dat is geen dreigement. Beetje wel.)' : '', false);
    play('kiss', () => play('hide', () => { el.hidden = true; shown = false; current = null; onChange?.(false); }));
  }
  return { el, show, hide, say, play, toggle: () => (shown ? hide(true) : show(!store.get('bonzi.seen'))), get shown() { return shown; }, set onChange(fn) { onChange = fn; } };
}
