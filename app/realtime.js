import { sb, loadProfiles, profiles, pname } from './api.js';
import { state, emit } from './store.js';
import { applyMessage, loadChats, preview } from './chatdata.js';
import { toast } from './ui.js';
import { here } from './router.js';

let ch = null, hiddenAt = 0, hbTimer = null, started = false;

function subscribe() {
  if (ch) return; const me = state.me.id;
  ch = sb.channel('rt-' + me)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver=eq.${me}` }, async (p) => {
      const m = p.new; await loadProfiles([m.sender]); applyMessage(m); emit('message', m);
      const open = here().startsWith('/c/') && document.visibilityState === 'visible' && state.openPeer === m.sender;
      if (!open) notify(m);
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'friendships', filter: `addressee=eq.${me}` }, async (p) => {
      await loadProfiles([p.new.requester]); await loadChats();
      toast(pname(profiles.get(p.new.requester)) + ' найзын хүсэлт илгээлээ');
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'friendships', filter: `requester=eq.${me}` }, async () => { await loadChats(); })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'msg_requests', filter: `receiver=eq.${me}` }, async () => { await loadChats(); })
    .subscribe();
}
function notify(m) {
  const p = profiles.get(m.sender), txt = preview(m).replace(/^Та: /, '');
  if (document.visibilityState === 'visible') toast(pname(p) + ': ' + txt.slice(0, 60));
}
function unsubscribe() { if (ch) { sb.removeChannel(ch); ch = null; } }

function heartbeat() {
  if (document.hidden || !state.me) return;
  sb.from('profiles').update({ last_online: new Date().toISOString() }).eq('id', state.me.id).then(() => {}, () => {});
}

export function startRealtime() {
  if (started) return; started = true; subscribe(); heartbeat();
  hbTimer = setInterval(heartbeat, 60000);
  // Квот хэмнэх: 1 минутаас илүү нуугдсан бол салгаад, буцаж ирэхэд нэг удаа тааруулна
  document.addEventListener('visibilitychange', async () => {
    if (document.hidden) { hiddenAt = Date.now(); setTimeout(() => { if (document.hidden && Date.now() - hiddenAt >= 60000) unsubscribe(); }, 61000); }
    else { subscribe(); heartbeat(); if (hiddenAt && Date.now() - hiddenAt > 15000) { await loadChats(); emit('resync'); } hiddenAt = 0; }
  });
  window.addEventListener('online', async () => { unsubscribe(); subscribe(); await loadChats(); emit('resync'); });
}
export function stopRealtime() { unsubscribe(); clearInterval(hbTimer); started = false; }
