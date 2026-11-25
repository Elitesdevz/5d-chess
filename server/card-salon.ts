import {randomInt,randomUUID} from 'node:crypto'
import {blackjackTotal,TABLE_STAKE as ante,type CardGame,type TableView} from '../src/world/resort.ts'
import {fromStockUnits,toStockUnits} from '../src/stock-model.ts'
import type {UnitOfWork} from './storage.ts'
import {debit,resortAccount} from './resort-ledger.ts'
import {casinoTerms,reserveWager,settleWager} from './casino-finance.ts'
import {companies,operating,saveCompanies} from './corporate.ts'
import {wallet} from './economy.ts'
import {income} from './credit.ts'
import {fail} from './http.ts'

type Hand={cards:number[];stake:number;done:boolean}
type Seat={name:string;hands:Hand[];reserve:number;paid?:number;contribution:number}
type Table={id:string;revision:number;game:CardGame;phase:TableView['phase'];until:number;seats:Seat[];
  deck:number[];dealer:number[];turn?:string;bet?:boolean;checked?:boolean;result?:string}
const key=(game:CardGame)=>'royalTable:'+game
const fresh=(game:CardGame):Table=>({id:randomUUID(),revision:0,game,phase:'waiting',until:0,seats:[],deck:[],dealer:[]})
const draw=(table:Table)=>table.deck.pop()!
const pip=(c:number)=>c%13+2
const natural=(hand:Hand)=>hand.cards.length===2&&blackjackTotal(hand.cards)===21
export function pokerScore(cards:number[]){
  const ranks=cards.map(pip).sort((a,b)=>b-a)
  const counts=new Map<number,number>()
  for(const r of ranks)counts.set(r,(counts.get(r)??0)+1)
  const groups=[...counts].sort(([a,m],[b,n])=>n-m||b-a)
  const flush=cards.every(c=>Math.floor(c/13)===Math.floor(cards[0]/13))
  const straight=groups.length===5?(ranks[0]-ranks[4]===4?ranks[0]:ranks.join()==='14,5,4,3,2'?5:0):0
  const [first,second]=groups.map(g=>g[1])
  const category=flush&&straight?8:first===4?7:first===3&&second===2?6:flush?5:straight?4:first===3?3:first===2&&second===2?2:first===2?1:0
  const kickers=straight?[straight]:groups.map(g=>g[0])
  let value=category
  for(let i=0;i<5;i++)value=value*15+(kickers[i]??0)
  return value
}
function shuffle(game:CardGame){
  const cards=Array.from({length:game==='poker'?52:312},(_,i)=>i%52)
  for(let i=cards.length-1;i>0;i--){const j=randomInt(i+1);[cards[j],cards[i]]=[cards[i],cards[j]]}
  return cards
}
function deal(t:Table,now:number,shoe:number[]){
  t.deck=shoe
  t.phase='play';t.until=now+60_000
  for(const s of t.seats){
    const hand=s.hands[0]
    hand.cards=Array.from({length:t.game==='poker'?5:2},()=>draw(t))
    hand.done=t.game==='blackjack'&&natural(hand)
  }
  if(t.game==='blackjack')t.dealer=[draw(t),draw(t)]
}
function payPoker(u:UnitOfWork,t:Table,winners:Seat[],now:number){
  const pot=t.seats.reduce((v,s)=>v+s.contribution,0),rake=toStockUnits(pot*.05)
  const gross=(toStockUnits(pot)-rake)/winners.length
  for(const s of t.seats){
    s.paid=winners.includes(s)?fromStockUnits(gross):0
    if(s.paid)income(resortAccount(u,s.name),gross,now)
  }
  const e=companies(u,now)
  e.CAS.cash+=rake;operating(e.CAS,'Card salon rake',rake,now);saveCompanies(u,e)
  t.result=winners.length===2?'Split pot':winners[0].name+' wins the pot'
  t.phase='settled';t.until=now+12_000;t.turn=undefined
}
function showdown(u:UnitOfWork,t:Table,now:number){
  const scores=t.seats.map(s=>pokerScore(s.hands[0].cards))
  payPoker(u,t,t.seats.filter((_,i)=>scores[i]===Math.max(...scores)),now)
}
function finishBlackjack(u:UnitOfWork,t:Table,now:number){
  const next=t.seats.find(s=>s.hands.some(h=>!h.done))
  if(next&&blackjackTotal(t.dealer)!==21){t.turn=next.name;t.until=now+60_000;return}
  while(blackjackTotal(t.dealer)<17)t.dealer.push(draw(t))
  const dealer=blackjackTotal(t.dealer),dealerBJ=t.dealer.length===2&&dealer===21
  for(const s of t.seats){
    s.paid=0
    for(const hand of s.hands){
      const total=blackjackTotal(hand.cards),bj=s.hands.length===1&&natural(hand)
      const multiplier=dealerBJ?Number(bj):bj?2.5:total>21?0:dealer>21||total>dealer?2:total===dealer?1:0
      s.paid+=hand.stake*multiplier;hand.done=true
    }
    settleWager(u,{gross:s.paid},s.reserve,now)
    income(resortAccount(u,s.name),toStockUnits(s.paid),now)
  }
  t.turn=undefined;t.phase='settled';t.until=now+12_000;t.result='Dealer finishes on '+dealer
}
function refund(u:UnitOfWork,s:Seat){
  const purse=wallet(resortAccount(u,s.name))
  purse.coins=fromStockUnits(toStockUnits(purse.coins)+toStockUnits(s.contribution))
}
export function advanceTable(u:UnitOfWork,game:CardGame,now:number){
  const saved=u.metadata<Table>(key(game))
  let t=saved??fresh(game)
  if(!saved)u.putMetadata(key(game),t)
  if(!t.until||t.until>now)return t
  if(t.phase==='play'){
    if(game==='poker'){
      if(t.bet)payPoker(u,t,t.seats.filter(s=>s.name!==t.turn),now)
      else showdown(u,t,now)
    }else{
      const seat=t.seats.find(s=>s.name===t.turn)
      if(seat)for(const h of seat.hands)h.done=true
      finishBlackjack(u,t,now)
    }
    t.revision++
  }else{
    if(t.phase==='waiting')for(const s of t.seats)refund(u,s)
    t=fresh(game)
  }
  u.putMetadata(key(game),t);return t
}
function commands(t:Table,name:string){
  const seat=t.seats.find(s=>s.name===name)
  if(t.phase==='waiting')return seat?['leave']:['join']
  if(t.phase!=='play'||!seat)return []
  if(t.game==='poker'){
    if(t.turn)return t.turn!==name?[]:t.bet?['call','fold']:['check','raise']
    return seat.hands[0].done?[]:['draw']
  }
  const hand=seat.hands.find(h=>!h.done)
  if(!hand||t.turn!==name)return []
  const options=['hit','stand']
  if(hand.cards.length===2){
    options.push('double')
    if(seat.hands.length===1&&pip(hand.cards[0])===pip(hand.cards[1]))options.push('split')
  }
  return options
}
export function tableView(t:Table,name:string):TableView{
  return {id:t.id,revision:t.revision,phase:t.phase,until:t.until,result:t.result,turn:t.turn,bet:t.bet,
    dealer:t.phase==='settled'?t.dealer:t.dealer.slice(0,1),actions:commands(t,name),
    seats:t.seats.map(s=>({name:s.name,count:s.hands[0].cards.length,done:s.hands.every(h=>h.done),paid:s.paid,
      cards:t.game==='blackjack'||s.name===name||t.phase==='settled'?s.hands[0].cards:[]})),
    hands:t.game==='blackjack'?t.seats.flatMap(s=>s.hands.map(h=>({name:s.name,cards:h.cards,stake:h.stake,active:!h.done}))):undefined}
}
export function cardAction(u:UnitOfWork,game:CardGame,name:string,data:Record<string,unknown>,now:number,shoe=shuffle){
  const t=advanceTable(u,game,now),cmd=data.kind,account=resortAccount(u,name)
  if(data.round!==t.id||data.revision!==t.revision)fail(409,'The table changed. Review the hand.')
  if(typeof cmd!=='string'||!commands(t,name).includes(cmd))fail(409,'That move is unavailable')
  const seat=t.seats.find(s=>s.name===name)!
  if(cmd==='join'){
    const terms=casinoTerms(u,now)
    if(!terms.open||terms.maxStake<ante)fail(409,'The casino is closed to new wagers')
    debit(account,ante,now)
    t.seats.push({name,hands:[{cards:[],done:false,stake:ante}],reserve:0,contribution:ante})
    t.until=now+90_000
    if(t.seats.length===2){
      if(game==='blackjack')for(const s of t.seats)s.reserve=reserveWager(u,ante,()=>2.5,now)
      deal(t,now,shoe(game))
    }
  }else if(cmd==='leave'){
    refund(u,seat);Object.assign(t,fresh(game))
  }else if(game==='poker'){
    const other=t.seats.find(s=>s!==seat)!
    if(cmd==='draw'){
      const indices=data.discards
      if(!Array.isArray(indices)||indices.length>3||new Set(indices).size!==indices.length||
        indices.some(i=>!Number.isInteger(i)||i<0||i>4))fail(400,'Choose up to three different cards')
      for(const i of indices)seat.hands[0].cards[i]=draw(t)
      seat.hands[0].done=true
      if(other.hands[0].done)t.turn=t.seats[0].name
    }else if(cmd==='fold')payPoker(u,t,[other],now)
    else{
      if(cmd==='raise'||cmd==='call'){debit(account,ante,now);seat.contribution+=ante}
      if(cmd==='call'||cmd==='check'&&t.checked)showdown(u,t,now)
      else{t.checked=cmd==='check';t.bet=cmd==='raise';t.turn=other.name}
    }
    if(t.phase==='play')t.until=now+60_000
  }else{
    const hand=seat.hands.find(h=>!h.done)!
    if(cmd==='split'||cmd==='double'){
      debit(account,ante,now);seat.reserve+=reserveWager(u,ante,()=>2,now);seat.contribution+=ante
    }
    if(cmd==='split'){
      const second={cards:[hand.cards.pop()!,draw(t)],stake:ante,done:false}
      hand.cards.push(draw(t));seat.hands.push(second)
      for(const h of seat.hands)h.done=pip(h.cards[0])===14||blackjackTotal(h.cards)===21
    }else{
      if(cmd!=='stand')hand.cards.push(draw(t))
      if(cmd==='double')hand.stake+=ante
      hand.done=cmd!=='hit'||blackjackTotal(hand.cards)>=21
    }
  }
  if(game==='blackjack'&&t.phase==='play')finishBlackjack(u,t,now)
  t.revision++;u.putMetadata(key(game),t)
  return tableView(t,name)
}
