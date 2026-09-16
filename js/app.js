// De coole website van Elisa — main module. One page, hash-routed tabs (#profiel, #chat/oma, #fotos/album/3, #vlog).
import { h, $, clear, store, session, fmtDate, relDate, fmtDuration, fmtNum, template, todo, pick, shuffle, hasMouse } from './util.js';
import { sfx } from './sfx.js';
import { player } from './player.js';
import { db, initDb } from './db.js';
import { showSignIn, toast, chatWindow, titleBar, nudge } from './msn.js';

const TABS = [['profiel', 'Profiel'], ['chat', 'Chat'], ['fotos', "Foto's"], ['vlog', 'Vlog']];
const MEDIA = 'media/';
let C, M, site, vars;           // content, manifest, site block, template vars
const live = { messages: [], visitors: [], likes: {}, votes: [] };
let messagesLoaded = false;

// ---- boot ---------------------------------------------------------------------------------------
async function boot() {
  const [content, manifest] = await Promise.all([
    fetch('content/content.json').then(r => r.json()),
    fetch(MEDIA + 'manifest.json').then(r => r.ok ? r.json() : {}).catch(() => ({})),
  ]);
  M = { albums: [], assets: {}, audio: { fanmail: [], soundboard: [], singles: {} }, videos: [], ...manifest };
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

  const dbReady = initDb();
  renderShell();
  window.addEventListener('hashchange', route);
  if (!location.hash) history.replaceState(null, '', '#profiel');

  await dbReady;
  startLive();
  route();

  // ?login in the URL forces the sign-in screen again (handy for testing)
  if (new URLSearchParams(location.search).has('login')) session.set('signedIn', false);
  if (session.get('signedIn')) afterSignIn(false);
  else showSignIn(site, () => { session.set('signedIn', true); afterSignIn(true); });

  if (hasMouse) sparkles();
}

function afterSignIn(fresh) {
  const welkom = M.audio.singles?.welkom;
  if (fresh) {
    setTimeout(() => {
      toast({ from: null, avatar: '💖', text: h('span', null, h('b', null, site.fanclub), ' heeft zich zojuist aangemeld.'), onClick: () => { location.hash = '#chat'; } });
      if (welkom) player.play(MEDIA + 'audio/' + welkom.file);
    }, 700);
  }
  setTimeout(startToasts, fresh ? 25000 : 12000);
  if (visitorName() && /elisa/i.test(visitorName()) && !session.get('partyDone')) setTimeout(party, 1500);
}

