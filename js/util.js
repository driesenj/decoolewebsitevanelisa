// Small DOM/format helpers. No framework, it's 2008.

export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  append(el, children);
  return el;
}
export function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

export const store = {
  get(k, def) { try { const v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch { return def; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode etc. */ } },
};
export const session = {
  get(k, def) { try { const v = sessionStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch { return def; } },
  set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch { } },
};

const NL = 'nl-BE';
export const fmtDate = (d, opts = { day: 'numeric', month: 'long', year: 'numeric' }) => new Date(d).toLocaleDateString(NL, opts);
export const fmtTime = (d) => new Date(d).toLocaleTimeString(NL, { hour: '2-digit', minute: '2-digit' });
export function relDate(d) {
  d = new Date(d);
  const now = new Date();
  const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 864e5);
  if (diff === 0) return `vandaag om ${fmtTime(d)}`;
  if (diff === 1) return `gisteren om ${fmtTime(d)}`;
  return `${d.toLocaleDateString(NL)} om ${fmtTime(d)}`;
}
export function fmtDuration(s) {
  s = Math.round(s || 0);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
export const fmtNum = (n) => Number(n).toLocaleString(NL);

// Replace {placeholders} in every string of a nested object.
export function template(obj, vars) {
  const rep = (s) => s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
  const walk = (x) => typeof x === 'string' ? rep(x) : Array.isArray(x) ? x.map(walk)
    : x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, walk(v)])) : x;
  return walk(obj);
}
// Mark leftover TODO markers visibly so nothing slips through to the live site unnoticed.
export function todo(text) {
  if (typeof text !== 'string' || !/\bTODO\b/.test(text)) return text;
  const parts = text.split(/(\bTODO\b)/);
  return parts.map(p => p === 'TODO' ? h('span', { class: 'todo', title: 'nog in te vullen in content/content.json' }, 'TODO') : p);
}
// Real SVG elements need the SVG namespace; parsing markup through innerHTML gets that right.
export function svg(viewBox, inner, attrs = {}) {
  const wrap = document.createElement('div');
  wrap.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${inner}</svg>`;
  const el = wrap.firstElementChild;
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export function shuffle(arr) { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
export const ageOn = (birth, on = new Date()) => { const b = new Date(birth); let a = on.getFullYear() - b.getFullYear(); const m = on.getMonth() - b.getMonth(); if (m < 0 || (m === 0 && on.getDate() < b.getDate())) a--; return a; };
export const isTouch = matchMedia('(pointer: coarse)').matches;
export const hasMouse = matchMedia('(pointer: fine)').matches;
// "Tante An" / "tante.an@hotmail.com" / "Tanté An" -> "tante-an": used to match Messenger usernames to contacts
export const norm = (x) => String(x || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .split('@')[0].replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
