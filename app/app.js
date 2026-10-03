const SB_URL='https://mefuakmklbuzqroerzre.supabase.co';
const SB_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1lZnVha21rbGJ1enFyb2VyenJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5MzEyNTEsImV4cCI6MjEwNjUwNzI1MX0.uR6iwXzcCen5Ws7nHrGx_zMjGRzHeWGQHDPuAhkY204';
const sb=supabase.createClient(SB_URL,SB_KEY);
const $=i=>document.getElementById(i);
const FONTS=['Inter','Pacifico','Bebas Neue','Caveat','Orbitron'];
const THEMES=['warm','dark','light','ocean','sunset'];
const VAPID='BCG5QSQVOdu_k_7UOOwlSGTqD95G1pndNwfvEl2VIPgbZtnT08yYjUNzJvqosIyfMcuI5s5KG-3J7_z15Z9GWKU';
const BADGES=['verified','star','heart','crown','dev','mod'];
let me,prof,friends=[],cur=null,seen={},tab='home',rec,chunks=[],started=false,lastSend=0,priv=null,keyCache={};

/* ---------- helpers ---------- */
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeColor=c=>/^#[0-9a-f]{6}$/i.test(c)?c:'#ffffff';
const gc=c=>{c=safeColor(c);return c==='#ffffff'?'var(--text)':c};
const safeFont=f=>FONTS.includes(f)?f:'Inter';
function nameHTML(p){return `<span class="nm" style="font-family:'${safeFont(p.font)}',sans-serif;background-image:linear-gradient(90deg,${gc(p.color1)},${gc(p.color2)})">${esc(p.display_name||p.username)}</span>`+(p.is_admin?'<span class="bdg">🛡️</span>':'')+(p.badge?badgeHTML(p.badge):'')}
function avHTML(p,big){const c='av'+(big?' l':'');return p.avatar_url?`<img class="${c}" src="${esc(p.avatar_url)}">`:`<div class="${c}">${esc((p.username||'?')[0].toUpperCase())}</div>`}
function badgeHTML(b){return BADGES.includes(b)?`<img class="bdgi" src="/assets/badges/${b}.svg" title="${b}">`:`<span class="bdg">${esc(b)}</span>`}
function setTheme(t){document.documentElement.dataset.theme=t;try{localStorage.theme=t}catch(e){}}
function hideLoader(){const l=$('loader');if(l)l.classList.add('gone')}
function cool(ts,d){const n=ts?new Date(ts).getTime()+d*864e5:0;return n>Date.now()?'Дараа нь солих: '+new Date(n).toLocaleDateString():'Одоо солих боломжтой'}

