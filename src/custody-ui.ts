let restricted=false

/** Keep world destinations and the account menu usable while game actions are locked. */
export function setCustody(active:boolean){
  restricted=active
  document.body.classList.toggle('in-custody',active)
  if(!active)return
  for(const link of document.querySelectorAll<HTMLAnchorElement>('.masthead a[href]')){
    const url=new URL(link.href)
    if(url.pathname==='/chess/world.html'||(url.pathname==='/chess/lobby.html'&&!url.hash))continue
    link.removeAttribute('href');link.setAttribute('aria-disabled','true')
  }
  document.querySelectorAll<HTMLButtonElement>('.masthead [data-open-notifications]').forEach(button=>button.disabled=true)
  const home=document.querySelector<HTMLFieldSetElement>('#home-controls')
  if(home)home.disabled=true
}

export function custodyHeartbeat(){
  async function tick(){
    try{
      const r=await fetch('/api/custody')
      if(r.ok&&Boolean((await r.json()).custody)!==restricted)location.reload()
    }catch{/* Retry on the next heartbeat. */}
  }
  window.setInterval(tick,12000)
  window.addEventListener('pageshow',e=>{if(e.persisted)void tick()})
}
