import {sb,$,esc,PCOLS,isPlus,discordLogin,profiles,heartbeat} from './core.js';
import {friendIds,history as loadHistory,send} from './api.js';
import {uploadMedia} from './media.js';
import {connect} from './realtime.js';

const STORE='https://whdpjlujnbcjjrmoyvkb.supabase.co/storage/';
const store=u=>typeof u==='string'&&u.startsWith(STORE)?u:'';
const https=u=>typeof u==='string'&&u.startsWith('https://')?u:'';
let me,prof,cur=null,friends=[],booted=false,rec=null;const seen=new Set();

const toast=t=>{const e=$('toast');e.textContent=t;e.classList.add('on');clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.remove('on'),2800)};
const av=p=>https(p.avatar_url)?`<img class="av" src="${esc(p.avatar_url)}" loading="lazy" alt="">`:`<div class="av">${esc((p.username||'?')[0].toUpperCase())}</div>`;
const nm=p=>esc(p.display_name||p.username);

/* ---------- нэвтрэлт ---------- */
const clean=x=>{x=String(x||'user').toLowerCase().replace(/[^a-z0-9_]/g,'_').slice(0,20);return x.length<3?x+'_usr':x};
async function ensureProfile(u){
  const get=()=>sb.from('profiles').select(PCOLS+',banned').eq('id',u.id).maybeSingle();
  let r=await get();if(r.data)return r.data;
  const m=u.user_metadata||{},base=clean(m.user_name||m.full_name||m.name);let un=base;
  for(let i=0;i<4;i++){
    const ins=await sb.from('profiles').insert({id:u.id,username:un,display_name:m.full_name||un,avatar_url:m.avatar_url||null}).select(PCOLS+',banned').single();
    if(ins.data)return ins.data;
    if(ins.error?.code==='23505'){r=await get();if(r.data)return r.data;un=base.slice(0,14)+'_'+Math.random().toString(36).slice(2,7)}else break;
  }
  return null;
}
async function boot(user){
  if(booted)return;booted=true;me=user;prof=await ensureProfile(user);
  if(!prof){booted=false;$('loader').classList.add('gone');$('auth').classList.remove('hide');toast('Профайл үүсгэж чадсангүй');return}
  if(prof.banned){document.body.innerHTML='<p style="padding:40px;text-align:center">Таны бүртгэл хязгаарлагдсан байна.</p>';return}
  $('auth').classList.add('hide');$('app').classList.remove('hide');$('loader').classList.add('gone');
  renderMe();await loadFriends();heartbeat(me.id);
  connect(me.id,{
    async message(m){const [p]=await profiles([m.sender]);if(cur&&cur.id===m.sender)addMsg(m);else toast('💬 '+(p?p.display_name||p.username:'Шинэ мессеж'))},
    async friendRequest(f){const [p]=await profiles([f.requester]);toast('👋 '+(p?nm(p):'Хэн нэгэн')+' найзын хүсэлт илгээлээ');if($('v-find').classList.contains('on'))search()},
    friendUpdate(f){if(f.status==='accepted'){loadFriends();toast('🎉 Найзын хүсэлт зөвшөөрөгдлөө')}}
  });
}
$('login').onclick=discordLogin;
sb.auth.onAuthStateChange((ev,s)=>{if(ev==='SIGNED_IN'&&s&&!booted)boot(s.user);if(ev==='SIGNED_OUT')location.reload()});
sb.auth.getSession().then(({data})=>{if(data.session)boot(data.session.user);else{$('loader').classList.add('gone');$('auth').classList.remove('hide')}});
setTimeout(()=>$('loader').classList.add('gone'),8000);

/* ---------- табууд ---------- */
document.querySelectorAll('#tabs button').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('#tabs button,.view').forEach(e=>e.classList.remove('on'));
  b.classList.add('on');$('v-'+b.dataset.t).classList.add('on');
  if(b.dataset.t==='find')search();if(b.dataset.t==='chats')loadFriends();
});

/* ---------- найзууд, чат жагсаалт ---------- */
async function loadFriends(){
  try{friends=await profiles(await friendIds(me.id))}catch{toast('Найзуудыг ачаалж чадсангүй')}
  $('list').innerHTML=friends.length?friends.map(p=>`<button class="row" data-id="${p.id}">${av(p)}<div><b>${nm(p)}</b><small>@${esc(p.username)}</small></div></button>`).join(''):'<p class="empty">Найз алга байна. "Найз" табаас хайж нэмээрэй.</p>';
}
$('list').onclick=e=>{const b=e.target.closest('.row');if(b)openChat(b.dataset.id)};

/* ---------- чат ---------- */
const att=a=>{const u=store(a?.url);if(!u)return'';const t=a.type||'';
  if(t.startsWith('image/'))return `<img class="am" src="${esc(u)}" loading="lazy" alt="">`;
  if(t.startsWith('video/'))return `<video class="am" src="${esc(u)}" controls preload="metadata" playsinline></video>`;
  if(t.startsWith('audio/'))return `<audio src="${esc(u)}" controls preload="none"></audio>`;
  return `<a href="${esc(u)}" target="_blank" rel="noopener">📎 ${esc(a.name||'файл')}</a>`};
