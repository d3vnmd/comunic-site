import { sb } from './api.js';
import { state } from './store.js';
import { VAPID_PUBLIC } from './config.js';
import { toast } from './ui.js';

const b64 = (s) => { const p = '='.repeat((4 - s.length % 4) % 4), r = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from([...r].map((c) => c.charCodeAt(0))); };
export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
export const pushState = () => (!pushSupported() ? 'unsupported' : Notification.permission);

export async function enablePush(silent) {
  if (!pushSupported()) { if (!silent) toast('Энэ хөтөч мэдэгдэл дэмжихгүй байна'); return false; }
  const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (perm !== 'granted') { if (!silent) toast('Мэдэгдэл зөвшөөрөгдсөнгүй'); return false; }
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(VAPID_PUBLIC) });
    const j = sub.toJSON();
    const { error } = await sb.from('push_subs').upsert({ user_id: state.me.id, endpoint: j.endpoint, sub: j }, { onConflict: 'endpoint' });
    if (error) throw error;
    if (!silent) toast('Мэдэгдэл асалаа'); return true;
  } catch (e) { if (!silent) toast('Мэдэгдэл асаахад алдаа гарлаа'); return false; }
}
