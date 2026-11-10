import { SUPABASE_URL } from './config.js';
import { icon } from './icons.js';
import { isPlus, pname } from './api.js';

export const $ = (s, r = document) => r.querySelector(s);

// DOM үүсгэгч. Текст үргэлж textContent-оор орно тул XSS боломжгүй
export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    const v = attrs[k]; if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'value' || k === 'disabled' || k === 'checked') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  add(el, kids); return el;
}
function add(el, kids) {
  for (const c of kids) {
    if (c == null || c === false) continue;
    if (Array.isArray(c)) add(el, c);
    else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}
export const clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };

// Зөвхөн энэ project-ийн storage-ийн хаягийг зөвшөөрнө
export function safeUrl(u) {
  if (typeof u !== 'string') return '';
  return u.startsWith(SUPABASE_URL + '/storage/v1/object/public/') ? u : '';
}

// ---------- цаг ----------
const pad = (n) => String(n).padStart(2, '0');
export const hm = (d) => { d = new Date(d); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
export const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();
export function dayLabel(d) {
  d = new Date(d); const now = new Date();
  if (sameDay(d, now)) return 'Өнөөдөр';
  if (sameDay(d, new Date(now - 864e5))) return 'Өчигдөр';
  return d.getFullYear() + '.' + pad(d.getMonth() + 1) + '.' + pad(d.getDate());
}
export function listTime(d) {
  d = new Date(d); const now = new Date();
  if (sameDay(d, now)) return hm(d);
  if (sameDay(d, new Date(now - 864e5))) return 'Өчигдөр';
  return pad(d.getMonth() + 1) + '.' + pad(d.getDate());
}
export function lastSeen(p) {
  if (!p || p.hide_online || !p.last_online) return '';
  const s = (Date.now() - new Date(p.last_online).getTime()) / 1000;
  if (s < 90) return 'онлайн';
  if (s < 3600) return Math.floor(s / 60) + ' мин өмнө';
  if (s < 86400) return Math.floor(s / 3600) + ' цагийн өмнө';
  return Math.floor(s / 86400) + ' өдрийн өмнө';
}

// ---------- аватар, нэр ----------
export function avatar(p, size = 46) {
  p = p || {};
  const st = { width: size + 'px', height: size + 'px', fontSize: Math.round(size * 0.42) + 'px' };
  let inner;
  const src = !p.is_guest && safeUrl(p.avatar_url);
  if (p.is_guest) inner = h('span', { class: 'av guest', style: st }, icon('user'));
  else if (src) inner = h('img', { class: 'av', style: st, src, alt: '', loading: 'lazy', decoding: 'async' });
  else inner = h('span', { class: 'av', style: st }, (pname(p).trim().charAt(0) || '?').toUpperCase());
  if (isPlus(p) && p.avatar_fx && /^[a-z]+$/.test(p.avatar_fx)) return h('span', { class: 'avw fx-' + p.avatar_fx }, inner);
  return inner;
}
export function nameEl(p, big) {
  p = p || {};
  const st = {};
  if (p.verified && p.color1 && /^#[0-9a-f]{6}$/i.test(p.color1) && p.color2 && /^#[0-9a-f]{6}$/i.test(p.color2) && (p.color1 !== '#ffffff' || p.color2 !== '#00cec9')) {
    st.backgroundImage = `linear-gradient(90deg,${p.color1},${p.color2})`;
  }
  const t = h('span', { class: 'nm-t' + (st.backgroundImage ? ' grad' : ''), style: st }, pname(p));
  const el = h('span', { class: 'nm' + (big ? ' big' : '') }, t);
  if (p.is_admin) el.append(h('span', { class: 'bdg adm', title: 'Админ' }, icon('shield')));
  if (p.verified) el.append(h('span', { class: 'bdg ver', title: 'Баталгаажсан' }, icon('verified')));
  if (isPlus(p)) el.append(h('span', { class: 'bdg plus', title: 'Comunic+' }, icon('star')));
  return el;
}

// ---------- toast, sheet ----------
export function toast(msg, kind) {
  let box = $('#toasts'); if (!box) { box = h('div', { id: 'toasts', 'aria-live': 'polite' }); document.body.append(box); }
  const t = h('div', { class: 'toast ' + (kind || '') }, msg); box.append(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, 3400);
}
export function sheet(build, opts = {}) {
  const prev = document.activeElement;
  const panel = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true' });
  const back = h('div', { class: 'sheet-bg' }, panel);
  const close = () => { back.classList.add('out'); setTimeout(() => { back.remove(); if (prev && prev.focus) prev.focus(); }, 220); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  back.addEventListener('click', (e) => { if (e.target === back) close(); });
  document.addEventListener('keydown', onKey);
  if (opts.title) panel.append(h('div', { class: 'sheet-h' }, h('b', null, opts.title), h('button', { class: 'ibtn', 'aria-label': 'Хаах', onclick: close }, icon('close'))));
  panel.append(build(close));
  document.body.append(back);
  const f = panel.querySelector('input,textarea,button'); if (f && !opts.noFocus) setTimeout(() => f.focus(), 60);
  return close;
}
export function menuSheet(items, title) {
  return sheet((close) => h('div', { class: 'menu' }, items.filter(Boolean).map((it) =>
    h('button', { class: 'mi' + (it.danger ? ' danger' : ''), onclick: () => { close(); setTimeout(it.run, 120); } }, icon(it.icon), it.label))), { title, noFocus: true });
}
export function confirmBox(text, okLabel, danger) {
  return new Promise((res) => {
    let done = false;
    const close = sheet((c) => h('div', { class: 'cf' },
      h('p', null, text),
      h('div', { class: 'row' },
        h('button', { class: 'btn out', onclick: () => { done = true; c(); res(false); } }, 'Болих'),
        h('button', { class: 'btn ' + (danger ? 'red' : 'pri'), onclick: () => { done = true; c(); res(true); } }, okLabel || 'Тийм'))), { noFocus: true });
    setTimeout(() => {}, 0); void close; void done;
  });
}

// Удаан дарах (утас) эсвэл баруун товшилт (компьютер)
export function onHold(el, fn, ms = 420) {
  let t, sx, sy;
  const cancel = () => clearTimeout(t);
  el.addEventListener('touchstart', (e) => { const p = e.touches[0]; sx = p.clientX; sy = p.clientY; t = setTimeout(() => { fn(e); if (navigator.vibrate) navigator.vibrate(8); }, ms); }, { passive: true });
  el.addEventListener('touchmove', (e) => { const p = e.touches[0]; if (Math.abs(p.clientX - sx) > 8 || Math.abs(p.clientY - sy) > 8) cancel(); }, { passive: true });
  el.addEventListener('touchend', cancel); el.addEventListener('touchcancel', cancel);
  el.addEventListener('contextmenu', (e) => { e.preventDefault(); fn(e); });
}
export const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
export const isTouch = () => matchMedia('(pointer:coarse)').matches;
export async function copyText(t) { try { await navigator.clipboard.writeText(t); toast('Хууллаа'); } catch (_) { toast('Хуулж чадсангүй'); } }
