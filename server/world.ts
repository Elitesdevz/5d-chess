import {Restaurant} from './restaurant.ts'
import {RESTAURANT,restaurantPoints} from '../src/world/restaurant-model.ts'
import {randomUUID} from 'node:crypto'
import {dayKey} from '../src/collection.ts'
import {DESTINATIONS,FLOOR_ARRIVAL,LIFT,WORLD_CAPACITY,WORLD_SPEED,floorHeight,groundZone,interactions,localSite,near,riderHeight,site,spawn,stockFloor,worldMove,type Destination,type WorldPlayer,type WorldUse,type WorldView,type WorldZone} from '../src/world/model.ts'
import type {Position,HallView} from '../src/roulette-hall-model.ts'
import type {ChessStore} from './storage.ts'
import type {RouletteHall} from './roulette-hall.ts'
import {fail} from './http.ts'

const TIMEOUT=27_000
type Member=WorldPlayer&{seen:number;moved:number;interaction?:WorldUse;liftArrived?:boolean}
type World={id:string;members:Map<string,Member>;restaurant:Restaurant}
export interface CaveVisit {day:string;active:boolean}
const publicMember=({name,avatar,zone,x,z,yaw,chair,lounge,online,lift,dining,eatingUntil,carrying,workingUntil}:Member,shared:boolean):WorldPlayer=>({name,avatar,zone,...(shared?{x,z}:localSite(zone,x,z)),yaw,chair,lounge,online,lift,dining,eatingUntil,carrying,workingUntil})

export class CityWorlds {
  private worlds=new Map<string,World>()
  private occupants=new Map<string,World>()
  private store:ChessStore
  private roulette:RouletteHall
  constructor(store:ChessStore,roulette:RouletteHall){this.store=store;this.roulette=roulette}
  private clean(now:number){
    for(const room of this.worlds.values()){
      for(const [name,member] of room.members){
        if(now-member.seen<TIMEOUT)continue
        if(member.zone==='casino')this.roulette.detach(name,room.id)
        room.restaurant.leave(name)
        room.members.delete(name);this.occupants.delete(name)
      }
      if(!room.members.size)this.worlds.delete(room.id)
    }
  }
  private enter(name:string,avatar:string,zone:WorldZone,now:number){
    let world=[...this.worlds.values()].find(w=>w.members.size<WORLD_CAPACITY)
    if(!world){world={id:'W-'+randomUUID().slice(0,8),members:new Map(),restaurant:new Restaurant(this.store)};this.worlds.set(world.id,world)}
    const member:Member={name,avatar,zone,...FLOOR_ARRIVAL,seen:now,moved:now,online:true}
    this.arrive(world,member,zone,now)
    world.members.set(name,member);this.occupants.set(name,world)
    return world
  }
  private arrive(world:World,member:Member,zone:WorldZone,now:number,point?:Position){
    if(member.zone==='casino'&&zone!=='casino')this.roulette.detach(member.name,world.id)
    if(member.zone==='kfc'){world.restaurant.leave(member.name);delete member.dining;delete member.eatingUntil;delete member.workingUntil;delete member.carrying}
    member.zone=zone;member.interaction=undefined;member.chair=undefined;member.lounge=undefined;member.lift=undefined;member.liftArrived=undefined
    Object.assign(member,spawn(zone,point),{moved:now})
  }
  private boundPosition(member:Member):Position{
    return {...localSite('casino',member.x,member.z),yaw:member.yaw}
  }
  private privateEntry(world:World,member:Member,now:number){
    this.store.transaction(unit=>{
      const account=unit.users.get(member.name)??fail(401,'Log in first')
      if((account.wallet?.coins??0)<1||account.cave?.day===dayKey(now))fail(403,'The passage is closed')
      account.cave={day:dayKey(now),active:true}
    })
    this.arrive(world,member,'private',now)
  }
  private privateExit(world:World,member:Member,now:number){
    this.store.transaction(unit=>{
      const account=unit.users.get(member.name)
      if(account?.cave?.active)account.cave={...account.cave,active:false}
    })
    this.arrive(world,member,'oasis',now)
  }
  private walkthrough(world:World,member:Member,open:boolean,now:number){
    const before=member.zone,zone=before.startsWith('floor:')?before:groundZone(member.x,member.z)
    if(before!==zone){
      if(before==='kfc')world.restaurant.leave(member.name)
      if(before==='casino')this.roulette.detach(member.name,world.id)
      if(member.zone==='kfc'){world.restaurant.leave(member.name);delete member.dining;delete member.eatingUntil;delete member.workingUntil;delete member.carrying}
    member.zone=zone;member.interaction=undefined
    }
    if(zone==='cave'&&open&&localSite(zone,member.x,member.z).z<-7.06){this.privateEntry(world,member,now);return}
    const points=this.points(world,member,now)
    if(member.interaction&&!points.some(p=>p.id===member.interaction&&near(member,p.x,p.z,(p.range??1.65)+.18)))member.interaction=undefined
    const elevator=points.find(p=>p.id==='elevator')
    if(elevator&&!near(member,elevator.x,elevator.z,1.27))member.liftArrived=undefined
    if(elevator&&!member.liftArrived&&near(member,elevator.x,elevator.z,1.02))member.interaction='elevator'
    else if(zone.startsWith('floor:')&&points.some(p=>p.id==='trader'&&near(member,p.x,p.z,1.28)))member.interaction='trader'
  }

