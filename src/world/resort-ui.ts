import {billiards} from './billiards.ts'
import {blackjackTotal,cardLabel,ROOMS,TIERS,TICKET_PRICE,SHARE_PRICE,TABLE_STAKE,slotSymbols,slotPays} from './resort.ts'
import type {WorldView} from './model.ts'
import {coins,safeText} from './services.ts'

const floors=[['hotel','Lobby','Reception · Weekly Lottery · Royal Salon & Bar'],['hotel:2','Gallery','Guest rooms 201–206 · Card Salon · Starlight Arcade'],['hotel:3','Crown','Guest rooms 301–305 · Aureate Penthouse · Palm Baths']]
const titles:Record<string,string>={desk:'The room register',lottery:'Royal Weekly Lottery',poker:'Five-card draw',blackjack:'Blackjack',slots:'Starlight Slots',lift:'Guest lift',billiards:'Three-ball pool'}
const button=(action:string,label:string,disabled=false)=>`<button type="button" data-command="${action}" ${disabled?'disabled':''}>${label}</button>`
const count=(label:string,max:number,value=1)=>`<label>${label}<input name="quantity" type="number" required min="1" max="${max}" value="${value}" inputmode="numeric"></label>`
const card=(n:number)=>`<span class="royal-card ${Math.floor(n/13)%3?'red':''}">${cardLabel(n).replace('T','10')}</span>`
const clock=(time:number)=>new Date(time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})
const grossLabel=(n:number)=>n?'Paid '+coins(n):'No payout'

