import {api,ApiError,initShell,renderAccount} from '../shell.ts'
import {icon} from '../icons.ts'
import {avatarArt} from '../cosmetic-art.ts'
import {casinoCoins,grossMultiplier,MAX_CASINO_STAKE,pocketColor,ROULETTE_ORDER,winProbability,type CasinoView,type RouletteChoice} from '../casino-model.ts'
import {COUCH_SEATS,HALL_CAPACITY,LOUNGES,TABLES,type HallTable,type HallView,type Position} from '../roulette-hall-model.ts'
import {rules} from './casino-panels.ts'
import {rouletteWheel} from './roulette.ts'
import type {HallStage} from './hall-stage.ts'

const root=document.getElementById('casino-root')!
const el=<E extends HTMLElement=HTMLElement>(selector:string)=>root.querySelector<E>(selector)!
const outside=[['low','1–18'],['even','Even'],['white','Ivory'],['black','Obsidian'],['odd','Odd'],['high','19–36']] as const
const choiceTitle=(choice:RouletteChoice)=>typeof choice==='number'?choice===0?'Rift zero':String(choice):outside.find(o=>o[0]===choice)![1]
const number=(n:number)=>casinoCoins(n)
const pocket=(n:number)=>`<span class="hall-pocket is-${pocketColor(n)}">${n}</span>`
const money=(n:number)=>`${n<0?'−':'+'}${number(Math.abs(n))}`
const escape=(text:string)=>text.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]!)
const chips=[1,25,100,500]

