// Only the public health probe decides whether to boot a normal page.
export async function status(){
  try {
    const response=await fetch('/api/health',{cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(4000)})
    if(response.ok){
      const health=await response.json()
      if(health.ok===true)return health.updating===true?'updating':'ready'
    }
  } catch {}
  return 'offline'
}

export function watch(check){
  let running=false
  async function run(){
    if(running)return
    running=true
    try {await check(await status())} finally {running=false}
  }
  window.addEventListener('online',run)
  window.addEventListener('offline',run)
  window.addEventListener('pageshow',event=>{if(event.persisted)void run()})
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)void run()})
  setInterval(()=>{if(!document.hidden)void run()},15000)
  void run()
  return run
}

if('serviceWorker' in navigator)navigator.serviceWorker.register('/chess/update-worker.js').catch(()=>{})
const entry=document.querySelector('script[data-entry]')?.dataset.entry
if(entry){
  let started=false
  watch(async state=>{
    if(state!=='ready'){
      const back=location.pathname+location.search+location.hash
      location.replace('/chess/update.html#'+encodeURIComponent(back))
    } else if(!started){
      started=true
      await import(entry)
    }
  })
}
