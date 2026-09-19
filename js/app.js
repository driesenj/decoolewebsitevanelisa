// De coole website van Elisa — main module. Profile page with tabs (#profiel, #fotos/album/3, #vlog) and a
// bottom-right dock with two minimised apps: Windows Live Messenger (modal window) and BonziBUDDY.
import { h, $, clear, store, session, fmtDate, relDate, fmtDuration, fmtNum, template, todo, pick, shuffle, hasMouse, norm } from './util.js';
import { sfx } from './sfx.js';
import { player } from './player.js';
import { db, initDb } from './db.js';
import { createMessenger, toast, xpTitle, nudge } from './msn.js';
import { createDock } from './dock.js';
import { createBonzi } from './bonzi.js';

const TABS = [['profiel', 'Profiel'], ['fotos', "Foto's"], ['vlog', 'PVO Vlog']];
const MEDIA = 'media/';
const mediaUrl = (file, v) => MEDIA + file + (v ? '?v=' + v : '');
let C, M, site, vars;           // content, manifest, site block, template vars
const live = { messages: [], visitors: [], likes: {}, votes: [] };
let messagesLoaded = false;
let dock, msn, bonzi, contacts = [];

// ---- boot ---------------------------------------------------------------------------------------
async function boot() {
  const [content, manifest] = await Promise.all([
    fetch('content/content.json').then(r => r.json()),
    fetch(MEDIA + 'manifest.json').then(r => r.ok ? r.json() : {}).catch(() => ({})),
  ]);
  M = { albums: [], assets: {}, audio: { fanmail: [], singles: {} }, videos: [], videoFanmail: [], ...manifest };
  const s = content.site;
  vars = {
    name: s.name, age: new Date().getFullYear() - new Date(s.birthday).getFullYear(), city: s.city, webmaster: s.webmaster,
    msnEmail: s.msnEmail, displayName: s.displayName,
    kid1: content.kids?.[0]?.name || 'de grote', kid2: content.kids?.[1]?.name || 'de kleine',
    kid1age: content.kids?.[0]?.age || '', kid2age: content.kids?.[1]?.age || '',
    birthdayLong: fmtDate(s.birthday),
  };
  C = template(content, vars);
  site = C.site;
  document.title = site.title;
  contacts = buildContacts();

  const dbReady = initDb();
  renderShell();
  setupDesktop();
  window.addEventListener('hashchange', route);
  if (!location.hash) history.replaceState(null, '', '#profiel');

  await dbReady;
  startLive();
  route();
  await splash();          // the front door: ENTER starts the song and, being a tap, unlocks sound for the rest of the visit

  if (hasMouse) sparkles();
  setTimeout(startToasts, 40000);
  // first-visit nudges: Messenger flashes with the unread count, Bonzi shows up uninvited (as he did)
  setTimeout(() => {
    if (!msn.isOpen && msn.unread() > 0) {
      dock.flash('msn', true);
      toast({ from: null, avatar: '📨', text: h('span', null, h('b', null, `Je hebt ${msn.unread()} nieuwe berichten.`), h('br'), 'Klik hier om ze te lezen.'), onClick: () => openMsn(), ms: 10000 });
    }
  }, 4000);
  if (!store.get('bonzi.dismissed') && !store.get('bonzi.seen')) setTimeout(() => { if (!msn.isOpen) { bonzi.show(true); store.set('bonzi.seen', true); } }, 20000);
}

