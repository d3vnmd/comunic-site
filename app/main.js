window.__cm = 1; // ачаалал амжилттай эхэлснийг index.html-д мэдэгдэнэ
import { sb, profiles, errText, log } from './api.js';
import { state, on } from './store.js';
import { sprite, icon, MARK } from './icons.js';
import { h, clear, $, toast, avatar } from './ui.js';
import { applyTheme } from './theme.js';
import { route, start } from './router.js';
import { showAuth } from './auth.js';
import { loadChats, unreadCount } from './chatdata.js';
import { startRealtime } from './realtime.js';
import { enablePush, pushState } from './push.js';
import { renderChats } from './v-chats.js';
import { renderChat } from './v-chat.js';
import { renderMe } from './v-me.js';
import { renderSoon } from './v-soon.js';

const TABS = [['/chats', 'chat', 'Чат'], ['/find', 'search', 'Найз'], ['/community', 'community', 'Нийгэмлэг'], ['/feed', 'feed', 'Мэдээ'], ['/me', 'user', 'Профайл']];
const root = $('#root');
let starting = false, listKind = '', cleanList = null, cleanMain = null, app, listEl, mainEl, rail;

window.addEventListener('error', (e) => log('error', 'js', (e.message || '') + ' @' + (e.filename || '').split('/').pop() + ':' + e.lineno));
window.addEventListener('unhandledrejection', (e) => log('error', 'promise', String((e.reason && e.reason.message) || e.reason)));
if (window.visualViewport) {
  const fit = () => { document.documentElement.style.setProperty('--vh', window.visualViewport.height + 'px'); if (window.scrollY) window.scrollTo(0, 0); };
  window.visualViewport.addEventListener('resize', fit); fit();
}

