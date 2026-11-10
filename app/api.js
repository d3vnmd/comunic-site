import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  realtime: { params: { eventsPerSecond: 5 } },
});

// Жагсаалтад хэрэгтэй хамгийн цөөн багана (өгөгдөл хэмнэнэ)
export const LITE = 'id,username,display_name,avatar_url,avatar_fx,font,color1,color2,verified,badge,is_admin,is_guest,plus_until,hide_online,last_online,user_no';
export const profiles = new Map();

export async function loadProfiles(ids, force = false) {
  const need = [...new Set(ids)].filter((i) => i && (force || !profiles.has(i)));
  for (let i = 0; i < need.length; i += 100) {
    const { data } = await sb.from('profiles').select(LITE).in('id', need.slice(i, i + 100));
    (data || []).forEach((p) => profiles.set(p.id, p));
  }
  return ids.map((i) => profiles.get(i));
}
export const isPlus = (p) => !!(p && p.plus_until && new Date(p.plus_until) > new Date());
export const isOnline = (p) => !!(p && !p.hide_online && p.last_online && Date.now() - new Date(p.last_online).getTime() < 90000);
export const pname = (p) => (p && (p.display_name || p.username)) || 'Хэрэглэгч';

// Алдааг ойлгомжтой Монгол текст болгоно
export function errText(e) {
  const m = String((e && (e.message || e.error_description || e.error)) || e || '');
  if (/rate_limit|too many|429/i.test(m)) return 'Хэт хурдан байна. Түр хүлээгээд дахин оролдоно уу.';
  if (/guest_forbidden/.test(m)) return 'Зочин хэрэглэгч энэ үйлдлийг хийх боломжгүй. Бүртгүүлнэ үү.';
  if (/banned/i.test(m)) return 'Таны эрх хязгаарлагдсан байна.';
  if (/need_followers/.test(m)) return 'Нийгэмлэг үүсгэхэд 3 дагагч хэрэгтэй.';
  if (/row-level security|violates row/i.test(m)) return 'Энэ үйлдлийг хийх эрх алга.';
  if (/Failed to fetch|NetworkError|network/i.test(m)) return 'Интернэт холболтоо шалгана уу.';
  if (/Invalid login|invalid_credentials|invalid/i.test(m)) return 'Нэр эсвэл нууц үг буруу байна.';
  if (/locked/.test(m)) return 'Олон удаа буруу оруулсан. 10 минутын дараа дахин оролдоно уу.';
  return m.length > 120 ? 'Алдаа гарлаа. Дахин оролдоно уу.' : (m || 'Алдаа гарлаа.');
}

// Алдааны лог: нэг төрлийн алдааг 1 минутад нэг л удаа явуулна
const seen = new Map();
export function log(level, kind, message, meta) {
  try {
    const key = kind + message, now = Date.now();
    if (now - (seen.get(key) || 0) < 60000) return; seen.set(key, now);
    sb.auth.getSession().then(({ data }) => {
      const uid = data && data.session && data.session.user.id; if (!uid) return;
      sb.from('app_logs').insert({ user_id: uid, level, kind: String(kind).slice(0, 40), message: String(message).slice(0, 500), meta: meta || null }).then(() => {}, () => {});
    });
  } catch (_) { /* логийн алдаа аппыг эвдэхгүй */ }
}
