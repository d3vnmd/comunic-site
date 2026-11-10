import { h, clear, avatar, nameEl, listTime, toast, debounce } from './ui.js';
import { icon } from './icons.js';
import { ready, sortedChats, isUnread, preview, incomingFriend, incomingMsgReq, decideFriend, decideMsgReq, ensureLink } from './chatdata.js';
import { profiles, errText, isOnline, pname } from './api.js';
import { on, state } from './store.js';
import { go } from './router.js';
import { pushState, enablePush } from './push.js';

export async function openPeer(id) {
  try { go('/c/' + (await ensureLink(id))); } catch (e) { toast(errText(e), 'err'); }
}

export function renderChats(el) {
  let q = '', raf = 0;
  const list = h('div', { class: 'chat-list', role: 'list' });
  const search = h('input', { class: 'inp srch', placeholder: 'Хайх', 'aria-label': 'Чат хайх', type: 'search' });
  search.addEventListener('input', debounce(() => { q = search.value.trim().toLowerCase(); draw(); }, 120));
  clear(el).append(
    h('header', { class: 'lh' }, h('h2', null, 'Чат')),
    h('div', { class: 'srch-w' }, icon('search'), search),
    list);

  function reqCard(x, kind) {
    const p = profiles.get(x.from); if (!p) return null;
    const act = async (ok) => { try { await (kind === 'f' ? decideFriend(x.id, ok) : decideMsgReq(x.id, ok)); } catch (e) { toast(errText(e), 'err'); } };
    return h('div', { class: 'req' }, avatar(p, 44),
      h('div', { class: 'rq-b' }, nameEl(p), h('small', null, kind === 'f' ? 'Найз болохыг хүсэж байна' : 'Мессеж илгээхийг хүсэж байна')),
      h('button', { class: 'ibtn ok', 'aria-label': 'Зөвшөөрөх', onclick: () => act(true) }, icon('check')),
      h('button', { class: 'ibtn', 'aria-label': 'Татгалзах', onclick: () => act(false) }, icon('close')));
  }

  function draw() {
    raf = 0; clear(list);
    if (pushState() === 'default') {
      list.append(h('div', { class: 'banner' }, icon('bell'), h('span', null, 'Мессеж, дуудлагын мэдэгдлийг асаа'),
        h('button', { class: 'btn pri sm', onclick: async (e) => { if (await enablePush()) e.target.closest('.banner').remove(); } }, 'Асаах')));
    }
    if (!ready) { for (let i = 0; i < 6; i++) list.append(h('div', { class: 'crow sk' }, h('span', { class: 'sk-a' }), h('span', { class: 'cb' }, h('i', { class: 'sk-l' }), h('i', { class: 'sk-l s' })))); return; }
    const reqs = [...incomingFriend.map((x) => reqCard(x, 'f')), ...incomingMsgReq.map((x) => reqCard(x, 'm'))].filter(Boolean);
    if (reqs.length) list.append(h('div', { class: 'sect' }, 'Хүсэлт'), ...reqs);
    const rows = sortedChats().filter((c) => !q || pname(profiles.get(c.id)).toLowerCase().includes(q));
    if (!rows.length && !reqs.length) {
      list.append(h('div', { class: 'empty' }, h('div', { class: 'eic' }, icon('chat')),
        h('b', null, q ? 'Олдсонгүй' : 'Чат хоосон байна'),
        h('p', null, q ? 'Өөр нэрээр хайж үзнэ үү.' : 'Найзаа нэмээд эхний мессежээ илгээгээрэй.')));
      return;
    }
    rows.forEach((c, i) => {
      const p = profiles.get(c.id), un = isUnread(c);
      const row = h('button', { class: 'crow' + (un ? ' unread' : '') + (state.openPeer === c.id ? ' sel' : ''), role: 'listitem', style: i < 12 ? { animationDelay: i * 28 + 'ms' } : null, onclick: () => openPeer(c.id) },
        h('span', { class: 'avl' + (isOnline(p) ? ' on' : '') }, avatar(p, 52)),
        h('span', { class: 'cb' }, nameEl(p), h('span', { class: 'pv' }, c.last ? preview(c.last) : (c.rel === 'sent' ? 'Хүсэлт илгээгдсэн' : 'Мессеж бичээрэй'))),
        h('span', { class: 'cm' }, h('time', null, c.last ? listTime(c.last.created_at) : ''), un ? h('i', { class: 'dot', 'aria-label': 'Уншаагүй' }) : null));
      list.append(row);
    });
  }
  const sched = () => { if (!raf) raf = requestAnimationFrame(draw); };
  draw();
  const off = [on('chats', sched), on('peer', sched)];
  return () => { off.forEach((f) => f()); cancelAnimationFrame(raf); };
}
