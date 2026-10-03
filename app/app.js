if(!window.supabase)throw new Error('Supabase сан ачаалагдсангүй (интернэт эсвэл CDN хаагдсан)');
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
  if(prof.banned){banScreen();hideLoader();return}
  if(prof.is_admin&&!document.querySelector('[data-t=admin]')){const ab=document.createElement('button');ab.dataset.t='admin';ab.textContent='🛡️ Админ';ab.onclick=()=>show('admin');$('tabs').appendChild(ab)}
  await initKeys();hideLoader();if('serviceWorker' in navigator)navigator.serviceWorker.register('/app/sw.js').then(subPush).catch(()=>{});gate();
  sb.channel('msgs').on('postgres_changes',{event:'INSERT',schema:'public',table:'messages'},x=>{
    const m=x.new;if(cur&&(m.sender===cur.id||m.receiver===cur.id))addMsg(m);
    if(m.sender!==me.id&&(document.hidden||!cur||cur.id!==m.sender))notify(m)})
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'friendships'},x=>{if(x.new.addressee===me.id)reqNotify(x.new.requester,'sent')})
    .on('postgres_changes',{event:'UPDATE',schema:'public',table:'friendships'},x=>{if(x.new.requester===me.id&&x.new.status==='accepted')reqNotify(x.new.addressee,'acc')})
    .on('postgres_changes',{event:'DELETE',schema:'public',table:'messages'},x=>{const el=document.querySelector('[data-id="'+x.old.id+'"]');if(el)el.remove()})
    .subscribe();
  await home();route();initV6();
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
  await loadReqs();await sortFriends();
  const day=new Date(Date.now()-864e5).toISOString();
  const [ns,ss]=await Promise.all([sb.from('notes').select('*').gt('created_at',day).order('created_at',{ascending:false}),sb.from('stories').select('*').gt('created_at',day).order('created_at')]);
  storyData={};(ss.data||[]).forEach(s=>(storyData[s.user_id]=storyData[s.user_id]||[]).push(s));
  const last={};(ns.data||[]).forEach(n=>{_N[n.id]=n;if(!last[n.user_id])last[n.user_id]=n});
  const all=[prof,...friends],nm=p=>p.id===me.id?'Би':esc(p.username);
  let h='<h3>Story</h3><div class="nrow"><div class="note" onclick="addStory()"><div class="av" style="font-size:26px;margin:0 auto">＋</div><div>Нэмэх</div></div>';
  all.forEach(p=>{if(storyData[p.id])h+=`<div class="note" onclick="viewStory('${p.id}')"><div class="ring">${avHTML(p)}</div><div>${nm(p)}</div></div>`});
  h+='</div><h3>Нотууд</h3><div class="nrow">';
  all.forEach(p=>{const n=last[p.id];if(n)h+=`<div class="note" onclick="playN('${n.id}')"><div class="bub">${esc(n.body||'')}${n.audio_url?' 🎧':''}</div>${avHTML(p)}<div>${nm(p)}</div></div>`});
  h+='</div>'+reqHTML()+'<h3>Чатууд</h3>';
  if(!friends.length)h+='<p style="color:var(--muted)">Найз байхгүй байна. "Найз" цэсээс хайж нэм.</p>';
  friends.forEach(f=>{h+=`<div class="row" onclick="openChat('${f.id}')">${avHTML(f)}<div class="g">${nameHTML(f)}<small>${esc(LM[f.id]?lmText(LM[f.id]):'@'+f.username)}</small></div></div>`});
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
  cur=friends.find(f=>f.id===id)||REQP[id];if(!cur)return;seen={};
  const slug=await chatSlug(id);if(!slug){cur=null;toast('Чат нээж чадсангүй');return}
  history[replace?'replaceState':'pushState']({chat:slug},'','#/c/'+slug);
  $('cinfo').innerHTML=avHTML(cur)+nameHTML(cur);lockUI();$('msgs').innerHTML='';$('chat').classList.remove('hide');
  const r=await sb.from('messages').select('*').or(`and(sender.eq.${me.id},receiver.eq.${id}),and(sender.eq.${id},receiver.eq.${me.id})`).order('created_at').limit(200);
  (r.data||[]).forEach(addMsg);loadAllRx();typingChan();
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
  if(o&&(friends.find(f=>f.id===o)||REQP[o]))openChat(o,true);else{toast('Холбоос хүчингүй эсвэл эрхгүй');history.replaceState(null,'','/app/')}
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


/* ================= v6: security, moderation, messenger features ================= */
const REACTS=['👍','❤️','😂','😮','😢','🔥'],MS={},ALLOWED=/^(image\/(png|jpe?g|gif|webp)|audio\/|video\/(mp4|webm)|application\/(pdf|zip|msword|vnd\.openxmlformats-officedocument\..+)|text\/plain)/;
let replyTo=null,rx={},LM={};
const fmtSize=n=>n>1048576?(n/1048576).toFixed(1)+' MB':Math.ceil((n||0)/1024)+' KB';
const prevText=m=>m._t||(m.audio_url?'🎤 Дуут':m.attachments?'📎 Файл':m.image_url?'📷 Зураг':'🔒');
const lmText=m=>(m.sender===me.id?'Та: ':'')+(m.enc?'🔒 Шифрлэгдсэн':m.body?m.body.slice(0,40):m.audio_url?'🎤 Дуут':m.attachments?'📎 Файл':'📷 Зураг');
function ago(t){const m=Math.floor((Date.now()-new Date(t))/6e4);return m<2?'🟢 Одоо онлайн':m<60?m+' мин өмнө':m<1440?Math.floor(m/60)+' цагийн өмнө':Math.floor(m/1440)+' өдрийн өмнө'}

function nameHTML(p){
  const v=p.verified||p.is_admin,st=v?`font-family:'${safeFont(p.font)}',sans-serif;background-image:linear-gradient(90deg,${gc(p.color1)},${gc(p.color2)})`:'background-image:linear-gradient(90deg,var(--text),var(--text))';
  return `<span class="nm" style="${st}">${esc(p.display_name||p.username)}</span>`+(p.is_admin?'<span class="bdg">🛡️</span>':'')+(p.badge?badgeHTML(p.badge):'')+(p.verified&&p.badge!=='verified'?badgeHTML('verified'):'');
}
function prevName(){$('prev').innerHTML=nameHTML({username:prof.username,display_name:$('dn').value,font:$('fo').value,color1:$('c1').value,color2:$('c2').value,verified:prof.verified,is_admin:prof.is_admin})}
function lockStyle(){
  if(prof.verified||prof.is_admin||!$('fo'))return;['fo','c1','c2'].forEach(i=>$(i).disabled=true);
  const h=document.createElement('p');h.className='fine';h.innerHTML='🔒 Өнгө, фонтыг зөвхөн <b>verified</b> хэрэглэгч ашиглана. <a href="#" onclick="reqVerify();return false">Verified хүсэх</a>';$('fo').parentNode.insertBefore(h,$('fo'));
}
async function upload(bucket,blob,type){
  type=(type||'application/octet-stream').split(';')[0];
  if(blob.size>20*1048576){toast('20MB-аас том файл');return null}
  const ext=(blob.name&&blob.name.includes('.')?blob.name.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,5):'')||({'audio/mp4':'m4a','audio/webm':'webm','image/png':'png','image/jpeg':'jpg','image/gif':'gif','image/webp':'webp'}[type]||'bin');
  const path=`${me.id}/${Date.now()}_${Math.random().toString(36).slice(2,6)}.${ext}`,r=await sb.storage.from(bucket).upload(path,blob,{contentType:type});
  if(r.error){toast('Upload алдаа: '+(r.error.message||''));return null}
  return sb.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/* ---- messages ---- */
