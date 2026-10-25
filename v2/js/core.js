import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
export const SB_URL='https://whdpjlujnbcjjrmoyvkb.supabase.co';
export const SB_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndoZHBqbHVqbmJjampybW95dmtiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5NTM1NTUsImV4cCI6MjEwNzUyOTU1NX0.zEDt-S9NbGOBnaqxIKTUMXVcqiLdzsfkcKni19_Dr6E';
export const sb=createClient(SB_URL,SB_KEY,{realtime:{params:{eventsPerSecond:10}}});
export const $=id=>document.getElementById(id);
export const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// select('*') биш, зөвхөн хэрэгтэй багана (egress хэмнэнэ)
export const PCOLS='id,user_no,username,display_name,avatar_url,bio,banner,avatar_fx,font,color1,color2,verified,badge,is_admin,plus_until,last_online,hide_online,followers_count,following_count';
export const isPlus=p=>!!p?.plus_until&&new Date(p.plus_until)>new Date();
export const discordLogin=()=>sb.auth.signInWithOAuth({provider:'discord',options:{redirectTo:location.origin+location.pathname}});
const cache=new Map();
export async function profiles(ids){
  const need=[...new Set(ids)].filter(i=>i&&!cache.has(i));
  if(need.length){const {data}=await sb.from('profiles').select(PCOLS).in('id',need);(data||[]).forEach(p=>cache.set(p.id,p))}
  return ids.map(i=>cache.get(i)).filter(Boolean);
}
// 5 минут тутамд, зөвхөн хуудас харагдаж байхад last_online шинэчилнэ
export function heartbeat(me){
  const beat=()=>{if(!document.hidden)sb.from('profiles').update({last_online:new Date().toISOString()}).eq('id',me).then(()=>{})};
  beat();return setInterval(beat,300000);
}
