// Windows Live Messenger bits: sign-in screen, toasts, conversation window for the fanmail tab.
import { h, clear, fmtDuration, todo, svg } from './util.js';
import { sfx } from './sfx.js';
import { player } from './player.js';

const butterfly = () => svg('0 0 64 64', `
  <defs><linearGradient id="bw" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7cc4ff"/><stop offset="1" stop-color="#1f5fbf"/></linearGradient>
  <linearGradient id="bw2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8be08b"/><stop offset="1" stop-color="#1c8a3c"/></linearGradient></defs>
  <path d="M32 34 C18 8 2 12 6 26 C9 36 22 38 32 34Z" fill="url(#bw)"/><path d="M32 34 C46 8 62 12 58 26 C55 36 42 38 32 34Z" fill="url(#bw2)"/>
  <path d="M32 36 C20 44 10 56 18 58 C26 60 30 46 32 36Z" fill="url(#bw2)" opacity=".9"/><path d="M32 36 C44 44 54 56 46 58 C38 60 34 46 32 36Z" fill="url(#bw)" opacity=".9"/>
  <ellipse cx="32" cy="36" rx="3" ry="10" fill="#234"/><path d="M30 27 C26 22 24 20 22 18 M34 27 C38 22 40 20 42 18" stroke="#234" stroke-width="1.5" fill="none"/>`);

export function titleBar(title, { menu } = {}) {
  return [
    h('div', { class: 'msn-title' }, h('span', { class: 'bfly' }, '🦋'), h('span', null, title),
      h('div', { class: 'ctl' }, h('span', null, '_'), h('span', null, '□'), h('span', { class: 'x' }, '✕'))),
    menu ? h('div', { class: 'msn-menu' }, menu.map(x => h('span', null, x))) : null,
  ].filter(Boolean);
}

// ---- sign-in ------------------------------------------------------------------------------------
export function showSignIn(site, onDone) {
  const root = document.getElementById('signin');
  clear(root);
  root.hidden = false;
  document.body.style.overflow = 'hidden';
  const win = h('div', { class: 'msn-win signin-win' });
  const body = h('div', { class: 'signin-body' },
    h('div', { class: 'logo' }, butterfly(), h('span', null, 'Windows Live', h('br'), 'Messenger')),
    h('div', { class: 'signin-field' }, h('label', null, 'E-mailadres:'), h('div', { class: 'inp' }, h('span', null, site.msnEmail), h('span', { class: 'arr' }, '▼'))),
    h('div', { class: 'signin-field' }, h('label', null, 'Wachtwoord:'), h('div', { class: 'inp pw' }, h('span', null, '•'.repeat(Math.max(8, (site.msnPassword || '').length))))),
    h('div', { class: 'signin-field' }, h('label', null, 'Status:'), h('div', { class: 'inp status' }, h('i'), h('span', null, 'Online'), h('span', { class: 'arr' }, '▼'))),
    h('div', { class: 'signin-checks' },
      h('label', null, h('input', { type: 'checkbox', checked: true }), 'Mijn e-mailadres onthouden'),
      h('label', null, h('input', { type: 'checkbox', checked: true }), 'Mijn wachtwoord onthouden'),
      h('label', null, h('input', { type: 'checkbox', checked: true }), 'Automatisch aanmelden')),
    h('button', { class: 'signin-btn', onclick: go }, 'Aanmelden'),
    h('div', { class: 'signin-links' },
      h('a', { href: '#', onclick: (e) => { e.preventDefault(); alert(`Het wachtwoord is "${site.msnPassword}". Zeg het tegen niemand.`); } }, 'Wachtwoord vergeten?'), ' · ',
      h('a', { href: '#', onclick: (e) => { e.preventDefault(); alert('Er is maar één account nodig. Die van Elisa.'); } }, 'Nieuw account?')),
  );
  win.append(...titleBar('Windows Live Messenger'), body, h('div', { class: 'signin-foot' }, 'Versie 8.5.1302.1018 · © 2008 Microsoft (niet echt)'));
  root.append(win);

  function go() {
    // These must run synchronously inside the tap: they unlock audio for the rest of the visit.
    sfx.unlock(); player.unlock(); sfx.signin();
    const steps = ['Verbinding maken met .NET Messenger Service...', 'Wachtwoord controleren... (klopt)', 'Contactpersonen laden... (allemaal fans)', 'Cool-niveau berekenen... (maximaal)'];
    const msg = h('div', { class: 'msg' }, steps[0]);
    const signing = h('div', { class: 'signing' }, h('div', null, h('b', null, `Aanmelden als ${site.msnEmail}`)),
      h('div', { class: 'dots' }, h('span'), h('span'), h('span'), h('span')), h('div', { class: 'prog' }, h('i')), msg);
    body.replaceWith(signing);
    let i = 0; const iv = setInterval(() => { i++; if (i < steps.length) msg.textContent = steps[i]; }, 420);
    setTimeout(() => {
      clearInterval(iv);
      root.classList.add('out');
      document.body.style.overflow = '';
      setTimeout(() => { root.hidden = true; root.classList.remove('out'); }, 550);
      onDone?.();
    }, 1800);
  }
}