function linkify(el,t){t.split(/(https?:\/\/[^\s<]+)/g).forEach((s,i)=>{if(i%2){const a=document.createElement('a');a.href=s;a.textContent=s;a.target='_blank';a.rel='noopener noreferrer nofollow';el.appendChild(a)}else el.appendChild(document.createTextNode(s))})}
function hold(el,fn){let t;const c=()=>clearTimeout(t);el.addEventListener('touchstart',()=>{t=setTimeout(fn,450)},{passive:true});['touchend','touchmove','touchcancel'].forEach(e=>el.addEventListener(e,c));el.addEventListener('contextmenu',e=>{e.preventDefault();fn()})}
function addMsg(m){
  if(seen[m.id])return;seen[m.id]=1;MS[m.id]=m;
  const d=document.createElement('div');d.className='m'+(m.sender===me.id?' me':'');d.dataset.id=m.id;d.title=new Date(m.created_at).toLocaleString();$('msgs').appendChild(d);
  fill(d,m).then(()=>{
    if(m.reply_to&&MS[m.reply_to]){const q=document.createElement('div');q.className='quote';q.textContent=prevText(MS[m.reply_to]).slice(0,80);d.prepend(q)}
    renderRx(m.id);$('msgs').scrollTop=$('msgs').scrollHeight});
  hold(d,()=>sheet(m));
}
async function fill(d,m){
  try{
    if(m.audio_url){
      if(m.enc){const pt=await dec(await (await fetch(m.audio_url)).arrayBuffer(),await sharedKey(cur));addAudio(d,URL.createObjectURL(new Blob([pt],{type:m.mime||'audio/webm'})),true)}
      else addAudio(d,m.audio_url,false);
    }else if(m.attachments&&m.attachments.length){
      const g=document.createElement('div');g.className='att';
      m.attachments.forEach(a=>{
        if((a.type||'').startsWith('image/')){const im=document.createElement('img');im.src=a.url;im.className='pic';im.loading='lazy';im.onclick=()=>viewImg(a.url,a.name);g.appendChild(im)}
        else{const l=document.createElement('a');l.className='file';l.href=a.url;l.target='_blank';l.rel='noopener noreferrer';l.download=a.name||'';l.textContent='📄 '+(a.name||'file')+' · '+fmtSize(a.size);g.appendChild(l)}});
      d.appendChild(g);
    }else if(m.image_url){const im=document.createElement('img');im.src=m.image_url;im.className='pic';im.onclick=()=>viewImg(m.image_url,'image');d.appendChild(im)}
    else{let t=m.body;if(m.enc)t=new TextDecoder().decode(await dec(Uint8Array.from(atob(m.body),c=>c.charCodeAt(0)),await sharedKey(cur)));m._t=t;linkify(d,t)}
  }catch(e){d.textContent='🔒 Тайлах боломжгүй'}
}
async function sendText(){
  const t=$('ctext').value.trim();if(!t||!cur||Date.now()-lastSend<500)return;lastSend=Date.now();$('ctext').value='';const rt=takeReply();
  if(encOn()){const o=await enc(new TextEncoder().encode(t),await sharedKey(cur));sendRow({body:b64(o),enc:true,reply_to:rt})}else sendRow({body:t,reply_to:rt});
}
async function sendFiles(inp){
  const fs=[...inp.files].slice(0,10);inp.value='';if(!fs.length||!cur)return;
  if(encOn()){toast('E2EE горимд файл илгээх боломжгүй');return}
  const att=[];toast('Илгээж байна...');
  for(const f of fs){
    if(f.size>20*1048576){toast(f.name+': 20MB-аас том');continue}
    if(!ALLOWED.test(f.type||'x')){toast(f.name+': төрөл зөвшөөрөгдөөгүй');continue}
    const u=await upload('voice',f,f.type);if(u)att.push({url:u,type:f.type,name:f.name.slice(0,80),size:f.size});
  }
  if(att.length)sendRow({attachments:att,reply_to:takeReply()});
}
function showReply(m){let b=$('rbar');if(!b){b=document.createElement('div');b.id='rbar';$('chat').insertBefore(b,$('cbar'))}b.innerHTML=`<span>↩ ${esc(prevText(m).slice(0,60))}</span><button onclick="takeReply()">✕</button>`;b.classList.remove('hide')}
function takeReply(){const r=replyTo;replyTo=null;const b=$('rbar');if(b)b.classList.add('hide');return r}
function sheet(m){
  closeSheet();const s=document.createElement('div');s.id='sheet';
  s.innerHTML=`<div class="sh"><div class="rxrow">${REACTS.map(e=>`<span data-e="${e}">${e}</span>`).join('')}</div><button data-a="reply">↩ Хариулах</button>${m._t?'<button data-a="copy">📋 Хуулах</button>':''}${m.sender===me.id?'<button data-a="del">🗑 Устгах</button>':'<button data-a="rep">⚑ Report</button>'}</div>`;
  s.onclick=async e=>{const t=e.target,a=t.dataset.a;
    if(t.dataset.e)react(m.id,t.dataset.e);
    else if(a==='reply'){replyTo=m.id;showReply(m)}
    else if(a==='copy'&&navigator.clipboard)navigator.clipboard.writeText(m._t);
    else if(a==='del'){if(confirm('Мессежийг устгах уу?')){await sb.from('messages').delete().eq('id',m.id);const el=document.querySelector(`[data-id="${m.id}"]`);if(el)el.remove()}}
    else if(a==='rep')report(m,m._t||'');
    if(t.dataset.e||a)closeSheet();else if(t===s)closeSheet()};
  $('chat').appendChild(s);
}
function closeSheet(){const s=$('sheet');if(s)s.remove()}
async function react(mid,e){
  const mine=(rx[mid]||[]).find(r=>r.user_id===me.id);
  if(mine&&mine.emoji===e)await sb.from('reactions').delete().eq('message_id',mid).eq('user_id',me.id);
  else{const r=await sb.from('reactions').upsert({message_id:mid,user_id:me.id,emoji:e},{onConflict:'message_id,user_id'});if(r.error)toast('Хэт хурдан байна')}
  loadRx(mid);
}
async function loadRx(mid){const r=await sb.from('reactions').select('*').eq('message_id',mid);rx[mid]=r.data||[];renderRx(mid)}
async function loadAllRx(){const ids=Object.keys(seen);if(!ids.length)return;const r=await sb.from('reactions').select('*').in('message_id',ids);rx={};(r.data||[]).forEach(x=>(rx[x.message_id]=rx[x.message_id]||[]).push(x));ids.forEach(renderRx)}
function renderRx(mid){
  const d=document.querySelector(`[data-id="${mid}"]`);if(!d)return;const o=d.querySelector('.rxs');if(o)o.remove();
  const L=rx[mid]||[];if(!L.length)return;const c={};L.forEach(r=>c[r.emoji]=(c[r.emoji]||0)+1);
  const b=document.createElement('div');b.className='rxs';b.textContent=Object.entries(c).map(([e,n])=>e+(n>1?n:'')).join(' ');d.appendChild(b);
}
function viewImg(url,name){
  const v=document.createElement('div');v.id='iv';v.innerHTML=`<div class="ivt"><button class="btn s" id="ivc">✕</button><button class="btn" id="ivd">⬇ Татах</button></div><img src="${esc(url)}">`;
  document.body.appendChild(v);history.pushState({sv:1},'');
  $('ivc').onclick=closeIV;
  $('ivd').onclick=async()=>{try{const b=await (await fetch(url)).blob(),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name||'image';a.click()}catch(e){window.open(url,'_blank')}};
}
function closeIV(){const v=$('iv');if(v){v.remove();if(history.state&&history.state.sv)history.back()}}
window.addEventListener('popstate',()=>{if(!(history.state&&history.state.sv)){const v=$('iv');if(v)v.remove()}});

/* ---- chat list sorted by latest message ---- */
async function sortFriends(){
  const r=await sb.from('messages').select('sender,receiver,body,enc,audio_url,attachments,image_url,created_at').order('created_at',{ascending:false}).limit(300);
  LM={};(r.data||[]).forEach(m=>{const o=m.sender===me.id?m.receiver:m.sender;if(!LM[o])LM[o]=m});
  friends.sort((a,b)=>new Date((LM[b.id]||{}).created_at||0)-new Date((LM[a.id]||{}).created_at||0));
}

