import {randomInt} from 'node:crypto'
import {ROOMS,STAY_MS,TIERS,slotPays,type ResortView} from '../src/world/resort.ts'
import type {Deeds} from '../src/world/housing.ts'
import type {UnitOfWork} from './storage.ts'
import {cardAction,advanceTable,tableView} from './card-salon.ts'
import {lottery} from './weekly-lottery.ts'
import {debit,quantity,resortAccount} from './resort-ledger.ts'
import {reserveWager,settleWager} from './casino-finance.ts'
import {cashUnits,companies,operating,saveCompanies} from './corporate.ts'
import {income} from './credit.ts'
import {fail} from './http.ts'

export function resortService(u:UnitOfWork,name:string,station:string,now:number,data?:Record<string,unknown>):ResortView{
  const account=resortAccount(u,name),record=account.resort??={sequence:0}
  if(data){
    const {sequence,id,...payload}=data
    if(typeof id!=='string'||!/^[-\w]{12,80}$/.test(id))fail(400,'A request ID is required')
    const signature=JSON.stringify([station,id,payload])
    if(sequence===record.sequence&&record.last===signature)data=undefined
    else{
      if(sequence!==record.sequence+1)fail(409,'Your balance changed. Review the action.')
      record.sequence++;record.last=signature
    }
  }
  const result:ResortView={sequence:record.sequence}
  if(station==='resort:desk'&&data){
    const room=ROOMS.find(r=>r.number===data!.room)??fail(400,'Choose a room')
    const deeds=u.metadata<Deeds>('cityDeeds')??{}
    if(ROOMS.some(r=>deeds[r.id]?.holder===name&&deeds[r.id].until>now))fail(409,'You already hold a room key')
    if(deeds[room.id]?.until>now)fail(409,'This room is occupied')
    const rate=TIERS[room.tier].price
    debit(account,rate,now)
    deeds[room.id]={holder:name,until:now+STAY_MS};u.putMetadata('cityDeeds',deeds)
    const e=companies(u,now)
    e.CAS.cash+=cashUnits(rate);operating(e.CAS,'Guest room sales',cashUnits(rate),now);saveCompanies(u,e)
  }else if(station==='resort:lottery')result.lottery=lottery(u,account,now,data)
  else if(station==='resort:poker'||station==='resort:blackjack'){
    const game=station==='resort:poker'?'poker':'blackjack'
    result.table=data?cardAction(u,game,name,data,now):tableView(advanceTable(u,game,now),name)
  }else if(station==='resort:slots'){
    if(data){
      const stake=quantity(data.stake,100),maximum=reserveWager(u,stake,()=>Math.max(...slotPays),now)
      debit(account,stake,now)
      const reels=Array.from({length:3},()=>randomInt(slotPays.length))
      const paid=reels.every(r=>r===reels[0])?slotPays[reels[0]]*stake:0
      settleWager(u,{gross:paid},maximum,now);income(account,cashUnits(paid),now)
      record.slots={reels,paid}
    }
    result.slots=record.slots
  }else if(data&&station!=='resort:desk')fail(400,'Unknown resort service')
  return result
}