/* ---------- Auth (Discord only) ---------- */
function discordLogin(){sb.auth.signInWithOAuth({provider:'discord',options:{redirectTo:location.origin+location.pathname}})}
(function(){const q=new URLSearchParams(location.search+'&'+location.hash.replace(/^#/,'')),e=q.get('error_description');if(e)$('amsg').textContent='Нэвтрэх алдаа: '+e})();
const cleanName=x=>{x=String(x||'user').toLowerCase().replace(/[^a-z0-9_]/g,'_').slice(0,20);return x.length<3?x+'_usr':x};
async function makeProfile(u){
  const m=u.user_metadata||{},base=cleanName(m.full_name||m.user_name||m.name);let un=base;
  for(let i=0;i<4;i++){
    const r=await sb.from('profiles').insert({id:u.id,username:un,display_name:(m.custom_claims&&m.custom_claims.global_name)||m.full_name||un,avatar_url:m.avatar_url||m.picture||null,username_set:true}).select().single();
    if(r.data)return r.data;
    if(r.error&&r.error.code==='23505'){const ex=await sb.from('profiles').select('*').eq('id',u.id).maybeSingle();if(ex.data)return ex.data;un=base.slice(0,14)+'_'+Math.random().toString(36).slice(2,7)}else break;
  }
  return null;
}
async function start(u){
  if(started)return;started=true;me=u;
  const r=await sb.from('profiles').select('*').eq('id',u.id).maybeSingle();prof=r.data;
  if(!prof)prof=await makeProfile(u);
  if(!prof){started=false;hideLoader();$('auth').classList.remove('hide');$('amsg').textContent='Профайл үүсгэж чадсангүй. SQL patch-ууд ажилласан эсэхийг шалгана уу.';return}
  $('auth').classList.add('hide');$('app').classList.remove('hide');
  if(prof.banned){toast('Таны эрх хаагдсан байна');await sb.auth.signOut();location.reload();return}
  if(prof.is_admin&&!document.querySelector('[data-t=admin]')){const ab=document.createElement('button');ab.dataset.t='admin';ab.textContent='🛡️ Админ';ab.onclick=()=>show('admin');$('tabs').appendChild(ab)}
  await initKeys();hideLoader();if('serviceWorker' in navigator)navigator.serviceWorker.register('/app/sw.js').then(subPush).catch(()=>{});gate();
  sb.channel('msgs').on('postgres_changes',{event:'INSERT',schema:'public',table:'messages'},x=>{
    const m=x.new;if(cur&&(m.sender===cur.id||m.receiver===cur.id))addMsg(m);
    if(m.sender!==me.id&&(document.hidden||!cur||cur.id!==m.sender))notify(m)})
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'friendships'},x=>{if(x.new.addressee===me.id)reqNotify(x.new.requester,'sent')})
    .on('postgres_changes',{event:'UPDATE',schema:'public',table:'friendships'},x=>{if(x.new.requester===me.id&&x.new.status==='accepted')reqNotify(x.new.addressee,'acc')})
    .on('postgres_changes',{event:'DELETE',schema:'public',table:'messages'},x=>{const el=document.querySelector('[data-id="'+x.old.id+'"]');if(el)el.remove()})
    .subscribe();
  await home();route();
}
sb.auth.onAuthStateChange((ev,sess)=>{if(sess&&sess.user)start(sess.user)});
sb.auth.getSession().then(r=>{if(r.data.session)start(r.data.session.user);else hideLoader()});
setTimeout(hideLoader,8000);

/* ---------- Tabs ---------- */
document.querySelectorAll('#tabs button').forEach(b=>b.onclick=()=>show(b.dataset.t));
function show(t){tab=t;document.querySelectorAll('#tabs button').forEach(b=>b.classList.toggle('on',b.dataset.t===t));
  if(t==='home')home();else if(t==='find')find();else if(t==='admin')admin();else if(t==='notes')notesTab();else profile()}

/* ---------- Home ---------- */
async function getRel(){const r=await sb.from('friendships').select('*'),map={};(r.data||[]).forEach(f=>{map[f.requester===me.id?f.addressee:f.requester]=f});return map}
window._N={};let storyData={};
async function home(){
  const rel=await getRel(),ids=Object.keys(rel).filter(k=>rel[k].status==='accepted');
  friends=ids.length?(await sb.from('profiles').select('*').in('id',ids)).data||[]:[];
  const day=new Date(Date.now()-864e5).toISOString();
  const [ns,ss]=await Promise.all([sb.from('notes').select('*').gt('created_at',day).order('created_at',{ascending:false}),sb.from('stories').select('*').gt('created_at',day).order('created_at')]);
  storyData={};(ss.data||[]).forEach(s=>(storyData[s.user_id]=storyData[s.user_id]||[]).push(s));
  const last={};(ns.data||[]).forEach(n=>{_N[n.id]=n;if(!last[n.user_id])last[n.user_id]=n});
  const all=[prof,...friends],nm=p=>p.id===me.id?'Би':esc(p.username);
  let h='<h3>Story</h3><div class="nrow"><div class="note" onclick="addStory()"><div class="av" style="font-size:26px;margin:0 auto">＋</div><div>Нэмэх</div></div>';
  all.forEach(p=>{if(storyData[p.id])h+=`<div class="note" onclick="viewStory('${p.id}')"><div class="ring">${avHTML(p)}</div><div>${nm(p)}</div></div>`});
  h+='</div><h3>Нотууд</h3><div class="nrow">';
  all.forEach(p=>{const n=last[p.id];if(n)h+=`<div class="note" onclick="playN('${n.id}')"><div class="bub">${esc(n.body||'')}${n.audio_url?' 🎧':''}</div>${avHTML(p)}<div>${nm(p)}</div></div>`});
  h+='</div><h3>Чатууд</h3>';
  if(!friends.length)h+='<p style="color:var(--muted)">Найз байхгүй байна. "Найз" цэсээс хайж нэм.</p>';
  friends.forEach(f=>{h+=`<div class="row" onclick="openChat('${f.id}')">${avHTML(f)}<div class="g">${nameHTML(f)}<small>@${esc(f.username)}</small></div></div>`});
  $('main').innerHTML=h;
}
function playN(id){const n=_N[id];if(n&&n.audio_url)new Audio(n.audio_url).play()}

/* ---------- Stories ---------- */
let svT;
function addStory(){
  const i=document.createElement('input');i.type='file';i.accept='image/*';
  i.onchange=async()=>{const f=i.files[0];if(!f)return;const cap=prompt('Тайлбар (заавал биш)')||'',u=await upload('voice',f,f.type);
    if(u){const r=await sb.from('stories').insert({user_id:me.id,image_url:u,caption:cap.slice(0,100)});if(r.error)toast('Story нэмж чадсангүй');home()}};
  i.click();
}
function viewStory(uid,i=0){
  const list=storyData[uid]||[];if(i>=list.length){closeSV();return}
  const s=list[i],p=uid===me.id?prof:(friends.find(f=>f.id===uid)||{username:'?'});
  let v=$('sv');if(!v){v=document.createElement('div');v.id='sv';document.body.appendChild(v);history.pushState({sv:1},'')}
  v.innerHTML=`<div class="sbar">${list.map((_,k)=>`<i class="${k<i?'d':k===i?'a':''}"></i>`).join('')}</div><div class="shead">${avHTML(p)}<b>${esc(p.display_name||p.username)}</b><span style="flex:1"></span>${uid===me.id?`<button class="btn s" onclick="delStory('${s.id}','${uid}')">🗑</button>`:''}<button class="btn s" onclick="closeSV()">✕</button></div><img src="${esc(s.image_url)}"><p>${esc(s.caption||'')}</p><div class="tl" onclick="viewStory('${uid}',${Math.max(0,i-1)})"></div><div class="tr" onclick="viewStory('${uid}',${i+1})"></div>`;
  clearTimeout(svT);svT=setTimeout(()=>viewStory(uid,i+1),5000);
}
function closeSV(){clearTimeout(svT);const v=$('sv');if(v){v.remove();if(history.state&&history.state.sv)history.back()}}
async function delStory(id,uid){await sb.from('stories').delete().eq('id',id);storyData[uid]=(storyData[uid]||[]).filter(s=>s.id!==id);closeSV();home()}

/* ---------- Notes tab (saved history) ---------- */
let pendAudio=null;
async function setNoteAudio(blob,type){const u=await upload('voice',blob,type);if(u){pendAudio=u;$('nv').textContent='🎧 Дуу бэлэн'}}
async function postNote(){
  const b=$('nb').value.trim();if(!b&&!pendAudio){toast('Бичвэр эсвэл дуу оруулна уу');return}
  const r=await sb.from('notes').insert({user_id:me.id,body:b||null,audio_url:pendAudio});pendAudio=null;
  if(r.error)toast('Нийтэлж чадсангүй');notesTab();
}
async function delNote(id){await sb.from('notes').delete().eq('id',id);notesTab()}
async function notesTab(){
  $('main').innerHTML=`<h3>Шинэ нот</h3><input id="nb" maxlength="100" placeholder="Юу бодож байна?"><div class="cr" style="align-items:center"><button class="mic" onclick="toggleRec(this,setNoteAudio)">🎤</button><span id="nv" style="color:var(--muted);font-size:14px">Дуу нэмэх (заавал биш)</span><button class="btn" style="margin-left:auto" onclick="postNote()">Нийтлэх</button></div><h3>Найзуудын нот (24 цаг)</h3><div id="nf"></div><h3>Миний хадгалсан нотууд</h3><div id="nmine"></div>`;
  const r=await sb.from('notes').select('*').order('created_at',{ascending:false}).limit(60),all=r.data||[],day=Date.now()-864e5;
  const ids=[...new Set(all.map(n=>n.user_id))],ps=ids.length?(await sb.from('profiles').select('*').in('id',ids)).data||[]:[],P={};ps.forEach(p=>P[p.id]=p);
  const card=(n,mine)=>{_N[n.id]=n;const p=P[n.user_id]||prof;return `<div class="row">${avHTML(p)}<div class="g">${nameHTML(p)}<small>${esc(n.body||'')} · ${new Date(n.created_at).toLocaleString()}</small></div>${n.audio_url?`<button class="btn s" onclick="playN('${n.id}')">▶</button>`:''}${mine?`<button class="btn s" onclick="delNote('${n.id}')">🗑</button>`:''}</div>`};
  const none='<p style="color:var(--muted)">Одоохондоо алга</p>';
  $('nf').innerHTML=all.filter(n=>n.user_id!==me.id&&new Date(n.created_at).getTime()>day).map(n=>card(n,false)).join('')||none;
  $('nmine').innerHTML=all.filter(n=>n.user_id===me.id).map(n=>card(n,true)).join('')||none;
}
function playNote(id){const f=friends.find(x=>x.id===id);if(f&&f.note_audio)new Audio(f.note_audio).play()}

/* ---------- Find friends ---------- */
async function find(){
  $('main').innerHTML='<input id="q" placeholder="Username-аар хайх..." oninput="doSearch()"><div id="req"></div><h3 id="fh">Шинээр нэгдсэн</h3><div id="res"></div>';
  const rel=await getRel();window._rel=rel;
  const inc=Object.keys(rel).filter(k=>rel[k].status==='pending'&&rel[k].addressee===me.id);
  if(inc.length){const ps=(await sb.from('profiles').select('*').in('id',inc)).data||[];
    $('req').innerHTML='<h3>Ирсэн хүсэлт</h3>'+ps.map(p=>`<div class="row">${avHTML(p)}<div class="g">${nameHTML(p)}<small>@${esc(p.username)}</small></div><button class="btn s" onclick="accept('${rel[p.id].id}')">Зөвшөөрөх</button></div>`).join('')}
  doSearch();
}
let st;function doSearch(){clearTimeout(st);st=setTimeout(runSearch,250)}
async function runSearch(){
  const q=(($('q')&&$('q').value)||'').toLowerCase().replace(/[^a-z0-9_]/g,'');
  let b=sb.from('profiles').select('*').neq('id',me.id);
  b=q?b.ilike('username','%'+q+'%').limit(20):b.order('created_at',{ascending:false}).limit(20);
  const r=await b;if(!$('res'))return;$('fh').textContent=q?'Үр дүн':'Шинээр нэгдсэн';const rel=window._rel||{};
  $('res').innerHTML=(r.data||[]).map(p=>{const f=rel[p.id];let btn;
    if(!f)btn=`<button class="btn s" onclick="addFriend('${p.id}',this)">Нэмэх</button>`;
    else if(f.status==='accepted')btn='<small>✓ Найз</small>';
    else btn=`<small>${f.requester===me.id?'Илгээсэн':'Хүлээж байна'}</small>`;
    return `<div class="row">${avHTML(p)}<div class="g">${nameHTML(p)}<small>@${esc(p.username)}</small></div>${btn}</div>`}).join('')||'<p style="color:var(--muted)">Олдсонгүй</p>';
}
async function addFriend(id,b){b.disabled=true;const r=await sb.from('friendships').insert({requester:me.id,addressee:id});b.outerHTML=`<small>${r.error?(/rate_limit/.test(r.error.message)?'Хэт олон хүсэлт':'Алдаа'):'Илгээсэн'}</small>`}
async function accept(id){await sb.from('friendships').update({status:'accepted'}).eq('id',id);find()}

/* ---------- Chat ---------- */
async function openChat(id,replace){
  cur=friends.find(f=>f.id===id);if(!cur)return;seen={};
  const slug=await chatSlug(id);if(!slug){cur=null;toast('Чат нээж чадсангүй');return}
  history[replace?'replaceState':'pushState']({chat:slug},'','#/c/'+slug);
  $('cinfo').innerHTML=avHTML(cur)+nameHTML(cur);lockUI();$('msgs').innerHTML='';$('chat').classList.remove('hide');
  const r=await sb.from('messages').select('*').or(`and(sender.eq.${me.id},receiver.eq.${id}),and(sender.eq.${id},receiver.eq.${me.id})`).order('created_at').limit(200);
  (r.data||[]).forEach(addMsg);
}
function hideChat(){cur=null;$('chat').classList.add('hide')}
function closeChat(){if(history.state&&history.state.chat)history.back();else hideChat()}
window.addEventListener('popstate',()=>{if(!(history.state&&history.state.chat)){hideChat();closeSV()}});
async function chatSlug(other){
  const [a,b]=[me.id,other].sort(),slug=crypto.randomUUID().replace(/-/g,'');
  const r=await sb.from('chat_links').upsert({a,b,slug},{onConflict:'a,b'});return r.error?null:slug;
}
async function route(){
  const m=location.hash.match(/^#\/c\/([a-f0-9]{32})$/);if(!m)return;
  const r=await sb.from('chat_links').select('*').eq('slug',m[1]).maybeSingle(),o=r.data&&(r.data.a===me.id?r.data.b:r.data.a);
  if(o&&friends.find(f=>f.id===o))openChat(o,true);else{toast('Холбоос хүчингүй эсвэл эрхгүй');history.replaceState(null,'','/app/')}
}
async function syncChat(){
  if(!cur)return;const id=cur.id,r=await sb.from('messages').select('*').or(`and(sender.eq.${me.id},receiver.eq.${id}),and(sender.eq.${id},receiver.eq.${me.id})`).order('created_at').limit(200);
  (r.data||[]).forEach(addMsg);
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&me){syncChat();if(tab==='home'&&!cur)home()}});
function addMsg(m){
  if(seen[m.id])return;seen[m.id]=1;
  const d=document.createElement('div');d.className='m'+(m.sender===me.id?' me':'');$('msgs').appendChild(d);d.dataset.id=m.id;d.title=new Date(m.created_at).toLocaleString();
  fill(d,m).then(()=>{
    if(m.sender!==me.id){const b=document.createElement('button');b.className='rp';b.textContent='⚑';b.title='Report';b.onclick=()=>report(m,d.dataset.t||'');d.appendChild(b)}else{const b=document.createElement('button');b.className='rp';b.textContent='🗑';b.title='Буцаах';b.onclick=async()=>{if(confirm('Мессежийг устгах уу?')){await sb.from('messages').delete().eq('id',m.id);d.remove()}};d.appendChild(b)}
    $('msgs').scrollTop=$('msgs').scrollHeight});
}
async function fill(d,m){
  try{
    if(m.audio_url){
      if(m.enc){const pt=await dec(await (await fetch(m.audio_url)).arrayBuffer(),await sharedKey(cur));addAudio(d,URL.createObjectURL(new Blob([pt],{type:m.mime||'audio/webm'})),true)}
      else addAudio(d,m.audio_url,false);
    }else if(m.image_url){const im=document.createElement('img');im.src=m.image_url;im.className='pic';d.appendChild(im)}
    else{let t=m.body;if(m.enc)t=new TextDecoder().decode(await dec(Uint8Array.from(atob(m.body),c=>c.charCodeAt(0)),await sharedKey(cur)));d.dataset.t=t;d.appendChild(document.createTextNode(t))}
  }catch(e){d.textContent='🔒 Тайлах боломжгүй'}
}
function addAudio(d,src,lock){const a=document.createElement('audio');a.controls=true;a.src=src;if(lock){a.setAttribute('controlsList','nodownload noplaybackrate');a.oncontextmenu=e=>e.preventDefault()}d.appendChild(a);if(lock){const l=document.createElement('small');l.textContent=' 🔒';d.appendChild(l)}}
async function sendRow(row){
  const r=await sb.from('messages').insert({sender:me.id,receiver:cur.id,...row}).select().single();
  if(r.data)addMsg(r.data);else toast(r.error&&/rate_limit/.test(r.error.message)?'Хэт хурдан илгээж байна, түр хүлээнэ үү':r.error&&/banned/.test(r.error.message)?'Таны эрх хаагдсан байна':'Илгээж чадсангүй');
}
async function sendText(){
  const t=$('ctext').value.trim();if(!t||!cur||Date.now()-lastSend<500)return;lastSend=Date.now();$('ctext').value='';
  if(encOn()){const o=await enc(new TextEncoder().encode(t),await sharedKey(cur));sendRow({body:b64(o),enc:true})}else sendRow({body:t});
}
$('ctext').addEventListener('keydown',e=>{if(e.key==='Enter')sendText()});
async function sendVoice(blob,type){
  if(encOn()){const o=await enc(new Uint8Array(await blob.arrayBuffer()),await sharedKey(cur)),u=await upload('voice',new Blob([o]),'application/octet-stream');if(u)sendRow({audio_url:u,enc:true,mime:type})}
  else{const u=await upload('voice',blob,type);if(u)sendRow({audio_url:u})}
}
async function sendImg(i){const f=i.files[0];i.value='';if(!f||!cur)return;if(encOn()){toast('E2EE горимд зураг илгээх боломжгүй');return}const u=await upload('voice',f,f.type);if(u)sendRow({image_url:u})}
$('emo').innerHTML='😀 😂 🤣 😍 🥰 😎 🤔 😭 😡 👍 👎 🙏 👏 🔥 💯 ❤️ 💔 🎉 ✨ 🌹 😴 🤯 🥳 😅 🤝 💪 👀 🙌 😘 😇 🤗 😜 🍕 ☕ 🎵 ⚽ 🇲🇳'.split(' ').map(e=>`<span>${e}</span>`).join('');
$('emo').onclick=e=>{if(e.target.tagName==='SPAN'){$('ctext').value+=e.target.textContent;$('ctext').focus()}};

/* ---------- Voice + upload ---------- */
async function upload(bucket,blob,type){
  const ext=type.includes('mp4')?'m4a':type.includes('webm')?'webm':type.includes('png')?'png':type.includes('jpeg')?'jpg':type.includes('gif')?'gif':type.includes('webp')?'webp':'bin';
  const path=`${me.id}/${Date.now()}.${ext}`,r=await sb.storage.from(bucket).upload(path,blob,{contentType:type});
  if(r.error){toast('Upload алдаа');return null}
  return sb.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
async function toggleRec(btn,done){
  if(rec&&rec.state==='recording'){rec.stop();return}
  let s;try{s=await navigator.mediaDevices.getUserMedia({audio:true})}catch(e){toast('Микрофоны зөвшөөрөл өгнө үү');return}
  rec=new MediaRecorder(s);chunks=[];rec.ondataavailable=e=>chunks.push(e.data);
  rec.onstop=()=>{s.getTracks().forEach(t=>t.stop());btn.classList.remove('rec');const type=rec.mimeType||'audio/webm';done(new Blob(chunks,{type}),type)};
  rec.start();btn.classList.add('rec');setTimeout(()=>{if(rec&&rec.state==='recording')rec.stop()},60000);
}

/* ---------- Profile ---------- */
function profile(){
  const p=prof;
  $('main').innerHTML=`<div style="text-align:center"><div id="pav">${avHTML(p,true)}</div><p><label class="btn s" style="display:inline-block;margin-top:8px;cursor:pointer">Зураг солих<input type="file" id="pf" accept="image/*" class="hide" onchange="setAvatar(this)"></label></p><p id="prev" style="margin-top:10px;font-size:26px">${nameHTML(p)}</p></div>
  <h3>Username (сард 1 удаа)</h3><input id="un" value="${esc(p.username)}" maxlength="20" autocapitalize="none"><small style="color:var(--muted)">${cool(p.username_changed_at,30)}</small>
  <h3>Нэр (7 хоногт 1 удаа)</h3><input id="dn" value="${esc(p.display_name||p.username)}" maxlength="30" oninput="prevName()"><small style="color:var(--muted)">${cool(p.name_changed_at,7)}</small>
  <h3>Тема</h3><select onchange="setTheme(this.value)">${THEMES.map(t=>`<option${t===document.documentElement.dataset.theme?' selected':''}>${t}</option>`).join('')}</select>
  <h3>Фонт ба градиент өнгө</h3><select id="fo" onchange="prevName()">${FONTS.map(f=>`<option${f===p.font?' selected':''}>${f}</option>`).join('')}</select>
  <div class="cr"><input type="color" id="c1" value="${safeColor(p.color1)}" oninput="prevName()"><input type="color" id="c2" value="${safeColor(p.color2)}" oninput="prevName()"></div>
  <div class="cr"><button class="btn" style="flex:1" onclick="saveProfile()">Хадгалах</button></div>
  <p id="ps" style="color:var(--b);min-height:22px"></p><button class="btn s" onclick="askPerms()">🔔 Зөвшөөрөл</button> <button class="btn s" onclick="installApp()">📲 Апп татах</button> <button class="btn s" onclick="sb.auth.signOut().then(()=>location.reload())">Гарах</button>
  <p class="fine" style="margin-top:16px"><a href="/terms.html">Нөхцөл</a> · <a href="/privacy.html">Нууцлал</a></p>`;
}
function prevName(){$('prev').innerHTML=nameHTML({username:prof.username,display_name:$('dn').value,font:$('fo').value,color1:$('c1').value,color2:$('c2').value})}
async function patchErr(o){const r=await sb.from('profiles').update(o).eq('id',me.id).select().single();if(r.data)prof=r.data;return r.error}
async function setAvatar(inp){const f=inp.files[0];if(!f)return;const u=await upload('avatars',f,f.type);if(u&&!await patchErr({avatar_url:u}))$('pav').innerHTML=avHTML(prof,true)}
async function setVoiceNote(blob,type){const u=await upload('voice',blob,type);if(u&&!await patchErr({note_audio:u,note_at:new Date().toISOString()}))$('vn').textContent='Дуут нот хадгалагдлаа ✓'}
async function saveProfile(){
  const msg=[];
  if(await patchErr({font:$('fo').value,color1:$('c1').value,color2:$('c2').value}))msg.push('Хадгалахад алдаа');
  const dn=$('dn').value.trim(),un=$('un').value.trim().toLowerCase();
  if(dn&&dn!==prof.display_name){const e=await patchErr({display_name:dn});if(e)msg.push(/name_cooldown/.test(e.message)?'Нэр: 7 хоногт 1 удаа':'Нэр солиход алдаа')}
  if(un!==prof.username){
    if(!/^[a-z0-9_]{3,20}$/.test(un))msg.push('Username: 3-20 тэмдэгт, a-z 0-9 _');
    else{const e=await patchErr({username:un});if(e)msg.push(/username_cooldown/.test(e.message)?'Username: сард 1 удаа':'Username эзлэгдсэн')}
  }
  profile();$('ps').textContent=msg.length?msg.join(' · '):'Хадгалагдлаа ✓';
}
async function clearNote(){await patchErr({note_text:null,note_audio:null});profile()}

/* ---------- Permissions + notifications ---------- */
async function askPerms(){
  try{localStorage.permAsked=1}catch(e){}
  try{await Notification.requestPermission()}catch(e){}
  try{const s=await navigator.mediaDevices.getUserMedia({audio:true,video:true});s.getTracks().forEach(t=>t.stop())}
  catch(e){try{const s=await navigator.mediaDevices.getUserMedia({audio:true});s.getTracks().forEach(t=>t.stop())}catch(e2){}}
  if(tab==='home')home();
}
function pushN(title,body,tag){
  if(!window.Notification||Notification.permission!=='granted')return;const o={body,tag,data:{url:'/app/'},icon:'/assets/icon-192.png'};
  const fb=()=>{try{new Notification(title,o)}catch(e){}};
  if('serviceWorker' in navigator)navigator.serviceWorker.ready.then(r=>r.showNotification(title,o)).catch(fb);else fb();
}
async function notify(m){
  let f=friends.find(x=>x.id===m.sender);if(!f){const r=await sb.from('profiles').select('*').eq('id',m.sender).maybeSingle();f=r.data}
  if(f)pushN(f.display_name||f.username,m.enc?'🔒 Шинэ мессеж':m.body||(m.audio_url?'🎤 Дуут мессеж':'📷 Зураг'),'m'+f.id);
}
function u8(b){const p='='.repeat((4-b.length%4)%4),r=atob((b+p).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from(r,c=>c.charCodeAt(0))}
async function subPush(){
  try{
    if(!VAPID||!('PushManager' in window)||Notification.permission!=='granted')return;
    const reg=await navigator.serviceWorker.ready;let s=await reg.pushManager.getSubscription();
    if(!s)s=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:u8(VAPID)});
    const sj=s.toJSON();await sb.from('push_subs').upsert({user_id:me.id,endpoint:sj.endpoint,sub:sj},{onConflict:'endpoint'});
  }catch(e){}
}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();window._ip=e});
function installApp(){if(window._ip)window._ip.prompt();else location.href='/download.html'}
function toast(m){let t=$('toast');if(!t){t=document.createElement('div');t.id='toast';document.body.appendChild(t)}t.textContent=m;t.classList.add('on');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('on'),3200)}
async function reqNotify(id,kind){
  const r=await sb.from('profiles').select('display_name,username').eq('id',id).maybeSingle();if(!r.data)return;
  pushN(r.data.display_name||r.data.username,kind==='sent'?'👋 Найзын хүсэлт илгээлээ':'✅ Найзын хүсэлтийг чинь зөвшөөрлөө','f'+id);
  if(tab==='find')find();if(tab==='home')home();
}
function gate(){
  if(!('Notification' in window)||Notification.permission==='granted')return;
  const g=document.createElement('div');g.id='gate';
  g.innerHTML='<div class="ic">🔔</div><h2>Мэдэгдэл асаана уу</h2><p style="color:var(--muted)">Найзын мессеж, хүсэлтийг алдахгүйн тулд мэдэгдэл заавал хэрэгтэй.</p><button class="btn" id="gbtn">Мэдэгдэл асаах</button><p id="gmsg" class="fine"></p>';
  document.body.appendChild(g);
  const chk=()=>{if(Notification.permission==='granted'){g.remove();askPerms();subPush()}};
  $('gbtn').onclick=async()=>{try{await Notification.requestPermission()}catch(e){}chk();if(Notification.permission==='denied')$('gmsg').textContent='Хаягийн мөрний 🔒 → Сайтын тохиргоо → Мэдэгдэл → Allow болгоод хуудсаа дахин ачаална уу.'};
  document.addEventListener('visibilitychange',chk);
}

