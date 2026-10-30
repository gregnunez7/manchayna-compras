/* Solo recursos de la interfaz: los datos de Supabase nunca se almacenan aquí. */
const CACHE = 'manchayna-shell-v24-2';
const SHELL = ['./','./index.html','./style.css','./app.js','./ocr.js','./import-whatsapp.js','./pwa.js','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL))); });
self.addEventListener('activate', event => { event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith('manchayna-shell-')&&k!==CACHE).map(k=>caches.delete(k)));await self.clients.claim();})()); });
self.addEventListener('message', event=>{if(event.data?.type==='SKIP_WAITING') self.skipWaiting();});
self.addEventListener('fetch', event=>{
 const request=event.request;
 if(request.method!=='GET'||new URL(request.url).origin!==self.location.origin) return;
 const path=new URL(request.url).pathname;
 if(path.endsWith('/supabase-config.js')) return; // Configuración: siempre de red
 event.respondWith((async()=>{
  try { const response=await fetch(request); if(response.ok){const cache=await caches.open(CACHE);cache.put(request,response.clone());}return response; }
  catch(error){const cached=await caches.match(request);if(cached)return cached;if(request.mode==='navigate'){const fallback=await caches.match('./index.html');if(fallback)return fallback;}throw error;}
 })());
});
