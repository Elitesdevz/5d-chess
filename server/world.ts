import {randomUUID} from 'node:crypto'
import {dayKey} from '../src/collection.ts'
import {CITY_PORTALS,DESTINATIONS,FLOOR_ARRIVAL,WORLD_CAPACITY,WORLD_SPEED,ZONE_ARRIVAL,interactions,near,stockFloor,worldMove,type Destination,type WorldPlayer,type WorldUse,type WorldView,type WorldZone} from '../src/world/model.ts'
import type {Position,HallView} from '../src/roulette-hall-model.ts'
import type {ChessStore} from './storage.ts'
import type {RouletteHall} from './roulette-hall.ts'
import {fail} from './http.ts'

const TIMEOUT=27_000
type Member=WorldPlayer&{seen:number;moved:number;interaction?:WorldUse}
type World={id:string;members:Map<string,Member>}
export interface CaveVisit {day:string;active:boolean}
const publicMember=({name,avatar,zone,x,z,yaw,chair,lounge,online}:Member):WorldPlayer=>({name,avatar,zone,x,z,yaw,chair,lounge,online})

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
        room.members.delete(name);this.occupants.delete(name)
      }
      if(!room.members.size)this.worlds.delete(room.id)
    }
  }
  private enter(name:string,avatar:string,zone:WorldZone,now:number){
    let world=[...this.worlds.values()].find(w=>w.members.size<WORLD_CAPACITY)
    if(!world){world={id:'W-'+randomUUID().slice(0,8),members:new Map()};this.worlds.set(world.id,world)}
    const member:Member={name,avatar,zone,...FLOOR_ARRIVAL,seen:now,moved:now,online:true}
    this.arrive(world,member,zone,now)
    world.members.set(name,member);this.occupants.set(name,world)
    return world
  }
  private arrive(world:World,member:Member,zone:WorldZone,now:number,point?:Position){
    if(member.zone==='casino'&&zone!=='casino')this.roulette.detach(member.name,world.id)
    member.zone=zone;member.interaction=undefined;member.chair=undefined;member.lounge=undefined
    const arrival=point??(zone.startsWith('floor:')?FLOOR_ARRIVAL:ZONE_ARRIVAL[zone as keyof typeof ZONE_ARRIVAL])
    Object.assign(member,arrival,{moved:now})
  }
  private exterior(world:World,member:Member,zone:string,now:number){
    const door=CITY_PORTALS.find(p=>p.to===zone)
    this.arrive(world,member,'city',now,door?{x:door.x,z:door.z+ (zone==='cave'||zone==='oasis'?-2.4:2.5),yaw:zone==='cave'||zone==='oasis'?0:Math.PI}:undefined)
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
    const {zone,x,z}=member
    if(zone==='city'){
      const portal=CITY_PORTALS.find(d=>near(member,d.x,d.z,d.to==='cave'||d.to==='oasis'?1.0:1.25))
      if(portal&&(portal.to!=='cave'||open))this.arrive(world,member,portal.to,now)
    }else if(zone==='hotel'&&Math.abs(x)<2&&z<-7.0)this.arrive(world,member,'casino',now)
    else if(zone==='casino'&&Math.abs(x)<1.6&&z>7.56)this.arrive(world,member,'hotel',now,{x:0,z:-5.75,yaw:Math.PI})
    else if(zone==='cave'&&z<-7.06){if(open)this.privateEntry(world,member,now);else this.exterior(world,member,'cave',now)}
    else if(zone==='oasis'&&z>7.05)this.exterior(world,member,'oasis',now)
    else if((zone==='hotel'||zone==='bank'||zone==='exchange'||zone==='cave')&&Math.abs(x)<1.7&&z>7.39)this.exterior(world,member,zone,now)
    else if((zone==='exchange'||zone.startsWith('floor:'))&&near(member,0,-4.5,1.15))member.interaction='elevator'
    else if(zone.startsWith('floor:')&&interactions(zone).some(p=>p.id==='trader'&&near(member,p.x,p.z,1.28)))member.interaction='trader'
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
    me.seen=now;me.avatar=avatar
    if(me.zone==='private'&&action!=='presence'&&action!=='exit-cave'&&action!=='teleport')fail(409,'Leave the room first')
    let hall:HallView|undefined
    if(action==='presence'){
      const {x,z,yaw}=data
      if(data.world===world.id&&data.zone===me.zone&&!me.chair&&!me.lounge&&me.zone!=='private'&&[x,z,yaw].every(n=>typeof n==='number'&&Number.isFinite(n))){
        const before=me.zone,limit=WORLD_SPEED*Math.min(1.25,Math.max(0,(now-me.moved)/1000))
        Object.assign(me,worldMove(me.zone,me,x as number,z as number,limit,open),{yaw:Math.atan2(Math.sin(yaw as number),Math.cos(yaw as number))})
        if(me.interaction&&!interactions(me.zone).some(p=>p.id===me.interaction&&near(me,p.x,p.z,(p.range??1.65)+.3)))me.interaction=undefined
        this.walkthrough(world,me,open,now)
        if(me.zone===before)me.moved=now
      }
    }else if(action==='teleport'){
      const to=data.to as Destination
      if(!Object.hasOwn(DESTINATIONS,to))fail(400,'Choose a city destination')
      if(account.caveActive||me.zone==='private')this.privateExit(world,me,now)
      else{
        if(me.zone==='casino')this.roulette.detach(name,world.id)
        this.arrive(world,me,DESTINATIONS[to],now)
        if(to==='stocks'&&typeof data.symbol==='string'&&[ 'CAS','BNK' ].includes(data.symbol))this.arrive(world,me,`floor:${data.symbol}`,now)
      }
    }else if(action==='exit-cave'){
      if(me.zone==='private'||account.caveActive)this.privateExit(world,me,now)
    }else if(action==='use'){
      const target=interactions(me.zone).find(p=>p.id===data.target&&near(me,p.x,p.z,p.range))
      if(!target)fail(409,'Move closer to interact')
      if(target.id.startsWith('seat:')||target.id.startsWith('couch:')){
        const [type,index]=target.id.split(':')
        hall=this.roulette.update(name,type==='seat'?'sit':'lounge',type==='seat'?{table:Number(index)}:{couch:Number(index)},now,{id:world.id,position:me})
      }else me.interaction=target.id as WorldUse
    }else if(action==='floor'){
      if(me.interaction!=='elevator'||!near(me,0,-4.5,1.8))fail(409,'Enter the elevator first')
      if(data.symbol==='')this.arrive(world,me,'exchange',now,{x:0,z:-2.9,yaw:Math.PI})
      else if(typeof data.symbol==='string'&&stockFloor(data.symbol))this.arrive(world,me,`floor:${data.symbol}`,now)
      else fail(400,'Choose a listed floor')
    }else if(action==='stand'||action==='bet'){
      if(me.zone!=='casino')fail(409,'Visit the casino to use a table')
      hall=this.roulette.update(name,action,data,now,{id:world.id,position:me})
    }else fail(404,'Unknown city action')
    if(me.zone==='casino'){
      hall??=this.roulette.update(name,'presence',{},now,{id:world.id,position:me})
      Object.assign(me,{x:hall.you.x,z:hall.you.z,yaw:hall.you.yaw,chair:hall.you.chair,lounge:hall.you.lounge})
    }
    const players=me.zone==='private'?[]:[...world.members.values()].filter(p=>p.name!==name&&p.zone===me.zone&&near(me,p.x,p.z,me.zone==='city'?35:23)).map(publicMember)
    return {id:world.id,now,you:publicMember(me),players,coins:hall?.coins??account.coins??0,caveOpen:open&&me.zone!=='private',hall,interaction:me.interaction}
  }
}