/* ---------- Report + Admin ---------- */
async function report(m,snap){
  const why=prompt('Report-ийн шалтгаан (spam, доромжлол, аюултай агуулга...)');if(!why)return;
  const r=await sb.from('reports').insert({reporter:me.id,message_id:m.id,reported_user:m.sender,reason:why.slice(0,200),snapshot:(snap||m.image_url||m.audio_url||'').slice(0,500)});
  toast(r.error?'Илгээж чадсангүй (хэт олон report байж магадгүй)':'Report илгээгдлээ. Баярлалаа.');
}
async function admin(){
  $('main').innerHTML='<h3>🚩 Report-ууд</h3><div id="rl"></div><h3>Хэрэглэгчид</h3><input id="aq" placeholder="Username хайх..." oninput="adminList()"><div id="al"></div>';adminList();
  const r=await sb.from('reports').select('*').order('created_at',{ascending:false}).limit(20);
  $('rl').innerHTML=(r.data||[]).map(x=>`<div class="row" style="flex-wrap:wrap"><div class="g"><small>${esc(x.reason||'')}</small>${esc((x.snapshot||'(агуулга байхгүй)').slice(0,200))}</div><button class="btn s" onclick="adm('${x.reported_user}','ban',true);delReport('${x.id}')">🚫 Ban</button><button class="btn s" onclick="delReport('${x.id}')">Хаах</button></div>`).join('')||'<p style="color:var(--muted)">Report байхгүй</p>';
}
async function delReport(id){await sb.from('reports').delete().eq('id',id);admin()}
async function adminList(){
  const q=($('aq').value||'').toLowerCase().replace(/[^a-z0-9_]/g,'');
  let b=sb.from('profiles').select('*').order('created_at',{ascending:false}).limit(30);if(q)b=b.ilike('username','%'+q+'%');
  const r=await b;
  $('al').innerHTML=(r.data||[]).map(p=>{const i=`adm('${p.id}',`;return `<div class="row" style="flex-wrap:wrap">${avHTML(p)}<div class="g">${nameHTML(p)}<small>@${esc(p.username)}${p.banned?' · БАН':''}</small></div><div style="display:flex;gap:6px;flex-wrap:wrap;width:100%"><button class="btn s" onclick="${i}'badge')">🏅 Badge</button><button class="btn s" onclick="${i}'ban',${!p.banned})">${p.banned?'Unban':'🚫 Ban'}</button><button class="btn s" onclick="${i}'avatar')">🖼️ Avatar устгах</button><button class="btn s" onclick="${i}'name')">✏️ Нэр</button><button class="btn s" onclick="${i}'username')">@ Username</button></div></div>`}).join('');
}
async function adm(id,act,v){
  const o={};
  if(act==='badge'){const b=prompt('Badge: '+BADGES.join(', ')+' (эсвэл текст). Хоосон = арилгах');if(b===null)return;o.badge=b.trim().slice(0,12)||null}
  else if(act==='ban'){if(id===me.id){toast('Өөрийгөө бан хийж болохгүй');return}o.banned=v}
  else if(act==='avatar')o.avatar_url=null;
  else if(act==='name'){const n=prompt('Шинэ нэр');if(!n)return;o.display_name=n.trim().slice(0,30)}
  else{const u=prompt('Шинэ username');if(!u||!/^[a-z0-9_]{3,20}$/.test(u.toLowerCase())){toast('3-20 тэмдэгт, a-z 0-9 _');return}o.username=u.toLowerCase()}
  const r=await sb.from('profiles').update(o).eq('id',id);if(r.error)toast('Алдаа: '+r.error.message);adminList();
}