// ---- identity: who is typing? ------------------------------------------------------------------------
const getUser = () => store.get('msn.user', '');
const isElisa = (u) => !!u && [site.msnEmail, site.name, ...(site.aliases || [])].some(a => norm(a) === norm(u));
const contactFor = (u) => u ? contacts.find(c => c.key === norm(u) || norm(c.name) === norm(u) || (c.aliases || []).some(a => norm(a) === norm(u))) : null;
const displayNameFor = (u) => isElisa(u) ? site.name : (contactFor(u)?.name || String(u || '').trim());
function setUser(v) {
  const was = getUser();
  store.set('msn.user', v);
  document.querySelectorAll('.visitor-box').forEach(b => b.dispatchEvent(new Event('refresh')));
  if (v && v !== was) db.addVisitor(displayNameFor(v)).catch(() => { });
}
function avatarFor(name) {
  let x = 7; for (const ch of String(name || '').toLowerCase()) x = (x * 31 + ch.codePointAt(0)) >>> 0;
  return C.avatars[x % C.avatars.length];
}
// One contact per fan, with all of their clips in one conversation. Files that only differ in a trailing number belong
// to the same fan: "Fatou.mp4", "Fatou 2.mp4", "Fatou (3).mp4" (or the "Fatou-2.mp4" the Immich sync makes for a repeated
// description) -> contact "Fatou" with three videos. Order of contacts = order in content.json, extras after.
const person = (key) => key.replace(/[-_ ]+\(?\d+\)?$/, '') || key;
const personName = (name) => name.replace(/[\s_-]+\(?\d+\)?$/, '') || name;
function buildContacts() {
  const cfg = C.msn.contacts;
  const groups = new Map();      // person key -> { audios, videos } in file order
  const groupOf = (key) => { const k = person(key); if (!groups.has(k)) groups.set(k, { audios: [], videos: [] }); return groups.get(k); };
  for (const a of M.audio.fanmail) groupOf(a.key).audios.push(a);
  for (const v of M.videoFanmail) groupOf(v.key).videos.push(v);
  // within a fan: the plain file first, then 2, 3, ... (natural file order would put "Fatou 2" before "Fatou")
  const seq = (key) => +(key.match(/[-_ ]+\(?(\d+)\)?$/)?.[1] || 0);
  for (const g of groups.values()) for (const list of [g.audios, g.videos]) list.sort((a, b) => seq(a.key) - seq(b.key) || a.key.localeCompare(b.key));
  const order = Object.keys(cfg).filter(k => !k.startsWith('_'));
  return [...groups.keys()].sort((a, b) => { const ia = order.indexOf(a), ib = order.indexOf(b); return (ia < 0 ? 1e9 : ia) - (ib < 0 ? 1e9 : ib); }).map(key => {
    const meta = cfg[key] || {}, g = groups.get(key);
    const first = g.audios[0] || g.videos[0];
    const name = meta.name || (first?.name && personName(first.name)) || key.replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    return {
      key, name, display: meta.display || name, pm: meta.pm || '', status: meta.status || C.msn.defaultStatus || 'online', avatar: meta.avatar || '🙂',
      aliases: meta.aliases || [], text: meta.text,
      audios: g.audios.map(a => ({ src: mediaUrl('audio/' + a.file, a.v), duration: a.duration })),
      videos: g.videos.map(v => ({ src: mediaUrl('video/' + v.file, v.v), poster: mediaUrl('video/' + v.poster, v.v), duration: v.duration, w: v.w, h: v.h })),
    };
  });
}

// ---- desktop: dock + messenger + bonzi -------------------------------------------------------------
function setupDesktop() {
  dock = createDock();
  msn = createMessenger({
    site, cfg: C.msn, contacts, emoticons: C.emoticons, avatarFor,
    identity: { getUser, setUser, isElisa, contactFor, displayNameFor },
    onSend: ({ name, message, room }) => db.addMessage({ name, message, room }),
    onSignIn: (name) => {
      const welkom = M.audio.singles?.welkom;
      if (welkom && !store.get('welkom.done')) { store.set('welkom.done', true); setTimeout(() => player.play(mediaUrl('audio/' + welkom.file, welkom.v)), 300); }
      if (isElisa(name) && !session.get('partyDone')) setTimeout(party, 600);
      else toast({ from: null, avatar: '🦋', text: h('span', null, h('b', null, displayNameFor(name)), ' heeft zich zojuist aangemeld.') });
    },
    onOpenChange: (open, unread) => { dock.setActive('msn', open); dock.badge('msn', unread); if (open) dock.flash('msn', false); },
  });
  dock.add({ id: 'msn', icon: '🦋', label: 'Windows Live Messenger', short: 'Messenger', onClick: () => (msn.isOpen ? msn.close() : openMsn()) });
  bonzi = createBonzi({ cfg: C.bonzi, onSing: () => { const src = songSrc(); if (src && !(player.src === src && player.playing)) player.play(src); } });
  bonzi.onChange = (shown) => dock.setActive('bonzi', shown);
  dock.add({ id: 'bonzi', icon: '🦍', label: C.bonzi.name, short: 'Bonzi', onClick: () => { store.set('bonzi.seen', true); bonzi.toggle(); } });
  // back button closes the Messenger window on phones
  window.addEventListener('popstate', (e) => { if (!e.state?.msn && msn.isOpen) msn.close(); });
}
function openMsn(room) {
  if (!msn.isOpen) history.pushState({ msn: 1 }, '', location.href);
  msn.open(room);
}

