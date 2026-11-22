import {randomUUID} from 'node:crypto'
import type {ChessStore} from './storage.ts'
import {casinoView,reserveRouletteStake,rouletteResult,settleReservedRoulette,validateBet} from './casino.ts'
import {CASINO_OWNER,type CasinoBet,type CasinoRound} from '../src/casino-model.ts'
import {BET_WINDOW,COUCH_SEATS,HALL_CAPACITY,LOUNGES,RESULT_TIME,SEAT_OFFSETS,SPAWN,SPIN_TIME,TABLES,WALK_SPEED,chairPosition,loungePosition,walk,type HallPlayer,type HallSpin,type HallTable,type HallView,type TablePrize} from '../src/roulette-hall-model.ts'
import {casState,recordCasinoMargins} from './cas-shares.ts'
import {fail} from './http.ts'

const ESCROW='rouletteHallEscrow'
const PRESENCE_TIME=20_000
type Ticket={name:string;avatar:string;seat:number;bet:CasinoBet}
type Escrow={room:string;table:number;round:string;until:number;tickets:Ticket[]}
type Member=HallPlayer&{seen:number;moved:number}
type Table={round:string;until:number;recent:number[];spin?:HallSpin;prizes?:TablePrize[];receipts?:Map<string,CasinoRound>}
type Room={id:string;players:Map<string,Member>;tables:Table[]}
const newTable=():Table=>({round:randomUUID(),until:0,recent:[]})
const publicMember=({name,avatar,x,z,yaw,chair,lounge,online}:Member):HallPlayer=>({name,avatar,x,z,yaw,chair,lounge,online})

export class RouletteHall {
  private rooms=new Map<string,Room>()
  private escrow:Escrow[]
  private timer:ReturnType<typeof setInterval>

  private store:ChessStore

  constructor(store:ChessStore){
    this.store=store
    this.escrow=(store.metadataValue(ESCROW) as Escrow[]|undefined)??[]
    for(const pending of this.escrow){
      const room=this.rooms.get(pending.room)??this.createRoom(pending.room)
      Object.assign(room.tables[pending.table],{round:pending.round,until:pending.until})
      for(const ticket of pending.tickets){
        const chair={table:pending.table,index:ticket.seat}
        room.players.set(ticket.name,{name:ticket.name,avatar:ticket.avatar,chair,...chairPosition(chair),seen:0,moved:0,online:false})
      }
    }
    this.timer=setInterval(()=>{try{this.tick(Date.now())}catch(error){console.error('Roulette round settlement deferred',error)}},250)
    this.timer.unref()
  }
  stop(){clearInterval(this.timer)}

  private createRoom(id=randomUUID().slice(0,6).toUpperCase()){
    const room:Room={id,players:new Map(),tables:TABLES.map(newTable)}
    this.rooms.set(id,room)
    return room
  }

  private settle(room:Room,index:number,now:number,pending:Escrow){
    const table=room.tables[index],pocket=rouletteResult()
    const remaining=this.escrow.filter(item=>item!==pending)
    const receipts=this.store.transaction(unit=>{
      const dayState=casState(unit,now)
      const owner=unit.findAccount(CASINO_OWNER),accounts=owner?[owner]:[]
      const rounds=new Map<string,CasinoRound>()
      for(const ticket of pending.tickets){
        const account=unit.users.get(ticket.name)
        if(!account)throw new Error('Reserved roulette account is missing')
        rounds.set(ticket.name,settleReservedRoulette(account,accounts,ticket.bet,pocket,now))
      }
      for(const account of accounts)if(!unit.findAccount(account.name))unit.users.add(account.name,account)
      recordCasinoMargins(unit,rounds.values(),now,dayState)
      this.store.putMetadata(ESCROW,remaining)
      return rounds
    })
    this.escrow=remaining
    table.spin={round:table.round,pocket,started:now,ends:now+SPIN_TIME}
    table.until=table.spin.ends+RESULT_TIME
    table.receipts=receipts
    table.prizes=[...receipts].map(([name,{won,net}])=>({name,won,net}))
    table.recent=[pocket,...table.recent].slice(0,8)
  }

  private tick(now:number){
    for(const [id,room] of this.rooms){
      for(const [name,p] of room.players){
        if(now-p.seen<PRESENCE_TIME)continue
        if(this.escrow.some(round=>round.room===id&&round.tickets.some(b=>b.name===name)))p.online=false
        else room.players.delete(name)
      }
      room.tables.forEach((table,index)=>{
        if(table.spin&&now<table.until)return
        if(table.spin){Object.assign(table,newTable(),{recent:table.recent,spin:undefined,prizes:undefined,receipts:undefined})}
        const seats=[...room.players.values()].filter(p=>p.chair?.table===index)
        const pending=this.escrow.find(item=>item.round===table.round)
        if(pending&&(now>=pending.until||seats.every(p=>pending.tickets.some(b=>b.name===p.name)))){
          this.settle(room,index,now,pending)
        }else if(!seats.length){
          table.until=0
        }else if(!table.until||now>=table.until){
          table.round=randomUUID()
          table.until=now+BET_WINDOW
        }
      })
      if(!room.players.size&&!room.tables.some(t=>t.spin))this.rooms.delete(id)
    }
  }