// ---- shell: profile card + tabs -------------------------------------------------------------------
function renderShell() {
  const views = store.get('pageviews', site.visitorsStart) + 1;
  store.set('pageviews', views);

  const card = $('#profile-card');
  const sparks = [[-10, -8, 0], [104, -12, .3], [118, 60, .6], [96, 112, .15], [-14, 100, .45], [50, -18, .8]].map(([x, y, d]) =>
    h('span', { class: 'spark', style: { left: x + 'px', top: y + 'px', animationDelay: d + 's' } }, '✦'));
  const avatarSrc = M.assets[site.avatar] ? MEDIA + 'photos/' + site.avatar : null;
  clear(card).append(
    h('div', { class: 'avatar' }, avatarSrc ? h('img', { src: avatarSrc, alt: site.name }) : h('div', { class: 'noavatar' }, '💖'), ...sparks),
    h('div', { class: 'who' },
      h('h1', { class: 'glitter' }, site.displayName),
      h('p', { class: 'pm' }, site.personalMessage),
      h('p', { class: 'meta' }, h('span', { class: 'online' }), h('b', null, 'Online'), ` · Vrouw · ${vars.age} jaar · ${site.city} · Laatst online: `, h('b', null, 'nu, vanuit ', site.location)),
      h('div', { class: 'actions' },
        h('a', { class: 'btn pink', href: '#chat' }, '💬 Stuur me een bericht'),
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

const messageCount = () => live.messages.length + C.chat.seed.length;
function updateCounts() {
  const counts = {
    fotos: M.albums.reduce((n, a) => n + a.count, 0) || null,
    vlog: M.videos.length || null,
    chat: (messageCount() + M.audio.fanmail.length) || null,
  };
  for (const [k, v] of Object.entries(counts)) { const el = $(`[data-count="${k}"]`); if (el) el.textContent = v ? `(${v})` : ''; }
  const mc = $('#msg-count'); if (mc) mc.textContent = fmtNum(messageCount());
}

// ---- visitor name ("wie bezocht mijn profiel" + chat name) -----------------------------------------
const visitorName = () => store.get('visitor.name', '');
function setVisitorName(v) {
  store.set('visitor.name', v);
  if (v) db.addVisitor(v).catch(() => { });
  document.querySelectorAll('.visitor-box').forEach(b => b.dispatchEvent(new Event('refresh')));
}
function avatarFor(name) {
  let x = 7; for (const ch of String(name || '').toLowerCase()) x = (x * 31 + ch.codePointAt(0)) >>> 0;
  return C.avatars[x % C.avatars.length];
}
function visitorBox() {
  const box = h('div', { class: 'visitor-box' });
  const render = () => {
    const name = visitorName();
    if (name) {
      clear(box).append(h('span', null, `👋 Hey ${name}! Je bezoek staat genoteerd.`),
        h('a', { href: '#', class: 'small', onclick: (e) => { e.preventDefault(); setVisitorName(''); } }, 'ik ben iemand anders'));
      return;
    }
    const inp = h('input', { type: 'text', placeholder: 'jouw naam', maxlength: 40 });
    const go = () => {
      const v = inp.value.trim(); if (!v) return inp.focus();
      setVisitorName(v); sfx.pop();
      if (/elisa/i.test(v)) party();
      else toast({ from: 'Systeem', avatar: '🦋', text: `Welkom ${v}! ${site.name} ziet nu dat je langs geweest bent.` });
    };
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    clear(box).append(h('span', null, '👋 Laat weten dat je langs was:'), inp, h('button', { class: 'btn', onclick: go }, 'OK'));
  };
  box.addEventListener('refresh', render);
  render();
  return box;
}

function party() {
  session.set('partyDone', true);
  sfx.tada();
  confetti();
  setTimeout(() => toast({ from: site.fanclub, avatar: '🎂', ms: 12000, text: `GELUKKIGE VERJAARDAG ${site.name.toUpperCase()}!!! (L)(L)(L) Dit is allemaal voor jou. Klik hier voor je berichten.`, onClick: () => { location.hash = '#chat'; } }), 300);
}
function confetti() {
  const colors = ['#ff3fa4', '#fff', '#ffd400', '#ff0080', '#7c4dff', '#00e0ff'];
  for (let i = 0; i < 90; i++) {
    const c = h('div', { class: 'confetti', style: { left: Math.random() * 100 + 'vw', background: pick(colors), animationDuration: 2.5 + Math.random() * 2.5 + 's', animationDelay: Math.random() * 1.2 + 's', transform: `rotate(${Math.random() * 360}deg)` } });
    document.body.append(c); setTimeout(() => c.remove(), 6000);
  }
}

// ---- live data --------------------------------------------------------------------------------
// seed messages (content.json) always open the conversation, live ones follow in time order
function allMessagesAsc() {
  const seeds = C.chat.seed.map((s, i) => ({ ...s, id: 'seed' + i, createdAt: new Date(s.date), seed: true }));
  return [...seeds, ...[...live.messages].sort((a, b) => a.createdAt - b.createdAt)];
}
function startLive() {
  db.onMessages(list => {
    const known = new Set(live.messages.map(m => m.id));
    const fresh = messagesLoaded ? list.filter(m => !known.has(m.id) && !m.pending && m.name !== visitorName()) : [];
    live.messages = list;
    updateCounts();
    const wasNear = chatWin?.nearEnd();
    chatWin?.setMessages(allMessagesAsc());
    if (fresh.length) {
      const m = fresh[fresh.length - 1];
      sfx.ding();
      if (current.tab === 'chat' && wasNear) chatWin.scrollToEnd();
      else toast({ from: m.name, avatar: avatarFor(m.name), text: m.message.slice(0, 120), onClick: () => { location.hash = '#chat'; setTimeout(() => chatWin?.scrollToEnd(), 400); } });
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
  const known = TABS.some(([id]) => id === tab) ? tab : 'profiel';
  document.querySelectorAll('#tabs a').forEach(a => a.classList.toggle('active', a.dataset.tab === known));
  const sameTab = current.tab === known;
  const first = current.tab === null;
  current.tab = known; current.args = args;
  const view = $('#view');
  const scrollUp = () => { if (!sameTab && !first) window.scrollTo({ top: $('#tabs').offsetTop - 6, behavior: 'smooth' }); };
  if (known === 'fotos') { renderFotos(view, args, sameTab); scrollUp(); return; }
  closeLightbox(false);
  if (known === 'chat' && sameTab && chatWin) { if (args[0]) chatWin.focusContact(args[0]); return; }
  clear(view);
  ({ profiel: renderProfiel, chat: renderChat, vlog: renderVlog })[known](view, args);
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
    box(p.links.title, h('ul', { class: 'links' }, p.links.items.map(l => h('li', null, h('a', { href: l.url, target: l.url.startsWith('#') ? null : '_blank', rel: 'noopener' }, todo(l.title)), h('small', null, todo(l.desc)))))),
  );
  view.append(h('div', { class: 'cols' }, main, side));
  renderVisitors(); renderPoll();
  requestAnimationFrame(() => view.querySelectorAll('.stat .bar i').forEach(i => { i.style.width = i.dataset.w + '%'; }));
}

function renderVisitors() {
  const el = $('#visitors'); if (!el) return;
  const seen = new Set(), list = [];
  for (const v of live.visitors) { const k = v.name.trim().toLowerCase(); if (seen.has(k)) continue; seen.add(k); list.push(v); if (list.length >= 12) break; }
  const me = visitorName();
  clear(el);
  if (!db.enabled) el.append(h('p', { class: 'muted small' }, 'Bezoekers worden pas bijgehouden zodra Firebase is ingesteld (zie README).'));
  if (!list.length && me) list.push({ name: me, createdAt: new Date() });
  if (!list.length) { el.append(h('p', { class: 'muted' }, 'Nog niemand. Wees de eerste: vul hierboven je naam in!')); return; }
  el.append(h('div', { class: 'visitors' }, list.map(v => h('span', { class: 'v' }, h('i', null, avatarFor(v.name)), v.name, h('small', null, ' ', relDate(v.createdAt).replace(' om', ','))))),
    h('p', { class: 'small muted', style: { margin: '6px 0 0' } }, `${fmtNum(live.visitors.length)} recente bezoeken · de webmaster (1.000.000 keer)`));
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

function musicBox() {
  const mu = C.profile.music;
  const song = M.audio.singles?.[mu.nowPlaying];
  const np = h('div', { class: 'np paused' }, h('span', { class: 'eq' }, h('i'), h('i'), h('i'), h('i')), h('span', null, song ? mu.nowPlayingLabel : 'Nog geen lied. Zet content/audio/lied.* klaar.'),
    song ? h('button', { class: 'btn small', onclick: () => player.play(MEDIA + 'audio/' + song.file) }, '▶') : null);
  if (song) player.onChange((src, playing) => { if (!np.isConnected) return; const on = src === MEDIA + 'audio/' + song.file && playing; np.classList.toggle('paused', !on); np.querySelector('button').textContent = on ? '❚❚' : '▶'; });
  return box(mu.title, h('div', { class: 'music' }, np, h('ol', null, mu.top.map(t => h('li', null, todo(t))))));
}

// ---- chat -------------------------------------------------------------------------------------
let chatWin = null;
function renderChat(view, args) {
  const F = C.chat;
  const order = Object.keys(F.contacts).filter(k => !k.startsWith('_'));
  const contacts = M.audio.fanmail.map(a => {
    const meta = F.contacts[a.key] || {};
    const name = meta.name || a.key.replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    return { key: a.key, src: MEDIA + 'audio/' + a.file, duration: a.duration, name, display: meta.display || name, pm: meta.pm || '', status: meta.status || F.defaultStatus || 'online', avatar: meta.avatar || '🙂', text: meta.text };
  }).sort((a, b) => { const ia = order.indexOf(a.key), ib = order.indexOf(b.key); return (ia < 0 ? 1e9 : ia) - (ib < 0 ? 1e9 : ib); });
  chatWin = chatWindow({
    site, chat: { ...F, emoticons: C.emoticons }, contacts, avatarFor,
    getName: visitorName, setName: setVisitorName,
    onSend: ({ name, message }) => db.addMessage({ name, message }),
    onNavigate: (key) => { location.hash = key ? `#chat/${key}` : '#chat'; },
  });
  view.append(chatWin.el);
  chatWin.setMessages(allMessagesAsc());
  if (args[0]) setTimeout(() => chatWin.focusContact(args[0]), 50);
  else if (!db.enabled || messagesLoaded) requestAnimationFrame(() => chatWin.scrollToEnd());
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
  const planned = Object.keys(C.albums).filter(s => !s.startsWith('_') && !known.has(s));
  view.append(box("Mijn foto's", [
    h('p', { class: 'intro muted' }, `${M.albums.length} albums · ${M.albums.reduce((n, a) => n + a.count, 0)} foto's · klik op een album, klik op een foto voor groot, geef hartjes (L)`),
    h('div', { class: 'albums' },
      M.albums.map(a => h('a', { class: 'album', href: `#fotos/${a.slug}` },
        h('div', { class: 'cov', style: a.cover ? { backgroundImage: `url("${MEDIA}photos/${a.slug}/thumbs/${a.cover}")` } : null }),
        h('span', { class: 't' }, todo(albumCfg(a.slug).title || a.slug)), h('span', { class: 'c' }, `${a.count} foto's`))),
      planned.map(s => h('div', { class: 'album empty', title: 'nog geen foto\'s in content/photos/' + s }, h('div', { class: 'cov' }, '📷'), h('span', { class: 't' }, albumCfg(s).title || s), h('span', { class: 'c' }, 'binnenkort')))),
  ]));
}
function renderAlbum(view, album) {
  const cfg = albumCfg(album.slug);
  view.append(box(h('a', { href: '#fotos' }, "◀ Foto's"), [
    h('div', { class: 'album-head' }, h('h4', { class: 'glitter' }, cfg.title || album.slug), h('span', { class: 'muted' }, `${album.count} foto's`), cfg.desc ? h('p', { class: 'desc' }, todo(cfg.desc)) : null),
    h('div', { class: 'grid' }, album.photos.map((p, i) => h('div', { class: 'ph', onclick: () => { location.hash = `#fotos/${album.slug}/${i}`; } },
      h('img', { src: `${MEDIA}photos/${album.slug}/thumbs/${p.file}`, alt: cfg.captions?.[p.key] || '', loading: 'lazy', width: p.tw, height: p.th }),
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
  const img = h('img', { src: `${MEDIA}photos/${album.slug}/${p.file}`, alt: cfg.captions?.[p.key] || '', width: p.w, height: p.h });
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
  [1, -1].forEach(d => { const q = album.photos[(idx + d + album.photos.length) % album.photos.length]; new Image().src = `${MEDIA}photos/${album.slug}/${q.file}`; });
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
    const video = h('video', { controls: true, playsinline: true, preload: 'none', poster: MEDIA + 'video/' + v.poster, src: MEDIA + 'video/' + v.file });
    video.addEventListener('play', () => { player.stop(); document.querySelectorAll('video').forEach(o => { if (o !== video) o.pause(); }); });
    return h('div', { class: 'msn-win webcam' }, ...titleBar(`Webcam van ${site.name}`),
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
    if (document.hidden || !queue.length) return;
    const t = queue[i++ % queue.length];
    toast({ from: t.from, text: t.text, avatar: pick(['💌', '💖', '🎂', '😘', '🌟']), onClick: () => { location.hash = '#chat'; } });
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