const bubble=m=>{
  const a=Array.isArray(m.attachments)?m.attachments.map(att).join(''):'',v=store(m.audio_url)?`<audio src="${esc(m.audio_url)}" controls preload="none"></audio>`:'';
  const t=new Date(m.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  return `<div class="b ${m.sender===me.id?'out':'in'}">${a}${v}${m.body?`<span>${esc(m.body)}</span>`:''}<time>${t}</time></div>`};
const end=()=>{const e=$('msgs');e.scrollTop=e.scrollHeight};
function addMsg(m){if(seen.has(m.id)||!cur||(m.sender!==cur.id&&m.receiver!==cur.id))return;seen.add(m.id);$('msgs').insertAdjacentHTML('beforeend',bubble(m));end()}
async function openChat(id){
  cur=friends.find(f=>f.id===id)||(await profiles([id]))[0];if(!cur)return;
  seen.clear();$('cname').textContent=cur.display_name||cur.username;$('msgs').innerHTML='';$('chat').classList.add('on');
  try{(await loadHistory(me.id,cur.id)).forEach(addMsg)}catch{toast('Мессеж ачаалж чадсангүй')}
}
$('back').onclick=()=>{$('chat').classList.remove('on');cur=null};
async function sendMsg(m){
  if(!cur)return;
  try{addMsg(await send(me.id,cur.id,m))}catch(e){toast(String(e.message).includes('row-level')?'Илгээх боломжгүй байна':'Илгээж чадсангүй')}
}
let sending=false;
async function sendText(){const t=$('ctext').value.trim();if(!t||sending)return;sending=true;$('ctext').value='';await sendMsg({body:t});sending=false;$('ctext').focus()}
$('send').onclick=sendText;$('ctext').onkeydown=e=>{if(e.key==='Enter')sendText()};
$('file').onchange=async e=>{
  for(const f of e.target.files){
    try{toast('Оруулж байна...');const url=await uploadMedia('media',me.id,f,isPlus(prof));await sendMsg({attachments:[{url,type:f.type,name:f.name}]})}
    catch(err){toast(err.message||'Файл оруулж чадсангүй')}
  }
  e.target.value='';
};
$('mic').onclick=async()=>{
  if(rec){rec.stop();return}
  try{
    const s=await navigator.mediaDevices.getUserMedia({audio:true}),ch=[];rec=new MediaRecorder(s);
    rec.ondataavailable=e=>ch.push(e.data);
    rec.onstop=async()=>{
      s.getTracks().forEach(t=>t.stop());rec=null;$('mic').classList.remove('rec');
      const b=new Blob(ch,{type:ch[0]?.type||'audio/webm'});if(b.size<1500)return;
      try{const url=await uploadMedia('media',me.id,new File([b],'voice',{type:b.type.split(';')[0]}));await sendMsg({audio_url:url})}catch{toast('Дуу оруулж чадсангүй')}
    };
    rec.start();$('mic').classList.add('rec');setTimeout(()=>rec&&rec.state==='recording'&&rec.stop(),60000);
  }catch{toast('Микрофонд зөвшөөрөл өгнө үү')}
};

/* ---------- найз хайх, хүсэлт ---------- */
let st;$('q').oninput=()=>{clearTimeout(st);st=setTimeout(search,350)};
async function search(){
  const q=$('q').value.trim().toLowerCase().replace(/[^a-z0-9_]/g,'');
  let b=sb.from('profiles').select(PCOLS).neq('id',me.id).limit(20);
  b=q?b.ilike('username','%'+q+'%'):b.order('created_at',{ascending:false});
  const [{data:ps},{data:fr}]=await Promise.all([b,sb.from('friendships').select('id,requester,addressee,status').or(`requester.eq.${me.id},addressee.eq.${me.id}`)]);
  const rel={};(fr||[]).forEach(f=>rel[f.requester===me.id?f.addressee:f.requester]=f);
  $('fres').innerHTML=(ps||[]).map(p=>{
    const f=rel[p.id];let a='<button class="btn s" data-a="add">Нэмэх</button>';
    if(f?.status==='accepted')a='<small>Найз ✓</small>';
    else if(f&&f.requester===me.id)a='<small>Хүлээгдэж байна</small>';
    else if(f)a=`<button class="btn s" data-a="ok" data-f="${f.id}">Зөвшөөрөх</button>`;
    return `<div class="row" data-id="${p.id}">${av(p)}<div><b>${nm(p)}</b><small>@${esc(p.username)}</small></div>${a}</div>`}).join('')||'<p class="empty">Хэрэглэгч олдсонгүй</p>';
}
$('fres').onclick=async e=>{
  const btn=e.target.closest('button[data-a]');if(!btn)return;const id=btn.closest('.row').dataset.id;btn.disabled=true;
  const r=btn.dataset.a==='add'
    ?await sb.from('friendships').insert({requester:me.id,addressee:id,status:'pending'})
    :await sb.from('friendships').update({status:'accepted'}).eq('id',btn.dataset.f).eq('addressee',me.id);
  if(r.error)toast('Алдаа гарлаа, дахин оролдоно уу');else{toast('Хийгдлээ');loadFriends()}
  search();
};

/* ---------- профайл ---------- */
function renderMe(){
  $('me').innerHTML=`<div class="row" style="cursor:default">${av(prof)}<div><b>${nm(prof)}</b><small>@${esc(prof.username)}${isPlus(prof)?' · Comunic+':''}</small></div></div><button class="btn g" id="out" style="width:100%">Гарах</button>`;
  $('out').onclick=()=>sb.auth.signOut();
}