// ---- shell: profile card + tabs -------------------------------------------------------------------
function renderShell() {
  const views = store.get('pageviews', site.visitorsStart) + 1;
  store.set('pageviews', views);

  const card = $('#profile-card');
  const sparks = [[-10, -8, 0], [104, -12, .3], [118, 60, .6], [96, 112, .15], [-14, 100, .45], [50, -18, .8]].map(([x, y, d]) =>
    h('span', { class: 'spark', style: { left: x + 'px', top: y + 'px', animationDelay: d + 's' } }, '✦'));
  const avatarSrc = M.assets[site.avatar] ? mediaUrl('photos/' + site.avatar, M.assets[site.avatar].v) : null;
  clear(card).append(
    h('div', { class: 'avatar' }, avatarSrc ? h('img', { src: avatarSrc, alt: site.name }) : h('div', { class: 'noavatar' }, '💖'), ...sparks),
    h('div', { class: 'who' },
      h('h1', { class: 'glitter' }, site.displayName),
      h('p', { class: 'pm' }, site.personalMessage),
      h('p', { class: 'meta' }, h('span', { class: 'online' }), h('b', null, 'Online'), ` · Vrouw · ${vars.age} jaar · ${site.city} · Laatst online: `, h('b', null, 'nu, vanuit ', site.location)),
      h('div', { class: 'actions' },
        h('button', { class: 'btn pink', onclick: () => openMsn('group') }, '💬 Stuur me een bericht'),
        h('button', { class: 'btn', onclick: () => { sfx.pop(); toast({ from: 'Systeem', avatar: '🦋', text: `${site.name} is al je vriend(in). Al jaren. Dat weet je toch?` }); } }, '+ Voeg toe als vriend'))),
    h('div', { class: 'side-stats' },
      h('div', null, h('b', null, fmtNum(views)), h('br'), 'profielbezoeken'),
      h('div', null, h('b', null, '∞'), h('br'), 'vrienden'),
      h('div', null, h('b', { id: 'msg-count' }, '0'), h('br'), 'berichten')),
    visitorBox(),
  );

  const tabs = $('#tabs');
  clear(tabs).append(...TABS.map(([id, label]) => h('a', { href: '#' + id, dataset: { tab: id } }, label, ' ', h('span', { class: 'n', dataset: { count: id } }))));
  updateCounts();
}

const messageCount = () => live.messages.length + C.msn.seed.length;
function updateCounts() {
  const counts = { fotos: M.albums.reduce((n, a) => n + a.count, 0) || null, vlog: M.videos.length || null };
  for (const [k, v] of Object.entries(counts)) { const el = $(`[data-count="${k}"]`); if (el) el.textContent = v ? `(${v})` : ''; }
  const mc = $('#msg-count'); if (mc) mc.textContent = fmtNum(messageCount());
}

function visitorBox() {
  const box = h('div', { class: 'visitor-box' });
  const render = () => {
    const u = getUser();
    clear(box).append(...(u
      ? [h('span', null, `👋 Hey ${displayNameFor(u)}! Je bent aangemeld bij Messenger.`), h('button', { class: 'btn small', onclick: () => openMsn() }, 'Open Messenger')]
      : [h('span', null, '👋 Laat weten dat je langs was: '), h('button', { class: 'btn', onclick: () => openMsn() }, '🦋 Aanmelden bij Messenger')]));
  };
  box.addEventListener('refresh', render);
  render();
  return box;
}

