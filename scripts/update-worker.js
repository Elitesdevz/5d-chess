// CACHE_NAME and FILES are emitted from the exact practice kit at build time.
self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE_NAME)
    await cache.addAll(FILES.map(path=>new Request(path,{cache:'reload'})))
    await self.skipWaiting()
  })())
})
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    for(const key of await caches.keys())if(key.startsWith('5d-update-')&&key!==CACHE_NAME)await caches.delete(key)
    await self.clients.claim()
  })())
})
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url)
  if(request.method!=='GET'||url.origin!==self.location.origin||!url.pathname.startsWith('/chess/'))return
  const navigation=request.mode==='navigate'
  if(!navigation&&!FILES.includes(url.pathname))return
  event.respondWith((async()=>{
    let response
    try {
      response=await fetch(request,{signal:AbortSignal.any([request.signal,AbortSignal.timeout(8000)])})
      if(response.status<500)return response
    } catch {}
    const cache=await caches.open(CACHE_NAME)
    const key=navigation&&url.pathname!=='/chess/practice.html'?'/chess/update.html':url.pathname
    return await cache.match(key)??response??Response.error()
  })())
})