root.innerHTML=`
  <section class="hall" data-mode="walking" aria-label="The Royal Salon">
    <canvas id="hall-canvas" tabindex="0" aria-label="Roulette hall. Walk with WASD or arrow keys. Drag to look. Press E near a table to sit."></canvas>
    <div class="hall-fallback" hidden>${rouletteWheel()}</div>
    <div class="hall-shade"></div>
    <div class="hall-projected">${TABLES.map((t,i)=>`<button type="button" class="hall-world-table" data-in-world="${i}" data-sit="${i}" aria-label="Take a seat at ${t.name}" hidden><i></i>${t.name}</button>`).join('')}${LOUNGES.map((site,i)=>`<button type="button" class="hall-world-table hall-world-lounge" data-in-lounge="${i}" data-couch="${i}" aria-label="Sit on ${site.name}" hidden><i></i>Sit on couch</button>`).join('')}</div>
    <div class="hall-title"><div class="hall-monogram">${icon('king')}</div><div><p>5D CHESS CASINO</p><h1>The Royal Salon</h1><small id="hall-room-status">Connecting to the salon…</small></div></div>
    <nav class="hall-links" aria-label="Roulette tools"><button data-dialog="hall-rules" type="button" aria-label="Rules">${icon('info')}<span>Rules</span></button><button data-dialog="hall-ledger" type="button" aria-label="History">${icon('clock')}<span>History</span></button></nav>
    <div class="hall-map" aria-hidden="true"><div class="hall-map-floor">${TABLES.map((t,i)=>`<i style="--site:${t.color};left:${50+t.x/22*100}%;top:${(t.z+6.5)/15*100}%">${i+1}</i>`).join('')}<b id="hall-map-you"></b></div><span><i></i> YOU</span></div>
    <div class="hall-walk" role="group" aria-label="Walk around">
      <button type="button" data-walk="w" aria-label="Walk forward">↑</button><button type="button" data-walk="a" aria-label="Walk left">←</button><button type="button" data-walk="s" aria-label="Walk back">↓</button><button type="button" data-walk="d" aria-label="Walk right">→</button>
    </div>
    <p class="hall-walk-hint"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> Walk <i></i> Drag to look <i></i> <kbd>E</kbd> Sit nearby</p>
    <aside class="hall-directory hall-glass" aria-label="Roulette tables">
      <div class="hall-panel-heading"><div><small>THE FLOOR</small><h2>Find a seat</h2></div><button type="button" id="hall-directory-toggle" aria-label="Toggle table list" aria-expanded="true">⌄</button></div>
      <div class="hall-directory-list">${TABLES.map((t,i)=>`<button type="button" class="hall-table-link" data-sit="${i}" style="--table-color:${t.color}" disabled><span class="hall-table-medallion">${i+1}</span><span><strong>${t.name}</strong><small data-table-meta="${i}">Waiting for the hall</small></span><span aria-hidden="true">›</span></button>`).join('')}</div>
      <details class="hall-lounge-list"><summary>Lounge seating</summary>
        ${LOUNGES.map((site,i)=>`<button type="button" data-couch="${i}" disabled>${site.name}<small></small></button>`).join('')}
      </details>
      <div class="hall-roster" id="hall-roster"></div>
    </aside>
    <div class="hall-lounge-card hall-glass" hidden><div><small>LOUNGE</small><strong id="hall-couch-name"></strong></div><button type="button" id="hall-couch-stand">Stand up</button></div>
    <aside class="hall-betting hall-glass" aria-label="Table controls" hidden>
      <div class="hall-panel-heading"><div><small id="hall-table-index"></small><h2 id="hall-table-title"></h2></div><button type="button" id="hall-stand">Stand up</button></div>
      <div class="hall-round-info"><span id="hall-round-status"></span><strong id="hall-timer"></strong></div>
      <div class="hall-progress"><i></i></div>
      <ol class="hall-seats" aria-label="Seated players"></ol>
      <div class="hall-recent" aria-label="Recent table pockets"></div>
      <div id="hall-bet-state"></div>
      <form id="hall-wager" class="hall-wager">
        <div class="hall-wager-top"><strong id="hall-selection">Ivory</strong><button id="hall-mat-toggle" type="button" aria-controls="hall-mat" aria-expanded="true">Betting mat <span aria-hidden="true">⌄</span></button></div>
        <div id="hall-mat" class="hall-mat">
          <div class="hall-number-mat" role="group" aria-label="Pick a pocket">
            <button type="button" class="hall-pocket hall-zero is-rift" data-choice="0" aria-label="Rift zero">0</button>
            ${Array.from({length:36},(_,i)=>`<button type="button" class="hall-pocket is-${pocketColor(i+1)}" data-choice="${i+1}" aria-label="Bet on ${i+1}">${i+1}</button>`).join('')}
          </div>
          <div class="hall-outside" role="group" aria-label="Outside bets">${outside.map(([key,label])=>`<button type="button" data-choice="${key}" class="is-${key}">${label}</button>`).join('')}</div>
        </div>
        <div class="hall-stake"><label for="hall-amount">Stake</label><div class="hall-input">${icon('coin')}<input type="number" id="hall-amount" min="1" max="${MAX_CASINO_STAKE}" step="1" value="25" required inputmode="numeric"></div><div class="hall-chips" aria-label="Set stake">${chips.map(c=>`<button type="button" data-stake="${c}" aria-label="Stake ${c} coins">${c}</button>`).join('')}</div></div>
        <div class="hall-submit-row"><div><span id="hall-chance"></span><strong id="hall-return"></strong></div><button type="submit" id="hall-lock">${icon('target')} Lock bet</button></div>
      </form>
    </aside>
    <section id="hall-result" class="hall-result hall-glass" aria-live="polite" hidden></section>
    <p id="hall-error" class="hall-error" role="alert" hidden></p>
    <dialog id="hall-rules" class="hall-dialog"><form method="dialog"><button aria-label="Close rules">×</button></form><h2>Roulette rules</h2><p>Take a seat and lock one bet. The wheel spins when everyone seated has bet, or after one minute if the table has a wager. A locked stake is reserved and settles even if you disconnect.</p>${rules('roulette').replace('<details','<details open')}</dialog>
    <dialog id="hall-ledger" class="hall-dialog"><form method="dialog"><button aria-label="Close history">×</button></form><h2>Your roulette history</h2><div id="hall-history"></div></dialog>
  </section>`

