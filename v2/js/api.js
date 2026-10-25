import {sb} from './core.js';
const MCOLS='id,sender,receiver,body,attachments,audio_url,reply_to,fx,created_at';
export async function friendIds(me){
  const {data,error}=await sb.from('friendships').select('requester,addressee')
    .eq('status','accepted').or(`requester.eq.${me},addressee.eq.${me}`);
  if(error)throw error;
  return (data||[]).map(f=>f.requester===me?f.addressee:f.requester);
}
export async function history(me,peer,before,limit=40){
  let q=sb.from('messages').select(MCOLS)
    .or(`and(sender.eq.${me},receiver.eq.${peer}),and(sender.eq.${peer},receiver.eq.${me})`)
    .order('created_at',{ascending:false}).limit(limit);
  if(before)q=q.lt('created_at',before);
  const {data,error}=await q;if(error)throw error;return data.reverse();
}
export async function send(me,peer,m){
  const row={sender:me,receiver:peer,body:(m.body||'').slice(0,4000),attachments:m.attachments||null,
    audio_url:m.audio_url||null,reply_to:m.reply_to||null,fx:m.fx||null};
  const {data,error}=await sb.from('messages').insert(row).select('id,created_at').single();
  if(error)throw error;return {...row,...data};
}
