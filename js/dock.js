// Bottom-right "taskbar" holding the minimised apps (Messenger, Bonzi) plus a little tray with a clock.
import { h } from './util.js';

export function createDock() {
  const el = h('div', { class: 'dock' });
  const clock = h('span', { class: 'clock' });
  const tick = () => { clock.textContent = new Date().toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' }); };
  tick(); setInterval(tick, 15000);
  const tray = h('div', { class: 'tray' }, h('span', { title: 'Volume: luid genoeg' }, '🔊'), h('span', { title: 'Verbonden met het internet (56k, bijna)' }, '🖧'), clock);
  el.append(tray);
  document.body.append(el);
  const buttons = {};
  return {
    el,
    add({ id, icon, label, short, onClick }) {
      const b = h('button', { class: 'task', dataset: { id }, onclick: onClick, title: label },
        h('span', { class: 'ic' }, icon), h('span', { class: 'lb' }, label), h('span', { class: 'sh' }, short || label), h('span', { class: 'badge' }));
      el.insertBefore(b, tray);
      buttons[id] = b;
      return b;
    },
    setActive(id, on) { buttons[id]?.classList.toggle('active', !!on); },
    flash(id, on) { buttons[id]?.classList.toggle('flash', !!on); },
    badge(id, n) { const b = buttons[id]?.querySelector('.badge'); if (b) b.textContent = n > 0 ? String(n) : ''; },
  };
}
