// Windows Live Messenger bits: sign-in screen, toasts, and the group conversation window for the chat tab.
import { h, clear, fmtDuration, relDate, todo, svg } from './util.js';
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

export function nudge(win) {
  sfx.nudge();
  win.classList.remove('shake'); void win.offsetWidth; win.classList.add('shake');
}

// ---- chat: one group conversation ----------------------------------------------------------------
// Voice clips from the contacts open the log (they were "sent" before the site went live); typed
// messages (seed + live) follow in time order. The participants list sits left on desktop and behind
// a toggle on phones.
const STATUS_LABEL = { online: 'Online', away: 'Afwezig', busy: 'Bezet', offline: 'Offline' };

export function chatWindow({ site, chat, contacts, avatarFor, getName, setName, onSend, onNavigate }) {
  const main = h('div', { class: 'msn-main' });
  const win = h('div', { class: 'msn-win chat-win' }, ...titleBar(chat.groupName, { menu: ['Bestand', 'Bewerken', 'Acties', 'Extra', 'Help'] }), main);
  const list = h('div', { class: 'contacts' });
  const convo = h('div', { class: 'convo' });
  main.append(list, convo);

  // participants -------------------------------------------------------------------------------------
  const groups = { online: [], away: [], busy: [], offline: [] };
  for (const c of contacts) (groups[c.status] || groups.online).push(c);
  list.append(h('div', { class: 'me' }, h('div', { class: 'av' }, '💖'),
    h('div', { style: { minWidth: 0 } }, h('b', null, site.displayName), h('small', null, site.personalMessage))));
  const onlineish = [...groups.online, ...groups.away, ...groups.busy];
  if (onlineish.length) list.append(h('div', { class: 'grp' }, `Online (${onlineish.length})`));
  onlineish.forEach(c => list.append(contactRow(c)));
  if (groups.offline.length) list.append(h('div', { class: 'grp' }, `Offline (${groups.offline.length})`));
  groups.offline.forEach(c => list.append(contactRow(c)));
  if (!contacts.length) list.append(h('div', { class: 'grp' }, 'Nog geen spraakclips (content/audio/fanmail/).'));
  function contactRow(c) {
    return h('div', { class: 'contact', dataset: { key: c.key }, onclick: () => { main.classList.remove('show-list'); onNavigate(c.key); } },
      h('div', { class: `st ${c.status}` }),
      h('div', { class: 'dn' }, c.display || c.name, h('small', null, c.pm ? c.pm + ' · ' : '', h('span', { class: 'dur' }, '🎤 ' + fmtDuration(c.duration)))));
  }

  // conversation -------------------------------------------------------------------------------------
  const log = h('div', { class: 'log' });
  const clips = {};
  log.append(h('div', { class: 'sys' }, todo(chat.welcome)));
  for (const c of contacts) {
    const clip = clipPlayer(c);
    clips[c.key] = clip;
    log.append(h('div', { class: 'msg clipmsg', id: 'clip-' + c.key },
      h('div', { class: 'says' }, h('span', { class: 'av' }, c.avatar), h('span', null, c.display || c.name, ' zegt:'), h('span', { class: 'tm' }, STATUS_LABEL[c.status] || 'Online')),
      h('div', { class: 'line sys' }, `${c.name} heeft een spraakclip verzonden (${fmtDuration(c.duration)})`),
      clip.el,
      c.text ? h('div', { class: 'line' }, todo(c.text)) : null));
  }
  const msgs = h('div', { class: 'msgs' });
  log.append(msgs);

  const toggle = h('button', { class: 'btn small list-toggle', onclick: () => main.classList.toggle('show-list') }, `👥 ${contacts.length}`);
  const head = h('div', { class: 'hd' }, h('div', { class: 'av' }, '💖'),
    h('div', { style: { minWidth: 0 } }, h('b', null, site.displayName), h('small', null, `Aan: ${site.name} <${site.msnEmail}> en ${contacts.length} fans`)),
    toggle);

  // input --------------------------------------------------------------------------------------------
  const ta = h('textarea', { placeholder: `Typ hier je bericht voor ${site.name}...`, maxlength: 600 });
  const nameInp = h('input', { type: 'text', placeholder: 'Je naam', maxlength: 40 });
  const who = h('div', { class: 'who-line' });
  const renderWho = () => {
    const n = getName();
    clear(who).append(...(n
      ? [h('span', null, 'Je chat als ', h('b', null, avatarFor(n), ' ', n)), ' · ', h('a', { href: '#', onclick: (e) => { e.preventDefault(); setName(''); renderWho(); } }, 'iemand anders')]
      : [h('span', null, 'Wie ben jij? '), nameInp]));
  };
  renderWho();
  const sendBtn = h('button', { class: 'btn pink', onclick: send }, 'Verzenden');
  const status = h('span', { class: 'send-status' });
  async function send() {
    let n = getName();
    if (!n) { n = nameInp.value.trim(); if (!n) { nameInp.focus(); return nudge(win); } setName(n); renderWho(); }
    const t = ta.value.trim();
    if (!t) { ta.focus(); return nudge(win); }
    sendBtn.disabled = true; status.textContent = 'verzenden...';
    try {
      const r = await onSend({ name: n, message: t });
      ta.value = ''; sfx.pop();
      status.textContent = r?.local ? 'bewaard op dit toestel (chat is offline)' : '';
    } catch (e) { console.error(e); status.textContent = 'oei, dat lukte niet: ' + (e.message || e); }
    sendBtn.disabled = false;
    ta.focus();
  }
  ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
  nameInp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); ta.focus(); } });
  const emo = (chat.emoticons || ['😊', '😉', '😛', '😍', '❤️', '🎂']).map(x => h('span', { class: 'emo', title: 'invoegen', onclick: () => insert(x) }, x));
  function insert(x) { const s = ta.selectionStart ?? ta.value.length; ta.setRangeText(x, s, ta.selectionEnd ?? s, 'end'); ta.focus(); }
  const input = h('div', { class: 'input' },
    h('div', { class: 'tools' }, ...emo, h('span', { class: 'sep' }), h('button', { class: 'btn small', onclick: () => { nudge(win); log.append(h('div', { class: 'sys' }, 'Je hebt zojuist een Buzzer verzonden. (Elisa voelde dat in Parijs.)')); scrollToEnd(); } }, '⚡ Buzzer')),
    who, ta,
    h('div', { class: 'send' }, status, sendBtn));
  convo.append(head, log, input);

  // messages -----------------------------------------------------------------------------------------
  const rendered = new Map();   // id -> element
  function setMessages(listAsc) {
    const ids = new Set(listAsc.map(m => m.id));
    for (const [id, el] of rendered) if (!ids.has(id)) { el.remove(); rendered.delete(id); }
    let last = null;
    for (const m of listAsc) {
      let el = rendered.get(m.id);
      if (!el) {
        el = h('div', { class: 'msg', dataset: { id: m.id } },
          h('div', { class: 'says' }, h('span', { class: 'av' }, avatarFor(m.name)), h('span', null, m.name, ' zegt:'), h('span', { class: 'tm' })),
          h('div', { class: 'line' }, m.message));
        rendered.set(m.id, el);
        if (last) last.after(el); else msgs.prepend(el);
      }
      el.classList.toggle('pending', !!m.pending);
      el.querySelector('.tm').textContent = m.pending ? 'wordt verzonden...' : m.local ? 'alleen op dit toestel' : relDate(m.createdAt);
      last = el;
    }
  }
  function scrollToEnd() {
    if (getComputedStyle(log).overflowY === 'auto') log.scrollTop = log.scrollHeight;
    else msgs.lastElementChild?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }
  function nearEnd() {
    if (getComputedStyle(log).overflowY === 'auto') return log.scrollHeight - log.scrollTop - log.clientHeight < 120;
    const r = input.getBoundingClientRect(); return r.top < window.innerHeight + 200;
  }
  function focusContact(key) {
    const el = log.querySelector('#clip-' + CSS.escape(key)); if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1500);
    clips[key]?.play();
  }
  return { el: win, setMessages, scrollToEnd, nearEnd, focusContact, focusInput: () => ta.focus() };
}

// voice-clip bubble with a fake waveform, driven by the shared player
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
    if (!el.isConnected) return off();
    btn.textContent = src === c.src && playing ? '❚❚' : '▶';
  });
  return { el, play };
}
