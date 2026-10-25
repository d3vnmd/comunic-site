import {sb} from './core.js';
const LIM={free:{px:1280,q:.78,max:10<<20},plus:{px:1920,q:.85,max:25<<20}};
const IMG=/^image\/(jpeg|png|webp)$/;
export async function shrinkImage(file,plus){
  const l=LIM[plus?'plus':'free'];
  if(!IMG.test(file.type)||file.size<200000)return file;
  try{
    const b=await createImageBitmap(file),s=Math.min(1,l.px/Math.max(b.width,b.height));
    const cv=document.createElement('canvas');cv.width=Math.round(b.width*s);cv.height=Math.round(b.height*s);
    cv.getContext('2d').drawImage(b,0,0,cv.width,cv.height);b.close?.();
    const out=await new Promise(r=>cv.toBlob(r,'image/webp',l.q));
    return out&&out.size<file.size?out:file;
  }catch{return file}
}
// Файлыг шахаж, 1 жилийн cache-тэй оруулаад public URL буцаана
export async function uploadMedia(bucket,uid,file,plus=false){
  const blob=file.type.startsWith('image/')?await shrinkImage(file,plus):file;
  if(blob.size>LIM[plus?'plus':'free'].max)throw new Error('Файл хэт том (дээд тал '+(LIM[plus?'plus':'free'].max>>20)+'MB)');
  const type=(blob.type||file.type||'application/octet-stream').split(';')[0];
  const ext=(type.split('/')[1]||'bin').replace(/[^a-z0-9]/gi,'').slice(0,5);
  const path=`${uid}/${Date.now()}_${Math.random().toString(36).slice(2,7)}.${ext}`;
  const {error}=await sb.storage.from(bucket).upload(path,blob,{contentType:type,cacheControl:'31536000'});
  if(error)throw error;
  return sb.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
