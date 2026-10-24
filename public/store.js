/* Shared local content store. No credentials are stored in this static editor. */
window.SiteStore=(()=>{
 const key='sai-plus-cms-v1';
 const remote=location.protocol!=='file:'&&window.SAI_REMOTE===true;let loaded=!remote,canEdit=!remote,busy=false,polling=false;
 const clone=x=>JSON.parse(JSON.stringify(x));
 const imageSrc=value=>{value=String(value||'');if(/^data:image\/(png|jpeg|webp|gif);base64,[a-zA-Z0-9+/=]+$/.test(value)||/^https:\/\/[^\s<>"']+$/.test(value))return value;if(/^\/api\/media\/[a-f0-9]{64}\.(png|jpeg|webp|gif)$/.test(value))return value;if(/^[a-zA-Z0-9_-]+$/.test(value))return 'assets/'+value+'.jpg';if(/^assets\/[a-zA-Z0-9_.-]+$/.test(value))return value;return ''};
 function validate(d){
  if(!d||d.version!==1||!Array.isArray(d.services)||!Array.isArray(d.items)||!Array.isArray(d.places)||typeof d.texts!=='object'||!d.texts)throw Error('الملف ليس نسخة محتوى متوافقة مع سعي بلس.');
  if(d.services.length>50||d.items.length>2000||d.places.length>200)throw Error('حجم البيانات أكبر من الحد المتاح لهذه النسخة.');
  const ids=new Set();for(const s of d.services){if(!Array.isArray(s)||s.length<4||!s.every(x=>typeof x==='string')||!/^[a-z][a-z0-9_-]*$/.test(s[0])||ids.has(s[0])||['admin','home','about','services'].includes(s[0]))throw Error('يوجد قسم غير صالح أو مكرر.');ids.add(s[0]);}
  const itemIds=new Set();for(const x of d.items){if(!x||typeof x.title!=='string'||typeof x.cat!=='string'||typeof x.desc!=='string'||!ids.has(x.type)||!/^[a-zA-Z0-9_-]+$/.test(x.id)||itemIds.has(x.id))throw Error('يوجد محتوى غير صالح أو مكرر.');itemIds.add(x.id);for(const k of ['image','badge','meta','extra','price','contact','emoji'])if(x[k]!==undefined&&typeof x[k]!=='string')throw Error('يوجد حقل غير صالح.');if(x.image&&!imageSrc(x.image))throw Error('رابط الصورة غير صالح.');}
  for(const p of d.places)if(!p||typeof p.name!=='string'||typeof p.desc!=='string'||typeof p.cat!=='string'||!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.x>95||p.y<0||p.y>95)throw Error('بيانات أحد الأماكن غير صالحة.');
  for(const v of Object.values(d.texts))if(typeof v!=='string')throw Error('تعديل النص غير صالح.');
  if(!d.images||typeof d.images!=='object')d.images={};for(const v of Object.values(d.images))if(v&&!imageSrc(v))throw Error('يوجد رابط صورة غير صالح.');
  if(!d.theme||!/^#[0-9a-f]{6}$/i.test(d.theme.green)||!/^#[0-9a-f]{6}$/i.test(d.theme.cream))throw Error('ألوان الموقع غير صالحة.');
  if(typeof d.siteName!=='string'||!d.siteName.trim()||!Array.isArray(d.hidden)||!d.hidden.every(x=>typeof x==='string')||typeof d.descriptions!=='object'||!d.descriptions)throw Error('إعدادات الموقع غير صالحة.');
  for(const v of Object.values(d.descriptions))if(typeof v!=='string')throw Error('وصف القسم غير صالح.');
  d.notice=String(d.notice??'');d.mapNotice=String(d.mapNotice??'');return clone(d);
 }
 let state=clone(window.SAI_DEFAULTS);try{let saved=JSON.parse(localStorage.getItem(key)||'null');if(!remote&&saved&&Number(saved.revision)>=Number(state.revision))state=validate(saved);}catch(e){console.warn('Content store: using packaged content.',e.message)}
 function cache(){try{localStorage.setItem(key,JSON.stringify(state));}catch(e){if(!remote)throw Error('مساحة المتصفح ممتلئة. صدّر نسخة احتياطية ثم خفف الصور.');}}
 async function save(next){
  if(busy)throw Error('جاري حفظ التعديل السابق. انتظر قليلًا.');
  const checked=validate(next);
  if(!remote){checked.revision=Date.now();state=checked;cache();window.dispatchEvent(new Event('sai-content-changed'));return state;}
  if(!loaded)throw Error('انتظر تحميل المحتوى من الموقع قبل الحفظ.');
  if(!canEdit)throw Error('سجّل الدخول بحساب مالك الموقع أولًا.');
  busy=true;
  try{
   const res=await fetch('/api/content',{method:'PUT',headers:{'Content-Type':'application/json','If-Match':'"'+state.revision+'"'},body:JSON.stringify(checked),cache:'no-store'});
   const data=await res.json();if(!res.ok)throw Error(data.error||'لم يتم حفظ التعديل. حاول مرة أخرى.');
   state=validate(data.state);canEdit=data.canEdit;cache();window.dispatchEvent(new Event('sai-content-changed'));return state;
  }catch(e){if(e instanceof TypeError)throw Error('انقطع الاتصال. لم يتم تأكيد حفظ التعديل؛ حاول مرة أخرى.');throw e;}finally{busy=false;}
 }
 async function refresh(force=false){
  if(!remote){try{const saved=JSON.parse(localStorage.getItem(key)||'null');state=saved?validate(saved):clone(window.SAI_DEFAULTS);window.dispatchEvent(new Event('sai-content-changed'));}catch(e){console.warn(e)}return;}
  if(polling||busy||(!force&&location.hash==='#admin'))return;
  polling=true;
  try{const res=await fetch('/api/content',{cache:'no-store',headers:loaded?{'If-None-Match':'"'+state.revision+'"'}:{}});if(res.status===304)return;if(!res.ok)throw Error('تعذر تحميل المحتوى المباشر من الموقع. أعد المحاولة.');const data=await res.json();state=validate(data.state);canEdit=Boolean(data.canEdit);loaded=true;cache();window.dispatchEvent(new Event('sai-content-changed'));}
  finally{polling=false;}
 }
 window.addEventListener('storage',e=>{if(e.key!==key||location.hash==='#admin')return;if(remote)refresh().catch(()=>{});else refresh();});
 const ready=remote?refresh(true):Promise.resolve();
 if(remote){setInterval(()=>{if(document.visibilityState!=='hidden')refresh().catch(()=>{});},1500);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refresh().catch(()=>{});});}
 return {get state(){return state},get loaded(){return loaded},get canEdit(){return canEdit},remote,ready,clone,save,validate,imageSrc,key,reload:()=>refresh(true)};
})();
