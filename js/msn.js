// Windows Live Messenger 8.5 look-alike, opened from the dock as a modal XP window.
// Sign-in (name only) -> conversation list left (group + one private conversation per fan with a voice/video
// message) -> conversation right. Everyone may post in the group; a private conversation accepts posts only from
// that contact (client-side check on the username) or from Elisa.
import { h, clear, fmtDuration, fmtTime, relDate, todo, svg, store, pick } from './util.js';
import { sfx } from './sfx.js';
import { player } from './player.js';

const butterfly = () => svg('0 0 64 64', `
  <defs><linearGradient id="bw" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7cc4ff"/><stop offset="1" stop-color="#1f5fbf"/></linearGradient>
  <linearGradient id="bw2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8be08b"/><stop offset="1" stop-color="#1c8a3c"/></linearGradient></defs>
  <path d="M32 34 C18 8 2 12 6 26 C9 36 22 38 32 34Z" fill="url(#bw)"/><path d="M32 34 C46 8 62 12 58 26 C55 36 42 38 32 34Z" fill="url(#bw2)"/>
  <path d="M32 36 C20 44 10 56 18 58 C26 60 30 46 32 36Z" fill="url(#bw2)" opacity=".9"/><path d="M32 36 C44 44 54 56 46 58 C38 60 34 46 32 36Z" fill="url(#bw)" opacity=".9"/>
  <ellipse cx="32" cy="36" rx="3" ry="10" fill="#234"/><path d="M30 27 C26 22 24 20 22 18 M34 27 C38 22 40 20 42 18" stroke="#234" stroke-width="1.5" fill="none"/>`);

const STATUS_LABEL = { online: 'Online', away: 'Afwezig', busy: 'Bezet', offline: 'Offline' };

// XP "Luna" title bar
export function xpTitle(title, { onMin, onMax, onClose, icon = '🦋' } = {}) {
  const t = h('span', { class: 'xp-title-text' }, title);
  const bar = h('div', { class: 'xp-title' }, h('span', { class: 'xp-icon' }, icon), t,
    h('div', { class: 'xp-ctl' },
      h('button', { class: 'xp-btn min', title: 'Minimaliseren', onclick: onMin }, '_'),
      h('button', { class: 'xp-btn max', title: 'Maximaliseren', onclick: onMax }, '□'),
      h('button', { class: 'xp-btn close', title: 'Sluiten', onclick: onClose }, '✕')));
  bar.setTitle = (s) => { t.textContent = s; };
  return bar;
}

export function nudge(win) {
  sfx.nudge();
  win.classList.remove('shake'); void win.offsetWidth; win.classList.add('shake');
}

// ---- toasts (they spring from the Messenger dock button) ------------------------------------------
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

