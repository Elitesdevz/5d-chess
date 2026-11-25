import {cellPosition,type CustodyView} from './world/arcade.ts'
import {jigsaw} from './jigsaw.ts'

let screen:HTMLDialogElement|undefined,cell:CustodyView|undefined
export function showCustody(status:CustodyView){
  cell=status
  if(!screen){
    document.body.classList.add('in-custody')
    for(const area of document.querySelectorAll<HTMLElement>('.masthead, main:not(.world), .world-chat, #world-pause'))area.inert=true
    if(document.pointerLockElement)document.exitPointerLock()
    for(const d of document.querySelectorAll<HTMLDialogElement>('dialog[open]'))d.close()
    screen=document.createElement('dialog');screen.className='cell-screen';screen.setAttribute('aria-labelledby','cell-title')
    screen.innerHTML='<header><small>MERIDIAN POLICE · CUSTODY</small><h2 id="cell-title"></h2></header><p class="sentence"></p><div class="cell-plan" aria-label="Cell floor plan"><span>Bed</span><span>Toilet</span><button class="cell-table">Jigsaw table</button><i aria-label="Your position">●</i></div><div class="cell-controls"><button data-step="-1,0">Left</button><button data-step="0,-1">Forward</button><button data-step="0,1">Back</button><button data-step="1,0">Right</button></div><section class="cell-game"></section><footer><button data-look>Look around cell</button><button data-logout>Log out</button></footer><p class="cell-error" role="alert"></p>'
    document.body.append(screen)
    const open=document.createElement('button');open.className='cell-reopen';open.textContent='Cell actions'
    document.body.append(open);open.onclick=()=>screen?.showModal()
    screen.oncancel=e=>e.preventDefault()
    screen.showModal()
    const message=(e:unknown)=>{screen!.querySelector('.cell-error')!.textContent=e instanceof Error?e.message:'Action unavailable'}
    screen.querySelector<HTMLButtonElement>('[data-look]')!.onclick=()=>{
      if(document.body.dataset.page==='world')screen?.close()
      else location.replace('/chess/world.html')
    }
    screen.querySelector<HTMLButtonElement>('[data-logout]')!.onclick=async()=>{
      try{const r=await fetch('/api/logout',{method:'POST'});if(!r.ok)throw Error('Log out failed');location.replace('/chess/login.html')}catch(e){message(e)}
    }
    screen.querySelector<HTMLButtonElement>('.cell-table')!.onclick=async()=>{
      const host=screen!.querySelector<HTMLElement>('.cell-game')!
      if(host.childElementCount){host.hidden=!host.hidden;return}
      try{await jigsaw(host)}catch(e){message(e)}
    }
    for(const b of screen.querySelectorAll<HTMLButtonElement>('[data-step]'))b.onclick=async()=>{
      const [dx,dz]=b.dataset.step!.split(',').map(Number)
      try{
        const r=await fetch('/api/custody/position',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({x:cell!.x+dx*.4,z:cell!.z+dz*.4,yaw:Math.atan2(-dx,-dz)})})
        if(!r.ok)throw Error('Cell movement unavailable')
        showCustody((await r.json()).custody)
      }catch(e){message(e)}
    }
  }
  screen.querySelector('h2')!.textContent=status.name
  screen.querySelector('.sentence')!.textContent=status.ends?'Release '+new Date(status.ends).toLocaleString():status.noRelease?'Permanent custody · moderation release only':'Permanent custody · complete the 1,000-piece jigsaw for release'
  screen.querySelector<HTMLElement>('.cell-table')!.hidden=status.ends!==null
  const center=cellPosition(status.cell),dot=screen.querySelector<HTMLElement>('.cell-plan i')!
  dot.style.left=(50+(status.x-center.x)*23)+'%';dot.style.top=(50+(status.z-center.z)*30)+'%'
}
export function openCellTable(){
  if(!screen||cell?.ends!==null)return
  if(!screen.open)screen.showModal()
  if(!screen.querySelector('.cell-game')?.childElementCount)screen.querySelector<HTMLButtonElement>('.cell-table')?.click()
  else screen.querySelector<HTMLElement>('.cell-game')!.hidden=false
}
export function custodyHeartbeat(){
  async function tick(){
    try{
      const r=await fetch('/api/custody')
      if(!r.ok)return
      const {custody}=await r.json()
      if(custody)showCustody(custody)
      else if(cell)location.replace('/chess/world.html')
    }catch{/* Reconnect on the next heartbeat. */}
  }
  window.setInterval(tick,12000)
  window.addEventListener('pageshow',e=>{if(e.persisted)void tick()})
}