let stage:HallStage|undefined,view:HallView|undefined
let activePoll:Promise<void>|undefined
let sendBusy=false,connected=false,closed=false,clockDelta=0
let choice:RouletteChoice='white',walletShown:number|undefined,errorTimer=0
let pending:{round:string;requestId:string;choice:RouletteChoice;stake:number}|undefined
let displayResult=''
let surfaceKey=''
const amount=el<HTMLInputElement>('#hall-amount')
const hall=el('.hall')
const noWebGL=el('.hall-fallback')
const fallbackBall=document.createElement('i')
fallbackBall.className='hall-fallback-ball'
noWebGL.append(fallbackBall)
const preferStatic=matchMedia('(prefers-reduced-motion: reduce)')
const stateText=(t:HallTable)=>({idle:'Open',betting:'Betting',spin:'Spinning',result:'Result'})[t.phase]
const selection=()=>view?.you.chair?view.tables[view.you.chair.table]:undefined
const isLocked=()=>{const seat=view?.you.chair;return seat?Boolean(view?.tables[seat.table].seats[seat.index]?.locked):false}
const announce=(message:string)=>{
  el('#hall-error').textContent=message;el('#hall-error').hidden=false
  window.clearTimeout(errorTimer);errorTimer=window.setTimeout(()=>el('#hall-error').hidden=true,5200)
}
function showSelection(){
  const stake=Number(amount.value)||0,multiplier=grossMultiplier('roulette',choice,view?.houseEdge),gross=stake*multiplier
  const percent=winProbability('roulette',choice)*100
  el('#hall-selection').textContent=choiceTitle(choice)
  el('#hall-chance').textContent=`${Number(percent.toFixed(2))}% chance`
  el('#hall-return').textContent=`${number(gross)} coins if you win`
  for(const b of root.querySelectorAll<HTMLButtonElement>('[data-choice]'))b.setAttribute('aria-pressed',String(b.dataset.choice===String(choice)))
  for(const b of root.querySelectorAll<HTMLButtonElement>('[data-stake]'))b.setAttribute('aria-pressed',String(Number(b.dataset.stake)===stake))
  stage?.select(choice)
}
function accept(response:HallView,start:number){
  clockDelta=response.now-(start+Date.now())/2
  view=response
  stage?.set(response,clockDelta)
  if(pending&&(pending.round!==selection()?.round||isLocked()))pending=undefined
}
async function presence(){
  const start=Date.now(),position:Position|undefined=stage?.position
  // Sampled movement is presence, not a click/API telemetry event.
  const response=await fetch('/api/roulette-hall/presence',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({room:view?.room,...position}),signal:AbortSignal.timeout(5500)})
  if(response.status===401)throw new ApiError('Log in to enter the salon.',401)
  if(!response.ok)throw new Error('Reconnecting to the salon…')
  accept(await response.json() as HallView,start)
}
async function action(action:'sit'|'stand'|'bet'|'lounge',data:object){
  if(sendBusy||!connected)return
  sendBusy=true
  updateUI()
  try{
    await activePoll
    if(!connected)throw new Error('Reconnecting to the salon…')
    const start=Date.now()
    accept(await api<HallView>('/roulette-hall/'+action,data),start)
  }catch(error){
    if(error instanceof ApiError&&error.status>=400&&error.status<500&&action==='bet')pending=undefined
    announce(error instanceof Error?error.message:'The table could not confirm that action.')
  }finally{sendBusy=false;updateUI()}
}
function updateUI(){
  if(!view)return
  const seat=view.you.chair,couch=view.you.lounge,table=selection()
  const seated=Boolean(seat&&table)
  hall.dataset.mode=seated?table!.phase:couch?'lounge':'walking'
  el('.hall-betting').hidden=!seated
  el('.hall-directory').hidden=seated||Boolean(couch)
  el('.hall-lounge-card').hidden=!couch
  if(couch)el('#hall-couch-name').textContent=LOUNGES[couch.couch].name
  el<HTMLButtonElement>('#hall-couch-stand').disabled=sendBusy||!connected
  el('.hall-walk').hidden=seated||Boolean(couch)||!stage
  el('.hall-walk-hint').hidden=seated||Boolean(couch)||!stage
  el('.hall-map').hidden=!stage
  el('#hall-room-status').textContent=connected?`Room ${view.room} · ${view.players.filter(p=>p.online).length}/${HALL_CAPACITY} players`:'Reconnecting…'
  const roster=view.players.filter(p=>p.online&&p.name!==view?.you.name)
  const rosterKey=JSON.stringify(roster.map(p=>[p.name,p.avatar]))
  const rosterEl=el('#hall-roster')
  if(rosterEl.dataset.key!==rosterKey){
    rosterEl.dataset.key=rosterKey
    rosterEl.innerHTML=roster.length?`<small>IN THIS ROOM</small><div>${roster.map(p=>`<span class="hall-roster-avatar" title="${escape(p.name)}" aria-label="${escape(p.name)}">${avatarArt(p.avatar)}</span>`).join('')}</div>`:''
  }
  for(const [i,status] of view.tables.entries()){
    const players=status.seats.filter(Boolean).length
    el(`[data-table-meta="${i}"]`).textContent=`${players}/4 seats · ${stateText(status)}`
    for(const b of root.querySelectorAll<HTMLButtonElement>(`[data-sit="${i}"]`))b.disabled=sendBusy||!connected||Boolean(seated)||players===4||status.phase==='spin'||status.phase==='result'
  }

  for(const b of root.querySelectorAll<HTMLButtonElement>('[data-couch]')){
    const occupied=view.players.filter(p=>p.lounge?.couch===Number(b.dataset.couch)).length
    b.disabled=sendBusy||!connected||seated||Boolean(couch)||occupied>=COUCH_SEATS.length
    const count=b.querySelector('small')
    if(count)count.textContent=`${occupied}/${COUCH_SEATS.length}`
  }
  const wager=el<HTMLFormElement>('#hall-wager'),result=el('#hall-result')
  if(!seat||!table){result.hidden=true;surfaceKey='';displayResult='';return}
  const config=TABLES[seat.table],locked=isLocked()
  el('#hall-table-index').textContent=`TABLE 0${seat.table+1}`
  el('#hall-table-title').textContent=config.name
  el<HTMLButtonElement>('#hall-stand').disabled=!connected||sendBusy||(locked&&table.phase==='betting')||table.phase==='spin'
  const seatKey=JSON.stringify(table.seats)
  if(seatKey!==surfaceKey){
    el('.hall-seats').innerHTML=table.seats.map(p=>p?`<li class="${p.locked?'is-ready':''}"><span class="hall-seat-avatar">${avatarArt(p.avatar)}</span><span><b>${escape(p.name)}</b><small>${!p.online?'Away':p.locked?'Locked':'Choosing'}</small></span></li>`:'<li class="is-empty"><i></i><span><b>Open</b></span></li>').join('')
    surfaceKey=seatKey
  }
  const recent=table.recent.join(',')
  if(el('.hall-recent').dataset.key!==recent){
    el('.hall-recent').dataset.key=recent
    el('.hall-recent').innerHTML=table.recent.length?`<small>LAST SPINS</small>${table.recent.map(pocket).join('')}`:''
  }
  wager.hidden=locked||table.phase!=='betting'
  el('#hall-bet-state').textContent=locked&&table.phase==='betting'?'Your bet is locked. Waiting for the table.':''
  el<HTMLButtonElement>('#hall-lock').disabled=!connected||sendBusy||locked||table.phase!=='betting'
  if(pending){choice=pending.choice;amount.value=String(pending.stake);showSelection()}
  root.querySelectorAll<HTMLButtonElement|HTMLInputElement>('[data-stake],[data-choice],#hall-amount').forEach(b=>b.disabled=Boolean(pending))
  if(table.phase==='result'&&table.spin){
    const my=view.receipt,prizes=table.prizes??[]
    if(displayResult!==table.round){
      displayResult=table.round
      result.dataset.won=String(Boolean(my?.won))
      result.innerHTML=`<div class="hall-result-title">${pocket(table.spin.pocket)}<div><small>${my?.won?'YOUR BET PAID':my?'YOUR RESULT':'THE TABLE RESULT'}</small><h2>${my?`${money(my.net)} coins`:table.spin.pocket===0?'Rift zero':`Pocket ${table.spin.pocket}`}</h2></div></div><ul>${prizes.map(p=>`<li class="${p.won?'winner':''}"><span>${escape(p.name)}</span><strong>${money(p.net)}</strong></li>`).join('')}</ul>`
      result.hidden=false
    }
  }else{
    result.hidden=true
    displayResult=''
  }
  updateClock()
}
function updateClock(){
  if(!view)return
  const local=stage?.position??view.you,map=el('#hall-map-you')
  map.style.left=(50+local.x/22*100)+'%'
  map.style.top=((local.z+6.5)/15*100)+'%'
  const table=selection()
  if(!table)return
  const remaining=Math.max(0,Math.ceil((table.until-Date.now()-clockDelta)/1000))
  el('#hall-round-status').textContent=table.phase==='spin'?'Bets closed · Wheel spinning':table.phase==='result'?'Round settled':table.phase==='betting'?'Bets open':'Waiting for bets'
  el('#hall-timer').textContent=table.phase==='betting'?`${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}`:table.phase==='result'&&table.spin?choiceTitle(table.spin.pocket):'—'
  el('.hall-progress i').style.width=(table.phase==='betting'?Math.min(100,remaining/60*100):table.phase==='spin'?100:0)+'%'
  if(stage||!table.spin)return
  const {pocket:draw,started,ends}=table.spin
  const p=preferStatic.matches?1:Math.max(0,Math.min(1,(Date.now()+clockDelta-started)/(ends-started)))
  const step=360/37,rot=-(ROULETTE_ORDER.indexOf(draw)+.5)*step+360*6
  const rotor=noWebGL.querySelector<SVGGElement>('.roulette-rotor')!
  rotor.style.transformOrigin='50% 50%'
  rotor.style.transform=`rotate(${rot*(1-(1-p)**2.6)}deg)`
  fallbackBall.style.transform=`rotate(${-360*8*(1-(1-p)**3)}deg) translateY(${-135+25*p}px)`
}
function login(){
  closed=true
  hall.dataset.mode='blocked'
  el('#hall-room-status').innerHTML='<a href="/chess/login.html">Log in to enter the salon ↗</a>'
}
async function start(){
  const auth=await initShell()
  if(!auth?.user){login();return}
  const profile=auth.profile
  try{
    const {HallStage}=await import('./hall-stage.ts')
    stage=new HallStage(el<HTMLCanvasElement>('#hall-canvas'),el('.hall-projected'),pick)
  }catch{
    noWebGL.hidden=false
    hall.classList.add('is-flat')
  }
  el('.hall').addEventListener('webglcontextlost',event=>{event.preventDefault();noWebGL.hidden=false;stage=undefined;hall.classList.add('is-flat')},true)
  const heartbeat=async()=>{
    if(closed)return
    if(!sendBusy){
      // Serialize movement polls with seat and wager actions so slow responses cannot rewind the UI.
      activePoll=(async()=>{
        try{
          await presence()
          connected=true
          if(view&&profile&&walletShown!==view.coins&&selection()?.phase!=='spin'){
            walletShown=view.coins
            renderAccount({...profile,coins:view.coins})
          }
        }catch(error){
          connected=false
          if(error instanceof ApiError&&error.status===401)login()
        }
      })()
      await activePoll
      activePoll=undefined
      if(!closed)updateUI()
    }
    window.setTimeout(heartbeat,document.hidden?3500:stage?.moving?310:stage?780:1150)
  }
  window.addEventListener('pagehide',e=>{if(!e.persisted)closed=true})
  void heartbeat()
  window.setInterval(updateClock,80)
}
root.querySelectorAll<HTMLButtonElement>('[data-sit]').forEach(b=>b.onclick=()=>void action('sit',{table:Number(b.dataset.sit)}))
root.querySelectorAll<HTMLButtonElement>('[data-couch]').forEach(b=>b.onclick=()=>void action('lounge',{couch:Number(b.dataset.couch)}))
el<HTMLButtonElement>('#hall-couch-stand').onclick=()=>void action('stand',{})
el<HTMLButtonElement>('#hall-stand').onclick=()=>void action('stand',{})
el<HTMLButtonElement>('#hall-directory-toggle').onclick=e=>{
  const button=e.currentTarget as HTMLButtonElement,open=button.getAttribute('aria-expanded')!=='true'
  button.setAttribute('aria-expanded',String(open));el('.hall-directory').classList.toggle('is-collapsed',!open)
}
el<HTMLButtonElement>('#hall-mat-toggle').onclick=e=>{
  const button=e.currentTarget as HTMLButtonElement
  el('#hall-mat').hidden=!el('#hall-mat').hidden;button.setAttribute('aria-expanded',String(!el('#hall-mat').hidden))
}
function pick(value:RouletteChoice){
  if(pending||isLocked()||selection()?.phase!=='betting')return
  choice=value
  showSelection()
}
root.querySelectorAll<HTMLButtonElement>('[data-choice]').forEach(b=>b.onclick=()=>{
  const value=b.dataset.choice!
  pick(/^\d+$/.test(value)?Number(value):value as RouletteChoice)
})
root.querySelectorAll<HTMLButtonElement>('[data-stake]').forEach(b=>b.onclick=()=>{if(!pending){amount.value=b.dataset.stake!;showSelection()}})
amount.addEventListener('input',showSelection)
el<HTMLFormElement>('#hall-wager').onsubmit=e=>{
  e.preventDefault()
  const table=selection()
  if(!table||sendBusy||!connected)return
  const stake=Number(amount.value)
  if(view?.open===false){announce('New wagers are paused.');return}
  if(!Number.isSafeInteger(stake)||stake<1||stake>(view?.maxStake??MAX_CASINO_STAKE)){announce('Choose a whole coin stake.');return}
  if(!pending&&stake>(view?.coins??0)){announce('Not enough coins for that stake.');return}
  pending??={round:table.round,requestId:crypto.randomUUID(),choice,stake}
  void action('bet',pending)
}
root.querySelectorAll<HTMLButtonElement>('[data-dialog]').forEach(b=>b.onclick=async()=>{
  const dialog=el<HTMLDialogElement>('#'+b.dataset.dialog)
  dialog.showModal()
  if(dialog.id==='hall-ledger'){
    const host=el('#hall-history')
    host.textContent='Loading…'
    try{
      const data=await api<CasinoView>('/casino')
      const rounds=data.recent.filter(r=>r.game==='roulette')
      host.innerHTML=rounds.map(r=>`<div class="hall-ledger-row">${pocket(r.result)}<span><b>${choiceTitle(r.choice)}</b><small>${number(r.stake)} coins · ${new Date(r.created).toLocaleString()}</small></span><strong class="${r.won?'winner':''}">${money(r.net)}</strong></div>`).join('')||'<p>No roulette wagers yet.</p>'
    }catch(error){host.textContent=error instanceof Error?error.message:'Could not load history.'}
  }
})
window.addEventListener('keydown',e=>{
  if(e.key.toLowerCase()!=='e'||e.repeat||document.querySelector('dialog[open]')||document.activeElement?.matches('input'))return
  if(view?.you.chair||view?.you.lounge){el<HTMLButtonElement>(view.you.chair?'#hall-stand':'#hall-couch-stand').click();return}
  const pos=stage?.position
  if(!pos)return
  const couch=LOUNGES.map((site,i)=>({i,d:Math.hypot(pos.x-site.x,pos.z-site.z)})).sort((a,b)=>a.d-b.d)[0]
  if(couch.d<2.1){el<HTMLButtonElement>(`.hall-lounge-list [data-couch="${couch.i}"]`).click();return}
  const nearby=TABLES.map((t,i)=>({i,d:Math.hypot(pos.x-t.x,pos.z-t.z-1.2)})).sort((a,b)=>a.d-b.d)[0]
  if(nearby.d<3.1)el<HTMLButtonElement>(`.hall-table-link[data-sit="${nearby.i}"]`).click()
})
showSelection()
void start()