function party() {
  session.set('partyDone', true);
  sfx.tada();
  confetti();
  setTimeout(() => toast({ from: site.fanclub, avatar: '🎂', ms: 12000, text: `GELUKKIGE VERJAARDAG ${site.name.toUpperCase()}!!! (L)(L)(L) Dit is allemaal voor jou. Je berichten staan klaar in Messenger.` }), 300);
}
function confetti() {
  const colors = ['#ff3fa4', '#fff', '#ffd400', '#ff0080', '#7c4dff', '#00e0ff'];
  for (let i = 0; i < 90; i++) {
    const c = h('div', { class: 'confetti', style: { left: Math.random() * 100 + 'vw', background: pick(colors), animationDuration: 2.5 + Math.random() * 2.5 + 's', animationDelay: Math.random() * 1.2 + 's', transform: `rotate(${Math.random() * 360}deg)` } });
    document.body.append(c); setTimeout(() => c.remove(), 6000);
  }
}

// ---- live data --------------------------------------------------------------------------------
const seedMessages = () => C.msn.seed.map((s, i) => ({ ...s, id: 'seed' + i, room: 'group', createdAt: new Date(s.date), seed: true }));
function startLive() {
  db.onMessages(list => {
    const asc = [...list].sort((a, b) => a.createdAt - b.createdAt);
    const known = new Set(live.messages.map(m => m.id));
    const me = displayNameFor(getUser());
    const fresh = messagesLoaded ? asc.filter(m => !known.has(m.id) && !m.pending && displayNameFor(m.name) !== me) : [];
    live.messages = asc;
    updateCounts();
    msn.setMessages({ live: asc, seed: seedMessages() });
    if (fresh.length) {
      const m = fresh[fresh.length - 1], room = m.room || 'group';
      sfx.ding();
      if (!(msn.isOpen && msn.room === room)) {
        const where = room === 'group' ? '' : ` (privé met ${contacts.find(c => c.key === room)?.name || room})`;
        toast({ from: displayNameFor(m.name) + where, avatar: avatarFor(m.name), text: m.message.slice(0, 120), onClick: () => openMsn(room) });
        if (!msn.isOpen) dock.flash('msn', true);
      }
    }
    messagesLoaded = true;
  });
  db.onVisitors(list => { live.visitors = list; if (current.tab === 'profiel') renderVisitors(); });
  db.onLikes(map => { live.likes = map; refreshLikes(); });
  db.onVotes(C.poll.id, votes => { live.votes = votes; if (current.tab === 'profiel') renderPoll(); });
}