// ---- toasts -------------------------------------------------------------------------------------
let toastTimer;
export function toast({ from, text, avatar = '💬', title = 'Windows Live Messenger', onClick, sound = false, ms = 6500 }) {
  const box = document.getElementById('toasts');
  clear(box);
  const el = h('div', { class: 'msn-toast', onclick: () => { onClick?.(); hide(); } },
    h('div', { class: 'tt' }, h('span', null, '🦋'), h('span', null, title), h('span', { class: 'x', onclick: (e) => { e.stopPropagation(); hide(); } }, '✕')),
    h('div', { class: 'tb' }, h('div', { class: 'av' }, avatar), h('div', null, from ? h('b', null, from, ' zegt:') : null, from ? h('br') : null, text)));
  box.append(el);
  if (sound) sfx.ding();
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hide, ms);
  function hide() { el.classList.add('out'); setTimeout(() => el.remove(), 350); }
  return el;
}

// ---- fanmail: contact list + conversation --------------------------------------------------------
const STATUS_LABEL = { online: 'Online', away: 'Afwezig', busy: 'Bezet', offline: 'Offline' };

export function fanmailWindow({ site, contacts, onNavigate, initialKey, onGuestbook }) {
  const main = h('div', { class: 'msn-main' });
  const win = h('div', { class: 'msn-win' }, ...titleBar('Windows Live Messenger', { menu: ['Bestand', 'Contactpersonen', 'Acties', 'Extra', 'Help'] }), main);
  const list = h('div', { class: 'contacts' });
  const convo = h('div', { class: 'convo' });
  main.append(list, convo);

  const groups = { online: [], away: [], busy: [], offline: [] };
  for (const c of contacts) (groups[c.status] || groups.online).push(c);
  list.append(h('div', { class: 'me' }, h('div', { class: 'av' }, '💖'),
    h('div', { style: { minWidth: 0 } }, h('b', null, `${site.fanclub} (Online)`), h('small', null, '(8) de fanmail stroomt binnen (8)'))));
  const onlineish = [...groups.online, ...groups.away, ...groups.busy];
  if (onlineish.length) list.append(h('div', { class: 'grp' }, `Online (${onlineish.length})`));
  onlineish.forEach(c => list.append(contactRow(c)));
  if (groups.offline.length) list.append(h('div', { class: 'grp' }, `Offline (${groups.offline.length})`));
  groups.offline.forEach(c => list.append(contactRow(c)));
  if (!contacts.length) list.append(h('div', { class: 'grp' }, 'Nog geen spraakclips: zet ze in content/audio/fanmail/ en run npm run build.'));

  function contactRow(c) {
    const row = h('div', { class: 'contact', dataset: { key: c.key }, onclick: () => onNavigate(c.key) },
      h('div', { class: `st ${c.status}` }),
      h('div', { class: 'dn' }, c.display || c.name, h('small', null, c.pm ? c.pm + ' · ' : '', h('span', { class: 'dur' }, '🎤 ' + fmtDuration(c.duration)))));
    return row;
  }

  function showEmpty() {
    main.classList.remove('show-convo');
    clear(convo).append(h('div', { class: 'empty' }, h('div', null, h('div', { style: { fontSize: '34px' } }, '🦋'), 'Klik op een contactpersoon om de spraakclip te beluisteren.', h('br'), h('small', null, 'Tip: probeer ook eens de Buzzer.'))));
  }

  function open(key) {
    const c = contacts.find(x => x.key === key);
    if (!c) return showEmpty();
    main.classList.add('show-convo');
    main.querySelectorAll('.contact').forEach(r => r.classList.toggle('active', r.dataset.key === key));
    const clip = clipPlayer(c);
    const log = h('div', { class: 'log' },
      h('div', { class: 'sys' }, `${c.name} is nu ${STATUS_LABEL[c.status] || 'Online'}.`),
      h('div', { class: 'sys' }, 'Waarschuwing: accepteer nooit bestanden van mensen die je niet kent. Deze fan ken je wel.'),
      h('div', { class: 'says' }, c.name, ' zegt:'),
      h('div', { class: 'line' }, `${c.name} heeft een spraakclip verzonden (${fmtDuration(c.duration)})`),
      clip.el,
      c.text ? [h('div', { class: 'says' }, c.name, ' zegt:'), h('div', { class: 'line' }, todo(c.text))] : null,
    );
    const ta = h('textarea', { placeholder: 'Typ hier je antwoord... (wordt in het gastenboek geplaatst)' });
    const input = h('div', { class: 'input' },
      h('div', { class: 'tools' }, '😊', '😉', '😛', '😍', '🥳', '❤️', h('span', { class: 'sep' }),
        h('button', { class: 'btn small', onclick: () => nudge(win) }, '⚡ Buzzer'),
        h('button', { class: 'btn small', onclick: () => { clip.play(); } }, '🎤 Spraakclip')),
      ta,
      h('div', { class: 'send' }, h('span', null, 'Enter = verzenden (naar het gastenboek)'), h('button', { class: 'btn', onclick: send }, 'Verzenden')));
    ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
    function send() { const t = ta.value.trim(); if (!t) return nudge(win); onGuestbook?.(t, c); }
    clear(convo).append(
      h('div', { class: 'hd' }, h('div', { class: 'av' }, c.avatar || '🙂'),
        h('div', { style: { minWidth: 0 } }, h('b', null, c.display || c.name), h('small', null, c.pm || '')),
        h('button', { class: 'btn small back', onclick: () => onNavigate(null) }, '◀ Contacten')),
      h('div', { class: 'to' }, `Aan: ${c.name} <${c.key}@hotmail.com>`),
      log, input);
    if (c.autoplay) clip.play();
  }

  if (initialKey) open(initialKey); else showEmpty();
  return { el: win, open, showEmpty };
}