/* ---------- E2EE (ECDH P-256 + AES-GCM) ---------- */
const ECA={name:'ECDH',namedCurve:'P-256'};
async function initKeys(){
  try{
    const st=localStorage.e2eePriv;
    if(st&&prof.public_key){priv=await crypto.subtle.importKey('jwk',JSON.parse(st),ECA,false,['deriveKey']);return}
    const kp=await crypto.subtle.generateKey(ECA,true,['deriveKey']);
    localStorage.e2eePriv=JSON.stringify(await crypto.subtle.exportKey('jwk',kp.privateKey));priv=kp.privateKey;
    await patchErr({public_key:JSON.stringify(await crypto.subtle.exportKey('jwk',kp.publicKey))});
  }catch(e){priv=null}
}
async function sharedKey(p){
  if(keyCache[p.id])return keyCache[p.id];
  const pub=await crypto.subtle.importKey('jwk',JSON.parse(p.public_key),ECA,false,[]);
  return keyCache[p.id]=await crypto.subtle.deriveKey({name:'ECDH',public:pub},priv,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
async function enc(bytes,k){const iv=crypto.getRandomValues(new Uint8Array(12)),ct=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},k,bytes)),o=new Uint8Array(12+ct.length);o.set(iv);o.set(ct,12);return o}
async function dec(buf,k){const u=new Uint8Array(buf);return crypto.subtle.decrypt({name:'AES-GCM',iv:u.slice(0,12)},k,u.slice(12))}
function b64(u){let s='';for(let i=0;i<u.length;i++)s+=String.fromCharCode(u[i]);return btoa(s)}
function encOn(){try{return !!cur&&localStorage['e2e_'+cur.id]==='1'}catch(e){return false}}
function lockUI(){$('lock').textContent=encOn()?'🔒 E2EE':'🔓';$('ctext').placeholder=encOn()?'🔒 Шифрлэгдсэн мессеж...':'Мессеж...'}
function toggleE2E(){
  if(!priv||!cur.public_key){toast('Найз тань аппаа дахин нээж E2EE түлхүүрээ үүсгэх хэрэгтэй');return}
  try{localStorage['e2e_'+cur.id]=encOn()?'0':'1'}catch(e){}lockUI();
}
