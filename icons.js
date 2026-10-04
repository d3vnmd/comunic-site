/* Comunic icons: UI emoji → inline SVG (чат мессеж, reaction, emoji самбар, нэр дотрох emoji хэвээр) */
(function(){
var P={
lock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
unlock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 7-2"/>',
phone:'<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
phoneoff:'<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/><path d="M3 3l18 18"/>',
mic:'<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
micoff:'<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M3 3l18 18"/>',
camera:'<path d="M4 8h3l2-3h6l2 3h3v12H4z"/><circle cx="12" cy="13" r="3.5"/>',
trash:'<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6"/>',
shield:'<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
bell:'<path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4zM10 21h4"/>',
video:'<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3"/>',
heart:'<path d="M12 20s-8-4.7-8-11a4.5 4.5 0 0 1 8-2.5A4.5 4.5 0 0 1 20 9c0 6.3-8 11-8 11z"/>',
heartfill:'<path d="M12 20s-8-4.7-8-11a4.5 4.5 0 0 1 8-2.5A4.5 4.5 0 0 1 20 9c0 6.3-8 11-8 11z"/>',
ban:'<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>',
check:'<path d="M5 12.5l4.5 4.5L19 7"/>',
checkc:'<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>',
close:'<path d="M6 6l12 12M18 6L6 18"/>',
chat:'<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 21 12z"/>',
headphones:'<path d="M4 16v-4a8 8 0 0 1 16 0v4"/><rect x="3" y="14" width="4" height="7" rx="2"/><rect x="17" y="14" width="4" height="7" rx="2"/>',
install:'<path d="M12 3v12M7 11l5 5 5-5M5 21h14"/>',
image:'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 17l-5-5-9 8"/>',
clip:'<path d="M20 11l-8 8a5 5 0 0 1-7-7l8-8a3.5 3.5 0 0 1 5 5l-8 8a2 2 0 0 1-3-3l7-7"/>',
user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
plus:'<path d="M12 5v14M5 12h14"/>',
flag:'<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
medal:'<circle cx="12" cy="15" r="5"/><path d="M8 3l4 7 4-7"/>',
edit:'<path d="M4 20h4L19 9l-4-4L4 16z"/>',
copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
palette:'<path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 1.5-2-.6-1.2.2-2.5 1.5-2.5H17a4 4 0 0 0 4-4c0-5-4-9.5-9-9.5z"/><circle cx="8" cy="11" r="1"/><circle cx="12" cy="7.5" r="1"/><circle cx="16" cy="10" r="1"/>',
mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
send:'<path d="M4 12l16-8-6 16-2-7z"/>',
key:'<circle cx="8" cy="14" r="4"/><path d="M11 12l9-9M16 8l3 3"/>',
console:'<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 9l3 3-3 3M13 15h4"/>',
reply:'<path d="M9 14L4 9l5-5M4 9h10a6 6 0 0 1 6 6v3"/>',
wave:'<path d="M8 12V5a1.5 1.5 0 0 1 3 0v6M11 11V4a1.5 1.5 0 0 1 3 0v7M14 11V6a1.5 1.5 0 0 1 3 0v8c0 4-2 7-6 7-3 0-5-2-6-5l-1-4a1.5 1.5 0 0 1 3 0z"/>',
dot:'<circle cx="12" cy="12" r="6"/>',
file:'<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>',
scale:'<path d="M12 3v18M6 21h12M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z"/>',
settings:'<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
hourglass:'<path d="M7 3h10M7 21h10M8 3v4l4 5-4 5v4M16 3v4l-4 5 4 5v4"/>',
warning:'<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17h.01"/>',
speaker:'<path d="M4 9v6h4l5 4V5L8 9zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',
search:'<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
note:'<path d="M5 3h10l4 4v14H5z"/><path d="M9 12h6M9 16h6"/>',
smile:'<circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/>',
arrow:'<path d="M5 12h14M13 6l6 6-6 6"/>'};
var M={'🔒':'lock','🔓':'unlock','📞':'phone','📵':'phoneoff','🎤':'mic','🔇':'micoff','📷':'camera','🗑':'trash','🛡':'shield','🔔':'bell','🎥':'video','❤':'heartfill','🤍':'heart','💔':'heart','🚫':'ban','⛔':'ban','✔':'check','✓':'check','✖':'close','✕':'close','💬':'chat','🎧':'headphones','📲':'install','⬇':'install','🖼':'image','📎':'clip','👤':'user','＋':'plus','➕':'plus','⚑':'flag','🚩':'flag','✅':'checkc','🏅':'medal','✏':'edit','📋':'copy','🎨':'palette','✉':'mail','➤':'send','🔑':'key','🖥':'console','↩':'reply','👋':'wave','🟢':'dot','📄':'file','⚖':'scale','⚙':'settings','🌐':'globe','⏳':'hourglass','⚠':'warning','🔊':'speaker','🔍':'search','📝':'note','😊':'smile','👉':'arrow'};
var FILL={heartfill:'#e74c3c',dot:'#2ecc71'};
function svg(n){var f=FILL[n];return '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" '+(f?'fill="'+f+'" stroke="none"':'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"')+'>'+P[n]+'</svg>'}
var keys=Object.keys(M).sort(function(a,b){return b.length-a.length});
var RX=new RegExp('(?:'+keys.join('|')+')\\uFE0F?','g');
var SKIP='.m,.pbody,.bub,#emo,.rxrow,.rxs,textarea,input,.nm,.quote,script,style,[data-keep]';
function proc(n){
  if(n.nodeType===3){
    var p=n.parentElement;if(!p||p.closest(SKIP))return;
    RX.lastIndex=0;if(!RX.test(n.data))return;RX.lastIndex=0;
    var t=n.data,f=document.createDocumentFragment(),last=0,m;
    while((m=RX.exec(t))){
      if(m.index>last)f.appendChild(document.createTextNode(t.slice(last,m.index)));
      var s=document.createElement('span');s.className='icw';s.innerHTML=svg(M[m[0].replace(/\uFE0F/g,'')]);f.appendChild(s);last=RX.lastIndex;
    }
    if(last<t.length)f.appendChild(document.createTextNode(t.slice(last)));
    n.replaceWith(f);
  }else if(n.nodeType===1){
    if(n.closest&&n.closest(SKIP))return;
    var w=document.createTreeWalker(n,NodeFilter.SHOW_TEXT),L=[],x;while((x=w.nextNode()))L.push(x);L.forEach(proc);
  }
}
function start(){
  proc(document.body);
  new MutationObserver(function(ms){ms.forEach(function(m){m.addedNodes.forEach(proc);if(m.type==='characterData')proc(m.target)})}).observe(document.body,{childList:true,subtree:true,characterData:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
