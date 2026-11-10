import { sb, loadProfiles, profiles, errText, isOnline, pname, log } from '../api.js';
import { state, on, emit } from '../store.js';
import { h, clear, avatar, nameEl, hm, dayLabel, sameDay, lastSeen, toast, menuSheet, confirmBox, onHold, isTouch, copyText } from '../ui.js';
import { icon } from '../icons.js';
import { MSG_COLS, applyMessage, markRead, peerFromSlug, loadChats } from '../chatdata.js';
import { back } from '../router.js';

const URL_RE = /(https?:\/\/[^\s<>"']+)/g;
function richText(text) {
  const out = [];
  text.split(URL_RE).forEach((part, i) => {
    if (i % 2 === 1) out.push(h('a', { href: part, target: '_blank', rel: 'noopener noreferrer nofollow' }, part));
    else if (part) out.push(part);
  });
  return out;
}
const snippet = (m) => (m ? (m.body ? (/^sticker:/.test(m.body) ? 'Стикер' : m.body) : m.audio_url ? 'Дуут мессеж' : 'Хавсралт') : 'Мессеж');

export async function renderChat(el, slug) {
  clear(el).append(h('div', { class: 'chat-load' }, h('i', { class: 'spin' })));
  const peerId = await peerFromSlug(slug);
  if (!peerId) {
    clear(el).append(h('div', { class: 'empty' }, h('div', { class: 'eic' }, icon('link')), h('b', null, 'Холбоос хүчингүй'),
      h('p', null, 'Энэ чатын холбоос шинэчлэгдсэн эсвэл устсан байна.'), h('button', { class: 'btn pri', onclick: () => back('/chats') }, 'Чат руу буцах')));
    return () => {};
  }
  state.openPeer = peerId; emit('peer');
  await loadProfiles([peerId], true);
  const me = state.me, peer = profiles.get(peerId);
  if (!peer) { clear(el).append(h('div', { class: 'empty' }, h('b', null, 'Хэрэглэгч олдсонгүй'))); return () => {}; }

  const byId = new Map(); let live = false, first = null, lastEl = null, replyTo = null, unseen = 0, hasMore = false, alive = true;
  const status = h('small', null, lastSeen(peer));
  const head = h('header', { class: 'ch' },
    h('button', { class: 'ibtn only-m', 'aria-label': 'Буцах', onclick: () => back('/chats') }, icon('back')),
    h('span', { class: 'avl' + (isOnline(peer) ? ' on' : '') }, avatar(peer, 42)),
    h('div', { class: 'ch-t' }, nameEl(peer), status));
  const msgs = h('div', { class: 'msgs', role: 'log', 'aria-live': 'polite' });
  const more = h('button', { class: 'btn out sm more', onclick: () => loadOlder() }, 'Өмнөх мессеж');
  const inner = h('div', { class: 'msgs-in' }); msgs.append(inner);
  const fab = h('button', { class: 'fab', 'aria-label': 'Доош', onclick: () => toBottom(true) }, icon('down'), h('i', null));
  const replyBar = h('div', { class: 'reply-bar', hidden: true });
  const ta = h('textarea', { class: 'ta', rows: '1', placeholder: 'Мессеж бичих', maxlength: '6700', 'aria-label': 'Мессеж' });
  const sendBtn = h('button', { class: 'send', 'aria-label': 'Илгээх', disabled: true, onclick: () => send() }, icon('send'));
  const comp = h('div', { class: 'comp' }, replyBar, h('div', { class: 'comp-r' }, ta, sendBtn));
  clear(el).append(head, h('div', { class: 'msgs-w' }, msgs, fab), comp);

  const nearBottom = () => msgs.scrollHeight - msgs.scrollTop - msgs.clientHeight < 140;
  function toBottom(smooth) { msgs.scrollTo({ top: msgs.scrollHeight, behavior: smooth ? 'smooth' : 'auto' }); unseen = 0; fab.classList.remove('on'); }
  msgs.addEventListener('scroll', () => { if (nearBottom()) { unseen = 0; fab.classList.remove('on'); } else fab.classList.add('on'); fab.lastChild.textContent = unseen ? String(unseen) : ''; fab.classList.toggle('has', unseen > 0); }, { passive: true });

  function resize() { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 150) + 'px'; sendBtn.disabled = !ta.value.trim(); }
  ta.addEventListener('input', resize);
  ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !isTouch()) { e.preventDefault(); send(); } });

  function setReply(m) {
    replyTo = m; replyBar.hidden = !m; clear(replyBar);
    if (!m) return;
    replyBar.append(icon('reply'), h('div', { class: 'rb' }, h('b', null, m.sender === me.id ? 'Өөртөө' : pname(peer)), h('span', null, snippet(m))),
      h('button', { class: 'ibtn', 'aria-label': 'Болих', onclick: () => setReply(null) }, icon('close')));
    ta.focus();
  }

  function quote(id) {
    const q = byId.get(id);
    return h('button', { class: 'quote', onclick: (e) => { e.stopPropagation(); jump(id); } },
      h('b', null, q ? (q.sender === me.id ? 'Та' : pname(peer)) : 'Мессеж'), h('span', null, q ? snippet(q) : 'Өмнөх мессеж'));
  }
  function jump(id) {
    const t = inner.querySelector(`[data-id="${CSS.escape(id)}"]`); if (!t) return toast('Өмнөх мессеж ачаалагдаагүй байна');
    t.scrollIntoView({ block: 'center', behavior: 'smooth' }); t.classList.add('flash'); setTimeout(() => t.classList.remove('flash'), 1400);
  }

  function msgEl(m, st) {
    const mine = m.sender === me.id;
    const b = h('div', { class: 'b' });
    if (m.reply_to) b.append(quote(m.reply_to));
    if (m.body) b.append(h('div', { class: 't' }, richText(m.body)));
    else if (m.audio_url) b.append(h('div', { class: 't dim' }, 'Дуут мессеж'));
    else if (m.attachments) b.append(h('div', { class: 't dim' }, 'Хавсралт'));
    const meta = h('div', { class: 'mt' }, h('time', null, hm(m.created_at)));
    if (mine) meta.append(h('span', { class: 'st' }, st === 'sending' ? icon('clock') : st === 'failed' ? icon('alert') : icon('check')));
    b.append(meta);
    const row = h('div', { class: 'msg ' + (mine ? 'out' : 'in') + (st ? ' ' + st : '') + (live ? ' new' : ''), dataset: { id: m.id } }, b);
    if (st === 'failed') row.append(h('button', { class: 'retry', onclick: () => retry(m, row) }, 'Дахин илгээх'));
    onHold(b, () => actions(m, row));
    swipe(row, b, m);
    return row;
  }
  function swipe(row, b, m) {
    let sx = 0, sy = 0, dx = 0, on_ = false;
    row.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; dx = 0; on_ = true; }, { passive: true });
    row.addEventListener('touchmove', (e) => { if (!on_) return; const x = e.touches[0].clientX - sx, y = e.touches[0].clientY - sy;
      if (Math.abs(y) > 18 && Math.abs(y) > Math.abs(x)) { on_ = false; b.style.transform = ''; return; }
      if (x > 0) { dx = Math.min(x, 72); b.style.transform = `translateX(${dx}px)`; } }, { passive: true });
    const end = () => { if (dx > 56) { setReply(m); if (navigator.vibrate) navigator.vibrate(8); } b.style.transition = 'transform .2s'; b.style.transform = ''; setTimeout(() => { b.style.transition = ''; }, 220); on_ = false; dx = 0; };
    row.addEventListener('touchend', end); row.addEventListener('touchcancel', end);
  }
  function actions(m, row) {
    const failed = row.classList.contains('failed'), sending = row.classList.contains('sending');
    menuSheet([
      !failed && !sending && { icon: 'reply', label: 'Хариу бичих', run: () => setReply(m) },
      m.body && { icon: 'copy', label: 'Хуулах', run: () => copyText(m.body) },
      m.sender === me.id && !sending && { icon: 'trash', label: 'Устгах', danger: true, run: () => remove(m, row) },
    ]);
  }
  async function remove(m, row) {
    if (row.classList.contains('failed')) { row.remove(); byId.delete(m.id); return; }
    if (!(await confirmBox('Энэ мессежийг устгах уу? Хоёр талдаа устна.', 'Устгах', true))) return;
    const { error } = await sb.from('messages').delete().eq('id', m.id);
    if (error) return toast(errText(error), 'err');
    row.classList.add('gone'); setTimeout(() => row.remove(), 200); byId.delete(m.id); loadChats();
  }

  // Өдөр тусгаарлагч, бүлэглэлттэй нэмэх (дараалал: хуучнаас шинэ рүү)
  function append(m, st) {
    byId.set(m.id, m);
    if (!first || !sameDay(first.created_at, m.created_at)) inner.append(h('div', { class: 'day' }, h('span', null, dayLabel(m.created_at))));
    const row = msgEl(m, st);
    if (first && first.sender === m.sender && sameDay(first.created_at, m.created_at) && new Date(m.created_at) - new Date(first.created_at) < 300000) row.classList.add('cont');
    inner.append(row); first = m; lastEl = row; return row;
  }
  function renderAll(list) {
    clear(inner); first = null; byId.clear();
    if (hasMore) inner.append(more);
    list.forEach((m) => append(m));
    if (!list.length) inner.append(h('div', { class: 'empty small' }, h('b', null, 'Мессеж алга'), h('p', null, pname(peer) + '-д эхний мессежээ бичээрэй.')));
  }
  async function fetchPage(before) {
    let q = sb.from('messages').select(MSG_COLS)
      .or(`and(sender.eq.${me.id},receiver.eq.${peerId}),and(sender.eq.${peerId},receiver.eq.${me.id})`)
      .order('created_at', { ascending: false }).limit(41);
    if (before) q = q.lt('created_at', before);
    const { data, error } = await q; if (error) throw error;
    hasMore = data.length > 40; return data.slice(0, 40).reverse();
  }
  let all = [];
  async function loadOlder() {
    more.disabled = true;
    try {
      const old = await fetchPage(all[0].created_at); const h0 = msgs.scrollHeight;
      all = old.concat(all); renderAll(all); msgs.scrollTop = msgs.scrollHeight - h0;
    } catch (e) { toast(errText(e), 'err'); more.disabled = false; }
  }
  try { all = await fetchPage(); renderAll(all); toBottom(false); markRead(peerId); live = true; }
  catch (e) { log('error', 'chat_load', String(e.message || e)); inner.append(h('div', { class: 'empty small' }, h('b', null, 'Ачаалж чадсангүй'), h('p', null, errText(e)), h('button', { class: 'btn out sm', onclick: () => renderChat(el, slug) }, 'Дахин оролдох'))); }
  if (!isTouch()) ta.focus();

  async function send(retryRow) {
    const text = ta.value.trim(); if (!text && !retryRow) return;
    const row0 = { id: crypto.randomUUID(), sender: me.id, receiver: peerId, body: text, reply_to: replyTo ? replyTo.id : null, created_at: new Date().toISOString() };
    ta.value = ''; resize(); setReply(null);
    if (inner.querySelector('.empty')) inner.querySelector('.empty').remove();
    const row = append(row0, 'sending'); toBottom(true);
    await post(row0, row);
  }
  async function post(m, row) {
    const { error } = await sb.from('messages').insert({ id: m.id, sender: m.sender, receiver: m.receiver, body: m.body, reply_to: m.reply_to });
    if (error && error.code !== '23505') {
      log('warn', 'msg_send', String(error.message || error.code));
      const nr = msgEl(m, 'failed'); row.replaceWith(nr); toast(errText(error), 'err'); return;
    }
    const nr = msgEl(m, ''); if (row.classList.contains('cont')) nr.classList.add('cont'); row.replaceWith(nr);
    all.push(m); applyMessage(m); markRead(peerId);
  }
  function retry(m, row) { const nr = msgEl(m, 'sending'); row.replaceWith(nr); post(m, nr); }

  const offMsg = on('message', (m) => {
    if (m.sender !== peerId || byId.has(m.id)) return;
    const stick = nearBottom(); all.push(m); append(m);
    if (stick) toBottom(true); else { unseen += 1; fab.classList.add('on', 'has'); fab.lastChild.textContent = String(unseen); }
    if (document.visibilityState === 'visible') markRead(peerId);
  });
  const offSync = on('resync', async () => {
    if (!alive) return;
    try { const fresh = await fetchPage(); const ids = new Set(all.map((x) => x.id)); const add = fresh.filter((x) => !ids.has(x.id));
      if (add.length) { const stick = nearBottom(); add.forEach((m) => { all.push(m); append(m); }); if (stick) toBottom(true); } } catch (_) { /* дараагийн удаад */ }
  });
  const tick = setInterval(async () => {
    if (document.hidden) return; await loadProfiles([peerId], true); const p = profiles.get(peerId);
    status.textContent = lastSeen(p); const av = head.querySelector('.avl'); if (av) av.classList.toggle('on', isOnline(p));
  }, 60000);
  const onVis = () => { if (!document.hidden) markRead(peerId); };
  document.addEventListener('visibilitychange', onVis);

  return () => { alive = false; offMsg(); offSync(); clearInterval(tick); document.removeEventListener('visibilitychange', onVis); if (state.openPeer === peerId) { state.openPeer = null; emit('peer'); } };
}