  private points(world:World,member:Member,now:number){
    if(member.zone!=='kfc')return interactions(member.zone)
    return restaurantPoints(world.restaurant.view(member.name,now,true),member.dining).map(p=>({...p,...site('kfc',p.x,p.z)}))
  }
  canTrade(name:string,symbol:unknown,now=Date.now()){
    const member=this.occupants.get(name)?.members.get(name)
    return typeof symbol==='string'&&Boolean(member&&now-member.seen<TIMEOUT&&member.interaction==='trader'&&member.zone==='floor:'+symbol)
  }
  canBank(name:string,kind:string,now=Date.now()){
    const member=this.occupants.get(name)?.members.get(name)
    return Boolean(member&&now-member.seen<TIMEOUT&&member.zone==='bank'&&member.interaction===(kind==='borrow'?'loans':'payments'))
  }
  update(name:string,action:string,data:Record<string,unknown>,now=Date.now()):WorldView{
    this.clean(now)
    const account=this.store.rouletteWallet(name)??fail(401,'Log in first')
    const open=(account.coins??0)>=1&&account.caveDay!==dayKey(now)
    const avatar=account.avatar??'default'
    let world=this.occupants.get(name)
    if(!world){
      if(action!=='presence'&&action!=='teleport'&&!(action==='exit-cave'&&account.caveActive))fail(409,'Join the city first')
      world=this.enter(name,avatar,account.caveActive?'private':'city',now)
    }
    const me=world.members.get(name)!
    const shared=data.scene===true
    world.restaurant.tick(now)
    me.seen=now;me.avatar=avatar
    if(me.lift&&now>=me.lift.ends){me.zone=me.lift.to;me.lift=undefined;me.liftArrived=true;me.moved=now}
    if(me.zone==='private'&&action!=='presence'&&action!=='exit-cave'&&action!=='teleport')fail(409,'Leave the room first')
    if(me.lift&&action!=='presence'&&action!=='teleport')fail(409,'Wait for the elevator to arrive')
    let hall:HallView|undefined
    if(action==='presence'){
      const {x,z,yaw}=data
      if(data.world===world.id&&(shared||data.zone===me.zone)&&!me.chair&&!me.lounge&&me.dining===undefined&&!me.lift&&me.zone!=='private'&&[x,z,yaw].every(n=>typeof n==='number'&&Number.isFinite(n))){
        const limit=WORLD_SPEED*Math.min(1.25,Math.max(0,(now-me.moved)/1000)),goal=shared?{x:x as number,z:z as number}:site(me.zone,x as number,z as number)
        Object.assign(me,worldMove(me.zone,me,goal.x,goal.z,limit,open||me.zone==='cave'),{yaw:Math.atan2(Math.sin(yaw as number),Math.cos(yaw as number)),moved:now})
        this.walkthrough(world,me,open,now)
      }
    }else if(action==='teleport'){
      const to=data.to as Destination
      if(!Object.hasOwn(DESTINATIONS,to))fail(400,'Choose a city destination')
      if(account.caveActive||me.zone==='private')this.privateExit(world,me,now)
      else{
        if(me.zone==='casino')this.roulette.detach(name,world.id)
        this.arrive(world,me,DESTINATIONS[to],now)
      }
    }else if(action==='exit-cave'){
      if(me.zone==='private'||account.caveActive)this.privateExit(world,me,now)
    }else if(action==='use'){
      const target=this.points(world,me,now).find(p=>p.id===data.target&&near(me,p.x,p.z,p.range))
      if(!target)fail(409,'Move closer to interact')
      if(target.id.startsWith('seat:')||target.id.startsWith('couch:')){
        const [type,index]=target.id.split(':')
        hall=this.roulette.update(name,type==='seat'?'sit':'lounge',type==='seat'?{table:Number(index)}:{couch:Number(index)},now,{id:world.id,position:this.boundPosition(me)})
      }else if(target.id.startsWith('kfc:sit:')){
        world.restaurant.act(me,'sit',{seat:Number(target.id.split(':').at(-1))},now)
        me.interaction='kfc:dining'
      }else me.interaction=target.id as WorldUse
    }else if(action==='restaurant'){
      world.restaurant.act(me,data.command,data,now)
      if(data.command==='step'||data.command==='take'||data.command==='deliver')me.workingUntil=now+800
      if(data.command==='stand')me.interaction=undefined
    }else if(action==='floor'){
      const local=localSite(me.zone,me.x,me.z)
      if(me.interaction!=='elevator'||!near({...local,yaw:me.yaw},LIFT.x,LIFT.z,1.25))fail(409,'Enter the elevator first')
      const to=data.symbol===''?'exchange':typeof data.symbol==='string'&&stockFloor(data.symbol)?`floor:${data.symbol}` as const:fail(400,'Choose a listed floor')
      if(to!==me.zone){
        const duration=1000+Math.min(4800,Math.abs(floorHeight(to)-floorHeight(me.zone))*9)
        me.lift={to,started:now+250,ends:now+250+duration};me.interaction=undefined;me.yaw=Math.PI
      }else{me.interaction=undefined;me.liftArrived=true}
    }else if(action==='stand'||action==='bet'){
      if(me.zone!=='casino')fail(409,'Visit the casino to use a table')
      hall=this.roulette.update(name,action,data,now,{id:world.id,position:this.boundPosition(me)})
    }else fail(404,'Unknown city action')
    if(me.zone==='casino'){
      hall??=this.roulette.update(name,'presence',{},now,{id:world.id,position:this.boundPosition(me)})
      Object.assign(me,{...site('casino',hall.you.x,hall.you.z),yaw:hall.you.yaw,chair:hall.you.chair,lounge:hall.you.lounge})
    }
    for(const person of world.members.values())if(person.zone==='kfc')person.carrying=world.restaurant.hasTray(person.name)
    const level=riderHeight(me,now)
    const players=me.zone==='private'?[]:[...world.members.values()].filter(p=>p.name!==name&&p.zone!=='private'&&near(me,p.x,p.z,48)&&(shared?Math.abs(riderHeight(p,now)-level)<23:p.zone===me.zone)).map(p=>publicMember(p,shared))
    const casino=site('casino',0,3)
    const tableMotion=shared&&!hall&&me.zone!=='private'&&level<5&&near(me,casino.x,casino.z,29)?this.roulette.tableMotion(world.id):undefined
    const restaurant=level<5&&(me.zone==='kfc'||near(me,RESTAURANT.x,RESTAURANT.z,26))?world.restaurant.view(name,now,me.zone==='kfc'):undefined
    const coins=action==='restaurant'?this.store.rouletteWallet(name)?.coins:account.coins
    return {id:world.id,now,you:publicMember(me,shared),players,coins:hall?.coins??coins??0,caveOpen:open&&me.zone!=='private',hall,tableMotion,restaurant,interaction:me.interaction}
  }
}
