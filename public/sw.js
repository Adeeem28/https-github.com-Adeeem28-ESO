const CACHE='eso-shell-v621';
const CORE=['/','/manifest.webmanifest','/icon-192.png','/icon-512.png','/eso-shield.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).catch(()=>{}));self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('eso-shell-')&&k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim();});
// Never cache user data, audit responses or signed Storage URLs across sessions.
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
 const staticAsset=CORE.includes(url.pathname)||url.pathname.startsWith('/_next/static/');
 if(!staticAsset)return;
 event.respondWith(fetch(event.request).then(response=>{
  if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(c=>c.put(event.request,copy)).catch(()=>{}));}
  return response;
 }).catch(async()=>{const cached=await caches.match(event.request);return cached||Response.error();}));
});
self.addEventListener('push',event=>{let d={};try{d=event.data?.json()||{}}catch{d={body:event.data?.text()||''}};event.waitUntil(self.registration.showNotification(d.title||'ESO Notification',{body:d.body||'',icon:'/icon-192.png',badge:'/icon-192.png',tag:d.tag||'eso',data:{url:d.url||'/'},renotify:true,vibrate:[180,80,180]}));});
self.addEventListener('notificationclick',event=>{event.notification.close();const url=new URL(event.notification.data?.url||'/',self.location.origin).href;event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{for(const c of list){if('focus'in c){c.navigate(url);return c.focus()}}return clients.openWindow(url)}));});
