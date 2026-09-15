// De coole website van Elisa — main module. One page, hash-routed tabs (#profiel, #fotos/album/3, ...).
import { h, $, clear, append, store, session, fmtDate, relDate, fmtDuration, fmtNum, template, todo, pick, shuffle, ageOn, hasMouse, svg } from './util.js';
import { sfx } from './sfx.js';
import { player } from './player.js';
import { db, initDb } from './db.js';
import { showSignIn, toast, fanmailWindow, titleBar, nudge } from './msn.js';

const TABS = [
  ['profiel', 'Profiel'], ['blog', 'Blog'], ['fotos', "Foto's"], ['videos', "Video's"],
  ['gastenboek', 'Gastenboek'], ['fanmail', 'Fanmail'], ['prijzen', 'Prijzen'],
];
const MEDIA = 'media/';
let C, M, site, vars;           // content, manifest, site block, template vars
const live = { guestbook: [], visitors: [], likes: {}, votes: {} };
const subs = {};                // live listeners, set up once

// ---- boot ---------------------------------------------------------------------------------------
async function boot() {
  const [content, manifest] = await Promise.all([
    fetch('content/content.json').then(r => r.json()),
    fetch(MEDIA + 'manifest.json').then(r => r.ok ? r.json() : {}).catch(() => ({})),
  ]);
  M = { albums: [], assets: {}, audio: { fanmail: [], soundboard: [], singles: {} }, videos: [], ...manifest };
  const s = content.site;
  const age = new Date().getFullYear() - new Date(s.birthday).getFullYear();
  vars = {
    name: s.name, age, city: s.city, webmaster: s.webmaster, msnEmail: s.msnEmail, displayName: s.displayName,
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

  if (session.get('signedIn')) afterSignIn(false);
  else showSignIn(site, () => { session.set('signedIn', true); afterSignIn(true); });

  if (hasMouse) sparkles();
}

function afterSignIn(fresh) {
  const welkom = M.audio.singles?.welkom;
  if (fresh) {
    setTimeout(() => {
      toast({ from: null, avatar: '💖', text: h('span', null, h('b', null, site.fanclub), ' heeft zich zojuist aangemeld.') });
      if (welkom) player.play(MEDIA + 'audio/' + welkom.file);
    }, 700);
  }
  setTimeout(startToasts, fresh ? 25000 : 12000);
  if (visitorName() && /elisa/i.test(visitorName()) && !session.get('partyDone')) setTimeout(party, 1500);
}

// ---- shell: top bar, profile card, tabs ---------------------------------------------------------
function renderShell() {
  $('#last-updated').textContent = fmtDate(site.lastUpdated, { day: '2-digit', month: '2-digit', year: 'numeric' });
  const views = store.get('pageviews', site.visitorsStart) + 1;
  store.set('pageviews', views);
  $('#pageviews').textContent = fmtNum(views);
  for (const id of ['#signout', '#footer-signout']) $(id).addEventListener('click', e => { e.preventDefault(); session.set('signedIn', false); location.hash = '#profiel'; location.reload(); });

  const card = $('#profile-card');
  const sparks = [[-10, -8, 0], [104, -12, .3], [118, 60, .6], [96, 112, .15], [-14, 100, .45], [50, -18, .8]].map(([x, y, d]) =>
    h('span', { class: 'spark', style: { left: x + 'px', top: y + 'px', animationDelay: d + 's' } }, '✦'));
  const avatarSrc = M.assets[site.avatar] ? MEDIA + 'photos/' + site.avatar : null;
  clear(card).append(
    h('div', { class: 'avatar' }, avatarSrc ? h('img', { src: avatarSrc, alt: site.name }) : h('div', { style: { width: '120px', height: '120px', background: '#ffd6ee', display: 'grid', placeItems: 'center', fontSize: '50px', outline: '2px solid #ff3fa4', border: '3px solid #fff' } }, '💖'), ...sparks),
    h('div', { class: 'who' },
      h('h1', { class: 'glitter' }, site.displayName),
      h('p', { class: 'pm' }, site.personalMessage),
      h('p', { class: 'meta' }, h('span', { class: 'online' }), h('b', null, 'Online'), ` · Vrouw · ${vars.age} jaar · ${site.city} · Laatst online: `, h('b', null, 'nu, vanuit ', site.location)),
      h('div', { class: 'actions' },
        h('a', { class: 'btn pink', href: '#gastenboek' }, '✎ Schrijf in mijn gastenboek'),
        h('a', { class: 'btn', href: '#fanmail' }, '💬 Stuur bericht'),
        h('button', { class: 'btn', onclick: () => { sfx.pop(); toast({ from: 'Systeem', avatar: '🦋', text: `${site.name} is al je vriend(in). Al jaren. Dat weet je toch?` }); } }, '+ Voeg toe als vriend'))),
    h('div', { class: 'side-stats' },
      h('div', null, h('b', null, fmtNum(views)), h('br'), 'profielbezoeken'),
      h('div', null, h('b', null, '∞'), h('br'), 'vrienden'),
      h('div', null, h('b', { id: 'gb-count' }, '0'), h('br'), 'gastenboek')),
    visitorBox(),
  );

  const tabs = $('#tabs');
  clear(tabs).append(...TABS.map(([id, label]) => h('a', { href: '#' + id, dataset: { tab: id } }, label, ' ', h('span', { class: 'n', dataset: { count: id } }))));
  updateCounts();
}

function updateCounts() {
  const counts = {
    fotos: M.albums.reduce((n, a) => n + a.count, 0) || null,
    videos: M.videos.length || null,
    gastenboek: (live.guestbook.length + C.guestbook.seed.length) || null,
    fanmail: M.audio.fanmail.length || null,
    prijzen: C.awards.items.length,
    blog: C.timeline.items.length,
  };
  for (const [k, v] of Object.entries(counts)) { const el = $(`[data-count="${k}"]`); if (el) el.textContent = v ? `(${v})` : ''; }
  const gb = $('#gb-count'); if (gb) gb.textContent = fmtNum(live.guestbook.length + C.guestbook.seed.length);
  $('#bar-msgcount').textContent = `(${fmtNum(live.guestbook.length + C.guestbook.seed.length)})`;
}

// ---- visitor name ("wie bezocht mijn profiel") ---------------------------------------------------
const visitorName = () => store.get('visitor.name', '');
function visitorBox() {
  const box = h('div', { class: 'visitor-box' });
  const render = () => {
    const name = visitorName();
    if (name) {
      clear(box).append(h('span', null, `👋 Hey ${name}! Je bezoek staat genoteerd.`),
        h('a', { href: '#', class: 'small', onclick: (e) => { e.preventDefault(); store.set('visitor.name', ''); render(); } }, 'ik ben iemand anders'));
      return;
    }
    const inp = h('input', { type: 'text', placeholder: 'jouw naam', maxlength: 40 });
    const go = async () => {
      const v = inp.value.trim(); if (!v) return inp.focus();
      store.set('visitor.name', v);
      db.addVisitor(v).catch(() => { });
      sfx.pop(); render();
      if (/elisa/i.test(v)) party();
      else toast({ from: 'Systeem', avatar: '🦋', text: `Welkom ${v}! ${site.name} ziet nu dat je langs geweest bent.` });
    };
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    clear(box).append(h('span', null, '👋 Laat weten dat je langs was:'), inp, h('button', { class: 'btn', onclick: go }, 'OK'));
  };
  render();
  return box;
}

function party() {
  session.set('partyDone', true);
  sfx.tada();
  confetti();
  setTimeout(() => toast({ from: site.fanclub, avatar: '🎂', ms: 12000, text: `GELUKKIGE VERJAARDAG ${site.name.toUpperCase()}!!! (L)(L)(L) Dit is allemaal voor jou. Klik hier voor je fanmail.`, onClick: () => { location.hash = '#fanmail'; } }), 300);
}
function confetti() {
  const colors = ['#ff3fa4', '#fff', '#ffd400', '#ff0080', '#7c4dff', '#00e0ff'];
  for (let i = 0; i < 90; i++) {
    const c = h('div', { class: 'confetti', style: { left: Math.random() * 100 + 'vw', background: pick(colors), animationDuration: 2.5 + Math.random() * 2.5 + 's', animationDelay: Math.random() * 1.2 + 's', transform: `rotate(${Math.random() * 360}deg)` } });
    document.body.append(c); setTimeout(() => c.remove(), 6000);
  }
}

// ---- live data --------------------------------------------------------------------------------
function startLive() {
  subs.gb = db.onGuestbook(list => { live.guestbook = list; updateCounts(); if (current.tab === 'gastenboek') renderGuestbookList(); });
  subs.vis = db.onVisitors(list => { live.visitors = list; if (current.tab === 'profiel') renderVisitors(); });
  subs.likes = db.onLikes(map => { live.likes = map; refreshLikes(); });
  subs.votes = db.onVotes(C.poll.id, votes => { live.votes = votes; if (current.tab === 'profiel') renderPoll(); });
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
  const active = $(`#tabs a[data-tab="${known}"]`);
  if (active) { const t = $('#tabs'); t.scrollLeft = active.offsetLeft - t.clientWidth / 2 + active.clientWidth / 2; }
  if (known === 'fotos') { renderFotos(view, args, sameTab); if (!sameTab && !first) window.scrollTo({ top: $('#tabs').offsetTop - 40, behavior: 'smooth' }); return; }
  if (known === 'fanmail' && sameTab && fanmailWin) { fanmailWin.open(args[0] || null); return; }
  closeLightbox(false);
  clear(view);
  ({ profiel: renderProfiel, blog: renderBlog, videos: renderVideos, gastenboek: renderGastenboek, fanmail: renderFanmail, prijzen: renderPrijzen })[known](view, args);
  // on a tab switch, bring the tab strip to the top (under the sticky bar); the first render keeps the profile header in view
  if (!sameTab && !first) window.scrollTo({ top: $('#tabs').offsetTop - 40, behavior: 'smooth' });
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
    soundboardBox(),
  );
  const side = h('div', null,
    box('Wie bezocht mijn profiel', h('div', { id: 'visitors' })),
    box('Poll', h('div', { id: 'poll', class: 'poll' })),
    box(p.friends.title, h('div', { class: 'friends' }, p.friends.items.map(f => h('div', { class: 'f', title: f.display }, h('div', { class: 'av' }, f.avatar), h('div', { class: 'nm' }, todo(f.name)), h('div', { class: 'nt' }, f.note))))),
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
  el.append(h('div', { class: 'visitors' }, list.map(v => h('span', { class: 'v' }, h('i', null, v.name.trim()[0].toUpperCase()), v.name, h('small', null, ' ', relDate(v.createdAt).replace(' om', ','))))),
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

function soundboardBox() {
  const items = M.audio.soundboard; if (!items.length) return null;
  const btns = items.map(s => {
    const src = MEDIA + 'audio/' + s.file;
    const b = h('button', { class: 'btn', onclick: () => player.play(src) }, '🔊 ', todo(C.soundboard.items[s.key] || s.key));
    player.onChange((cur, playing) => { if (b.isConnected) b.classList.toggle('playing', cur === src && playing); });
    return b;
  });
  return box(C.soundboard.title, [h('p', { class: 'muted small' }, todo(C.soundboard.intro)), h('div', { class: 'soundboard' }, btns)]);
}

// ---- blog / timeline --------------------------------------------------------------------------
function renderBlog(view) {
  const items = [...C.timeline.items].map((it, i) => ({ ...it, i })).sort((a, b) => (a.year ?? 9998) - (b.year ?? 9998) || a.i - b.i);
  const years = [...new Set(items.map(x => x.year ?? '20??'))];
  const posts = items.map(it => {
    const asset = it.photo && M.assets[it.photo];
    return h('article', { class: 'post', id: 'y' + (it.year ?? 'x') },
      h('h4', null, h('span', { class: 'year-badge' }, it.year ?? '20??'), todo(it.title)),
      h('div', { class: 'meta' }, 'Geplaatst op ', h('b', null, it.date ? fmtDate(it.date) : (it.year ? `ergens in ${it.year}` : 'datum onbekend')), ' door ', h('b', null, site.fanclub), ' · Categorie: Het leven van ', site.name),
      asset ? h('img', { src: MEDIA + 'photos/' + it.photo, alt: it.title, loading: 'lazy', width: asset.w, height: asset.h }) : null,
      h('p', null, todo(it.text)),
      h('div', { class: 'foot' }, h('a', { href: '#gastenboek' }, `Reacties (${3 + (it.i * 7) % 11})`), ' · ', h('a', { href: '#', onclick: (e) => { e.preventDefault(); nudge(e.target.closest('.post')); } }, 'Kudos geven'), ' · Permalink'));
  });
  view.append(h('div', { class: 'cols' },
    box('Blog', [h('p', { class: 'intro muted' }, todo(C.timeline.intro)), posts]),
    h('div', null, box('Archief', h('div', { class: 'archive' }, years.map(y => h('a', { href: '#blog', onclick: (e) => { e.preventDefault(); document.getElementById('y' + (y === '20??' ? 'x' : y))?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }, `» ${y} (${items.filter(x => (x.year ?? '20??') === y).length})`)))),
      box('Over deze blog', h('p', null, 'Bijgehouden door de fanclub sinds 1995 (met terugwerkende kracht). Alle feiten gecontroleerd door ', h('b', null, vars.kid1), '.')))));
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
  // preload neighbours
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

// ---- video's ----------------------------------------------------------------------------------
function renderVideos(view) {
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

// ---- gastenboek -------------------------------------------------------------------------------
function renderGastenboek(view, args) {
  const G = C.guestbook;
  const name = h('input', { type: 'text', placeholder: 'Je naam', maxlength: 40, value: visitorName() });
  const msg = h('textarea', { placeholder: 'Je bericht voor ' + site.name + '...', maxlength: 600 });
  const prefill = session.get('gb.prefill'); if (prefill) { msg.value = prefill; session.set('gb.prefill', null); }
  const avatars = h('div', { class: 'picker' }, C.avatars.map((a, i) => h('label', null, h('input', { type: 'radio', name: 'av', value: a, checked: i === 0 }), h('span', { class: 'av' }, a))));
  const stickers = h('div', { class: 'picker' }, C.stickers.map((s, i) => h('label', null, h('input', { type: 'radio', name: 'stk', value: s, checked: i === 0 }), h('span', { class: 'stk glitter' }, s))));
  const status = h('div', { class: 'gb-status' }, db.enabled ? 'Live gastenboek: je bericht verschijnt meteen, ook op de gsm van ' + site.name + ' in Parijs.' : 'Gastenboek nog niet online (Firebase niet ingesteld): je bericht blijft voorlopig op dit toestel.');
  const btn = h('button', { class: 'btn pink', onclick: async () => {
    const n = name.value.trim(), t = msg.value.trim();
    if (!n) { name.focus(); return nudge(form.closest('.box')); }
    if (!t) { msg.focus(); return nudge(form.closest('.box')); }
    btn.disabled = true;
    try {
      if (!visitorName()) { store.set('visitor.name', n); db.addVisitor(n).catch(() => { }); }
      const r = await db.addGuestbook({ name: n, message: t, sticker: form.querySelector('[name=stk]:checked')?.value, avatar: form.querySelector('[name=av]:checked')?.value });
      msg.value = ''; sfx.ding();
      toast({ from: site.fanclub, avatar: '💖', text: r.local ? 'Bewaard op dit toestel. (Zet Firebase aan om het voor iedereen te tonen.)' : 'Bericht geplaatst! ' + site.name + ' kan het nu lezen.' });
      if (r.local) { subs.gb?.(); subs.gb = db.onGuestbook(list => { live.guestbook = list; updateCounts(); renderGuestbookList(); }); }
    } catch (e) { console.error(e); toast({ from: 'Systeem', avatar: '⚠️', text: 'Oei, dat lukte niet: ' + (e.message || e) }); }
    btn.disabled = false;
  } }, 'Plaats bericht');
  const form = h('div', { class: 'gb-form' },
    h('div', { class: 'row' }, name, h('span', { class: 'small muted' }, 'Kies je avatar:'), avatars),
    msg,
    h('div', { class: 'row' }, h('span', { class: 'small muted' }, 'Glitter-sticker:'), stickers),
    h('div', { class: 'row' }, btn, status));
  view.append(box(G.title, [h('p', { class: 'intro' }, todo(G.intro)), form]), box('Berichten', h('div', { id: 'gb-list' }), { right: h('span', { id: 'gb-total' }) }));
  renderGuestbookList();
}
function renderGuestbookList() {
  const el = $('#gb-list'); if (!el) return;
  const seeds = C.guestbook.seed.map((s, i) => ({ ...s, id: 'seed' + i, createdAt: new Date(s.date), seed: true }));
  const all = [...live.guestbook, ...seeds].sort((a, b) => b.createdAt - a.createdAt);
  $('#gb-total').textContent = `${fmtNum(all.length)} berichten`;
  append(clear(el), all.length ? all.map(e => h('div', { class: 'entry' + (e.pending ? ' pending' : '') },
    h('div', { class: 'av' }, e.avatar || '😊'),
    h('div', null, h('div', { class: 'hd' }, h('b', null, e.name), e.sticker ? h('span', { class: 'sticker glitter' }, e.sticker) : null, h('small', null, e.pending ? 'wordt verzonden...' : e.local ? 'alleen op dit toestel' : relDate(e.createdAt))),
      h('p', { class: 'msg' }, e.message)))) : h('p', { class: 'muted' }, 'Nog geen berichten. Jij mag de eerste zijn!'));
}

// ---- fanmail ----------------------------------------------------------------------------------
let fanmailWin = null;
function renderFanmail(view, args) {
  const F = C.fanmail;
  const contacts = M.audio.fanmail.map(a => {
    const meta = F.contacts[a.key] || {};
    const name = meta.name || a.key.replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    return { key: a.key, src: MEDIA + 'audio/' + a.file, duration: a.duration, name, display: meta.display || name, pm: meta.pm || '', status: meta.status || F.defaultStatus || 'online', avatar: meta.avatar || '🙂', text: meta.text, autoplay: true };
  });
  fanmailWin = fanmailWindow({
    site, contacts, initialKey: args[0] || null,
    onNavigate: (key) => { location.hash = key ? `#fanmail/${key}` : '#fanmail'; },
    onGuestbook: (text, c) => { session.set('gb.prefill', `@${c.name}: ${text}`); location.hash = '#gastenboek'; },
  });
  view.append(box(F.title, [h('p', { class: 'intro muted' }, todo(F.intro)), fanmailWin.el]));
}

// ---- prijzen ----------------------------------------------------------------------------------
function medal(kind) {
  const col = { goud: ['#fff1a8', '#e0a800', '#8a6400'], zilver: ['#ffffff', '#b8bec8', '#6d7480'], brons: ['#f7c9a0', '#b8722e', '#6e3f12'] }[kind] || ['#fff1a8', '#e0a800', '#8a6400'];
  return svg('0 0 64 80', `<path d="M20 0h10l6 26h-10z" fill="#e0245e"/><path d="M34 0h10l-6 26h-10z" fill="#2b5bd7"/><circle cx="32" cy="50" r="24" fill="${col[1]}" stroke="${col[2]}" stroke-width="2"/><circle cx="32" cy="50" r="18" fill="url(#g${kind})" stroke="${col[2]}" stroke-width="1"/><defs><radialGradient id="g${kind}" cx=".35" cy=".3"><stop offset="0" stop-color="${col[0]}"/><stop offset="1" stop-color="${col[1]}"/></radialGradient></defs><text x="32" y="57" text-anchor="middle" font-size="20" fill="${col[2]}">★</text>`);
}
function renderPrijzen(view) {
  const A = C.awards;
  const cards = A.items.map(a => {
    const asset = a.photo && M.assets[a.photo];
    const img = asset ? h('img', { src: MEDIA + 'photos/' + a.photo, alt: a.title, loading: 'lazy', onclick: () => openLightbox({ slug: a.photo.split('/')[0], photos: [{ file: a.photo.split('/')[1], key: a.title, w: asset.w, h: asset.h }] }, 0) }) : null;
    if (a.medal === 'diploma') return h('div', { class: 'award diploma' }, h('div', null, h('h4', null, todo(a.title)), h('p', null, todo(a.reason)), h('p', { class: 'from' }, 'Uitgereikt door ', todo(a.from)), img));
    return h('div', { class: 'award' }, medal(a.medal), h('div', null, h('h4', null, todo(a.title)), h('p', null, todo(a.reason)), h('p', { class: 'from' }, `${a.medal[0].toUpperCase() + a.medal.slice(1)} · uitgereikt door `, todo(a.from)), img));
  });
  const tally = ['goud', 'zilver', 'brons'].map(k => `${A.items.filter(a => a.medal === k).length}× ${k}`).join(' · ');
  view.append(box(A.title, [h('p', { class: 'intro muted' }, todo(A.intro), ' Medaillespiegel: ', h('b', null, tally), '.'), h('div', { class: 'awards' }, cards)]));
}

// ---- ambient: MSN toasts + sparkle trail --------------------------------------------------------
function startToasts() {
  const queue = shuffle(C.toasts.filter(t => !/TODO/.test(t.text)));
  let i = 0;
  const tick = () => {
    if (document.hidden || !queue.length) return;
    const t = queue[i++ % queue.length];
    toast({ from: t.from, text: t.text, avatar: pick(['💌', '💖', '🎂', '😘', '🌟']), onClick: () => { location.hash = '#gastenboek'; } });
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