// ---- messenger -----------------------------------------------------------------------------------
export function createMessenger({ site, cfg, contacts, emoticons, avatarFor, identity, onSend, onSignIn, onOpenChange }) {
  const { getUser, setUser, isElisa, contactFor, displayNameFor } = identity;
  let user = getUser();
  let room = null;            // current room key ('group' or contact key)
  let isOpen = false;
  let all = [];               // all live messages (asc)
  let seeds = [];             // group seed messages
  const READ = 'msn.read';
  const lastRead = () => store.get(READ, {});
  const markRead = (r) => { const m = lastRead(); m[r] = new Date().toISOString(); store.set(READ, m); refreshBadges(); };

  const roomMsgs = (r) => (r === 'group' ? seeds : []).concat(all.filter(m => (m.room || 'group') === r));
  const contactOf = (r) => contacts.find(c => c.key === r);
  const canPost = (r) => !!user && (r === 'group' || isElisa(user) || contactFor(user)?.key === r);
  const clipCount = (c) => (c.audio ? 1 : 0) + (c.video ? 1 : 0) + (c.text ? 1 : 0);
  function roomUnread(r) {
    const seen = lastRead()[r];
    const mine = (m) => user && displayNameFor(m.name) === displayNameFor(user);
    if (!seen) return roomMsgs(r).filter(m => !mine(m)).length + (r === 'group' ? 0 : clipCount(contactOf(r)));
    return all.filter(m => (m.room || 'group') === r && m.createdAt > new Date(seen) && !mine(m)).length;
  }
  const unread = () => ['group', ...contacts.map(c => c.key)].reduce((n, r) => n + roomUnread(r), 0);

  // window ------------------------------------------------------------------------------------------
  const title = xpTitle('Windows Live Messenger', { onMin: () => close(), onMax: () => win.classList.toggle('maxi'), onClose: () => close() });
  const menubar = h('div', { class: 'msn-menubar' },
    h('span', { class: 'menu', onclick: (e) => { e.stopPropagation(); fileMenu.hidden = !fileMenu.hidden; } }, 'Bestand'),
    h('span', { class: 'menu' }, 'Contactpersonen'), h('span', { class: 'menu' }, 'Acties'), h('span', { class: 'menu' }, 'Extra'), h('span', { class: 'menu' }, 'Help'));
  const fileMenu = h('div', { class: 'xp-menu', hidden: true },
    h('div', { onclick: () => { fileMenu.hidden = true; signOut(); } }, 'Afmelden'),
    h('div', { onclick: () => { fileMenu.hidden = true; nudge(win); } }, 'Buzzer verzenden'),
    h('div', { class: 'sep' }),
    h('div', { onclick: () => { fileMenu.hidden = true; close(); } }, 'Sluiten'));
  document.addEventListener('click', () => { fileMenu.hidden = true; });
  const body = h('div', { class: 'msn-body' });
  const status = h('div', { class: 'xp-status' }, h('span', { class: 'st-l' }), h('span', { class: 'st-r' }, '🦋'));
  const win = h('div', { class: 'xp-win msn-window' }, title, h('div', { class: 'menubar-wrap' }, menubar, fileMenu), body, status);
  const root = h('div', { class: 'msn-backdrop', hidden: true, onclick: (e) => { if (e.target === root) close(); } }, win);
  document.body.append(root);
  const setStatus = (s) => { status.querySelector('.st-l').textContent = s; };

  // sign-in panel -----------------------------------------------------------------------------------
  let pendingRoom = null;
  function showSignIn() {
    title.setTitle('Windows Live Messenger');
    const inp = h('input', { type: 'text', class: 'xp-input', placeholder: 'naam of e-mailadres', maxlength: 40, autocomplete: 'off' });
    const go = () => {
      const v = inp.value.trim();
      if (!v) { inp.focus(); return nudge(win); }
      sfx.unlock(); player.unlock(); sfx.signin();
      user = v; setUser(v);
      const steps = ['Verbinding maken met .NET Messenger Service...', 'Wachtwoord controleren... (er is er geen)', 'Contactpersonen laden... (allemaal fans)', 'Cool-niveau berekenen... (maximaal)'];
      const msg = h('div', { class: 'msg' }, steps[0]);
      clear(body).append(h('div', { class: 'signing' }, h('div', null, h('b', null, `Aanmelden als ${v}`)),
        h('div', { class: 'dots' }, h('span'), h('span'), h('span'), h('span')), h('div', { class: 'prog' }, h('i')), msg));
      let i = 0; const iv = setInterval(() => { i++; if (i < steps.length) msg.textContent = steps[i]; }, 380);
      setTimeout(() => { clearInterval(iv); showMain(); select(pendingRoom || 'group'); pendingRoom = null; onSignIn?.(v); }, 1600);
    };
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    clear(body).append(h('div', { class: 'signin' },
      h('div', { class: 'logo' }, butterfly(), h('span', null, 'Windows Live', h('br'), 'Messenger')),
      h('div', { class: 'signin-field' }, h('label', null, 'E-mailadres:'), inp),
      h('div', { class: 'signin-field' }, h('label', null, 'Wachtwoord:'), h('input', { type: 'password', class: 'xp-input', value: 'geenwachtwoord', disabled: true, title: 'Niet nodig. Het is 2008.' })),
      h('div', { class: 'signin-field' }, h('label', null, 'Status:'), h('div', { class: 'xp-input status' }, h('i'), h('span', null, 'Online'), h('span', { class: 'arr' }, '▼'))),
      h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: true }), 'Mij automatisch aanmelden'),
      h('button', { class: 'xp-button primary', onclick: go }, 'Aanmelden'),
      h('p', { class: 'hint' }, todo(cfg.signinHint)),
    ));
    setStatus('Niet aangemeld');
    setTimeout(() => inp.focus(), 50);
  }
  function signOut() { user = ''; setUser(''); room = null; main = null; showSignIn(); }

  // main: list + conversation -------------------------------------------------------------------------
  let main, list, convo, convList;
  function showMain() {
    const meContact = contactFor(user);
    const meDisplay = isElisa(user) ? site.displayName : (meContact?.display || user);
    const mePm = isElisa(user) ? site.personalMessage : (meContact?.pm || `(8) fan van ${site.name} (8)`);
    const meAv = isElisa(user) ? '💖' : (meContact?.avatar || avatarFor(user));
    list = h('div', { class: 'msn-left' },
      h('div', { class: 'me-head' }, h('div', { class: 'dp' }, meAv),
        h('div', { class: 'me-txt' }, h('b', null, meDisplay, ' ', h('span', { class: 'online-dot' })), h('small', null, mePm))),
      h('div', { class: 'search' }, h('span', null, '🔍'), h('span', { class: 'ph' }, 'Zoek een contactpersoon of typ een nummer')),
      convList = h('div', { class: 'conv-list' }),
      adBanner());
    convo = h('div', { class: 'msn-right' }, h('div', { class: 'empty' }, h('div', null, h('div', { style: { fontSize: '36px' } }, '🦋'), 'Kies links een gesprek.')));
    main = h('div', { class: 'msn-main' }, list, convo);
    clear(body).append(main);
    renderList();
    setStatus(`Aangemeld als ${displayNameFor(user)}${isElisa(user) ? ' (dat is Elisa zelf!!!)' : ''}`);
  }
  function adBanner() {
    const t = h('div', { class: 'ad' }, pick(cfg.ads));
    setInterval(() => { if (t.isConnected) t.textContent = pick(cfg.ads); }, 12000);
    t.addEventListener('click', () => { t.textContent = 'Nee.'; });
    return t;
  }
  function renderList() {
    if (!convList) return;
    const groupRow = h('div', { class: 'conv', dataset: { room: 'group' }, onclick: () => select('group') },
      h('span', { class: 'st online grp' }), h('div', { class: 'dn' }, h('b', null, cfg.groupName), h('small', null, `${cfg.groupPm} · ${roomMsgs('group').length} berichten`)), h('span', { class: 'badge' }));
    const rows = contacts.map(c => h('div', { class: 'conv', dataset: { room: c.key }, onclick: () => select(c.key) },
      h('span', { class: `st ${c.status}` }),
      h('div', { class: 'dn' }, h('b', null, c.display || c.name), h('small', null, [c.audio ? '🎤 ' : '', c.video ? '🎥 ' : '', c.pm || ''].join(''))),
      h('span', { class: 'badge' })));
    clear(convList).append(h('div', { class: 'grp' }, `Gesprekken (${contacts.length + 1})`), groupRow, ...rows,
      h('div', { class: 'grp' }, 'Offline (0)'), h('div', { class: 'empty-grp' }, 'Niemand. Iedereen is online voor Elisa.'));
    refreshBadges();
  }
  function refreshBadges() {
    convList?.querySelectorAll('.conv').forEach(r => { const n = roomUnread(r.dataset.room); const b = r.querySelector('.badge'); b.textContent = n ? String(n) : ''; r.classList.toggle('active', r.dataset.room === room); });
    onOpenChange?.(isOpen, unread());
  }

  // conversation ------------------------------------------------------------------------------------
  let msgsEl = null, logEl = null, rendered = new Map();
  function select(r) {
    if (!main) return;
    room = r;
    const c = contactOf(r);
    const isGroup = r === 'group';
    if (!isGroup && !c) return select('group');
    const displayName = isGroup ? cfg.groupName : (c.display || c.name);
    const pm = isGroup ? cfg.groupPm : (c.pm || '');
    const av = isGroup ? '👥' : (c.avatar || '🙂');
    title.setTitle(`${isGroup ? cfg.groupName : c.name} - Gesprek`);
    main.classList.add('show-convo');
    rendered = new Map();

    logEl = h('div', { class: 'log' });
    if (isGroup) logEl.append(h('div', { class: 'sys' }, todo(cfg.groupWelcome)));
    else {
      logEl.append(h('div', { class: 'sys' }, `${c.name} is nu ${STATUS_LABEL[c.status] || 'Online'}.`));
      logEl.append(h('div', { class: 'sys' }, 'Accepteer nooit bestanden van vreemden. Deze persoon ken je.'));
      if (c.audio) logEl.append(msgBlock(c, [h('div', { class: 'line sys' }, `${c.name} heeft een spraakclip verzonden (${fmtDuration(c.audio.duration)})`), clipPlayer(c).el]));
      if (c.video) logEl.append(msgBlock(c, [h('div', { class: 'line sys' }, `${c.name} heeft een videoclip verzonden (${fmtDuration(c.video.duration)})`), videoClip(c)]));
      if (c.text) logEl.append(msgBlock(c, [h('div', { class: 'line' }, todo(c.text))]));
    }
    msgsEl = h('div', { class: 'msgs' });
    logEl.append(msgsEl);

    const head = h('div', { class: 'conv-head' },
      h('button', { class: 'xp-button back', onclick: () => { main.classList.remove('show-convo'); room = null; title.setTitle('Windows Live Messenger'); refreshBadges(); } }, '◀'),
      h('div', { class: 'ch-txt' }, h('b', null, displayName), h('small', null, pm)),
      h('div', { class: 'dp' }, av));
    const to = h('div', { class: 'to' }, isGroup ? `Aan: ${site.name} <${site.msnEmail}>; ${contacts.map(x => x.name).join('; ')}` : `Aan: ${c.name} <${c.key}@hotmail.com>`);
    const side = h('div', { class: 'dps' }, h('div', { class: 'dp' }, av), h('div', { class: 'dp me' }, isElisa(user) ? '💖' : (contactFor(user)?.avatar || avatarFor(user))));
    clear(convo).append(head, to, h('div', { class: 'conv-mid' }, logEl, side), inputArea(r, c));
    syncMsgs();
    markRead(r);
    scrollToEnd(true);
  }
  function msgBlock(c, children) {
    return h('div', { class: 'msg' }, h('div', { class: 'says' }, h('span', null, c.display || c.name, ' zegt:'), h('span', { class: 'tm' }, 'eerder')), ...children);
  }
  function inputArea(r, c) {
    if (!canPost(r)) {
      const notice = (cfg.privateNotice || '').replace(/\{contact\}/g, c?.name || '');
      return h('div', { class: 'input readonly' }, h('div', { class: 'ro' }, '🔒 ', notice), h('button', { class: 'xp-button', onclick: () => select('group') }, 'Naar het groepsgesprek'));
    }
    const ta = h('textarea', { placeholder: r === 'group' ? `Typ hier je bericht voor ${site.name} en de fanclub...` : 'Typ hier je bericht...', maxlength: 600 });
    const sendBtn = h('button', { class: 'xp-button primary', onclick: send }, 'Verzenden');
    const st = h('span', { class: 'send-status' });
    async function send() {
      const t = ta.value.trim(); if (!t) { ta.focus(); return nudge(win); }
      sendBtn.disabled = true; st.textContent = 'verzenden...';
      try { const res = await onSend({ name: user, message: t, room: r }); ta.value = ''; sfx.pop(); st.textContent = res?.local ? 'bewaard op dit toestel (offline)' : ''; }
      catch (e) { console.error(e); st.textContent = 'oei: ' + (e.message || e); }
      sendBtn.disabled = false; ta.focus();
    }
    ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
    const insert = (x) => { const s = ta.selectionStart ?? ta.value.length; ta.setRangeText(x, s, ta.selectionEnd ?? s, 'end'); ta.focus(); };
    return h('div', { class: 'input' },
      h('div', { class: 'tools' }, ...emoticons.map(x => h('span', { class: 'emo', onclick: () => insert(x) }, x)), h('span', { class: 'sep' }),
        h('button', { class: 'tool', title: 'Buzzer verzenden', onclick: () => { nudge(win); logEl.append(h('div', { class: 'sys' }, 'Je hebt een Buzzer verzonden. (Elisa voelde dat in Parijs.)')); scrollToEnd(true); } }, '⚡'),
        h('button', { class: 'tool', title: 'Spraakclip (F2)', onclick: () => toast({ from: 'Systeem', avatar: '🎤', text: 'Spraakclips stuur je via WhatsApp naar de webmaster, die zet ze hier.' }) }, '🎤'),
        h('button', { class: 'tool', title: 'Bestanden verzenden', onclick: () => toast({ from: 'Systeem', avatar: '📎', text: 'Bestandsoverdracht mislukt (56k). Probeer het in 2010 opnieuw.' }) }, '📎')),
      ta,
      h('div', { class: 'send' }, st, sendBtn));
  }
  function syncMsgs() {
    if (!msgsEl || !room) return;
    const listAsc = roomMsgs(room);
    const ids = new Set(listAsc.map(m => m.id));
    for (const [id, el] of rendered) if (!ids.has(id)) { el.remove(); rendered.delete(id); }
    let last = null;
    for (const m of listAsc) {
      let el = rendered.get(m.id);
      if (!el) {
        const name = displayNameFor(m.name);
        el = h('div', { class: 'msg' + (user && displayNameFor(user) === name ? ' mine' : '') },
          h('div', { class: 'says' }, h('span', null, name, ' zegt:'), h('span', { class: 'tm' })),
          h('div', { class: 'line' }, m.message));
        rendered.set(m.id, el);
        if (last) last.after(el); else msgsEl.prepend(el);
      }
      el.classList.toggle('pending', !!m.pending);
      el.querySelector('.tm').textContent = m.pending ? 'wordt verzonden...' : m.local ? 'alleen op dit toestel' : relDate(m.createdAt);
      last = el;
    }
    const lastMsg = listAsc[listAsc.length - 1];
    if (lastMsg && !lastMsg.pending) setStatus(`Laatste bericht ontvangen om ${fmtTime(lastMsg.createdAt)}`);
  }
  const nearEnd = () => !logEl || logEl.scrollHeight - logEl.scrollTop - logEl.clientHeight < 140;
  function scrollToEnd(force = false) { if (logEl && (force || nearEnd())) requestAnimationFrame(() => { logEl.scrollTop = logEl.scrollHeight; }); }

  // open / close ------------------------------------------------------------------------------------
  function open(r) {
    if (!isOpen) {
      isOpen = true; root.hidden = false; document.body.classList.add('msn-open');
      user = getUser();
      if (!user) { pendingRoom = r || null; showSignIn(); }
      else { showMain(); select(r || 'group'); }
    } else if (r) select(r);
    onOpenChange?.(true, unread());
  }
  function close() {
    if (!isOpen) return;
    isOpen = false; root.hidden = true; document.body.classList.remove('msn-open');
    onOpenChange?.(false, unread());
  }
  function setMessages({ live, seed }) {
    all = live; seeds = seed;
    const wasNear = nearEnd();
    if (main) { syncMsgs(); if (room && isOpen) markRead(room); if (wasNear) scrollToEnd(); refreshBadges(); renderCounts(); }
    else onOpenChange?.(isOpen, unread());
  }
  function renderCounts() { const g = convList?.querySelector('[data-room="group"] small'); if (g) g.textContent = `${cfg.groupPm} · ${roomMsgs('group').length} berichten`; }

  return { open, close, toggle: () => (isOpen ? close() : open()), setMessages, unread, get isOpen() { return isOpen; }, get room() { return isOpen ? room : null; }, root, win };
}

