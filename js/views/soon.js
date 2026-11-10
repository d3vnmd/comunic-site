import { h, clear } from '../ui.js';
import { icon } from '../icons.js';
export function renderSoon(el, title, ic, text) {
  clear(el).append(h('header', { class: 'lh' }, h('h2', null, title)),
    h('div', { class: 'empty' }, h('div', { class: 'eic' }, icon(ic)), h('b', null, title), h('p', null, text)));
}
