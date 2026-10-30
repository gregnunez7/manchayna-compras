"use strict";
// Importación con confirmación explícita. No requiere servicios externos.
(()=>{
 const el=id=>document.getElementById(id);
 const tidy=s=>String(s||'').trim().replace(/\s+/g,' ');
 const fold=s=>tidy(s).toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
 const singular=s=>s.split(' ').map(w=>w.length>4&&w.endsWith('s')?w.slice(0,-1):w).join(' ');
 const ignore=/^(?:lista(?: de (?:la )?compra)?|makro|mercadona|compras|pendientes|productos|buenos dias|hola|gracias|total)\s*[:.!-]*$/i;
 function parse(raw){
  let s=tidy(raw.replace(/^[\s•*\-☐✅]+/,'').replace(/^\[\s?[xX ]?\]\s*/,''));
  // Cabeceras y marcas de tiempo de mensajes copiados de WhatsApp
  s=s.replace(/^\[?\d{1,2}\/\d{1,2}\/\d{2,4},?\s+\d{1,2}:\d{2}(?::\d{2})?\]?\s*[-–]?\s*[^:]{1,50}:\s*/, '');
  if(!s||ignore.test(s)||/^(?:https?:\/\/|imagen omitida|foto omitida)/i.test(s))return null;
  let m=s.match(/^(\d+(?:[.,]\d+)?)\s*(?:[x×]\s*|[-–:]\s*)?(.+)$/i);
  if(m)return {qty:Number(m[1].replace(',','.')),name:tidy(m[2])};
  m=s.match(/^(.+?)\s+[x×]\s*(\d+(?:[.,]\d+)?)$/i);
  if(m)return {qty:Number(m[2].replace(',','.')),name:tidy(m[1])};
  m=s.match(/^(.+?)\s*[-–:]\s*(\d+(?:[.,]\d+)?)$/);
  if(m)return {qty:Number(m[2].replace(',','.')),name:tidy(m[1])};
  if(s.length>90||!/[a-záéíóúñ]{2}/i.test(s))return null;
  return {qty:1,name:s};
 }
 function suggest(name){
  const k=fold(name);if(!k)return null;
  let exact=products.find(p=>fold(p.name)===k);if(exact)return exact;
  const candidates=products.filter(p=>singular(fold(p.name))===singular(k));
  return candidates.length===1?candidates[0]:null;
 }
 function row(qty=1,name=''){
  const box=document.createElement('div');box.className='wa-row';
  const ql=document.createElement('label');ql.textContent='Cantidad';const q=document.createElement('input');q.type='number';q.min='0.01';q.step='any';q.value=String(qty);ql.append(q);
  const nl=document.createElement('label');nl.textContent='Producto';const n=document.createElement('input');n.type='text';n.value=name;n.setAttribute('list','catalogOptions');nl.append(n);
  const del=document.createElement('button');del.type='button';del.textContent='✕';del.setAttribute('aria-label','Eliminar fila');del.onclick=()=>box.remove();
  const hint=document.createElement('div');hint.className='wa-suggestion';
  function refresh(){hint.replaceChildren();const match=suggest(n.value);if(match&&match.name!==n.value){const label=document.createElement('span');label.textContent='¿Usar producto guardado?';const b=document.createElement('button');b.type='button';b.textContent=match.name;b.onclick=()=>{n.value=match.name;refresh();};hint.append(label,b);}}
  n.addEventListener('change',refresh);box.append(ql,nl,del,hint);el('waRows').append(box);refresh();
 }
 el('waPreview').addEventListener('click',()=>{
  if(typeof busy!=='undefined'&&busy)return;
  const text=el('bulk').value;const entries=text.split(/\r?\n/).map(parse).filter(Boolean);
  if(!entries.length){notice('No se detectaron productos. Usa una línea por producto.');return;}
  el('waRows').replaceChildren();entries.forEach(x=>row(x.qty,x.name));el('waReview').hidden=false;
  el('waInfo').textContent=`${entries.length} líneas detectadas. Comprueba cada una, especialmente los productos sin cantidad (se asigna 1).`;
 });
 el('waNewRow').addEventListener('click',()=>row());
 el('waConfirm').addEventListener('click',()=>run(async()=>{
  const rows=[...el('waRows').querySelectorAll('.wa-row')];
  const entries=rows.map(r=>({element:r,name:tidy(r.querySelector('input[type=text]').value),qty:Number(r.querySelector('input[type=number]').value)}));
  if(!entries.length)throw Error('No hay productos para añadir');
  if(entries.some(x=>!x.name||!Number.isFinite(x.qty)||x.qty<=0))throw Error('Revisa los nombres y cantidades antes de guardar');
  if(!confirm(`¿Añadir ${entries.length} líneas a la lista compartida? Los repetidos sumarán cantidades.`))return;
  let done=0;
  try{for(const x of entries){await add(x.name,x.qty);x.element.remove();done++;}await load();el('waInfo').textContent=`✅ ${done} líneas añadidas.`;if(!el('waRows').children.length){el('waReview').hidden=true;el('bulk').value='';}}
  catch(e){await load().catch(()=>{});throw Error(`Se añadieron ${done} de ${entries.length} líneas. Las restantes siguen visibles. ${e.message||e}`);}
 }));
})();