// ---- clips ------------------------------------------------------------------------------------------
function clipPlayer(c) {
  const a = c.audio;
  const bars = Array.from({ length: 28 }, (_, i) => h('i', { style: { height: (25 + 60 * Math.abs(Math.sin(i * 1.7 + c.key.length))) + '%' } }));
  const btn = h('button', { class: 'pl', title: 'Afspelen' }, '▶');
  const tm = h('span', { class: 'tm' }, fmtDuration(a.duration));
  const el = h('div', { class: 'clip' }, btn, h('div', { class: 'wave' }, bars), tm);
  const play = () => player.play(a.src, {
    onTick: (t, d) => { const f = d ? t / d : 0; bars.forEach((b, i) => b.classList.toggle('on', i / bars.length <= f)); tm.textContent = fmtDuration(t) + ' / ' + fmtDuration(d || a.duration); },
    onEnd: () => { bars.forEach(b => b.classList.remove('on')); tm.textContent = fmtDuration(a.duration); },
  });
  btn.addEventListener('click', play);
  const off = player.onChange((src, playing) => { if (!el.isConnected) return off(); btn.textContent = src === a.src && playing ? '❚❚' : '▶'; });
  return { el, play };
}
function videoClip(c) {
  const v = c.video;
  const video = h('video', { controls: true, playsinline: true, preload: 'metadata', poster: v.poster, src: v.src });
  video.addEventListener('play', () => { player.stop(); document.querySelectorAll('video').forEach(o => { if (o !== video) o.pause(); }); });
  video.addEventListener('ended', () => player.resume());
  return h('div', { class: 'vclip' + (v.h > v.w ? ' portrait' : '') }, h('div', { class: 'vclip-title' }, `Webcam van ${c.name}`), video);
}
