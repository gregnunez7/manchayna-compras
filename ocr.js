"use strict";
// OCR gratuito en el navegador. Requiere conexión inicial para descargar Tesseract y el idioma español.
(() => {
 const byId=id=>document.getElementById(id);
 const start=byId('ocrStart'),files=byId('ocrFiles'),status=byId('ocrStatus'),progress=byId('ocrProgress'),review=byId('ocrReview'),rows=byId('ocrRows');
 let processing=false;
 const tidy=s=>String(s||'').trim().replace(/\s+/g,' ');
 const key=s=>tidy(s).toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9 ]/g,'').replace(/\s+/g,' ');
 function catalogMatch(name){
   const k=key(name);if(!k)return '';
   const exact=products.find(p=>key(p.name)===k);if(exact)return exact.name;
   // Solo normalizar automáticamente variantes muy cercanas; evitar unir productos distintos.
   const singular=k.replace(/s$/,'');const close=products.filter(p=>key(p.name).replace(/s$/,'')===singular);
   return close.length===1?close[0].name:name;
 }
 function addRow(qty=1,name=''){
   const row=document.createElement('div');row.className='ocr-row';
   const qLabel=document.createElement('label');qLabel.textContent='Cantidad';const q=document.createElement('input');q.type='number';q.min='0.01';q.step='any';q.value=String(qty);qLabel.append(q);
   const nLabel=document.createElement('label');nLabel.textContent='Producto';const n=document.createElement('input');n.type='text';n.value=catalogMatch(name);n.setAttribute('list','catalogOptions');n.placeholder='Nombre del producto';nLabel.append(n);
   const remove=document.createElement('button');remove.type='button';remove.textContent='✕';remove.title='Quitar fila';remove.addEventListener('click',()=>row.remove());
   row.append(qLabel,nLabel,remove);rows.append(row);
 }
 function extract(text){
   const found=[];
   for(const raw of text.split(/\r?\n/)){
     let line=tidy(raw.replace(/^[•*\-]+\s*/,''));
     if(!line||/^(makro|lista de compra|compras|fecha)\s*:?$/i.test(line))continue;
     // Cantidad al principio: 4 Cachapas / 4x Cachapas / 4 - Cachapas
     let m=line.match(/^(\d+(?:[.,]\d+)?)\s*(?:[x×]|[-–:]\s*)?\s+(.{2,})$/i);
     if(m){found.push({qty:Number(m[1].replace(',','.')),name:tidy(m[2])});continue;}
     // Cantidad al final: Cachapas x4
     m=line.match(/^(.{3,}?)\s+[x×]\s*(\d+(?:[.,]\d+)?)$/i);
     if(m){found.push({qty:Number(m[2].replace(',','.')),name:tidy(m[1])});continue;}
     // Si se detecta texto sin cantidad, conservarlo para revisión con cantidad 1.
     if(/[a-záéíóúñ]{3}/i.test(line)&&line.length<85)found.push({qty:1,name:line});
   }
   return found;
 }
 function resizeImage(file){return new Promise((resolve,reject)=>{
   const img=new Image(),url=URL.createObjectURL(file);
   img.onload=()=>{try{const max=1900,scale=Math.min(1,max/Math.max(img.width,img.height));const c=document.createElement('canvas');c.width=Math.round(img.width*scale);c.height=Math.round(img.height*scale);const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(url);resolve(c);}catch(e){URL.revokeObjectURL(url);reject(e);}};
   img.onerror=()=>{URL.revokeObjectURL(url);reject(Error('No se pudo abrir la imagen '+file.name));};img.src=url;
 });}
 start.addEventListener('click',async()=>{
   if(processing)return;
   if(!user){status.textContent='Inicia sesión primero.';return;}
   if(!files.files.length){status.textContent='Selecciona al menos una fotografía.';return;}
   if(!window.Tesseract?.createWorker){status.textContent='No se pudo cargar Tesseract. Comprueba Internet y vuelve a intentarlo.';return;}
   processing=true;start.disabled=true;progress.hidden=false;progress.value=0;review.hidden=true;rows.replaceChildren();
   let worker;
   try{
     status.textContent='Preparando OCR español (la primera vez puede tardar)...';
     worker=await Tesseract.createWorker('spa',1,{logger:m=>{if(m.status==='recognizing text'){progress.value=Math.min(99,Math.round(m.progress*100));}}});
     let total=0;
     for(let i=0;i<files.files.length;i++){
       status.textContent=`Leyendo fotografía ${i+1} de ${files.files.length}...`;
       progress.value=0;
       const canvas=await resizeImage(files.files[i]);
       const result=await worker.recognize(canvas);
       const parsed=extract(result.data.text||'');
       parsed.forEach(x=>addRow(x.qty,x.name));total+=parsed.length;
     }
     review.hidden=false;
     if(!total)addRow();
     status.textContent=total?`Detectadas ${total} líneas. Revisa cuidadosamente el texto antes de añadir.`:'No se detectaron productos fiables. Puedes introducirlos manualmente en las filas.';
     progress.value=100;
   }catch(e){status.textContent='⚠️ Error al reconocer: '+(e.message||String(e))+'. Puedes seguir añadiendo productos manualmente.';review.hidden=false;if(!rows.children.length)addRow();}
   finally{if(worker)try{await worker.terminate();}catch{}processing=false;start.disabled=false;}
 });
 byId('ocrNewRow').addEventListener('click',()=>addRow());
 byId('ocrConfirm').addEventListener('click',()=>run(async()=>{
   const parsed=[...rows.querySelectorAll('.ocr-row')].map(row=>({qty:Number(row.querySelector('input[type=number]').value),name:tidy(row.querySelector('input[type=text]').value)}));
   if(!parsed.length)throw Error('No hay filas para añadir.');
   if(parsed.some(x=>!x.name||!Number.isFinite(x.qty)||x.qty<=0))throw Error('Revisa nombres y cantidades: todas las filas deben ser válidas.');
   if(!confirm(`¿Añadir ${parsed.length} productos revisados a la lista compartida?`))return;
   const confirmButton=byId('ocrConfirm');confirmButton.disabled=true;
   let added=0;
   try{for(const x of parsed){await add(x.name,x.qty);added++;rows.firstElementChild.remove();}await load();status.textContent=`✅ Añadidos ${added} productos a la lista compartida.`;if(!rows.children.length){review.hidden=true;files.value='';}}
   catch(e){await load().catch(()=>{});throw Error(`Se añadieron ${added} productos antes del error. Quedan ${parsed.length-added} filas sin enviar. ${e.message||e}`);}
   finally{confirmButton.disabled=false;}
 }));
})();