// ---- router -----------------------------------------------------------------------------------
const current = { tab: null, args: [] };
function route() {
  const [tab = 'profiel', ...args] = location.hash.replace(/^#/, '').split('/').map(decodeURIComponent);
  if (tab === 'msn' || tab === 'chat') {      // deep link: open Messenger over the current tab
    history.replaceState(null, '', '#' + (current.tab || 'profiel'));
    route();
    openMsn(args[0] || undefined);
    return;
  }
  const known = TABS.some(([id]) => id === tab) ? tab : 'profiel';
  document.querySelectorAll('#tabs a').forEach(a => a.classList.toggle('active', a.dataset.tab === known));
  const sameTab = current.tab === known;
  const first = current.tab === null;
  current.tab = known; current.args = args;
  const view = $('#view');
  const scrollUp = () => { if (!sameTab && !first) window.scrollTo({ top: $('#tabs').offsetTop - 6, behavior: 'smooth' }); };
  if (known === 'fotos') { renderFotos(view, args, sameTab); scrollUp(); return; }
  closeLightbox(false);
  clear(view);
  ({ profiel: renderProfiel, vlog: renderVlog })[known](view, args);
  scrollUp();
}
const box = (title, body, { right, cls = '' } = {}) => h('div', { class: 'box ' + cls }, h('h3', null, title, right ? h('span', { class: 'r' }, right) : null), h('div', { class: 'body' }, body));

// ---- profiel ----------------------------------------------------------------------------------
function renderProfiel(view) {
  const p = C.profile;
  const main = h('div', null,
    box('Over mij', [
      h('p', { class: 'intro' }, todo(p.intro)),
      h('table', { class: 'fields' }, p.fields.map(([k, v]) => h('tr', null, h('th', null, k), h('td', null, todo(v))))),
    ]),
    box('Ik hou van (L) / Ik haat :@', h('div', { class: 'lovehate' },
      h('div', null, h('h4', null, '(L) Ik hou van'), h('ul', null, p.loves.map(x => h('li', null, todo(x))))),
      h('div', null, h('h4', null, ':@ Ik haat'), h('ul', null, p.hates.map(x => h('li', null, todo(x))))))),
    box(p.stats.title, h('div', { class: 'stats' }, p.stats.groups.map(g => h('div', { class: 'group' }, h('h4', null, 'Beoordeeld door ', h('b', null, todo(g.by))),
      g.items.map(([label, val, note]) => h('div', { class: 'stat' }, h('span', null, label), h('div', { class: 'bar' }, h('i', { dataset: { w: Math.min(100, val * 10) } })), h('span', { class: 'val' }, `${val}/10`), note ? h('span', { class: 'note' }, note) : null)))))),
  );
  const side = h('div', null,
    box('Wie bezocht mijn profiel', h('div', { id: 'visitors' })),
    box('Poll', h('div', { id: 'poll', class: 'poll' })),
    musicBox(),
  );
  view.append(h('div', { class: 'cols' }, main, side));
  renderVisitors(); renderPoll();
  requestAnimationFrame(() => view.querySelectorAll('.stat .bar i').forEach(i => { i.style.width = i.dataset.w + '%'; }));
}

function renderVisitors() {
  const el = $('#visitors'); if (!el) return;
  const seen = new Set(), list = [];
  for (const v of live.visitors) { const k = v.name.trim().toLowerCase(); if (seen.has(k)) continue; seen.add(k); list.push(v); if (list.length >= 12) break; }
  const me = getUser();
  clear(el);
  if (!db.enabled) el.append(h('p', { class: 'muted small' }, 'Bezoekers worden pas bijgehouden zodra Firebase is ingesteld (zie README).'));
  if (!list.length && me) list.push({ name: displayNameFor(me), createdAt: new Date() });
  if (!list.length) { el.append(h('p', { class: 'muted' }, 'Nog niemand. Meld je aan bij Messenger (rechtsonder) en je staat hier!')); return; }
  el.append(h('div', { class: 'visitors' }, list.map(v => h('span', { class: 'v' }, h('i', null, avatarFor(v.name)), v.name, h('small', null, ' ', relDate(v.createdAt).replace(' om', ','))))),
    h('p', { class: 'small muted', style: { margin: '6px 0 0' } }, `${fmtNum(live.visitors.length)} recente bezoeken · poepie (1.000.000 keer)`));
}

function renderPoll() {
  const el = $('#poll'); if (!el) return;
  const poll = C.poll, voted = store.get('poll.voted.' + poll.id);
  const counts = Object.fromEntries(poll.options.map(o => [o, 0]));
  for (const v of live.votes) if (v in counts) counts[v]++;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  clear(el).append(h('p', null, h('b', null, poll.question)));
  if (!voted) {
    const name = 'poll' + poll.id;
    const opts = poll.options.map(o => h('label', { class: 'opt' }, h('input', { type: 'radio', name, value: o }), ' ', o));
    el.append(...opts, h('button', { class: 'btn pink', onclick: async () => {
      const sel = el.querySelector('input:checked'); if (!sel) return nudge(el.closest('.box'));
      store.set('poll.voted.' + poll.id, sel.value); live.votes = [...live.votes, sel.value]; sfx.pop(); renderPoll();
      try { await db.vote(poll.id, sel.value); } catch (e) { console.warn(e); }
    } }, 'Stem!'));
    return;
  }
  el.append(...poll.options.map(o => { const pct = total ? Math.round(counts[o] / total * 100) : 0; return h('div', { class: 'res' }, `${o} — ${pct}% (${counts[o]})`, h('div', { class: 'bar' }, h('i', { style: { width: pct + '%' } }))); }));
  el.append(h('p', { class: 'small muted' }, `${fmtNum(total)} stemmen · Conclusie: ja. Jij stemde "${voted}".`));
}

const songSrc = () => { const song = M.audio.singles?.[C.profile.music.nowPlaying]; return song ? mediaUrl('audio/' + song.file, song.v) : null; };
function musicBox() {
  const mu = C.profile.music, src = songSrc();
  const np = h('div', { class: 'np paused' }, h('span', { class: 'eq' }, h('i'), h('i'), h('i'), h('i')), h('span', null, src ? mu.nowPlayingLabel : 'Nog geen lied. Zet content/audio/lied.* klaar.'),
    src ? h('button', { class: 'btn small', onclick: () => player.play(src) }, '▶') : null);
  if (src) {
    const sync = (cur, playing) => { const on = cur === src && playing; np.classList.toggle('paused', !on); np.querySelector('button').textContent = on ? '❚❚' : '▶'; };
    sync(player.src, player.playing);
    const off = player.onChange((cur, playing) => { if (!np.isConnected) return off(); sync(cur, playing); });
  }
  return box(mu.title, h('div', { class: 'music' }, np, h('ol', null, mu.top.map(t => h('li', null, todo(t))))));
}
// ---- splash: "Welkom op de coole site van Elisa" + ENTER ------------------------------------------------
// Every visit starts here, like every self-respecting site in 2008. The ENTER tap is what browsers need before
// they allow sound, so this is where the song starts (and keeps looping) and the sound effects get unlocked.
function splash() {
  const s = C.splash || {};
  const src = songSrc();
  if (src) player.setBgm(src, { loop: true });
  return new Promise(resolve => {
    const go = () => {
      document.removeEventListener('keydown', onKey);
      sfx.unlock();
      if (src) player.play(src);
      document.body.classList.remove('splash-open');
      el.classList.add('out'); setTimeout(() => el.remove(), 600);
      window.scrollTo(0, 0);
      resolve();
    };
    const onKey = (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } };
    const btn = h('button', { class: 'btn pink enter', onclick: go }, s.button || 'ENTER');
    const el = h('div', { id: 'splash' }, h('div', { class: 'inner' },
      h('div', { class: 'deco' }, '~*~ ✦ ~*~'),
      h('h1', { class: 'glitter' }, s.title || `Welkom op de coole site van ${site.name}`),
      s.sub ? h('p', { class: 'sub' }, todo(s.sub)) : null,
      btn,
      s.hint ? h('p', { class: 'hint' }, todo(s.hint)) : null));
    document.body.classList.add('splash-open');
    document.body.append(el);
    document.addEventListener('keydown', onKey);
    btn.focus();
  });
}

