import { h, clear, avatar, nameEl, toast, confirmBox } from '../ui.js';
import { icon } from '../icons.js';
import { state } from '../store.js';
import { sb } from '../api.js';
import { getTheme, setTheme } from '../theme.js';
import { pushState, enablePush } from '../push.js';
import { APP_VERSION } from '../config.js';

export function renderMe(el) {
  const me = state.me;
  const seg = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Загвар' },
    [['auto', 'Авто', 'info'], ['dark', 'Харанхуй', 'moon'], ['light', 'Цайвар', 'sun']].map(([v, l, ic]) =>
      h('button', { class: 'sg' + (getTheme() === v ? ' on' : ''), role: 'radio', 'aria-checked': getTheme() === v, onclick: (e) => { setTheme(v); seg.querySelectorAll('.sg').forEach((b) => { b.classList.remove('on'); b.setAttribute('aria-checked', 'false'); }); e.currentTarget.classList.add('on'); e.currentTarget.setAttribute('aria-checked', 'true'); } }, icon(ic), l)));
  const ps = pushState();
  const pushRow = h('div', { class: 'srow' }, icon('bell'), h('div', { class: 'sr-b' }, h('b', null, 'Мэдэгдэл'),
      h('small', null, ps === 'granted' ? 'Асаалттай' : ps === 'denied' ? 'Хөтчийн тохиргооноос зөвшөөрнө үү' : ps === 'unsupported' ? 'Энэ хөтөч дэмжихгүй' : 'Унтраалттай')),
    ps === 'default' ? h('button', { class: 'btn pri sm', onclick: async (e) => { if (await enablePush()) { e.target.replaceWith(h('small', null, 'Асаалттай')); } } }, 'Асаах') : null);
  clear(el).append(
    h('header', { class: 'lh' }, h('h2', null, 'Профайл')),
    h('div', { class: 'scroll' },
      h('div', { class: 'pcard' }, avatar(me, 76), h('div', { class: 'pc-b' }, nameEl(me, true), h('small', null, '@' + me.username + (me.is_guest ? ' · Зочин' : '')))),
      me.is_guest ? h('div', { class: 'banner' }, icon('info'), h('span', null, 'Та зочноор орсон байна. Зочны бүртгэл 1 өдөр идэвхгүй бол устна.')) : null,
      h('div', { class: 'sect' }, 'Загвар'), seg,
      h('div', { class: 'sect' }, 'Тохиргоо'), pushRow,
      h('div', { class: 'sect' }, 'Тухай'),
      h('a', { class: 'srow', href: '/terms.html', target: '_blank', rel: 'noopener' }, icon('lock'), h('div', { class: 'sr-b' }, h('b', null, 'Үйлчилгээний нөхцөл'))),
      h('a', { class: 'srow', href: '/privacy.html', target: '_blank', rel: 'noopener' }, icon('shield'), h('div', { class: 'sr-b' }, h('b', null, 'Нууцлалын бодлого'))),
      h('button', { class: 'srow danger', onclick: async () => { if (await confirmBox('Гарах уу?', 'Гарах', true)) { await sb.auth.signOut(); location.hash = ''; location.reload(); } } }, icon('logout'), h('div', { class: 'sr-b' }, h('b', null, 'Гарах'))),
      h('p', { class: 'ver' }, 'Comunic v' + APP_VERSION)));
  void toast;
}
