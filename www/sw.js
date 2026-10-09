// Conti Chiari — funziona offline: tiene in cache i file dell'app
const CACHE='conti-chiari-v12';
const FILES=['./','index.html','i18n.js','sync.js','feedback.js','lib/secp256k1.js','lib/qrcode.js','lib/jsQR.js','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png','icons/apple-touch-icon.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==CACHE).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  // rete prima (per ricevere aggiornamenti), cache se offline
  e.respondWith(fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match('index.html'))));
});

// tocco su una notifica: riporta in primo piano l'app e apre la chat giusta
self.addEventListener('notificationclick',e=>{
  e.notification.close();
  const chan=e.notification.data&&e.notification.data.chan;
  e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
    const c=list[0];
    if(c){c.postMessage({openChat:chan});return c.focus()}
    return self.clients.openWindow('./'+(chan?'#chat='+encodeURIComponent(chan):''));
  }));
});