// ---- foto's -----------------------------------------------------------------------------------
const albumCfg = (slug) => C.albums[slug] || {};
const photoId = (slug, key) => `${slug}__${key}`;
function renderFotos(view, args, sameTab) {
  const [slug, idx] = args;
  const album = M.albums.find(a => a.slug === slug);
  if (!sameTab || view.dataset.album !== (slug || '')) {
    clear(view); view.dataset.album = slug || '';
    if (!album) renderAlbumList(view); else renderAlbum(view, album);
  }
  if (album && idx != null && album.photos[+idx]) openLightbox(album, +idx);
  else closeLightbox(false);
}
function renderAlbumList(view) {
  const known = new Set(M.albums.map(a => a.slug));
  const order = Object.keys(C.albums).filter(s => !s.startsWith('_'));
  const planned = order.filter(s => !known.has(s));
  const rank = (a) => { const i = order.indexOf(a.slug); return i < 0 ? 1e9 : i; };
  const albums = [...M.albums].sort((a, b) => rank(a) - rank(b));
  view.append(box("Mijn foto's", [
    h('p', { class: 'intro muted' }, `${M.albums.length} albums · ${M.albums.reduce((n, a) => n + a.count, 0)} foto's · klik op een album, klik op een foto voor groot, geef hartjes (L)`),
    h('div', { class: 'albums' },
      albums.map(a => h('a', { class: 'album', href: `#fotos/${a.slug}` },
        h('div', { class: 'cov', style: a.cover ? { backgroundImage: `url("${mediaUrl(`photos/${a.slug}/thumbs/${a.cover}`, a.photos.find(p => p.file === a.cover)?.v)}")` } : null }),
        h('span', { class: 't' }, todo(albumCfg(a.slug).title || a.slug)), h('span', { class: 'c' }, `${a.count} foto's`))),
      planned.map(s => h('div', { class: 'album empty', title: 'nog geen foto\'s in content/photos/' + s }, h('div', { class: 'cov' }, '📷'), h('span', { class: 't' }, albumCfg(s).title || s), h('span', { class: 'c' }, 'binnenkort')))),
  ]));
}
function renderAlbum(view, album) {
  const cfg = albumCfg(album.slug);
  view.append(box(h('a', { href: '#fotos' }, "◀ Foto's"), [
    h('div', { class: 'album-head' }, h('h4', { class: 'glitter' }, cfg.title || album.slug), h('span', { class: 'muted' }, `${album.count} foto's`), cfg.desc ? h('p', { class: 'desc' }, todo(cfg.desc)) : null),
    h('div', { class: 'grid' }, album.photos.map((p, i) => h('div', { class: 'ph', onclick: () => { location.hash = `#fotos/${album.slug}/${i}`; } },
      h('img', { src: mediaUrl(`photos/${album.slug}/thumbs/${p.file}`, p.v), alt: cfg.captions?.[p.key] || '', loading: 'lazy', width: p.tw, height: p.th }),
      h('span', { class: 'lk', dataset: { like: photoId(album.slug, p.key) } })))),
  ]));
  refreshLikes();
}
function refreshLikes() {
  document.querySelectorAll('[data-like]').forEach(el => { const n = live.likes[el.dataset.like] || 0; el.textContent = n ? `♥ ${n}` : ''; });
}

