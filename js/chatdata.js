import { sb, loadProfiles, profiles, pname } from './api.js';
import { state, emit } from './store.js';

// peerId -> { id, rel: 'friend'|'accepted'|'sent', last: message|null }
export let ready = false;
export const chats = new Map();
export let incomingFriend = [];   // [{ id, from }]  найзын хүсэлт
export let incomingMsgReq = [];   // [{ id, from }]  мессежийн хүсэлт
const MSG_COLS = 'id,sender,receiver,body,audio_url,attachments,reply_to,fx,created_at';
export { MSG_COLS };

const lrKey = (id) => 'lr:' + id;
export const lastRead = (id) => Number(localStorage.getItem(lrKey(id)) || 0);
export function markRead(id) {
  const c = chats.get(id), t = c && c.last ? new Date(c.last.created_at).getTime() : Date.now();
  localStorage.setItem(lrKey(id), String(Math.max(t, lastRead(id)))); emit('chats');
}
export const isUnread = (c) => !!(c.last && c.last.sender === c.id && new Date(c.last.created_at).getTime() > lastRead(c.id));
export const unreadCount = () => [...chats.values()].filter(isUnread).length;

export function preview(m) {
  if (!m) return '';
  const mine = m.sender === state.me.id ? 'Та: ' : '';
  let t;
  if (m.body) t = /^sticker:/.test(m.body) ? 'Стикер' : m.body;
  else if (m.audio_url) t = 'Дуут мессеж';
  else { const ty = (m.attachments && m.attachments[0] && m.attachments[0].type) || ''; t = ty.startsWith('image/') ? 'Зураг' : ty.startsWith('video/') ? 'Бичлэг' : 'Файл'; }
  return mine + t.replace(/\s+/g, ' ');
}

export async function loadChats() {
  const me = state.me.id;
  const [fr, mr, ms] = await Promise.all([
    sb.from('friendships').select('id,requester,addressee,status').or(`requester.eq.${me},addressee.eq.${me}`),
    sb.from('msg_requests').select('id,sender,receiver,status').or(`sender.eq.${me},receiver.eq.${me}`).neq('status', 'declined'),
    sb.from('messages').select(MSG_COLS).order('created_at', { ascending: false }).limit(150),
  ]);
  const rel = new Map(); incomingFriend = []; incomingMsgReq = [];
  for (const f of fr.data || []) {
    const peer = f.requester === me ? f.addressee : f.requester;
    if (f.status === 'accepted') rel.set(peer, 'friend');
    else if (f.addressee === me) incomingFriend.push({ id: f.id, from: peer });
  }
  for (const r of mr.data || []) {
    const peer = r.sender === me ? r.receiver : r.sender;
    if (rel.get(peer) === 'friend') continue;
    if (r.status === 'accepted') rel.set(peer, 'accepted');
    else if (r.receiver === me) incomingMsgReq.push({ id: r.id, from: peer });
    else rel.set(peer, 'sent');
  }
  const last = new Map();
  for (const m of ms.data || []) { const peer = m.sender === me ? m.receiver : m.sender; if (!last.has(peer)) last.set(peer, m); }
  const ids = new Set([...rel.keys(), ...incomingFriend.map((x) => x.from), ...incomingMsgReq.map((x) => x.from)]);
  await loadProfiles([...ids]);
  chats.clear();
  for (const [id, r] of rel) if (profiles.has(id)) chats.set(id, { id, rel: r, last: last.get(id) || null });
  // Мессежийн хүсэлт илгээгчийн анхны мессеж харагдахын тулд
  for (const x of incomingMsgReq) if (!chats.has(x.from)) x.last = last.get(x.from) || null;
  ready = true; emit('chats');
}

export function sortedChats() {
  return [...chats.values()].sort((a, b) => {
    const ta = a.last ? new Date(a.last.created_at).getTime() : 0, tb = b.last ? new Date(b.last.created_at).getTime() : 0;
    if (ta !== tb) return tb - ta;
    return pname(profiles.get(a.id)).localeCompare(pname(profiles.get(b.id)));
  });
}

export function applyMessage(m) {
  const me = state.me.id, peer = m.sender === me ? m.receiver : m.sender;
  let c = chats.get(peer);
  if (!c) { c = { id: peer, rel: 'sent', last: null }; chats.set(peer, c); }
  if (!c.last || new Date(m.created_at) >= new Date(c.last.created_at)) c.last = m;
  emit('chats');
}

export async function decideFriend(id, accept) {
  const q = accept ? sb.from('friendships').update({ status: 'accepted' }).eq('id', id) : sb.from('friendships').delete().eq('id', id);
  const { error } = await q; if (error) throw error; await loadChats();
}
export async function decideMsgReq(id, accept) {
  const { error } = await sb.from('msg_requests').update({ status: accept ? 'accepted' : 'declined' }).eq('id', id);
  if (error) throw error; await loadChats();
}

// Хоёр хүний хувьд санамсаргүй холбоос (нээх бүрд шинэчлэгдэнэ)
export async function ensureLink(peerId) {
  const me = state.me.id, [a, b] = [me, peerId].sort();
  const slug = crypto.randomUUID().replace(/-/g, '');
  const { error } = await sb.from('chat_links').upsert({ a, b, slug }, { onConflict: 'a,b' });
  if (error) throw error; return slug;
}
export async function peerFromSlug(slug) {
  const { data } = await sb.from('chat_links').select('a,b').eq('slug', slug).maybeSingle();
  if (!data) return null; return data.a === state.me.id ? data.b : data.a;
}