/* ---- find (with #ID, profile view) ---- */
async function runSearch(){
  const raw=(($('q')&&$('q').value)||'').trim().toLowerCase();let b=sb.from('profiles').select('*').neq('id',me.id);
  if(/^#\d+$/.test(raw))b=b.eq('user_no',+raw.slice(1));
  else{const q=raw.replace(/[^a-z0-9_]/g,'');b=q?b.ilike('username','%'+q+'%').limit(20):b.order('user_no',{ascending:false}).limit(20)}
  const r=await b;if(!$('res'))return;$('fh').textContent=raw?'Үр дүн':'Шинээр нэгдсэн';const rel=window._rel||{};
  $('res').innerHTML=(r.data||[]).map(p=>{const f=rel[p.id];let btn;
    if(!f)btn=`<button class="btn s" onclick="addFriend('${p.id}',this)">Нэмэх</button>`;
    else if(f.status==='accepted')btn='<small>✓ Найз</small>';else btn=`<small>${f.requester===me.id?'Илгээсэн':'Хүлээж байна'}</small>`;
    return `<div class="row"><span onclick="showProfile('${p.id}')">${avHTML(p)}</span><div class="g">${nameHTML(p)}<small>@${esc(p.username)} · #${p.user_no}</small></div>${btn}</div>`}).join('')||'<p style="color:var(--muted)">Олдсонгүй</p>';
}
async function showProfile(id){
  const r=await sb.from('profiles').select('*').eq('id',id).maybeSingle(),p=r.data;if(!p)return;
  const on=p.hide_online&&p.id!==me.id?'Нуусан':(p.last_online?ago(p.last_online):'-'),v=document.createElement('div');v.id='nm';
  v.innerHTML=`<div class="nmh"><b>Профайл</b><button class="btn s" onclick="this.closest('#nm').remove()">✕</button></div><div style="text-align:center">${avHTML(p,true)}<p style="font-size:24px;margin:8px 0">${nameHTML(p)}</p><p class="fine">@${esc(p.username)} · #${p.user_no}</p></div><div class="row"><div class="g"><small>Нэгдсэн</small>${new Date(p.created_at).toLocaleDateString()}</div></div><div class="row"><div class="g"><small>Сүүлд онлайн</small>${on}</div></div>`;
  document.body.appendChild(v);
}

/* ---- notifications menu ---- */
async function notifData(){
  const [rq,lg,vr]=await Promise.all([sb.from('friendships').select('*').eq('addressee',me.id).eq('status','pending'),sb.from('admin_log').select('*').eq('target',me.id).order('created_at',{ascending:false}).limit(20),sb.from('verify_requests').select('*').eq('user_id',me.id).order('created_at',{ascending:false}).limit(3)]);
  return {rq:rq.data||[],lg:lg.data||[],vr:vr.data||[]};
}
async function bellCount(){const d=await notifData(),t=+(localStorage.nseen||0);$('bdot').classList.toggle('hide',!(d.rq.length+d.lg.filter(x=>new Date(x.created_at)>t).length))}
async function openNotifs(){
  const d=await notifData();localStorage.nseen=Date.now();$('bdot').classList.add('hide');
  const ps=d.rq.length?(await sb.from('profiles').select('*').in('id',d.rq.map(r=>r.requester))).data||[]:[],v=document.createElement('div');v.id='nm';
  v.innerHTML=`<div class="nmh"><b>🔔 Мэдэгдэл</b><button class="btn s" onclick="this.closest('#nm').remove()">✕</button></div>`+
  ps.map(p=>`<div class="row">${avHTML(p)}<div class="g">${nameHTML(p)}<small>Найзын хүсэлт</small></div><button class="btn s" onclick="accept('${d.rq.find(r=>r.requester===p.id).id}');this.closest('#nm').remove()">Зөвшөөрөх</button></div>`).join('')+
  d.lg.map(l=>`<div class="row"><div class="g"><small>${new Date(l.created_at).toLocaleString()}</small>${esc(l.action)}: ${esc(l.detail||'')}<small>Шалтгаан: ${esc(l.reason||'-')}</small></div></div>`).join('')+
  d.vr.map(r=>`<div class="row"><div class="g">Verified хүсэлт: <b>${esc(r.status)}</b></div></div>`).join('');
  if(!ps.length&&!d.lg.length&&!d.vr.length)v.innerHTML+='<p class="fine">Мэдэгдэл алга</p>';
  document.body.appendChild(v);
}

/* ---- settings ---- */
function settings(){
  $('main').innerHTML=`<h3>🔔 Мэдэгдэл</h3><div class="row"><div class="g">Төлөв: <b>${window.Notification?Notification.permission:'дэмжигдэхгүй'}</b></div><button class="btn s" onclick="pushN('Comunic','Тест мэдэгдэл ✅','t')">Тест</button></div>
  <h3>🔒 Privacy</h3><label class="row"><input type="checkbox" style="width:auto" ${prof.hide_online?'checked':''} onchange="setPriv(this.checked)"><div class="g">Сүүлд онлайн байсан цагийг нуух</div></label>
  <h3>🛡 Security</h3><div class="row" onclick="resetKeys()"><div class="g">E2EE түлхүүр шинэчлэх<small>Хуучин шифрлэгдсэн мессеж задрахгүй</small></div></div><div class="row" onclick="sb.auth.signOut({scope:'global'}).then(()=>location.reload())"><div class="g">Бүх төхөөрөмжөөс гарах</div></div>
  <h3>🎨 Загвар</h3><select onchange="setTheme(this.value)">${THEMES.map(t=>`<option${t===document.documentElement.dataset.theme?' selected':''}>${t}</option>`).join('')}</select>
  <h3>✔ Verified</h3><div class="row" onclick="reqVerify()"><div class="g">Verified хүсэлт илгээх</div></div>
  <div class="row" onclick="installApp()"><div class="g">📲 Апп татах</div></div><p class="fine"><a href="/terms.html">Нөхцөл</a> · <a href="/privacy.html">Нууцлал</a></p>`;
}
async function setPriv(v){await patchErr({hide_online:v});toast('Хадгалагдлаа')}
function resetKeys(){if(!confirm('Түлхүүр шинэчлэх үү?'))return;localStorage.removeItem('e2eePriv');prof.public_key=null;keyCache={};initKeys().then(()=>toast('Шинэчлэгдлээ'))}
async function reqVerify(){const t=prompt('Яагаад verified авах ёстой вэ? (10+ тэмдэгт)');if(!t||t.length<10)return;const r=await sb.from('verify_requests').insert({user_id:me.id,body:t.slice(0,500)});toast(r.error?'Илгээж чадсангүй (өдөрт 2 удаа)':'Хүсэлт илгээгдлээ')}
function show(t){tab=t;document.querySelectorAll('#tabs button').forEach(b=>b.classList.toggle('on',b.dataset.t===t));
  ({home,find,admin,feed,notes:notesTab,settings,me:()=>{profile();lockStyle();profStats()}})[t]()}

/* ---- ban screen + appeal ---- */
function banScreen(){
  $('app').classList.add('hide');const d=document.createElement('div'),left=Math.max(0,Math.ceil((new Date(prof.banned_until)-Date.now())/864e5));d.id='gate';
  d.innerHTML=`<div class="ic">⛔</div><h2>Таны бүртгэл хаагдсан</h2><p>Шалтгаан: <b>${esc(prof.ban_reason||'-')}</b></p><p style="color:var(--muted)">${left} хоногийн дараа бүртгэл бүрмөсөн устна. Appeal илгээж, админ зөвшөөрвөл сэргээгдэнэ.</p><textarea id="apt" maxlength="1000" rows="4" style="width:100%;padding:12px;border-radius:10px;border:1px solid var(--line);background:var(--card);color:var(--text)" placeholder="Appeal мессеж..."></textarea><button class="btn" onclick="sendAppeal()">Appeal илгээх</button><button class="btn s" onclick="sb.auth.signOut().then(()=>location.reload())">Гарах</button><p id="apm" class="fine"></p>`;
  document.body.appendChild(d);
}
async function sendAppeal(){const t=$('apt').value.trim();if(t.length<10){$('apm').textContent='Дор хаяж 10 тэмдэгт бич';return}const r=await sb.from('appeals').insert({user_id:me.id,body:t});$('apm').textContent=r.error?(/rate_limit/.test(r.error.message)?'Өдөрт 3 удаа':'Алдаа'):'Илгээгдлээ. Админ хянана.'}

/* ---- admin (reasons, 100-day ban, audit log, appeals, verify requests) ---- */
async function logA(target,action,detail,reason){await sb.from('admin_log').insert({admin_id:me.id,target,action,detail,reason})}
async function admin(){
  $('main').innerHTML='<h3>⚖️ Appeal</h3><div id="apl"></div><h3>✔ Verified хүсэлт</h3><div id="vrl"></div><h3>🚩 Report</h3><div id="rl"></div><h3>Хэрэглэгчид</h3><input id="aq" placeholder="Username эсвэл #ID..." oninput="adminList()"><div id="al"></div>';adminList();
  const [ap,vr,rp]=await Promise.all([sb.from('appeals').select('*').eq('status','open').order('created_at'),sb.from('verify_requests').select('*').eq('status','open').order('created_at'),sb.from('reports').select('*').order('created_at',{ascending:false}).limit(20)]);
  const row=(t,x,tbl)=>`<div class="row" style="flex-wrap:wrap"><div class="g"><small>${esc(x.user_id.slice(0,8))}</small>${esc(x.body)}</div><button class="btn s" onclick="decide('${tbl}','${x.id}','${x.user_id}',true)">✓</button><button class="btn s" onclick="decide('${tbl}','${x.id}','${x.user_id}',false)">✕</button></div>`;
  $('apl').innerHTML=(ap.data||[]).map(x=>row('a',x,'appeals')).join('')||'<p class="fine">Алга</p>';
  $('vrl').innerHTML=(vr.data||[]).map(x=>row('v',x,'verify_requests')).join('')||'<p class="fine">Алга</p>';
  $('rl').innerHTML=(rp.data||[]).map(x=>`<div class="row" style="flex-wrap:wrap"><div class="g"><small>${esc(x.reason||'')}</small>${esc((x.snapshot||'(агуулга байхгүй)').slice(0,200))}</div><button class="btn s" onclick="adm('${x.reported_user}','ban',true).then(()=>delReport('${x.id}'))">🚫 Ban</button><button class="btn s" onclick="delReport('${x.id}')">Хаах</button></div>`).join('')||'<p class="fine">Алга</p>';
}
async function decide(tbl,id,uid,ok){
  const why=prompt('Хариу/шалтгаан (хэрэглэгчид харагдана):');if(why===null)return;
  await sb.from(tbl).update({status:ok?'accepted':'rejected'}).eq('id',id);
  if(tbl==='appeals'&&ok)await sb.from('profiles').update({banned:false,banned_until:null,ban_reason:null}).eq('id',uid);
  if(tbl==='verify_requests'&&ok)await sb.from('profiles').update({verified:true,badge:'verified'}).eq('id',uid);
  await logA(uid,tbl==='appeals'?'Appeal':'Verified хүсэлт',ok?'Зөвшөөрөгдлөө':'Татгалзлаа',why.slice(0,200));admin();
}
async function adminList(){
  const raw=($('aq').value||'').trim().toLowerCase();let b=sb.from('profiles').select('*').order('user_no',{ascending:true}).limit(40);
  if(/^#\d+$/.test(raw))b=b.eq('user_no',+raw.slice(1));else{const q=raw.replace(/[^a-z0-9_]/g,'');if(q)b=b.ilike('username','%'+q+'%')}
  const r=await b;
  $('al').innerHTML=(r.data||[]).map(p=>{const i=`adm('${p.id}',`;return `<div class="row" style="flex-wrap:wrap">${avHTML(p)}<div class="g">${nameHTML(p)}<small>#${p.user_no} · @${esc(p.username)}${p.banned?' · БАН':''}</small></div><div style="display:flex;gap:6px;flex-wrap:wrap;width:100%"><button class="btn s" onclick="${i}'badge')">🏅 Badge</button><button class="btn s" onclick="${i}'verify',${!p.verified})">${p.verified?'✖ Verified':'✔ Verified'}</button><button class="btn s" onclick="${i}'ban',${!p.banned})">${p.banned?'Unban':'🚫 Ban 100х'}</button><button class="btn s" onclick="${i}'avatar')">🖼️ Avatar</button><button class="btn s" onclick="${i}'name')">✏️ Нэр</button><button class="btn s" onclick="${i}'username')">@ Username</button></div></div>`}).join('');
}
async function adm(id,act,v){
  let why=prompt('Шалтгаан (хэрэглэгчид харагдана):');if(why===null)return;why=why.trim().slice(0,200);
  const old=(await sb.from('profiles').select('*').eq('id',id).single()).data||{},o={};let det='';
  if(act==='badge'){const b=prompt('Badge: '+BADGES.join(', ')+' (хоосон=арилгах)');if(b===null)return;o.badge=b.trim().slice(0,12)||null;det=`badge ${old.badge||'-'} → ${o.badge||'-'}`}
  else if(act==='ban'){if(id===me.id){toast('Өөрийгөө бан хийж болохгүй');return}
    if(v){if(!why){toast('Ban-д шалтгаан заавал');return}o.banned=true;o.banned_until=new Date(Date.now()+100*864e5).toISOString();o.ban_reason=why;det='100 хоногийн хориг'}
    else{o.banned=false;o.banned_until=null;o.ban_reason=null;det='Хориг цуцлав'}}
  else if(act==='avatar'){o.avatar_url=null;det='avatar устгав'}
  else if(act==='verify'){o.verified=v;if(v&&!old.badge)o.badge='verified';det=v?'Verified олголоо':'Verified хаслаа'}
  else if(act==='name'){const n=prompt('Шинэ нэр');if(!n)return;o.display_name=n.trim().slice(0,30);det=`нэр "${old.display_name}" → "${o.display_name}"`}
  else{const u=prompt('Шинэ username');if(!u||!/^[a-z0-9_]{3,20}$/.test(u.toLowerCase())){toast('3-20, a-z 0-9 _');return}o.username=u.toLowerCase();det=`username @${old.username} → @${o.username}`}
  const r=await sb.from('profiles').update(o).eq('id',id);if(r.error){toast('Алдаа: '+r.error.message);return}
  await logA(id,act,det,why);adminList();
}

/* ---- init ---- */
async function heartbeat(){if(!document.hidden)sb.from('profiles').update({last_online:new Date().toISOString()}).eq('id',me.id).then(()=>{})}
function initV6(){
  const b=document.createElement('button');b.id='bell';b.innerHTML='🔔<i id="bdot" class="hide"></i>';b.onclick=openNotifs;$('app').appendChild(b);
  const sbtn=document.createElement('button');sbtn.dataset.t='settings';sbtn.textContent='⚙️ Тохиргоо';sbtn.onclick=()=>show('settings');$('tabs').insertBefore(sbtn,document.querySelector('#tabs [data-t=me]').nextSibling);
  $('cinfo').onclick=()=>cur&&showProfile(cur.id);
  heartbeat();setInterval(heartbeat,120000);bellCount();initV7();initV8();initG();initV11();
  sb.channel('v6').on('postgres_changes',{event:'*',schema:'public',table:'reactions'},x=>{const r=(x.new&&x.new.message_id)?x.new:x.old;if(r&&r.message_id&&MS[r.message_id])loadRx(r.message_id)})
   .on('postgres_changes',{event:'INSERT',schema:'public',table:'messages'},()=>{if(tab==='home'&&!cur)home()}).subscribe();
}


/* ================= v7: follow, feed/posts, message requests, auto-verify ================= */
const REQP={};let REQ=[],feedMode='all';
function initV7(){const b=document.createElement('button');b.dataset.t='feed';b.textContent='🌐 Мэдээ';b.onclick=()=>show('feed');$('tabs').insertBefore(b,document.querySelector('#tabs [data-t=find]'))}
async function counts(uid){const q=(c,v)=>sb.from('follows').select('*',{count:'exact',head:true}).eq(c,v),[a,b]=await Promise.all([q('following',uid),q('follower',uid)]);return {fr:a.count||0,fg:b.count||0}}
async function profStats(){
  const c=await counts(me.id),el=$('prev');if(!el)return;const d=document.createElement('p');d.className='fine';
  d.innerHTML=`<span onclick="followList('${me.id}','followers')">${c.fr} дагагч</span> · <span onclick="followList('${me.id}','following')">${c.fg} дагасан</span>`+((prof.verified||prof.is_admin)?'':` · ✔ ${c.fr}/30 → verified`);el.after(d);
}
async function toggleFollow(uid){
  const R=await sb.from('follows').select('follower').eq('follower',me.id).eq('following',uid).maybeSingle();
  if(R.data)await sb.from('follows').delete().eq('follower',me.id).eq('following',uid);
  else{const r=await sb.from('follows').insert({follower:me.id,following:uid});if(r.error)toast('Хэт олон дагалт, түр хүлээнэ үү')}
  showProfile(uid);
}
async function followList(uid,kind){
  const col=kind==='followers'?'follower':'following',key=kind==='followers'?'following':'follower';
  const r=await sb.from('follows').select(col).eq(key,uid).limit(100),ids=(r.data||[]).map(x=>x[col]);
  const ps=ids.length?(await sb.from('profiles').select('*').in('id',ids)).data||[]:[];
  const o=$('nm');if(o)o.remove();const v=document.createElement('div');v.id='nm';
  v.innerHTML=`<div class="nmh"><b>${kind==='followers'?'Дагагчид':'Дагасан'}</b><button class="btn s" onclick="this.closest('#nm').remove()">✕</button></div>`+(ps.map(p=>`<div class="row" onclick="showProfile('${p.id}')">${avHTML(p)}<div class="g">${nameHTML(p)}<small>@${esc(p.username)}</small></div></div>`).join('')||'<p class="fine">Хоосон</p>');
  document.body.appendChild(v);
}
async function showProfile(id){
  const old=$('nm');if(old)old.remove();
  const [r,c,f,po]=await Promise.all([sb.from('profiles').select('*').eq('id',id).maybeSingle(),counts(id),sb.from('follows').select('follower').eq('follower',me.id).eq('following',id).maybeSingle(),sb.from('posts').select('*, post_likes(count), post_comments(count)').eq('user_id',id).order('created_at',{ascending:false}).limit(5)]);
  const p=r.data;if(!p)return;
  const on=p.hide_online&&p.id!==me.id?'Нуусан':(p.last_online?ago(p.last_online):'-'),isme=id===me.id,isF=friends.some(x=>x.id===id),v=document.createElement('div');v.id='nm';
  v.innerHTML=`<div class="nmh"><b>Профайл</b><button class="btn s" onclick="this.closest('#nm').remove()">✕</button></div><div style="text-align:center">${avHTML(p,true)}<p style="font-size:24px;margin:8px 0">${nameHTML(p)}</p><p class="fine">@${esc(p.username)} · #${p.user_no}</p><p class="fine"><span onclick="followList('${id}','followers')">${c.fr} дагагч</span> · <span onclick="followList('${id}','following')">${c.fg} дагасан</span>${(p.verified||p.is_admin)?'':` · ${c.fr}/30 → verified`}</p>`+
  (isme?'':`<div style="display:flex;gap:8px;justify-content:center;margin:10px 0"><button class="btn" onclick="toggleFollow('${id}')">${f.data?'Дагахаа болих':'➕ Дагах'}</button>${isF?`<button class="btn s" onclick="this.closest('#nm').remove();openChat('${id}')">💬 Чат</button>`:`<button class="btn s" onclick="dmStart('${id}')">✉ Мессеж</button>`}</div>`)+
  `</div><div class="row"><div class="g"><small>Нэгдсэн</small>${new Date(p.created_at).toLocaleDateString()}</div></div><div class="row"><div class="g"><small>Сүүлд онлайн</small>${on}</div></div><h3>Постууд</h3><div id="pp"></div>`;
  document.body.appendChild(v);await renderPosts($('pp'),po.data||[]);
}

/* ---- message requests ---- */
async function loadReqs(){
  const r=await sb.from('msg_requests').select('*').neq('status','declined');REQ=[];
  const rows=r.data||[],ids=[...new Set(rows.map(x=>x.sender===me.id?x.receiver:x.sender))].filter(i=>!friends.some(f=>f.id===i));
  const ps=ids.length?(await sb.from('profiles').select('*').in('id',ids)).data||[]:[];ps.forEach(p=>REQP[p.id]=p);
  rows.forEach(x=>{const o=x.sender===me.id?x.receiver:x.sender,p=REQP[o];if(!p)return;
    if(x.receiver===me.id&&x.status==='pending')REQ.push({...x,p});else if(!friends.some(f=>f.id===o))friends.push(p)});
}
function reqHTML(){
  if(!REQ.length)return '';
  return `<h3>✉ Мессежийн хүсэлт (${REQ.length})</h3>`+REQ.map(x=>`<div class="row"><span onclick="showProfile('${x.p.id}')">${avHTML(x.p)}</span><div class="g" onclick="openChat('${x.p.id}')">${nameHTML(x.p)}<small>Нээж унших</small></div><button class="btn s" onclick="reqDecide('${x.id}',true)">✓</button><button class="btn s" onclick="reqDecide('${x.id}',false)">✕</button></div>`).join('');
}
async function reqDecide(id,ok){await sb.from('msg_requests').update({status:ok?'accepted':'declined'}).eq('id',id);home()}
async function dmStart(id){
  const p=(await sb.from('profiles').select('*').eq('id',id).single()).data;if(!p)return;REQP[id]=p;
  const ex=await sb.from('msg_requests').select('status').eq('sender',me.id).eq('receiver',id).maybeSingle();
  if(ex.data&&ex.data.status==='declined'){toast('Хэрэглэгч хүсэлтийг татгалзсан');return}
  if(!ex.data){const r=await sb.from('msg_requests').insert({sender:me.id,receiver:id});if(r.error){toast('Хүсэлт илгээж чадсангүй');return}}
  const m=$('nm');if(m)m.remove();openChat(id);
}
async function sendRow(row){
  const r=await sb.from('messages').insert({sender:me.id,receiver:cur.id,...row}).select().single(),e=(r.error&&r.error.message)||'';
  if(r.data)addMsg(r.data);else toast(/rate_limit/.test(e)?'Хэт хурдан илгээж байна':/banned/.test(e)?'Таны эрх хаагдсан':'Илгээж чадсангүй. Хүсэлт зөвшөөрөгдөх хүртэл 1 мессеж илгээнэ');
}

/* ---- feed ---- */
async function feed(){
  $('main').innerHTML=`<div class="row" style="flex-direction:column;align-items:stretch"><textarea id="pt" maxlength="2000" rows="3" placeholder="Юу шинэ байна?" style="width:100%;padding:10px;border-radius:10px;border:1px solid var(--line);background:var(--bg);color:var(--text)"></textarea><div style="display:flex;gap:8px;align-items:center;margin-top:8px"><label class="btn s" style="cursor:pointer">🖼 Зураг<input type="file" id="pi" accept="image/*" class="hide" onchange="$('pin').textContent=this.files[0]?this.files[0].name:''"></label><span id="pin" class="fine"></span><button class="btn" style="margin-left:auto" onclick="postPost()">Нийтлэх</button></div></div><div style="display:flex;gap:8px;margin:8px 0"><button class="btn s" onclick="feedMode='all';loadFeed()">Бүгд</button><button class="btn s" onclick="feedMode='fol';loadFeed()">Дагасан</button></div><div id="fd"></div>`;
  loadFeed();
}
async function postPost(){
  const t=$('pt').value.trim(),f=$('pi').files[0];if(!t&&!f){toast('Бичвэр эсвэл зураг оруулна уу');return}
  let u=null;if(f){if(!f.type.startsWith('image/')){toast('Зөвхөн зураг');return}u=await upload('voice',f,f.type);if(!u)return}
  const r=await sb.from('posts').insert({user_id:me.id,body:t||null,image_url:u});
  toast(r.error?(/rate_limit/.test(r.error.message)?'Цагт 10 пост':'Алдаа'):'Нийтлэгдлээ');if(!r.error)feed();
}
async function loadFeed(){
  let q=sb.from('posts').select('*, post_likes(count), post_comments(count)').order('created_at',{ascending:false}).limit(30);
  if(feedMode==='fol'){const f=await sb.from('follows').select('following').eq('follower',me.id);q=q.in('user_id',[me.id,...(f.data||[]).map(x=>x.following)])}
  const r=await q;if($('fd'))await renderPosts($('fd'),r.data||[]);
}
async function renderPosts(el,list){
  const ids=[...new Set(list.map(p=>p.user_id))],ps=ids.length?(await sb.from('profiles').select('*').in('id',ids)).data||[]:[],P={};ps.forEach(p=>P[p.id]=p);
  const lk=list.length?(await sb.from('post_likes').select('post_id').eq('user_id',me.id).in('post_id',list.map(p=>p.id))).data||[]:[],L=new Set(lk.map(x=>x.post_id)),n=x=>(x&&x[0]&&x[0].count)||0;
  el.innerHTML=list.map(p=>{const a=P[p.user_id]||{id:'',username:'?'};return `<div class="card post"><div class="prow"><span onclick="showProfile('${a.id}')">${avHTML(a)}</span><div class="g">${nameHTML(a)}<small>${new Date(p.created_at).toLocaleString()}</small></div>${p.user_id===me.id||prof.is_admin?`<button class="btn s" onclick="delPost('${p.id}')">🗑</button>`:''}</div><div class="pbody" id="pb${p.id}"></div>${p.image_url?`<img class="pic" style="max-width:100%;border-radius:12px;margin-top:6px" src="${esc(p.image_url)}" onclick="viewImg(this.src,'post')">`:''}<div class="prow" style="margin-top:8px"><button class="btn s" onclick="likePost('${p.id}',${L.has(p.id)})">${L.has(p.id)?'❤️':'🤍'} ${n(p.post_likes)}</button><button class="btn s" onclick="comments('${p.id}')">💬 ${n(p.post_comments)}</button></div></div>`}).join('')||'<p class="fine">Пост алга</p>';
  list.forEach(p=>{const b=document.getElementById('pb'+p.id);if(b&&p.body)linkify(b,p.body)});
}
async function likePost(id,liked){
  if(liked)await sb.from('post_likes').delete().eq('post_id',id).eq('user_id',me.id);else{const r=await sb.from('post_likes').insert({post_id:id,user_id:me.id});if(r.error)toast('Хэт хурдан байна')}
  if($('fd'))loadFeed();else toast(liked?'💔':'❤️');
}
async function delPost(id){if(!confirm('Постыг устгах уу?'))return;await sb.from('posts').delete().eq('id',id);if($('fd'))loadFeed();const m=$('nm');if(m)m.remove()}
async function comments(pid){
  const r=await sb.from('post_comments').select('*').eq('post_id',pid).order('created_at').limit(100),ids=[...new Set((r.data||[]).map(x=>x.user_id))];
  const ps=ids.length?(await sb.from('profiles').select('*').in('id',ids)).data||[]:[],P={};ps.forEach(p=>P[p.id]=p);
  const o=$('cm');if(o)o.remove();const v=document.createElement('div');v.id='cm';v.className='nmv';
  v.innerHTML=`<div class="nmh"><b>💬 Сэтгэгдэл</b><button class="btn s" onclick="this.closest('#cm').remove()">✕</button></div>`+((r.data||[]).map(x=>{const a=P[x.user_id]||{username:'?'};return `<div class="row">${avHTML(a)}<div class="g">${nameHTML(a)}<small style="color:var(--text)" id="c${x.id}"></small></div>${x.user_id===me.id||prof.is_admin?`<button class="btn s" onclick="delCm('${x.id}','${pid}')">🗑</button>`:''}</div>`}).join('')||'<p class="fine">Сэтгэгдэл алга</p>')+`<div class="cr"><input id="cmt" maxlength="500" placeholder="Сэтгэгдэл бич..."><button class="btn" onclick="sendCm('${pid}')">➤</button></div>`;
  document.body.appendChild(v);(r.data||[]).forEach(x=>{const e=document.getElementById('c'+x.id);if(e)linkify(e,x.body)});
}
async function sendCm(pid){const t=$('cmt').value.trim();if(!t)return;const r=await sb.from('post_comments').insert({post_id:pid,user_id:me.id,body:t});if(r.error)toast('Хэт хурдан байна');comments(pid);if($('fd'))loadFeed()}
async function delCm(id,pid){await sb.from('post_comments').delete().eq('id',id);comments(pid);if($('fd'))loadFeed()}


/* ================= v8: audio / video calls (WebRTC, signaling via call_signals) ================= */
const ICE={iceServers:[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun1.l.google.com:19302'}/* ,{urls:'turn:HOST:443',username:'USER',credential:'PASS'} */]};
let call=null,sigSeen=new Set(),pendIce={},ringT=null,callTimer=null;
function ring(on){clearInterval(ringT);if(!on)return;const beep=()=>{try{const c=new (window.AudioContext||window.webkitAudioContext)(),o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.frequency.value=480;g.gain.value=.15;o.start();setTimeout(()=>{o.stop();c.close()},350)}catch(e){}if(navigator.vibrate)navigator.vibrate(300)};beep();ringT=setInterval(beep,1500)}
async function sendSig(kind,data){if(!call)return null;const r=await sb.from('call_signals').insert({call_id:call.id,sender:me.id,receiver:call.peer.id,kind,data});return r.error}
function callUI(){
  const c=call;let v=$('call');if(!c){if(v)v.remove();return}
  if(!v){v=document.createElement('div');v.id='call';document.body.appendChild(v)}
  v.className=(c.state==='Холбогдлоо'&&c.kind==='video')?'vid':'';
  v.innerHTML=`<video id="rv" autoplay playsinline></video><video id="lv" autoplay playsinline muted${c.kind==='video'?'':' style="display:none"'}></video><div class="cinfo2">${avHTML(c.peer,true)}<h2>${esc(c.peer.display_name||c.peer.username)}</h2><p id="cst">${c.state==='incoming'?(c.kind==='video'?'🎥 Видео дуудлага':'📞 Аудио дуудлага'):esc(c.state)}</p></div><div class="cctl">${c.state==='incoming'?'<button class="cb ok" onclick="acceptCall()">📞</button>':`<button class="cb" onclick="toggleMic()">🎤</button>${c.kind==='video'?'<button class="cb" onclick="toggleCam()">📷</button>':''}`}<button class="cb end" onclick="endCall(true)">⛔</button></div>`;
  if(c.local)$('lv').srcObject=c.local;if(c.remote)$('rv').srcObject=c.remote;
}
function makePC(){
  const pc=new RTCPeerConnection(ICE);call.pc=pc;call.remote=new MediaStream();
  pc.ontrack=e=>{e.track&&!call.remote.getTracks().includes(e.track)&&call.remote.addTrack(e.track);const rv=$('rv');if(rv){rv.srcObject=call.remote;rv.play&&rv.play().catch(()=>{})}};
  pc.onicecandidate=e=>{if(e.candidate)sendSig('ice',e.candidate.toJSON())};
  pc.onconnectionstatechange=()=>{if(!call)return;const s=pc.connectionState;
    if(s==='connected'){call.state='Холбогдлоо';ring(false);clearTimeout(call.to);callUI();startTimer()}
    else if(s==='failed'||s==='closed'){toast('Холболт тасарлаа');endCall(false)}};
  call.local.getTracks().forEach(t=>pc.addTrack(t,call.local));
}
function startTimer(){const t0=Date.now();clearInterval(callTimer);callTimer=setInterval(()=>{const s=Math.floor((Date.now()-t0)/1000),e=$('cst');if(e)e.textContent=String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')},1000)}
async function startCall(kind){
  if(call||!cur)return;if(!window.RTCPeerConnection){toast('Энэ хөтөч дуудлага дэмжихгүй');return}
  let s;try{s=await navigator.mediaDevices.getUserMedia({audio:true,video:kind==='video'})}catch(e){toast('Камер/микрофоны зөвшөөрөл өгнө үү');return}
  call={id:crypto.randomUUID(),peer:cur,kind,state:'Дуудаж байна...',local:s};
  makePC();callUI();ring(true);
  const o=await call.pc.createOffer();await call.pc.setLocalDescription(o);
  const er=await sendSig('offer',{type:o.type,sdp:o.sdp,kind});
  if(er){toast(/rate_limit/.test(er.message)?'Хэт олон дуудлага':'Зөвхөн найзтайгаа дуудлага хийнэ');cleanup();return}
  call.to=setTimeout(()=>{if(call&&call.state!=='Холбогдлоо'){toast('Хариулсангүй');endCall(true)}},45000);
}
async function acceptCall(){
  const c=call;if(!c||c.state!=='incoming')return;clearTimeout(c.to);ring(false);
  let s;try{s=await navigator.mediaDevices.getUserMedia({audio:true,video:c.kind==='video'})}catch(e){toast('Зөвшөөрөл өгнө үү');endCall(true);return}
  c.local=s;c.state='Холбогдож байна...';makePC();callUI();
  await c.pc.setRemoteDescription({type:c.offer.type,sdp:c.offer.sdp});flushIce();
  const a=await c.pc.createAnswer();await c.pc.setLocalDescription(a);await sendSig('answer',{type:a.type,sdp:a.sdp});
}
function flushIce(){const l=pendIce[call.id]||[];delete pendIce[call.id];l.forEach(c=>call.pc.addIceCandidate(c).catch(()=>{}))}
function cleanup(){ring(false);clearInterval(callTimer);const c=call;call=null;if(c){clearTimeout(c.to);if(c.pc)c.pc.close();if(c.local)c.local.getTracks().forEach(t=>t.stop())}const v=$('call');if(v)v.remove()}
async function endCall(send){if(call&&send)await sendSig('end',{});cleanup()}
function toggleMic(){const t=call&&call.local.getAudioTracks()[0];if(t){t.enabled=!t.enabled;toast(t.enabled?'🎤 Асаалаа':'🔇 Хаалаа')}}
function toggleCam(){const t=call&&call.local.getVideoTracks()[0];if(t){t.enabled=!t.enabled;toast(t.enabled?'📷 Асаалаа':'📷 Хаалаа')}}
async function onSignal(s){
  if(sigSeen.has(s.id)||s.receiver!==me.id)return;sigSeen.add(s.id);
  if(s.kind==='offer'){
    if(call){await sb.from('call_signals').insert({call_id:s.call_id,sender:me.id,receiver:s.sender,kind:'end',data:{busy:true}});return}
    const p=friends.find(f=>f.id===s.sender);if(!p)return;
    call={id:s.call_id,peer:p,kind:s.data.kind,state:'incoming',offer:s.data};callUI();ring(true);
    pushN(p.display_name||p.username,(s.data.kind==='video'?'🎥':'📞')+' Дуудлага ирж байна','c'+p.id);
    call.to=setTimeout(()=>{if(call&&call.state==='incoming')endCall(true)},45000);return;
  }
  if(s.kind==='ice'){if(call&&call.id===s.call_id&&call.pc&&call.pc.remoteDescription)call.pc.addIceCandidate(s.data).catch(()=>{});else(pendIce[s.call_id]=pendIce[s.call_id]||[]).push(s.data);return}
  if(!call||call.id!==s.call_id)return;
  if(s.kind==='answer'&&call.pc){await call.pc.setRemoteDescription(s.data);flushIce()}
  else if(s.kind==='end'){toast(s.data&&s.data.busy?'Завгүй байна':'Дуудлага дууслаа');cleanup()}
}
async function initV8(){
  const h=$('chead');[['📞','audio'],['🎥','video']].forEach(([e,k])=>{const b=document.createElement('button');b.className='btn s';b.textContent=e;b.onclick=()=>startCall(k);h.appendChild(b)});
  sb.channel('calls').on('postgres_changes',{event:'INSERT',schema:'public',table:'call_signals',filter:'receiver=eq.'+me.id},x=>onSignal(x.new)).subscribe();
  const r=await sb.from('call_signals').select('*').eq('receiver',me.id).gt('created_at',new Date(Date.now()-50000).toISOString()).order('created_at');
  (r.data||[]).forEach(onSignal);
}


/* ================= v9: guest accounts ================= */
const genPw=()=>Array.from(crypto.getRandomValues(new Uint8Array(12)),b=>'abcdefghjkmnpqrstuvwxyz23456789'[b%31]).join('');
(function(){
  const d=document.createElement('div');d.className='gbox';
  d.innerHTML='<p class="fine">эсвэл</p><input id="gname" maxlength="20" placeholder="Нэрээ бич (Guest)"><button class="btn s" onclick="guestSignup()">👤 Guest-ээр орох</button><details><summary class="fine">Guest-ээр нэвтрэх (ID + нууц үг)</summary><input id="gid" inputmode="numeric" placeholder="Guest ID (жишээ: 3)"><input id="gpw" type="password" placeholder="Нууц үг"><button class="btn s" onclick="guestLogin()">Нэвтрэх</button></details>';
  $('amsg').before(d);
})();
async function guestSignup(){
  const name=$('gname').value.trim(),m=$('amsg');if(name.length<2){m.textContent='Нэрээ бич (2+ тэмдэгт)';return}
  m.textContent='...';const n=(await sb.rpc('next_guest_no')).data;if(!n){m.textContent='Алдаа, дахин оролдоно уу';return}
  const pw=genPw(),r=await sb.auth.signUp({email:`guest${n}@guest.comunic.online`,password:pw,options:{data:{name}}});
  if(r.error){m.textContent='Guest үүсгэж чадсангүй: '+r.error.message;return}
  m.textContent='';showGuestCred(n,pw);
}
async function guestLogin(){
  const n=parseInt(($('gid').value||'').replace(/\D/g,'')),pw=$('gpw').value;if(!n||!pw){$('amsg').textContent='ID болон нууц үгээ бич';return}
  const r=await sb.auth.signInWithPassword({email:`guest${n}@guest.comunic.online`,password:pw});
  $('amsg').textContent=r.error?'ID эсвэл нууц үг буруу':'';
}
function showGuestCred(n,pw){
  const v=document.createElement('div');v.id='gate';v.style.zIndex=140;
  v.innerHTML=`<div class="ic">🔑</div><h2>Guest #${n}</h2><p style="color:var(--muted)">Дахин нэвтрэхийн тулд хадгалаарай. Дахиж харагдахгүй!</p><div class="row" style="width:100%"><div class="g">ID: <b>${n}</b><br>Нууц үг: <b>${esc(pw)}</b></div><button class="btn s" onclick="navigator.clipboard&&navigator.clipboard.writeText('ID: ${n}  Нууц үг: ${esc(pw)}');toast('Хуулагдлаа')">📋</button></div><p class="fine">7 хоног орохгүй бол Guest бүртгэл устна.</p><button class="btn" onclick="this.closest('#gate').remove()">Хадгалсан, үргэлжлүүлэх</button>`;
  document.body.appendChild(v);
}
async function guestNewPw(){if(!confirm('Нууц үгийг шинэчлэх үү? Хуучин нууц үг хүчингүй болно.'))return;const pw=genPw(),r=await sb.auth.updateUser({password:pw});if(r.error){toast('Алдаа');return}showGuestCred(prof.guest_no,pw)}
function initG(){
  if(!prof.is_guest)return;
  ['feed','notes'].forEach(t=>{const b=document.querySelector('#tabs [data-t='+t+']');if(b)b.style.display='none'});
  toast('👤 Guest: чат, найзын хүсэлт, нэр солих боломжтой. 7 хоног орохгүй бол устна.');
}
const _showG=show;
show=function(t){
  if(prof&&prof.is_guest&&(t==='feed'||t==='notes')){toast('Guest-д боломжгүй. Discord-оор бүртгүүлнэ үү');return}
  _showG(t);
  if(prof&&prof.is_guest){
    if(t==='me')setTimeout(()=>{['un','fo','c1','c2'].forEach(i=>$(i)&&($(i).disabled=true));const l=document.querySelector('#pav + p');if(l)l.remove()},50);
    if(t==='settings')$('main').insertAdjacentHTML('beforeend','<div class="row" onclick="guestNewPw()"><div class="g">🔑 Guest нууц үг шинэчлэх</div></div>');
  }
};


/* ================= v10: Messenger-style calls + guest via edge function ================= */
let raf=0;
const fmtDur=ms=>{const s=Math.floor(ms/1000);return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')};
const MEDIA=k=>({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true,channelCount:1},video:k==='video'?{width:{ideal:1280},height:{ideal:720},frameRate:{ideal:24,max:30}}:false});
function tuneOpus(sdp){
  const m=sdp.match(/a=rtpmap:(\d+) opus\/48000/);if(!m)return sdp;
  const pt=m[1],extra='useinbandfec=1;usedtx=1;stereo=0;maxaveragebitrate=40000;minptime=10',re=new RegExp('a=fmtp:'+pt+' ([^\\r\\n]*)');
  return re.test(sdp)?sdp.replace(re,(x,p)=>'a=fmtp:'+pt+' '+p.replace(/(useinbandfec|usedtx|stereo|maxaveragebitrate|minptime)=[^;]*;?/g,'').replace(/;$/,'')+(p?';':'')+extra):sdp.replace(m[0],m[0]+'\r\na=fmtp:'+pt+' '+extra);
}
function ring(mode){
  clearInterval(ringT);if(!mode)return;
  const beep=()=>{try{const c=new (window.AudioContext||window.webkitAudioContext)(),g=c.createGain();g.connect(c.destination);g.gain.value=.12;
    (mode==='in'?[[440,0],[480,.25]]:[[425,0]]).forEach(([f,t])=>{const o=c.createOscillator();o.frequency.value=f;o.connect(g);o.start(c.currentTime+t);o.stop(c.currentTime+t+.2)});setTimeout(()=>c.close(),900)}catch(e){}
    if(mode==='in'&&navigator.vibrate)navigator.vibrate([300,150,300])};
  beep();ringT=setInterval(beep,mode==='in'?2000:3000);
}
function callUI(){
  const c=call;let v=$('call');if(!c){if(v)v.remove();return}
  if(!v){v=document.createElement('div');v.id='call';document.body.appendChild(v)}
  const inc=c.state==='incoming';v.className=(c.kind==='video'&&c.connected?'vid ':'')+(c.connected?'':'ringing');
  v.innerHTML=`<video id="rv" autoplay playsinline muted></video><video id="lv" autoplay playsinline muted${c.kind==='video'?'':' style="display:none"'}></video><div class="cbg" style="background-image:url('${c.peer.avatar_url?esc(c.peer.avatar_url):''}')"></div><div class="cinfo2"><div class="cav" id="cav">${avHTML(c.peer,true)}</div><h2>${esc(c.peer.display_name||c.peer.username)}</h2><p id="cst">${inc?(c.kind==='video'?'Видео дуудлага ирж байна':'Дуудлага ирж байна'):esc(c.state)}</p></div><div class="cctl">${inc?'<div class="cc"><button class="cb end" onclick="endCall(true)">✕</button><small>Татгалзах</small></div><div class="cc"><button class="cb ok" onclick="acceptCall()">📞</button><small>Авах</small></div>':`<div class="cc"><button class="cb${c.muted?' off':''}" id="cmute" onclick="toggleMic()">${c.muted?'🔇':'🎤'}</button><small>Микрофон</small></div>${c.kind==='video'?'<div class="cc"><button class="cb" onclick="toggleCam()">📷</button><small>Камер</small></div>':''}<div class="cc"><button class="cb end" onclick="endCall(true)">📵</button><small>Дуусгах</small></div>`}</div>`;
  if(c.local)$('lv').srcObject=c.local;if(c.remote)$('rv').srcObject=c.remote;
}
function toggleMic(){const t=call&&call.local.getAudioTracks()[0];if(!t)return;t.enabled=!t.enabled;call.muted=!t.enabled;const b=$('cmute');if(b){b.textContent=call.muted?'🔇':'🎤';b.classList.toggle('off',call.muted)}}
function startTimer(){clearInterval(callTimer);callTimer=setInterval(()=>{if(!call||call.weak)return;const e=$('cst');if(e)e.textContent=fmtDur(Date.now()-call.t0)},1000)}
function watchSpeech(){
  try{const ac=new (window.AudioContext||window.webkitAudioContext)(),an=ac.createAnalyser();an.fftSize=256;ac.createMediaStreamSource(call.remote).connect(an);call.ac=ac;const d=new Uint8Array(an.frequencyBinCount);
    const loop=()=>{if(!call)return;an.getByteFrequencyData(d);const e=$('cav');if(e)e.classList.toggle('speak',d.reduce((a,b)=>a+b,0)/d.length>18);raf=requestAnimationFrame(loop)};loop()}catch(e){}
}
async function keepAwake(){try{if(navigator.wakeLock)call.wl=await navigator.wakeLock.request('screen')}catch(e){}}
function makePC(){
  const pc=new RTCPeerConnection({iceServers:(iceCache&&iceCache.s)||ICE.iceServers,iceCandidatePoolSize:4,bundlePolicy:'max-bundle'});call.pc=pc;call.remote=new MediaStream();
  pc.ontrack=e=>{if(e.track&&!call.remote.getTracks().includes(e.track))call.remote.addTrack(e.track);if(e.track.kind==='audio')sink();const rv=$('rv');if(rv&&call.kind==='video'){rv.srcObject=call.remote;rv.play&&rv.play().catch(()=>{})}};
  pc.onicecandidate=e=>{if(e.candidate)sendSig('ice',e.candidate.toJSON())};
  pc.onconnectionstatechange=()=>{
    if(!call||call.pc!==pc)return;const s=pc.connectionState;
    if(s==='connected'){clearTimeout(call.rt);clearTimeout(call.rt2);call.weak=false;
      if(!call.connected){call.connected=true;call.t0=Date.now();ring(false);clearTimeout(call.to);call.state='00:00';callUI();startTimer();watchSpeech();keepAwake();watchdog()}}
    else if(s==='disconnected'){call.weak=true;const e=$('cst');if(e)e.textContent='Холболт муудлаа...';clearTimeout(call.rt);call.rt=setTimeout(()=>restartIce(false),3000)}
    else if(s==='failed'){call.weak=true;restartIce(true)}};
  call.local.getAudioTracks().forEach(t=>{try{t.contentHint='speech'}catch(e){}});call.local.getTracks().forEach(t=>pc.addTrack(t,call.local));
}
async function restartIce(final){
  const c=call;if(!c||!c.pc)return;
  const giveUp=()=>{clearTimeout(c.rt2);c.rt2=setTimeout(()=>{if(call===c&&c.pc.connectionState!=='connected'){toast('Холболт тасарлаа');endCall(true)}},final?12000:15000)};
  if(c.role!=='caller'){sendSig('ringing',{restart:true});if(final)giveUp();return}
  try{const o=await c.pc.createOffer({iceRestart:true});await c.pc.setLocalDescription({type:o.type,sdp:tuneOpus(o.sdp)});await sendSig('offer',{type:o.type,sdp:c.pc.localDescription.sdp,kind:c.kind,re:true})}catch(e){}
  giveUp();
}
async function startCall(kind){
  if(call||!cur)return;if(!window.RTCPeerConnection){toast('Энэ хөтөч дуудлага дэмжихгүй');return}
  let s;try{s=await navigator.mediaDevices.getUserMedia(MEDIA(kind))}catch(e){toast('Микрофон/камерын зөвшөөрөл өгнө үү');return}
  call={id:crypto.randomUUID(),peer:cur,kind,role:'caller',state:'Дуудаж байна...',local:s};
  makePC();callUI();ring('out');
  const o=await call.pc.createOffer();await call.pc.setLocalDescription({type:o.type,sdp:tuneOpus(o.sdp)});
  const er=await sendSig('offer',{type:o.type,sdp:call.pc.localDescription.sdp,kind});
  if(er){toast(/rate_limit/.test(er.message)?'Хэт олон дуудлага':'Зөвхөн найзтайгаа дуудлага хийнэ');call.logged=1;cleanup();return}
  call.to=setTimeout(()=>{if(call&&!call.connected){call.why='📞 Аваагүй дуудлага';toast('Хариулсангүй');endCall(true)}},45000);
}
async function acceptCall(){
  const c=call;if(!c||c.state!=='incoming')return;clearTimeout(c.to);ring(false);
  let s;try{s=await navigator.mediaDevices.getUserMedia(MEDIA(c.kind))}catch(e){toast('Зөвшөөрөл өгнө үү');endCall(true);return}
  c.local=s;c.state='Холбогдож байна...';makePC();callUI();
  await c.pc.setRemoteDescription({type:c.offer.type,sdp:c.offer.sdp});flushIce();
  const a=await c.pc.createAnswer();await c.pc.setLocalDescription({type:a.type,sdp:tuneOpus(a.sdp)});await sendSig('answer',{type:a.type,sdp:c.pc.localDescription.sdp});
}
function logCall(c,text){sb.from('messages').insert({sender:me.id,receiver:c.peer.id,body:text}).then(()=>{})}
function cleanup(){
  ring(false);clearInterval(callTimer);cancelAnimationFrame(raf);const c=call;call=null;
  if(c){clearTimeout(c.to);clearTimeout(c.rt);clearTimeout(c.rt2);if(c.pc)c.pc.close();if(c.local)c.local.getTracks().forEach(t=>t.stop());if(c.wl)c.wl.release().catch(()=>{});if(c.ac)c.ac.close().catch(()=>{});
    if(c.role==='caller'&&!c.logged){c.logged=1;logCall(c,c.t0?(c.kind==='video'?'🎥 Видео':'📞 Аудио')+' дуудлага · '+fmtDur(Date.now()-c.t0):(c.why||'📞 Цуцалсан дуудлага'))}}
  const v=$('call');if(v)v.remove();
}
async function endCall(send){if(call&&send)await sendSig('end',{});cleanup()}
async function onSignal(s){
  if(sigSeen.has(s.id)||s.receiver!==me.id)return;sigSeen.add(s.id);
  if(s.kind==='offer'){
    if(call&&call.id===s.call_id&&call.pc){
      await call.pc.setRemoteDescription({type:s.data.type,sdp:s.data.sdp});const a=await call.pc.createAnswer();
      await call.pc.setLocalDescription({type:a.type,sdp:tuneOpus(a.sdp)});await sendSig('answer',{type:a.type,sdp:call.pc.localDescription.sdp});return}
    if(call){await sb.from('call_signals').insert({call_id:s.call_id,sender:me.id,receiver:s.sender,kind:'end',data:{busy:true}});return}
    const p=friends.find(f=>f.id===s.sender);if(!p)return;
    call={id:s.call_id,peer:p,kind:s.data.kind,role:'callee',state:'incoming',offer:s.data};callUI();ring('in');sendSig('ringing',{});
    pushN(p.display_name||p.username,(s.data.kind==='video'?'🎥':'📞')+' Дуудлага ирж байна','c'+p.id);
    call.to=setTimeout(()=>{if(call&&call.state==='incoming')endCall(true)},45000);return;
  }
  if(s.kind==='ice'){if(call&&call.id===s.call_id&&call.pc&&call.pc.remoteDescription)call.pc.addIceCandidate(s.data).catch(()=>{});else(pendIce[s.call_id]=pendIce[s.call_id]||[]).push(s.data);return}
  if(!call||call.id!==s.call_id)return;
  if(s.kind==='ringing'){if(s.data&&s.data.restart&&call.role==='caller'&&call.connected)restartIce(false);else if(!call.connected){call.state='Дуугарч байна...';const e=$('cst');if(e)e.textContent=call.state}}
  else if(s.kind==='answer'&&call.pc){await call.pc.setRemoteDescription({type:s.data.type,sdp:s.data.sdp});flushIce()}
  else if(s.kind==='end'){const busy=s.data&&s.data.busy;if(call.role==='caller'&&!call.t0)call.why=busy?'📞 Завгүй байсан':'📞 Татгалзсан дуудлага';toast(busy?'Завгүй байна':'Дуудлага дууслаа');cleanup()}
}

/* guest signup via edge function (и-мэйл тохиргоо хэрэггүй) */
async function guestSignup(){
  const name=$('gname').value.trim(),m=$('amsg');if(name.length<2){m.textContent='Нэрээ бич (2+ тэмдэгт)';return}
  m.textContent='...';const r=await sb.functions.invoke('guest',{body:{name}});
  if(r.error||!r.data||!r.data.n){m.textContent='Guest үүсгэж чадсангүй. Дахин оролдоно уу.';return}
  const {n,password}=r.data,l=await sb.auth.signInWithPassword({email:`guest${n}@guest.comunic.online`,password});
  if(l.error){m.textContent=/disabled/i.test(l.error.message)?'Supabase → Authentication → Providers → Email-г идэвхжүүлнэ үү':'Нэвтэрч чадсангүй, дахин оролдоно уу';return}
  m.textContent='';showGuestCred(n,password);
}

window.__ok=1;


/* ================= v11: typing, instant send, logs/console, reliable calls ================= */
const PEND={},logSeen={};let tch=null,lastTyp=0,conF='all',conCh=null,iceCache=null,wdT=null,wdLast=-1,wdMiss=0;
function logE(level,kind,message,meta){
  if(!me)return;const k=kind+message,n=Date.now();if(logSeen[k]&&n-logSeen[k]<30000)return;logSeen[k]=n;
  sb.from('app_logs').insert({user_id:me.id,level,kind,message:String(message||'').slice(0,500),meta:meta||null}).then(()=>{});
}
window.addEventListener('error',e=>logE('error','js',e.message,{src:(e.filename||'').split('/').pop(),line:e.lineno}));
window.addEventListener('unhandledrejection',e=>logE('error','promise',(e.reason&&e.reason.message)||String(e.reason)));

/* ---- typing indicator ---- */
function typingChan(){
  if(!cur)return null;const id=[me.id,cur.id].sort().join('_');if(tch&&tch._id===id)return tch;if(tch)sb.removeChannel(tch);
  tch=sb.channel('typ_'+id);tch._id=id;tch.on('broadcast',{event:'t'},p=>{if(cur&&p.payload&&p.payload.from===cur.id)showTyping()}).subscribe();return tch;
}
function showTyping(){
  let t=$('tb');if(!t){t=document.createElement('div');t.id='tb';t.className='m typ';t.innerHTML='<i></i><i></i><i></i>'}
  $('msgs').appendChild(t);$('msgs').scrollTop=$('msgs').scrollHeight;clearTimeout(t._h);t._h=setTimeout(()=>t.remove(),3000);
}
$('ctext').addEventListener('input',()=>{if(!cur||Date.now()-lastTyp<2000)return;lastTyp=Date.now();const c=typingChan();c&&c.send({type:'broadcast',event:'t',payload:{from:me.id}})});
const _am=addMsg;addMsg=function(m){const t=$('tb');if(t&&m.sender!==me.id)t.remove();_am(m)};

/* ---- instant (optimistic) send with retry ---- */
function markState(id,st){
  const d=document.querySelector(`[data-id="${id}"]`);if(!d)return;let s=d.querySelector('.st');
  if(!s){s=document.createElement('small');s.className='st';d.appendChild(s)}
  d.classList.toggle('pend',st==='sending');d.classList.toggle('fail',st==='failed');
  s.textContent=st==='sending'?'⏳':st==='failed'?'⚠ Илгээгдсэнгүй · дарж дахин оролдох':'✓';s.onclick=st==='failed'?()=>retrySend(id):null;
}
function retrySend(id){const p=PEND[id];if(p)sendRow(p.row,id,p.to)}
async function sendRow(row,retryId,toId){
  const id=retryId||crypto.randomUUID(),to=toId||cur.id;
  if(!retryId){PEND[id]={row,to};addMsg({id,sender:me.id,receiver:to,created_at:new Date().toISOString(),...row})}
  markState(id,'sending');
  const r=await sb.from('messages').insert({id,sender:me.id,receiver:to,...row}),e=(r.error&&r.error.message)||'';
  if(!r.error||(r.error.code==='23505')){delete PEND[id];markState(id,'sent');return}
  markState(id,'failed');logE('warn','send',e.slice(0,200));
  toast(/rate_limit/.test(e)?'Хэт хурдан илгээж байна':/banned/.test(e)?'Таны эрх хаагдсан':/row-level security|policy/.test(e)?'Хүлээн авагч хүсэлтийг зөвшөөрөх хүртэл 1 мессеж илгээнэ':'Илгээж чадсангүй, дахин оролдоно уу');
}
async function sendText(){
  const t=$('ctext').value.trim();if(!t||!cur)return;$('ctext').value='';$('ctext').focus();const rt=takeReply();
  if(encOn()){try{const o=await enc(new TextEncoder().encode(t),await sharedKey(cur));sendRow({body:b64(o),enc:true,reply_to:rt})}catch(e){$('ctext').value=t;toast('Шифрлэж чадсангүй')}}
  else sendRow({body:t,reply_to:rt});
}

/* ---- admin: Console & Logs ---- */
const _admin=admin;admin=async function(){await _admin();$('main').insertAdjacentHTML('afterbegin','<button class="btn" style="width:100%;margin-bottom:8px" onclick="adminConsole()">🖥 Console & Logs</button>')};
function closeCon(){const v=$('nm');if(v)v.remove();if(conCh){sb.removeChannel(conCh);conCh=null}}
async function adminConsole(){
  const o=$('nm');if(o)o.remove();const v=document.createElement('div');v.id='nm';v.className='con';
  v.innerHTML=`<div class="nmh"><b>🖥 Console & Logs</b><button class="btn s" onclick="closeCon()">✕</button></div><div id="cst2" class="grid"></div><div class="chips">${['all','error','warn','info','admin'].map(k=>`<button class="btn s" onclick="conF='${k}';loadLogs()">${k}</button>`).join('')}<button class="btn s" onclick="loadStats();loadLogs()">⟳</button></div><div class="cr"><input id="cmd" placeholder="Команд (help)" onkeydown="if(event.key==='Enter')runCmd()"><button class="btn" onclick="runCmd()">▶</button></div><div id="logs" class="logs"></div>`;
  document.body.appendChild(v);loadStats();loadLogs();
  conCh=sb.channel('conlive').on('postgres_changes',{event:'INSERT',schema:'public',table:'app_logs'},()=>loadLogs()).subscribe();
}
async function loadStats(){const r=await sb.rpc('admin_stats'),s=r.data||{};$('cst2').innerHTML=Object.entries(s).map(([k,v])=>`<div class="stc"><b>${v}</b><small>${esc(k)}</small></div>`).join('')||'<p class="fine">Stats алдаа (v11 SQL ажиллуулсан уу?)</p>'}
async function loadLogs(){
  const box=$('logs');if(!box)return;let q=sb.from('app_logs').select('*').order('created_at',{ascending:false}).limit(120);
  if(['error','warn','info'].includes(conF))q=q.eq('level',conF);
  const [a,b]=await Promise.all([conF==='admin'?{data:[]}:q,['all','admin'].includes(conF)?sb.from('admin_log').select('*').order('created_at',{ascending:false}).limit(60):{data:[]}]);
  const rows=[...(a.data||[]).map(x=>({t:x.created_at,l:x.level,k:x.kind,u:x.user_id,m:x.message,x:x.meta})),...(b.data||[]).map(x=>({t:x.created_at,l:'admin',k:x.action,u:x.target,m:(x.detail||'')+' | '+(x.reason||''),x:null}))].sort((p,q2)=>new Date(q2.t)-new Date(p.t)).slice(0,150);
  const ids=[...new Set(rows.map(r=>r.u).filter(Boolean))],ps=ids.length?(await sb.from('profiles').select('id,username').in('id',ids)).data||[]:[],N={};ps.forEach(p=>N[p.id]=p.username);
  box.innerHTML=rows.map(r=>`<div class="ln ${r.l}">${new Date(r.t).toLocaleTimeString()} [${r.l}] ${esc(r.k)} ${r.u?'@'+esc(N[r.u]||r.u.slice(0,6)):''} — ${esc(r.m||'')}${r.x?' '+esc(JSON.stringify(r.x)):''}</div>`).join('')||'<p class="fine">Лог алга</p>';
}
async function runCmd(){
  const raw=$('cmd').value.trim();$('cmd').value='';if(!raw)return;const [c,...a]=raw.split(/\s+/),box=$('logs');
  const out=t=>box.insertAdjacentHTML('afterbegin',`<div class="ln cmd">&gt; ${esc(raw)}<br>${esc(String(t))}</div>`);
  if(c==='help')return out('stats | user <@name|#id> | ban <u> <шалтгаан> | unban <u> | verify <u> | unverify <u> | badge <u> <key|none> | logs <error|warn|info|admin|all> | purge-guests | clear');
  if(c==='stats'){const r=await sb.rpc('admin_stats');return out(JSON.stringify(r.data||r.error))}
  if(c==='logs'){conF=a[0]||'all';return loadLogs()}
  if(c==='clear'){box.innerHTML='';return}
  if(c==='purge-guests'){const r=await sb.rpc('admin_purge_guests');return out(r.error?r.error.message:'Устгасан guest: '+r.data)}
  const q=(a[0]||'').replace('@','').toLowerCase(),b=sb.from('profiles').select('*').limit(1),u=((await (/^#\d+$/.test(q)?b.eq('user_no',+q.slice(1)):b.eq('username',q))).data||[])[0];
  if(!u)return out('Хэрэглэгч олдсонгүй');const why=a.slice(1).join(' ');
  if(c==='user')return out(`#${u.user_no} @${u.username} | ${u.display_name} | join ${u.created_at} | online ${u.last_online} | verified ${u.verified} | banned ${u.banned} | guest ${u.is_guest}`);
  let o,det;
  if(c==='ban'){if(!why)return out('Шалтгаан заавал: ban <u> <шалтгаан>');o={banned:true,banned_until:new Date(Date.now()+100*864e5).toISOString(),ban_reason:why};det='100 хоногийн хориг'}
  else if(c==='unban'){o={banned:false,banned_until:null,ban_reason:null};det='Хориг цуцлав'}
  else if(c==='verify'){o={verified:true,badge:u.badge||'verified'};det='Verified олголоо'}
  else if(c==='unverify'){o={verified:false};det='Verified хаслаа'}
  else if(c==='badge'){o={badge:a[1]&&a[1]!=='none'?a[1]:null};det='badge → '+(o.badge||'-')}
  else return out('Тодорхойгүй команд. help');
  const r=await sb.from('profiles').update(o).eq('id',u.id);if(r.error)return out('Алдаа: '+r.error.message);
  await logA(u.id,c,det,why||'console');out('OK: '+det);
}

/* ---- reliable calls: TURN, persistent audio sink, watchdog ---- */
async function getIce(){
  if(iceCache&&Date.now()-iceCache.t<6e5)return iceCache.s;let s=ICE.iceServers;
  try{const r=await sb.functions.invoke('turn');if(Array.isArray(r.data)&&r.data.length)s=[...r.data,...s]}catch(e){}
  iceCache={t:Date.now(),s};return s;
}
function sink(){
  let a=$('ra');if(!a){a=document.createElement('audio');a.id='ra';a.autoplay=true;a.setAttribute('playsinline','');document.body.appendChild(a)}
  a.srcObject=call.remote;const p=a.play();
  if(p)p.catch(()=>{if($('unmute'))return;const b=document.createElement('button');b.className='btn';b.id='unmute';b.textContent='🔊 Дууг асаах';b.style.cssText='position:fixed;bottom:130px;left:50%;transform:translateX(-50%);z-index:150';b.onclick=()=>{a.play();b.remove()};document.body.appendChild(b)});
}
function watchdog(){
  clearInterval(wdT);wdLast=-1;wdMiss=0;
  wdT=setInterval(async()=>{
    if(!call||!call.pc||!call.connected||call.weak)return;
    try{const st=await call.pc.getStats();let b=0;st.forEach(r=>{if(r.type==='inbound-rtp'&&r.kind==='audio')b+=r.bytesReceived});
      if(wdLast>=0&&b<=wdLast){if(++wdMiss>=2){wdMiss=0;logE('warn','call','no inbound audio, restarting ICE');toast('Дуу ирэхгүй байна, дахин холбож байна...');restartIce(false)}}else wdMiss=0;wdLast=b}catch(e){}
  },4000);
}
window.addEventListener('online',()=>{if(call&&call.connected){call.weak=true;restartIce(false)}});
const _cu=cleanup;cleanup=function(){
  const c=call;if(c)logE(c.connected?'info':'warn','call',(c.connected?'ended ':'failed/unanswered ')+c.kind+(c.t0?' '+fmtDur(Date.now()-c.t0):''),{role:c.role,why:c.why||null});
  clearInterval(wdT);const a=$('ra');if(a)a.srcObject=null;const u=$('unmute');if(u)u.remove();_cu();
};
const _sc=startCall;startCall=async function(k){await getIce();logE('info','call','start '+k);return _sc(k)};
function initV11(){logE('info','login',(prof.is_guest?'guest ':'')+prof.username);getIce()}