// voice-clip bubble with fake waveform, driven by the shared player
function clipPlayer(c) {
  const bars = Array.from({ length: 28 }, (_, i) => h('i', { style: { height: (25 + 60 * Math.abs(Math.sin(i * 1.7 + c.key.length))) + '%' } }));
  const btn = h('button', { class: 'pl', title: 'Afspelen' }, '▶');
  const tm = h('span', { class: 'tm' }, fmtDuration(c.duration));
  const el = h('div', { class: 'clip' }, btn, h('div', { class: 'wave' }, bars), tm);
  const play = () => player.play(c.src, {
    onTick: (t, d) => { const f = d ? t / d : 0; bars.forEach((b, i) => b.classList.toggle('on', i / bars.length <= f)); tm.textContent = fmtDuration(t) + ' / ' + fmtDuration(d || c.duration); },
    onEnd: () => { bars.forEach(b => b.classList.remove('on')); tm.textContent = fmtDuration(c.duration); },
  });
  btn.addEventListener('click', play);
  const off = player.onChange((src, playing) => {
    if (!el.isConnected) return off();   // bubble was replaced by another conversation: unsubscribe
    btn.textContent = src === c.src && playing ? '❚❚' : '▶';
  });
  return { el, play };
}

export function nudge(win) {
  sfx.nudge();
  win.classList.remove('shake'); void win.offsetWidth; win.classList.add('shake');
  const log = win.querySelector('.log');
  if (log) { log.append(h('div', { class: 'sys' }, 'Je hebt zojuist een Buzzer verzonden. (Elisa voelde dat in Parijs.)')); log.scrollTop = log.scrollHeight; }
}