export class ResortUI {
  private digest=''
  private slotSequence=-1
  private stake=1
  constructor(private dialog:HTMLDialogElement,private send:(action:string,data:Record<string,unknown>)=>Promise<void>){}
  open(v:WorldView){
    const station=v.interaction?.split(':')[1],resort=v.resort
    if(!station||!resort)return
    const spinning=station==='slots'&&this.dialog.open&&this.slotSequence>=0&&resort.sequence!==this.slotSequence
    this.slotSequence=station==='slots'?resort.sequence:-1
    const key=JSON.stringify([v.interaction,resort,v.housing?.keys,v.housing?.occupied,v.coins,v.you.zone])
    if(this.dialog.open&&key===this.digest)return
    this.digest=key
    let body=''
    if(station==='lift')body=floors.map(([id,name,description],i)=>`<button class="royal-floor" data-floor="${id}" ${v.you.zone===id?'disabled':''}><b>0${i+1}</b><span><strong>${name}</strong><small>${description}</small></span></button>`).join('')
    if(station==='desk'){
      const stay=ROOMS.find(r=>v.housing?.keys.includes(r.id))
      body=`<p>${stay?'Your key opens room '+stay.number+' until '+clock(v.housing!.expires[stay.id])+'.':'Each booking includes one real-time hour. Take the guest lift to your room.'}</p>`+TIERS.map((tier,i)=>{
        const rooms=ROOMS.filter(r=>r.tier===i)
        return `<section class="royal-room"><header><h3>${tier.name}</h3><b>${coins(tier.price)}</b></header><p>${tier.note}</p><div class="royal-buttons">${rooms.map(r=>{
          const taken=v.housing?.occupied.includes(r.id)
          return button('room-'+r.number,r.number+(stay?.id===r.id?' · Your room':taken?' · Occupied':' · Book'),!!stay||taken||tier.price>v.coins)
        }).join('')}</div></section>`
      }).join('')
    }
    if(station==='lottery'&&resort.lottery){
      const l=resort.lottery
      body=`<div class="royal-jackpot"><small>WEEKLY JACKPOT</small><strong>${coins(l.pool)}</strong><span>Draws ${new Date(l.until).toLocaleString([], {weekday:'short',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</span></div>
        <p>${l.tickets} tickets in the drum · ${l.npc} from city residents · ${l.mine} yours</p>
        <p>Each ticket costs ${coins(TICKET_PRICE)}. One ticket wins 99% of sales. Shareholders divide the remaining 1% at the draw.</p>
        <div class="royal-order">${count('Tickets',100)}${button('ticket','Buy tickets',v.coins<TICKET_PRICE)}</div>
        <section class="royal-room"><h3>LOT shares</h3><p>Trade at the Royal Weekly Lottery floor in Exchange Tower. You own ${l.shares} shares and have earned ${coins(l.dividends)} in dividends.</p></section>
        ${l.last?`<p>Last draw · ${safeText(l.last.winner)} won ${coins(l.last.prize)}. Dividend per share: ${coins(l.last.dividend)}.</p>`:''}`
    }
    if(station==='slots'){
      body=`<div class="royal-reels" aria-label="Slot reels">${(resort.slots?.reels??[-1,-1,-1]).map(r=>`<b>${slotSymbols[r]??'★'}</b>`).join('')}</div><p role="status">${resort.slots?grossLabel(resort.slots.paid):'Match all three symbols to win.'}</p>
        <div class="royal-order">${count('Stake in coins',100,this.stake)}${button('spin','Spin reels',v.coins<1)}</div><details><summary>Paytable · 94.91% return</summary><p>Three independent reels, six equally likely symbols. Three of a kind pays the listed multiple of your stake, including your stake.</p>${slotSymbols.map((s,i)=>`<div class="royal-pay"><span>${s}</span><b>${slotPays[i]}×</b></div>`).join('')}</details>`
    }
    const t=resort.table
    if(t){
      const poker=station==='poker',me=t.seats.find(s=>s.name===v.you.name),canDraw=t.actions.includes('draw')
      const status=t.phase==='waiting'?t.seats.length?'Waiting for a second player. Your ante returns at '+clock(t.until)+' if nobody joins.':'Two players required. Take the first seat.':t.phase==='settled'?t.result??'Round complete':t.turn?t.turn+' to act':poker?'Choose up to three discards, or keep your hand.':'Play each hand against the dealer.'
      const name=(n:string)=>n===v.you.name?'You':safeText(n)
      body=`<p class="royal-status" role="status">${safeText(status)}</p>
        ${t.dealer.length?`<div class="royal-hand"><strong>Dealer</strong><div>${t.dealer.map(card).join('')}${t.phase==='play'?'<span class="royal-card back">◆</span>':''}</div></div>`:''}
        ${t.seats.map(s=>`<div class="royal-hand"><strong>${name(s.name)}${s.paid!==undefined?' · '+grossLabel(s.paid):''}</strong><div>${poker?(s.cards.length?s.cards.map((n,i)=>canDraw&&s.name===v.you.name?`<label class="royal-discard"><input type="checkbox" value="${i}" aria-label="Discard ${cardLabel(n)}">${card(n)}</label>`:card(n)).join(''):'<span class="royal-card back">◆</span>'.repeat(s.count)):
        (t.hands??[]).filter(h=>h.name===s.name).map(h=>`<div>${h.cards.map(card).join('')} <small>${blackjackTotal(h.cards)>21?'Bust':blackjackTotal(h.cards)} · ${coins(h.stake)}${t.turn===s.name&&h===(t.hands??[]).find(hand=>hand.name===s.name&&hand.active)?' · Playing':''}</small></div>`).join('')}</div></div>`).join('')}
        <div class="royal-buttons">${t.actions.map(a=>button(a,({join:'Take a seat · '+coins(TABLE_STAKE),leave:'Leave & refund',draw:'Finish draw',raise:'Bet '+coins(TABLE_STAKE),call:'Call '+coins(TABLE_STAKE)} as Record<string,string>)[a]??(a[0].toUpperCase()+a.slice(1)))).join('')}</div>
        ${me?.done&&t.phase==='play'&&!t.actions.length?'<p>Waiting for the other player.</p>':''}<details><summary>Table rules</summary><p>${poker?'Both players ante 10 coins. Replace up to three cards once, then check or bet 10. Highest five-card hand wins. Ties split the pot. House rake is 5%. On timeout the table shows down, or folds an unanswered bet.':'Six decks. Dealer stands on soft 17 and checks for blackjack. Naturals pay 3:2, ordinary wins pay 1:1, and ties push. Double on two cards or split a pair once. Split aces receive one card. Inactive hands stand after one minute.'}</p></details>`
    }
    const host=this.dialog.querySelector<HTMLElement>('.world-dialog-body')!
    host.innerHTML=`<header class="world-service-head"><div><span>ROYAL HOTEL & CASINO</span><h2 id="world-dialog-title">${titles[station]}</h2></div><form method="dialog"><button aria-label="Close">×</button></form></header><div class="royal-service ${t||station==='slots'?'salon-controls':''}">${body}</div>`
    if(spinning&&!matchMedia('(prefers-reduced-motion:reduce)').matches){
      const status=host.querySelector<HTMLElement>('[role=status]')!,result=status.textContent
      const spin=host.querySelector<HTMLButtonElement>('[data-command=spin]')!
      const stops=host.querySelector('.royal-reels')!
      spin.disabled=true;status.textContent='Reels spinning…';stops.setAttribute('data-spinning','')
      window.setTimeout(()=>{status.textContent=result;spin.disabled=v.coins<1;stops.removeAttribute('data-spinning')},1490)
    }
    if(station==='billiards')billiards(host.querySelector('.royal-service')!)
    host.querySelectorAll<HTMLInputElement>('.royal-discard input').forEach(input=>input.onchange=()=>{
      const limit=host.querySelectorAll('.royal-discard :checked').length>=3
      host.querySelectorAll<HTMLInputElement>('.royal-discard input').forEach(card=>card.disabled=limit&&!card.checked)
    })
    if(!this.dialog.open)this.dialog.showModal()
    host.querySelectorAll<HTMLButtonElement>('[data-floor],[data-command]').forEach(b=>b.onclick=async()=>{
      const kind=b.dataset.command,floor=b.dataset.floor
      const input=b.closest('.royal-order')?.querySelector('input')
      if(input&&!input.reportValidity())return
      const data:Record<string,unknown>={id:crypto.randomUUID(),sequence:resort.sequence+1,kind}
      if(kind?.startsWith('room-'))data.room=Number(kind.slice(5))
      if(kind==='spin')data.stake=this.stake=Number(input?.value)
      if(resort.lottery){data.count=Number(input?.value);data.draw=resort.lottery.until}
      if(t){
        data.round=t.id;data.revision=t.revision
        if(kind==='draw')data.discards=[...host.querySelectorAll<HTMLInputElement>(':checked')].map(c=>Number(c.value))
      }
      b.disabled=true
      try{await this.send(floor?'resort-floor':'resort',floor?{floor}:data)}catch{}finally{b.disabled=false}
    })
  }
}
