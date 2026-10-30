(() => {
 if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
 const banner = document.getElementById('updateBanner');
 const button = document.getElementById('updateNow');
 let waitingWorker = null;
 function showUpdate(worker) { waitingWorker = worker; if (banner) banner.hidden = false; }
 let refreshing = false;
 navigator.serviceWorker.addEventListener('controllerchange', () => {
   if (!refreshing) { refreshing = true; location.reload(); }
 });
 button?.addEventListener('click', () => waitingWorker?.postMessage({type:'SKIP_WAITING'}));
 window.addEventListener('load', async () => {
   try {
     const registration = await navigator.serviceWorker.register('./service-worker.js', {updateViaCache:'none'});
     if (registration.waiting && navigator.serviceWorker.controller) showUpdate(registration.waiting);
     registration.addEventListener('updatefound', () => {
       const worker = registration.installing;
       worker?.addEventListener('statechange', () => {
         if (worker.state === 'installed' && navigator.serviceWorker.controller) showUpdate(worker);
       });
     });
     if (document.visibilityState === 'visible') registration.update().catch(()=>{});
     document.addEventListener('visibilitychange', () => {if(document.visibilityState === 'visible') registration.update().catch(()=>{});});
   } catch (error) { console.warn('PWA no disponible:', error); }
 });
})();
