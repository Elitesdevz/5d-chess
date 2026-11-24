import {RestaurantUI} from './restaurant-ui.ts'
import {api,ApiError,getSession,initShell,renderAccount} from '../shell.ts'
import type {Profile} from '../account-model.ts'
import {casinoCoins,grossMultiplier,pocketColor,MAX_CASINO_STAKE,type CasinoView,type RouletteChoice} from '../casino-model.ts'
import {BNK,CAS,isEquity,type StockView,type PricePoint} from '../stock-model.ts'
import {DICE_TABLE_INDEX,DESTINATIONS,WORLD_TABLES,type Destination,type WorldAction,type WorldView} from './model.ts'
import {CityServices,coins,safeText} from './services.ts'
import type {CityStage} from './stage.ts'

const cast=<E extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as E
const host=cast('city-world'),connection=cast('world-connection'),panel=cast('world-table'),dialog=cast<HTMLDialogElement>('world-service')
const pause=cast('world-pause'),chatForm=cast<HTMLFormElement>('world-chat-form'),chatInput=chatForm.querySelector('input')!
let paused=false,chatting=false
function syncControls(){stage?.lock(paused||chatting||dialog.open)}
function showPause(){
  if(closed||paused)return
  paused=true;pause.hidden=false
  if(chatting)chatInput.blur()
  if(dialog.open){dialog.close();shownService=''}
  syncControls()
}
function resume(){paused=false;pause.hidden=true;syncControls();stage?.resumeMouse()}
cast('world-continue').onclick=resume
cast('world-pause-toggle').onclick=()=>paused?resume():showPause()
document.addEventListener('visibilitychange',()=>{if(document.hidden)showPause()})
window.addEventListener('blur',showPause)
let chatKey=''
function renderChat(next:WorldView){
  const key=next.id+':'+(next.chat?.at(-1)?.id??0)
  if(key===chatKey)return
  chatKey=key
  const list=cast('world-messages')
  list.innerHTML=(next.chat??[]).slice(-8).map(m=>`<li><b>${safeText(m.name)}</b> ${safeText(m.text)}</li>`).join('')
  list.scrollTop=list.scrollHeight
}
chatInput.onfocus=()=>{chatting=true;syncControls()}
chatInput.onblur=()=>{chatting=false;syncControls()}
chatForm.onsubmit=async e=>{
  e.preventDefault()
  const text=chatInput.value.trim()
  if(!text||performing)return
  chatInput.blur();stage?.resumeMouse()
  try{await action('chat',{text});if(chatInput.value.trim()===text)chatInput.value=''}catch{}
}
let restaurant:RestaurantUI|undefined
let stage:CityStage|undefined,services:CityServices|undefined,view:WorldView|undefined,profile:Profile|undefined
let offset=0,refreshing:Promise<void>|undefined,performing=false,closed=false,errorTimer=0
let viewKey='',shownService='',lastFloor='';let closeAfterFloor=false
let stake=25,choice:RouletteChoice='white',activeTable=-1,tableKey=''
let pending:{round:string;requestId:string;stake:number;choice:RouletteChoice}|undefined
const options={white:'Ivory',black:'Obsidian',even:'Even',odd:'Odd',low:'1–18',high:'19–36'} as const
const title=(n:RouletteChoice)=>typeof n==='number'?String(n):options[n]
const like=(to:string):to is Destination=>Object.hasOwn(DESTINATIONS,to)
function showError(text:string){
  const p=cast('world-error');p.textContent=text;p.hidden=false
  clearTimeout(errorTimer);errorTimer=window.setTimeout(()=>p.hidden=true,4800)
}
function setCoins(coins:number){
  if(profile&&profile.coins!==coins){profile={...profile,coins};renderAccount(profile)}
}
const seated=()=>view?.you.chair
function tableStatus(){
  const chair=seated(),table=chair&&view?.hall?.tables[chair.table]
  if(!table)return
  const left=Math.max(0,Math.ceil((table.until-Date.now()-offset)/1000))
  const status=panel.querySelector<HTMLElement>('[data-round-clock]')
  if(status)status.textContent=table.phase==='betting'?left+'s':table.phase==='spin'?'In motion':table.phase==='result'?'Round settled':'Waiting'
}
function updateSelection(){
  const chair=seated()
  if(!chair)return
  panel.querySelectorAll<HTMLButtonElement>('[data-face]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.face===String(choice))))
  const gross=stake*grossMultiplier(chair.table===DICE_TABLE_INDEX?'dice':'roulette',choice,view?.hall?.houseEdge)
  const line=panel.querySelector('[data-payout]')
  if(line)line.textContent=view?.hall?.open===false?'New wagers are paused':Number.isSafeInteger(stake)&&stake>0?coins(gross)+' if you win':'Choose a whole coin amount'
  const lock=panel.querySelector<HTMLButtonElement>('[data-lock]')
  if(lock)lock.disabled=view?.hall?.open===false||performing||!Number.isSafeInteger(stake)||stake<1||stake>(view?.hall?.maxStake??MAX_CASINO_STAKE)||stake>(view?.coins??0)
}
function renderTable(){
  if(!view)return
  const chair=view.you.chair,table=chair&&view.hall?.tables[chair.table]
  panel.hidden=!chair&&!view.you.lounge
  if(!chair||!table){
    if(view.you.lounge&&tableKey!=='lounge'){panel.innerHTML='<div class="world-table-head"><h2>Lounge</h2><button type="button" data-stand>Stand up</button></div>';tableKey='lounge'}
    else if(!view.you.lounge)tableKey=''
    activeTable=-1;pending=undefined
    return
  }
  const dice=chair.table===DICE_TABLE_INDEX
  if(activeTable!==chair.table){choice=dice?1:'white';activeTable=chair.table}
  const locked=Boolean(table.seats[chair.index]?.locked)
  if(pending&&(pending.round!==table.round||locked))pending=undefined
  const key=JSON.stringify([chair.table,table.round,table.phase,locked,table.prizes,table.wagers,view.hall?.maxStake,view.hall?.open])
  if(key!==tableKey){
    tableKey=key
    const faces=dice?Array.from({length:6},(_,i)=>i+1):Array.from({length:37},(_,i)=>i)
    const mat=`<div class="world-bet-numbers ${dice?'dice-numbers':''}" role="group" aria-label="${dice?'Dice faces':'Roulette pockets'}">${faces.map(n=>`<button type="button" data-face="${n}" class="${dice?'':pocketColor(n)}" aria-label="${dice?'Face ':'Pocket '}${n}">${n}</button>`).join('')}</div>${
      dice?'':`<div class="world-bet-outside">${Object.entries(options).map(([value,label])=>`<button type="button" data-face="${value}">${label}</button>`).join('')}</div>`
    }`
    panel.innerHTML=`<div class="world-table-head"><div><small>${dice?'PUBLIC DICE':'ROULETTE'} · <span data-round-clock></span></small><h2>${WORLD_TABLES[chair.table].name}</h2></div><button type="button" data-stand ${table.phase==='spin'||locked&&table.phase==='betting'?'disabled':''}>Stand up</button></div>
      <ul class="world-seats">${table.seats.map(()=>'<li></li>').join('')}</ul>
      ${table.phase==='betting'&&!locked?`<form class="world-wager">${mat}<div class="world-wager-row"><label>Stake<input type="number" min="1" max="${view.hall?.maxStake??MAX_CASINO_STAKE}" step="1" required value="${stake}" inputmode="numeric"></label><button type="submit" class="world-primary" data-lock>Lock bet</button></div><small data-payout></small></form>`:
      table.phase==='spin'?'<p class="world-muted">Bets are closed. Watch the table.</p>':
      table.phase==='result'?`<div class="world-result"><strong>${dice?'Face':'Pocket'} ${table.spin?.pocket}</strong><ul class="world-ledger">${(table.prizes??[]).map(p=>`<li><span>${safeText(p.name)}</span><b class="${p.won?'is-winner':''}">${p.net>=0?'+':'−'}${casinoCoins(Math.abs(p.net))}</b></li>`).join('')}</ul></div>`:'<p class="world-muted">Your bet is locked. Waiting for the table.</p>'}`
    if(table.wagers?.length)panel.insertAdjacentHTML('beforeend',`<section class="world-wagers" aria-label="Bets this round"><h3>Bets this round</h3><ul>${table.wagers.map((b,i)=>`<li data-chip="${i}"><b>${safeText(b.name)}</b><span>${dice?'Face ':''}${safeText(title(b.choice))} · ${coins(b.stake)}</span></li>`).join('')}</ul></section>`)
    panel.insertAdjacentHTML('beforeend',`<details class="world-table-rules"><summary>Rules and recent results</summary><p>${dice?'Pick one face. The croupier rolls one shared die. The return for your selected face is shown above.':'Bet on a pocket or choose an outside bet. The wheel result is shared by the table.'}</p><p>${table.recent.length?'Recent: '+table.recent.join(' · '):'No recent results yet.'}</p></details>${dice?'':'<details class="world-table-rules" data-history><summary>Your roulette history</summary><ul class="world-ledger"></ul></details>'}`)
    const history=panel.querySelector<HTMLDetailsElement>('[data-history]')
    if(history)history.ontoggle=()=>{
      if(!history.open)return
      const list=history.querySelector('ul')!
      list.innerHTML='<li>Loading rounds…</li>'
      void api<CasinoView>('/casino').then(data=>{
        list.innerHTML=data.recent.filter(r=>r.game==='roulette').slice(0,15).map(r=>`<li><span>Pocket ${r.result} · ${title(r.choice)}</span><b class="${r.won?'is-winner':''}">${r.net>=0?'+':'−'}${casinoCoins(Math.abs(r.net))}</b></li>`).join('')||'<li>No roulette rounds yet.</li>'
      }).catch(()=>{list.innerHTML='<li>Roulette history is unavailable.</li>'})
    }
    const form=panel.querySelector<HTMLFormElement>('form')
    if(form){
      form.oninput=e=>{if((e.target as HTMLElement).matches('input')){stake=Number((e.target as HTMLInputElement).value);updateSelection()}}
      form.onsubmit=e=>{
        e.preventDefault()
        if(performing)return
        pending??={round:table.round,stake,choice,requestId:crypto.randomUUID()}
        void action('bet',pending).catch(error=>{if(error instanceof ApiError&&error.status>=400&&error.status<500&&error.status!==408)pending=undefined})
      }
    }
  }
  panel.querySelectorAll('.world-seats li').forEach((seat,i)=>{
    const member=table.seats[i],label=member?.name??'Open seat'
    if(seat.textContent!==label)seat.textContent=label
    seat.classList.toggle('is-ready',Boolean(member?.locked))
  })
  tableStatus();updateSelection()
}
panel.onclick=e=>{
  const button=(e.target as HTMLElement).closest<HTMLButtonElement>('button')
  if(!button)return
  if(button.hasAttribute('data-stand'))void action('stand',{}).catch(()=>undefined)
  else if(button.dataset.face!==undefined){
    choice=/^\d+$/.test(button.dataset.face)?Number(button.dataset.face):button.dataset.face as RouletteChoice
    updateSelection()
  }
}
async function floorScreens(zone:string){
  if(!zone.startsWith('floor:'))return
  const symbol=zone.slice(6)
  try{
    const data=await api<StockView>('/stocks'),issue=symbol===CAS?data.cas:symbol===BNK?data.bank:undefined
    if(view?.you.zone!==zone)return
    stage?.quote(symbol,issue?.history??data.quotes[symbol]?.history??[],issue?.price??data.quotes[symbol]?.price)
    if(isEquity(symbol))stage?.ownership(symbol,data.companies[symbol])
    else {
      const {points}=await api<{points:PricePoint[]}>('/stocks/history?symbol='+encodeURIComponent(symbol))
      if(view?.you.zone===zone)stage?.quote(symbol,points.slice(-60),data.quotes[symbol]?.price)
    }
  }catch{}
}
function accepted(next:WorldView,start:number,reposition=false){
  offset=next.now-(start+Date.now())/2
  const scope=next.id+':'+next.you.zone,changed=viewKey!==scope
  view=next
  if(next.you.zone==='private'){
    closed=true;location.replace('/chess/dice.html?cave=1');return
  }
  connection.hidden=true
  host.dataset.zone=next.you.zone
  host.dataset.seated=String(Boolean(next.you.chair||next.you.lounge||next.you.dining!==undefined||next.you.barSeat!==undefined||next.you.boardSeat!==undefined))
  if(changed){
    viewKey=scope;shownService='';services?.close()
    if(next.you.zone!==lastFloor){lastFloor=next.you.zone;void floorScreens(lastFloor)}
  }
  stage?.set(next,offset,reposition);syncControls();renderChat(next)
  setCoins(next.coins);restaurant?.update(next)
  const nav=next.you.zone==='hotel'||next.you.zone==='casino'?'casino':next.you.zone==='bank'?'bank':next.you.zone==='kfc'?'kfc':next.you.zone==='exchange'||next.you.zone.startsWith('floor:')?'stocks':next.you.zone==='city'?'city':''
  for(const a of document.querySelectorAll<HTMLAnchorElement>('.economy-nav a[href*="world.html"]')){
    if(new URL(a.href).searchParams.get('go')===nav)a.setAttribute('aria-current','page')
    else a.removeAttribute('aria-current')
  }
  renderTable()
  const service=next.interaction
  const station=service?.startsWith('kfc:kitchen:')?service:undefined
  stage?.setStation(station,gesture=>{
    if(!station)return
    void action('restaurant',{command:'kitchen',point:station,gesture}).finally(()=>stage?.resetTool()).catch(()=>{})
  })
  if(!paused&&service&&shownService!==service){
    shownService=service
    if(station)return
    if(service.startsWith('property:')){
      stage?.lock(true)
      const render=()=>{if(view)services?.property(service,view,async unit=>{await action('housing',{unit});render()})}
      render()
      return
    }
    if(service==='bar'){
      services?.bar(next.bar?.name===next.you.name?next.bar:undefined,(drink,id)=>action('bar',{drink,id}),()=>action('stand-scenery',{}),next.you.barSeat!==undefined)
      return
    }
    if(service.startsWith('kfc:'))restaurant?.open(service)
    else void services?.open(service,next.you.zone.startsWith('floor:')?next.you.zone.slice(6):undefined)
    stage?.lock(true)
  }else if(!service)shownService=''
}
async function presence(){
  const t=Date.now()
  const response=await fetch('/api/world/presence',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({scene:true,world:view?.id,zone:view?.you.zone,...stage?.position}),signal:AbortSignal.timeout(5500)})
  if(!response.ok){
    if(response.status===401){closed=true;location.replace('/chess/login.html')}
    throw new Error('City connection lost')
  }
  accepted(await response.json() as WorldView,t)
}
async function action(name:string,data:object){
  if(performing||closed)return
  performing=true
  updateSelection()
  try{
    await refreshing
    if(name==='use')await presence()
    if(closed)return
    const t=Date.now()
    accepted(await api<WorldView>('/world/'+name,{...data,scene:true}),t,name==='teleport'||name==='exit-cave')
    if(name==='stand'||name==='stand-scenery'||name==='teleport')stage?.resumeMouse()
  }catch(error){showError(error instanceof Error?error.message:'City action failed');throw error}
  finally{performing=false;updateSelection()}
}
function use(point?:WorldAction){
  if(view?.interaction?.startsWith('kfc:kitchen:')){
    void action('restaurant',{command:'leave-station'}).catch(()=>{});return
  }
  if(view?.you.barSeat!==undefined||view?.you.boardSeat!==undefined){
    if(!dialog.open)void action('stand-scenery',{}).catch(()=>{});return
  }
  if(seated()||view?.you.lounge){void action('stand',{}).catch(()=>undefined);return}
  if(!point||dialog.open)return
  if(shownService===point.id)shownService=''
  void action('use',{target:point.id}).catch(()=>undefined)
}
host.querySelector<HTMLButtonElement>('[data-world-use]')!.onclick=()=>stage?.act()
dialog.addEventListener('close',()=>{syncControls();if(!paused)stage?.resumeMouse()})
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'){
    if(chatting){chatInput.blur();stage?.resumeMouse();event.preventDefault()}
    else if(!paused){showPause();event.preventDefault()}
    return
  }
  if((event.key==='/'||event.key.toLowerCase()==='t')&&!event.ctrlKey&&!event.metaKey&&!dialog.open&&!paused&&
      !(event.target instanceof HTMLElement&&event.target.matches('input,textarea,select,[contenteditable]'))){
    event.preventDefault();chatInput.focus()
  }
})
window.addEventListener('pagehide',e=>{if(!e.persisted)closed=true})
async function start(){
  await initShell();const auth=await getSession()
  if(!auth.user){location.replace('/chess/login.html');return}
  profile=auth.profile??undefined
  services=new CityServices(dialog,auth.user,symbol=>{
    if(closeAfterFloor)return
    closeAfterFloor=true
    void action('floor',{symbol}).then(()=>services?.close()).catch(()=>undefined).finally(()=>closeAfterFloor=false)
  },setCoins,()=>void floorScreens(view?.you.zone??''))
  restaurant=new RestaurantUI(dialog,cast('world-kfc-hud'),(command,data)=>action('restaurant',{command,...data}))
  const {CityStage}=await import('./stage.ts')
  stage=new CityStage(cast('world-canvas'),host,use,showPause)
  const url=new URL(location.href),go=url.searchParams.get('go')??''
  if(url.searchParams.get('exit')==='cave')await action('exit-cave',{})
  else if(like(go))await action('teleport',{to:go})
  else await presence()
  history.replaceState(null,'',url.pathname)
  const beat=async()=>{
    if(closed)return
    if(!performing){
      refreshing=presence().catch(()=>{connection.textContent='Reconnecting…';connection.hidden=false})
      await refreshing;refreshing=undefined
    }
    window.setTimeout(beat,document.hidden?3000:stage?.moving?220:view?.you.chair?480:780)
  }
  void beat();window.setInterval(tableStatus,160)
  window.setInterval(()=>{if(!document.hidden&&view&&/^floor:(CAS|BNK)$/.test(view.you.zone))void floorScreens(view.you.zone)},12_000)
}
document.addEventListener('click',event=>{
  const link=(event.target as Element).closest<HTMLAnchorElement>('a')
  if(!link||!view||event.defaultPrevented||event instanceof MouseEvent&&(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey))return
  const url=new URL(link.href)
  if(url.origin!==location.origin||url.pathname!=='/chess/world.html')return
  const to=url.searchParams.get('go')??''
  if(!like(to))return
  event.preventDefault()
  services?.close()
  if(paused){paused=false;pause.hidden=true;syncControls()}
  void action('teleport',{to}).catch(()=>undefined)
})
void start().catch(error=>{connection.hidden=false;connection.textContent=error instanceof Error?error.message:'The city could not open.'})