// lightbox ----------------------------------------------------------------------------------------
const lb = { album: null, idx: -1, el: document.getElementById('lightbox') };
function openLightbox(album, idx) {
  const p = album.photos[idx], cfg = albumCfg(album.slug), id = photoId(album.slug, p.key);
  lb.album = album; lb.idx = idx;
  const img = h('img', { src: mediaUrl(`photos/${album.slug}/${p.file}`, p.v), alt: cfg.captions?.[p.key] || '', width: p.w, height: p.h });
  const liked = store.get('liked.' + id, false);
  const heart = h('button', { class: 'heart' + (liked ? ' on' : ''), onclick: async () => {
    heart.classList.add('on', 'pop'); store.set('liked.' + id, true); live.likes[id] = (live.likes[id] || 0) + 1; heart.textContent = `♥ ${live.likes[id]}`; sfx.pop(); refreshLikes();
    try { await db.like(id); } catch (e) { console.warn(e); }
  } }, `♥ ${live.likes[id] || ''}`.trim());
  const go = (d) => { const n = (idx + d + album.photos.length) % album.photos.length; history.replaceState(null, '', `#fotos/${album.slug}/${n}`); openLightbox(album, n); };
  clear(lb.el).append(
    h('div', { class: 'top' }, h('b', null, cfg.title || album.slug), h('span', null, `${idx + 1} / ${album.photos.length}`), h('button', { class: 'xbtn x', onclick: closeLightbox }, '✕ sluiten')),
    h('div', { class: 'stage' }, h('div', { class: 'nav prev', onclick: () => go(-1) }, '‹'), img, h('div', { class: 'nav next', onclick: () => go(1) }, '›')),
    h('div', { class: 'cap' }, h('div', { class: 'txt' }, todo(cfg.captions?.[p.key] || ''), p.date ? h('div', { class: 'small muted' }, fmtDate(p.date)) : null), heart),
  );
  lb.el.hidden = false; document.body.style.overflow = 'hidden';
  [1, -1].forEach(d => { const q = album.photos[(idx + d + album.photos.length) % album.photos.length]; new Image().src = mediaUrl(`photos/${album.slug}/${q.file}`, q.v); });
  lb.go = go;
}
function closeLightbox(navigate = true) {
  if (lb.el.hidden) return;
  lb.el.hidden = true; document.body.style.overflow = '';
  const album = lb.album; lb.album = null;
  if (navigate && album) history.replaceState(null, '', `#fotos/${album.slug}`);
}
lb.el.addEventListener('click', e => { if (e.target === lb.el || e.target.classList.contains('stage')) closeLightbox(); });
document.addEventListener('keydown', e => { if (lb.el.hidden) return; if (e.key === 'Escape') closeLightbox(); if (e.key === 'ArrowLeft') lb.go?.(-1); if (e.key === 'ArrowRight') lb.go?.(1); });
let tx = null;
lb.el.addEventListener('touchstart', e => { tx = e.touches[0].clientX; }, { passive: true });
lb.el.addEventListener('touchend', e => { if (tx == null) return; const dx = e.changedTouches[0].clientX - tx; tx = null; if (Math.abs(dx) > 50) lb.go?.(dx < 0 ? 1 : -1); });

