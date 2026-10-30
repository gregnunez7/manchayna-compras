"use strict";
const $=id=>document.getElementById(id);
const CFG=window.MANCHAYNA_CONFIG||{};
const SESSION='00000000-0000-4000-8000-000000000001';
let db,channel,items=[],products=[],active=false,user=null,busy=false,filter='all';
const FAVORITES='manchayna-favorites-v1';
let favorites=new Set(JSON.parse(localStorage.getItem(FAVORITES)||'[]'));
const saveFavorites=()=>localStorage.setItem(FAVORITES,JSON.stringify([...favorites]));
const notice=(s='')=>$('notice').textContent=s;
const err=e=>notice('⚠️ '+(e?.message||String(e)));
const normal=s=>s.trim().replace(/\s+/g,' ');
const number=n=>Number(n).toLocaleString('es-ES',{maximumFractionDigits:2});
function setBusy(v){busy=v;for(const id of ['toggle','addButton','waPreview','waConfirm'])$(id).disabled=v;}
async function run(action){if(busy)return;setBusy(true);notice();try{await action();}catch(e){err(e);}finally{setBusy(false);}}
async function load(){
 const [s,i,p]=await Promise.all([
 db.from('shopping_sessions').select('status').eq('id',SESSION).single(),
 db.from('shopping_items').select('id,product_id,quantity,purchased_quantity').eq('session_id',SESSION).order('created_at'),
 db.from('products').select('id,name').order('name')]);
 for(const r of [s,i,p])if(r.error)throw r.error;
 active=s.data.status==='active';items=i.data;products=p.data;render();
}
function render(){
 const opts=$('catalogOptions');opts.replaceChildren();const byId=new Map(products.map(p=>[p.id,p]));
 for(const p of products){const o=document.createElement('option');o.value=p.name;opts.append(o);}
 const list=$('items');list.replaceChildren();const query=normal($('search').value).toLocaleLowerCase('es');
 const rows=items.filter(x=>{const match=(byId.get(x.product_id)?.name||'').toLocaleLowerCase('es').includes(query);const done=Number(x.purchased_quantity)>=Number(x.quantity);return match&&(filter==='all'||(filter==='done'?done:!done));});
 for(const it of rows){
  const li=document.createElement('li');const name=byId.get(it.product_id)?.name||'Producto desconocido';
  const bought=Number(it.purchased_quantity),qty=Number(it.quantity);if(bought>=qty)li.classList.add('done');
  const cb=document.createElement('input');cb.type='checkbox';cb.checked=bought>=qty;cb.disabled=!active;
  cb.setAttribute('aria-label','Comprado: '+name);
  cb.addEventListener('change',()=>run(async()=>{const r=await db.from('shopping_items').update({purchased_quantity:cb.checked?qty:0}).eq('id',it.id);if(r.error)throw r.error;await load();}));
  const label=document.createElement('span');label.className='name';label.textContent=number(qty)+' × '+name;
  const partial=document.createElement('input');partial.type='number';partial.className='bought';partial.min='0';partial.max=String(qty);partial.step='any';partial.value=String(bought);partial.disabled=!active;partial.title='Cantidad comprada';partial.setAttribute('aria-label','Cantidad comprada de '+name);
  partial.addEventListener('change',()=>run(async()=>{const n=Number(partial.value);if(!Number.isFinite(n)||n<0||n>qty)throw Error('La cantidad comprada debe estar entre 0 y '+qty);const r=await db.from('shopping_items').update({purchased_quantity:n}).eq('id',it.id);if(r.error)throw r.error;await load();}));
  const del=document.createElement('button');del.type='button';del.textContent='✕';del.title='Quitar producto';del.disabled=active;del.addEventListener('click',()=>run(async()=>{if(!confirm('¿Quitar '+name+' de la lista?'))return;const r=await db.from('shopping_items').delete().eq('id',it.id);if(r.error)throw r.error;await load();}));
  const wrap=document.createElement('div');wrap.className='item-line';wrap.append(cb,label);
  const controls=document.createElement('div');controls.className='item-controls';
  if(!active){const qtyInput=document.createElement('input');qtyInput.type='number';qtyInput.min='0.01';qtyInput.step='any';qtyInput.value=String(qty);qtyInput.className='item-edit';qtyInput.title='Cantidad solicitada';qtyInput.setAttribute('aria-label','Cantidad solicitada de '+name);qtyInput.addEventListener('change',()=>run(async()=>{const n=Number(qtyInput.value);if(!Number.isFinite(n)||n<=0)throw Error('Cantidad inválida');const r=await db.from('shopping_items').update({quantity:n,purchased_quantity:0}).eq('id',it.id);if(r.error)throw r.error;await load();}));controls.append(qtyInput);}
  else {const caption=document.createElement('small');caption.textContent='Comprado:';controls.append(caption,partial);}
  controls.append(del);li.append(wrap,controls);list.append(li);
 }
 $('count').textContent='('+items.length+')';$('empty').hidden=rows.length>0;
 const completed=items.filter(x=>Number(x.purchased_quantity)>=Number(x.quantity)).length;
 $('stats').textContent=active?`Compra en curso · ${completed} completos · ${items.length-completed} por completar`:`${items.length} productos pendientes · Compra sin iniciar`;
 $('toggle').textContent=active?'🏁 Finalizar compra':'▶ Iniciar compra';$('toggle').classList.toggle('finish',active);$('toggle').disabled=busy||(!active&&!items.length);
 for(const id of ['product','quantity','bulk','addButton','waPreview'])$(id).disabled=busy;
 renderCatalog();
}
function renderCatalog(){
 const sorted=[...products].sort((a,b)=>Number(favorites.has(b.id))-Number(favorites.has(a.id))||a.name.localeCompare(b.name,'es'));
 const quick=$('quickCatalog');quick.replaceChildren();for(const p of sorted.filter(p=>favorites.has(p.id)).slice(0,12)){const b=document.createElement('button');b.type='button';b.textContent='⭐ '+p.name;b.disabled=busy;b.addEventListener('click',()=>{$('product').value=p.name;$('quantity').focus();});quick.append(b);}
 $('catalogCount').textContent=products.length+' productos';const list=$('catalogList');list.replaceChildren();const q=normal($('catalogSearch').value).toLocaleLowerCase('es');
 for(const p of sorted.filter(x=>x.name.toLocaleLowerCase('es').includes(q))){const li=document.createElement('li');li.className='catalog-row';const name=document.createElement('span');name.textContent=p.name;const star=document.createElement('button');star.type='button';star.className='star';star.textContent=favorites.has(p.id)?'★':'☆';star.title='Favorito';star.addEventListener('click',()=>{favorites.has(p.id)?favorites.delete(p.id):favorites.add(p.id);saveFavorites();renderCatalog();});const pick=document.createElement('button');pick.type='button';pick.className='secondary';pick.textContent='Elegir';pick.addEventListener('click',()=>{$('product').value=p.name;$('product').scrollIntoView({behavior:'smooth',block:'center'});$('quantity').focus();});const rename=document.createElement('button');rename.type='button';rename.className='rename';rename.textContent='Editar';rename.addEventListener('click',()=>run(async()=>{const value=prompt('Nuevo nombre del producto:',p.name);if(value===null)return;const n=normal(value);if(!n)throw Error('El nombre no puede estar vacío');const r=await db.from('products').update({name:n}).eq('id',p.id);if(r.error)throw r.error;await load();}));const remove=document.createElement('button');remove.type='button';remove.className='remove';remove.textContent='Borrar';remove.addEventListener('click',()=>run(async()=>{if(items.some(i=>i.product_id===p.id))throw Error('Este producto está en la lista. Quítalo primero para borrarlo del catálogo.');if(!confirm('¿Eliminar '+p.name+' del catálogo?'))return;const r=await db.from('products').delete().eq('id',p.id);if(r.error)throw r.error;favorites.delete(p.id);saveFavorites();await load();}));li.append(name,star,pick,rename,remove);list.append(li);}
}
async function add(name,qty){name=normal(name);if(!name||!Number.isFinite(qty)||qty<=0)throw Error('Introduce un producto y una cantidad válida');const r=await db.rpc('add_shopping_product',{p_name:name,p_quantity:qty});if(r.error)throw r.error;}
function parseLine(line){const s=normal(line.replace(/^[-•]\s*/,''));if(!s)return null;const m=s.match(/^(\d+(?:[.,]\d+)?)\s*(?:[x×]\s*)?(.+)$/i);return {name:m?normal(m[2]):s,qty:m?Number(m[1].replace(',','.')):1};}
function summary(){const map=new Map(products.map(p=>[p.id,p.name]));return '🛒 MANCHAYNA — PENDIENTES\n'+(items.length?items.map(i=>'• '+number(i.quantity)+' × '+(map.get(i.product_id)||'Producto')).join('\n'):'✅ No quedan productos pendientes.');}
async function setupUser(session){user=session?.user||null;$('loginPanel').hidden=!!user;$('appPanel').hidden=!user;
 if(channel){await db.removeChannel(channel);channel=null;}
 if(user){$('who').textContent=user.email;await load();channel=db.channel('compras-live').on('postgres_changes',{event:'*',schema:'public',table:'shopping_items'},()=>load().catch(err)).on('postgres_changes',{event:'*',schema:'public',table:'shopping_sessions'},()=>load().catch(err)).on('postgres_changes',{event:'*',schema:'public',table:'products'},()=>load().catch(err)).subscribe();}
}
async function main(){
 if(!CFG.url?.startsWith('https://')||!CFG.publishableKey||CFG.publishableKey.includes('PEGA_AQUI')){notice('Configura tu URL y publishable key en supabase-config.js.');return;}
 if(!window.supabase?.createClient){notice('No se pudo cargar Supabase. Comprueba la conexión a Internet.');return;}
 db=window.supabase.createClient(CFG.url,CFG.publishableKey);
 $('loginForm').addEventListener('submit',e=>{e.preventDefault();run(async()=>{const r=await db.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});if(r.error)throw r.error;await setupUser(r.data.session);$('password').value='';});});
 $('logout').addEventListener('click',()=>run(async()=>{const r=await db.auth.signOut();if(r.error)throw r.error;await setupUser(null);}));
 $('addForm').addEventListener('submit',e=>{e.preventDefault();run(async()=>{await add($('product').value,Number($('quantity').value));$('product').value='';$('quantity').value='1';await load();});});
 $('toggle').addEventListener('click',()=>run(async()=>{if(active&&!confirm('¿Finalizar compra y conservar solo las cantidades pendientes?'))return;const wasActive=active;const r=await db.rpc('set_purchase_status',{p_finish:wasActive});if(r.error)throw r.error;await load();if(wasActive){$('summary').textContent=summary();$('summaryPanel').hidden=false;}else{$('summaryPanel').hidden=true;}}));
 $('share').addEventListener('click',async()=>{const txt=$('summary').textContent;try{if(navigator.share)await navigator.share({text:txt});else{await navigator.clipboard.writeText(txt);notice('Resumen copiado al portapapeles');}}catch(e){if(e.name!=='AbortError')err(e);}});
 $('search').addEventListener('input',render);$('catalogSearch').addEventListener('input',renderCatalog);document.querySelectorAll('.filter').forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.filter;document.querySelectorAll('.filter').forEach(x=>x.classList.toggle('selected',x===b));render();}));$('refresh').addEventListener('click',()=>run(load));
 const r=await db.auth.getSession();if(r.error)throw r.error;await setupUser(r.data.session);
}
main().catch(err);
