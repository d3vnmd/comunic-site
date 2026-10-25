import {sb} from './core.js';
// Нэг хэрэглэгчид нэг суваг, бүх шүүлтүүр сервер дээр (өөрт хамаатай мөр л ирнэ)
export function connect(me,h){
  const f=(table,col,event='INSERT')=>({event,schema:'public',table,filter:`${col}=eq.${me}`});
  const ch=sb.channel('u:'+me)
    .on('postgres_changes',f('messages','receiver'),p=>h.message?.(p.new))
    .on('postgres_changes',f('call_signals','receiver'),p=>h.signal?.(p.new))
    .on('postgres_changes',f('friendships','addressee'),p=>h.friendRequest?.(p.new))
    .on('postgres_changes',f('friendships','requester','UPDATE'),p=>h.friendUpdate?.(p.new))
    .subscribe(s=>h.status?.(s));
  return ()=>sb.removeChannel(ch);
}