function mountList(kind, fn) {
  if (listKind === kind) return; listKind = kind;
  if (cleanList) cleanList(); cleanList = fn(listEl) || null;
}
function mountMain(fn) {
  if (cleanMain) { const c = cleanMain; cleanMain = null; Promise.resolve(c).then((f) => f && f()); }
  clear(mainEl);
  if (!fn) { mainEl.append(h('div', { class: 'main-empty' }, (() => { const d = h('div', { class: 'core' }); d.innerHTML = MARK; return d; })(), h('b', null, 'Чат сонгоно уу'), h('p', null, 'Зүүн талаас найзаа сонгоод яриагаа үргэлжлүүл.'))); return; }
  cleanMain = fn(mainEl);
}
function setTab(path) {
  rail.querySelectorAll('.tab').forEach((t) => { const on_ = t.dataset.path === path; t.classList.toggle('on', on_); if (on_) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current'); });
}
function page(tab, kind, fn) { app.dataset.detail = '0'; setTab(tab); mountList(kind, fn); mountMain(null); }

function buildShell() {
  clear(root); root.className = '';
  rail = h('nav', { id: 'rail', 'aria-label': 'Үндсэн цэс' },
    h('a', { class: 'rail-logo', href: '#/chats', 'aria-label': 'Comunic' }, (() => { const d = h('i'); d.innerHTML = MARK; return d; })()),
    TABS.map(([p, ic, l]) => h('a', { class: 'tab', href: '#' + p, dataset: { path: p } }, h('span', { class: 'tic' }, icon(ic), h('i', { class: 'bd' })), h('span', { class: 'tl' }, l))));
  listEl = h('section', { id: 'list' }); mainEl = h('section', { id: 'main', 'aria-label': 'Харилцан яриа' });
  app = h('div', { id: 'app', dataset: { detail: '0' } }, rail, listEl, mainEl); root.append(app);
  on('chats', () => { const n = unreadCount(); const b = rail.querySelector('.tab[data-path="/chats"] .bd'); if (b) b.classList.toggle('on', n > 0); document.title = (n ? '(' + n + ') ' : '') + 'Comunic'; });
}

function registerRoutes() {
  route('/chats', () => page('/chats', 'chats', renderChats));
  route('/c/:slug', ({ slug }) => { app.dataset.detail = '1'; setTab('/chats'); mountList('chats', renderChats); mountMain((el) => { const p = renderChat(el, slug); return () => p.then((f) => f && f()); }); });
  route('/find', () => page('/find', 'find', (el) => renderSoon(el, 'Найз', 'search', 'Хүн хайх, найзын хүсэлт илгээх хэсэг удахгүй нэмэгдэнэ.')));
  route('/community', () => page('/community', 'cm', (el) => renderSoon(el, 'Нийгэмлэг', 'community', 'Нийгэмлэг үүсгэх, нэгдэх хэсэг удахгүй нэмэгдэнэ.')));
  route('/feed', () => page('/feed', 'feed', (el) => renderSoon(el, 'Мэдээ', 'feed', 'Пост, түүх, нот хэсэг удахгүй нэмэгдэнэ.')));
  route('/me', () => page('/me', 'me', renderMe));
}

function showBanned(p) {
  clear(root); root.className = 'auth';
  const ta = h('textarea', { class: 'inp', rows: '4', maxlength: '1000', placeholder: 'Давж заалдах шалтгаанаа бичнэ үү (10-аас дээш тэмдэгт)', 'aria-label': 'Давж заалдах' });
  const msg = h('p', { class: 'err', role: 'alert' });
  const until = p.banned_until ? new Date(p.banned_until).toLocaleDateString('mn-MN') : '';
  root.append(h('div', { class: 'auth-in' }, h('div', { class: 'eic big' }, icon('alert')), h('h1', null, 'Таны эрх хязгаарлагдсан'),
    h('p', { class: 'sub' }, (p.ban_reason ? 'Шалтгаан: ' + p.ban_reason + '. ' : '') + (until ? 'Хугацаа: ' + until + ' хүртэл.' : '')), ta,
    h('div', { class: 'stack' }, h('button', { class: 'btn pri wide', onclick: async (e) => {
      msg.textContent = ''; if (ta.value.trim().length < 10) { msg.textContent = 'Хамгийн багадаа 10 тэмдэгт бичнэ үү.'; return; }
      e.target.disabled = true; const { error } = await sb.from('appeals').insert({ user_id: p.id, body: ta.value.trim() });
      if (error) { msg.textContent = errText(error); e.target.disabled = false; } else { ta.value = ''; ta.disabled = true; msg.textContent = 'Хүсэлт илгээгдлээ. Админ хянан үзнэ.'; msg.className = 'ok'; }
    } }, 'Давж заалдах'), h('button', { class: 'btn out wide', onclick: async () => { await sb.auth.signOut(); location.reload(); } }, 'Гарах')), msg));
}

async function fetchMe(uid) {
  for (let i = 0; i < 4; i++) {
    const { data } = await sb.from('profiles').select('*').eq('id', uid).maybeSingle();
    if (data) return data; await new Promise((r) => setTimeout(r, 500 * (i + 1)));
  }
  return null;
}
async function startApp(user) {
  if (starting || state.me) return; starting = true;
  try {
    const me = await fetchMe(user.id);
    if (!me) { clear(root); root.className = 'auth'; root.append(h('div', { class: 'auth-in' }, h('h1', null, 'Профайл ачаалж чадсангүй'), h('p', { class: 'sub' }, 'Дахин оролдоно уу.'), h('button', { class: 'btn pri wide', onclick: () => location.reload() }, 'Дахин оролдох'), h('button', { class: 'btn out wide', onclick: async () => { await sb.auth.signOut(); location.reload(); } }, 'Гарах'))); return; }
    if (me.banned && (!me.banned_until || new Date(me.banned_until) > new Date())) return showBanned(me);
    state.me = me; profiles.set(me.id, me);
    buildShell(); registerRoutes(); start();
    loadChats().catch((e) => { log('error', 'load_chats', String(e.message || e)); toast(errText(e), 'err'); });
    startRealtime();
    if (pushState() === 'granted') enablePush(true);
  } finally { starting = false; }
}

async function boot() {
  applyTheme(); document.body.prepend(sprite());
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/app/sw.js', { scope: '/app/' }).catch(() => {});
  let session = null;
  try { session = (await sb.auth.getSession()).data.session; } catch (_) { /* сүлжээгүй */ }
  if (/[?&](code|error)=/.test(location.search)) history.replaceState(null, '', location.pathname + location.hash);
  if (!session) return showAuth(root);
  startApp(session.user);
}
sb.auth.onAuthStateChange((ev, s) => {
  if (ev === 'SIGNED_IN' && s && !state.me) setTimeout(() => startApp(s.user), 0);
  if (ev === 'SIGNED_OUT' && state.me) location.reload();
});
boot();
void avatar;