  update(name:string,action:string,data:Record<string,unknown>,now=Date.now()):HallView{
    this.tick(now)
    const account=this.store.rouletteWallet(name)??fail(401,'Log in first')
    const avatar=account.avatar??'default'
    let room=[...this.rooms.values()].find(r=>r.players.has(name))
    if(!room){
      if(action!=='presence')fail(409,'Rejoin the hall first')
      room=[...this.rooms.values()].find(r=>r.players.size<HALL_CAPACITY)??this.createRoom()
      room.players.set(name,{name,avatar,...SPAWN,seen:now,moved:now,online:true})
    }
    const me=room.players.get(name)!
    me.seen=now
    me.online=true
    me.avatar=avatar
    const table=me.chair?room.tables[me.chair.table]:undefined
    const pending=this.escrow.find(item=>item.round===table?.round)
    const locked=pending?.tickets.find(ticket=>ticket.name===name)
    if(action==='presence'){
      const {x,z,yaw}=data
      if(!me.chair&&!me.lounge&&data.room===room.id&&typeof x==='number'&&typeof z==='number'&&typeof yaw==='number'&&Number.isFinite(x)&&Number.isFinite(z)&&Number.isFinite(yaw)){
        Object.assign(me,walk(me,x,z,WALK_SPEED*Math.min(1.5,Math.max(0,(now-me.moved)/1000))),{yaw:Math.atan2(Math.sin(yaw),Math.cos(yaw))})
      }
      me.moved=now
    }else if(action==='sit'){
      if(me.chair||me.lounge)fail(409,'Stand up before changing seats')
      const index=data.table
      if(typeof index!=='number'||!Number.isInteger(index)||!room.tables[index])fail(400,'Choose a table')
      const target=room.tables[index]
      if(target.spin)fail(409,'This table is finishing a round')
      const used=new Set([...room.players.values()].filter(p=>p.chair?.table===index).map(p=>p.chair!.index))
      const available=SEAT_OFFSETS.map((_,i)=>i).filter(i=>!used.has(i)).sort((a,b)=>Math.abs(TABLES[index].x+SEAT_OFFSETS[a]-me.x)-Math.abs(TABLES[index].x+SEAT_OFFSETS[b]-me.x))
      if(!available.length)fail(409,'This table is full')
      me.chair={table:index,index:available[0]}
      Object.assign(me,chairPosition(me.chair))
      if(!target.until)target.until=now+BET_WINDOW
    }else if(action==='lounge'){
      if(me.chair||me.lounge)fail(409,'Stand up before changing seats')
      const couch=data.couch
      if(typeof couch!=='number'||!Number.isInteger(couch)||!LOUNGES[couch])fail(400,'Choose a couch')
      const taken=new Set([...room.players.values()].filter(p=>p.lounge?.couch===couch).map(p=>p.lounge!.index))
      const index=[1,0,2].find(i=>!taken.has(i)&&i<COUCH_SEATS.length)
      if(index===undefined)fail(409,'This couch is full')
      me.lounge={couch,index}
      Object.assign(me,loungePosition(me.lounge))
    }else if(action==='stand'){
      if(locked)fail(409,'Your bet is locked until the wheel spins')
      if(me.chair&&table?.spin&&now<table.spin.ends)fail(409,'Wait for the wheel to land')
      if(me.chair){
        Object.assign(me,{z:me.z+.63,moved:now})
        me.chair=undefined
      }else if(me.lounge){
        Object.assign(me,loungePosition(me.lounge,true),{moved:now})
        me.lounge=undefined
      }
    }else if(action==='bet'){
      if(!me.chair||!table||!table.until||data.round!==table.round)fail(409,'Betting has closed for this round')
      const bet=validateBet({game:'roulette',sequence:1,requestId:data.requestId,stake:data.stake,choice:data.choice})
      const accepted=locked?.bet??table.receipts?.get(name)
      if(accepted){
        if(accepted.requestId!==bet.requestId||accepted.choice!==bet.choice||accepted.stake!==bet.stake)fail(409,'Your bet is already locked')
      }else{
        if(table.spin)fail(409,'Betting has closed for this round')
        const entry:Escrow={room:room.id,table:me.chair.table,round:table.round,until:table.until,
          tickets:[...pending?.tickets??[],{name,avatar,seat:me.chair.index,bet}]}
        const next=[...this.escrow.filter(item=>item!==pending),entry]
        this.store.transaction(unit=>{
          const bettor=unit.users.get(name)??fail(401,'Log in first')
          if(casinoView(bettor).recent.some(receipt=>receipt.requestId===bet.requestId))fail(409,'This bet was already settled')
          reserveRouletteStake(bettor,bet.stake)
          this.store.putMetadata(ESCROW,next)
        })
        this.escrow=next
      }
    }else fail(404,'Unknown roulette action')

    this.tick(now)
    const current=action==='bet'||action==='stand'?this.store.rouletteWallet(name)??account:account
    const own=me.chair?room.tables[me.chair.table]:undefined
    const receipt=own?.spin&&now>=own.spin.ends?own.receipts?.get(name):undefined
    return {room:room.id,now,coins:current.coins??0,you:publicMember(me),players:[...room.players.values()].map(publicMember),
      tables:room.tables.map((t,i):HallTable=>{
        const result=t.spin&&now>=t.spin.ends, tickets=this.escrow.find(item=>item.round===t.round)?.tickets??[]
        return {round:t.round,until:t.until,phase:t.spin?result?'result':'spin':t.until?'betting':'idle',spin:t.spin,
          prizes:result?t.prizes:undefined,recent:t.spin&&!result?t.recent.slice(1):t.recent,
          seats:SEAT_OFFSETS.map((_,index)=>{
            const player=[...room.players.values()].find(p=>p.chair?.table===i&&p.chair.index===index)
            return player?{name:player.name,avatar:player.avatar,online:player.online,locked:t.receipts?.has(player.name)||tickets.some(ticket=>ticket.name===player.name)}:null
          })}
      }),receipt}
  }
}