// ---- vlog -------------------------------------------------------------------------------------
function renderVlog(view) {
  const V = C.videos;
  const cards = M.videos.map((v, i) => {
    const meta = V.items[v.key] || {};
    const video = h('video', { controls: true, playsinline: true, preload: 'none', poster: mediaUrl('video/' + v.poster, v.v), src: mediaUrl('video/' + v.file, v.v) });
    video.addEventListener('play', () => { player.stop(); document.querySelectorAll('video').forEach(o => { if (o !== video) o.pause(); }); });
    video.addEventListener('ended', () => player.resume());
    return h('div', { class: 'xp-win webcam' + (v.h > v.w ? ' portrait' : '') }, xpTitle(`Webcam van ${site.name}`, { icon: '🎥' }),
      h('div', { class: 'vbody' }, video),
      h('div', { class: 'vfoot' }, h('b', null, todo(meta.title || `${V.defaultTitle} #${i + 1}`)), h('small', null, todo(meta.desc || V.defaultDesc), ` · ${fmtDuration(v.duration)}`)));
  });
  view.append(box(V.title, [h('p', { class: 'intro muted' }, todo(V.intro)),
    cards.length ? h('div', { class: 'vids' }, cards) : h('p', null, 'Nog geen vlogs. Zet ze in content/video/ en run npm run build.')]));
}

// ---- ambient: MSN toasts + sparkle trail --------------------------------------------------------
function startToasts() {
  const queue = shuffle(C.toasts.filter(t => !/TODO/.test(t.text)));
  let i = 0;
  const tick = () => {
    if (document.hidden || !queue.length || msn.isOpen) return;
    const t = queue[i++ % queue.length];
    toast({ from: t.from, text: t.text, avatar: pick(['💌', '💖', '🎂', '😘', '🌟']), onClick: () => openMsn() });
  };
  tick(); setInterval(tick, 75000);
}
function sparkles() {
  let last = 0;
  document.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    const now = performance.now(); if (now - last < 40) return; last = now;
    const s = h('span', { class: 'spk', style: { left: e.clientX + (Math.random() * 12 - 6) + 'px', top: e.clientY + (Math.random() * 12 - 6) + 'px', color: pick(['#fff', '#ffd6ee', '#ff3fa4', '#ffd400']) } }, pick(['✦', '✧', '✨', '♥']));
    document.body.append(s); setTimeout(() => s.remove(), 900);
  }, { passive: true });
}

boot().catch(e => { console.error(e); document.getElementById('view').textContent = 'Oei, er ging iets mis: ' + e.message; });
