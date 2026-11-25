import {randomUUID} from 'node:crypto'
import type {ChessStore,UnitOfWork} from './storage.ts'
import {alias,cellPosition,CLEAR_MINUTES,MAX_HP,origins,type ArcadeView,type Contact,type Stack,type Item} from '../src/world/arcade.ts'
import {near,type WorldPlayer} from '../src/world/model.ts'
import {UNITS,type Deeds} from '../src/world/housing.ts'
import {buildingById,homeZone,residentialSite,residentialAt,contains} from '../src/world/residential.ts'
import {book,roster,custodyView} from './custody.ts'
import {carry,mirrorFood,pack,quantity,stash,transfer,type Pack} from './city-inventory.ts'
import {fail} from './http.ts'

type Located={x:number;z:number;zone:string}
type Drop=Located&{id:string;items:Stack[]}
type NpcHealth={hp:number;returns:number}
type Scene={world:string;me:WorldPlayer;players:WorldPlayer[];residents:(Located&{id:string;name:string})[];keys:string[];drawer?:string;bank:boolean;shop:boolean}
type Search={units:Contact[];last:number;arrived:number;raidAt:number;dogAt:number;searched:string[];warning:string}
export const RULES={range:8,damage:35,shotDelay:900,notice:4500,officers:[0,1,2,3,4,5],speed:[0,1.6,1.9,2.2,2.5,2.7],dogRange:7,dogCooldown:18000,dogNotice:2400,raidDelay:12000}
function advance(p:Pack,by:number){p.stars=Math.min(5,p.stars+by);p.remaining=CLEAR_MINUTES[p.stars]*60000}
export class CityArcade {
  private store:ChessStore
  private seen=new Map<string,number>()
  private searches=new Map<string,Search>()
  constructor(store:ChessStore){this.store=store}
  offline(name:string){this.seen.delete(name)}
  active(name:string,now:number){
    const last=this.seen.get(name)
    this.seen.set(name,now)
    if(last===undefined||now<=last||now-last>30000)return
    const a=JSON.parse(this.store.accountJson(name)??'{}')
    if(!a.cityPack?.stars)return
    this.store.transaction(tx=>{
      const p=pack(tx.users.get(name)!)
      p.remaining=Math.max(0,p.remaining-(now-last))
      if(!p.remaining){p.stars=0;this.searches.delete(name)}
    })
  }
  private staff(now:number):Contact[]{
    return [{id:'desk',label:'Desk officer',kind:'officer',zone:'station',x:207,z:-2.9},
      {id:'booking',label:'Booking officer',kind:'officer',zone:'station',x:214,z:-2.8},
      {id:'patrol',label:'Meridian patrol',kind:'officer',zone:'city',x:-50+4*Math.sin(now/9000),z:-61}]
  }
  private sweep(tx:UnitOfWork,s:Scene,stars:number,search:Search,now:number){
    const deeds=tx.metadata<Deeds>('cityDeeds')??{}
    const owned=UNITS.filter(u=>deeds[u.id]?.holder===s.me.name&&(!deeds[u.id].until||deeds[u.id].until>now))
    const candidates=stars<4?owned:UNITS.filter(u=>owned.includes(u)||Math.hypot(u.x-s.me.x,u.z-s.me.z)<18||owned.some(h=>Math.hypot(u.x-h.x,u.z-h.z)<12))
    const unit=candidates[search.searched.length%candidates.length]
    if(!unit)return
    search.searched.push(unit.id);search.warning='Searching '+unit.name
    const officer=search.units.at(-1)!
    const building=buildingById.get(unit.block===undefined?unit.id:'block-'+unit.block)!
    const home=building.levels[unit.floor].units.find(u=>u.id===unit.id)!
    Object.assign(officer,residentialSite(building,(home.rect.l+home.rect.r)/2,(home.rect.b+home.rect.f)/2),{zone:homeZone(building.id,unit.floor)})
    if(!owned.includes(unit))return
    const a=tx.users.get(s.me.name)!,p=pack(a)
    if(p.drawers[unit.id])p.drawers[unit.id]=p.drawers[unit.id].filter(i=>i.item!=='blaster')
    const here=residentialAt(s.me.zone)
    if(here?.building.id===building.id&&here.level===unit.floor&&contains(home.rect,(s.me.x-building.x)*building.facing,(s.me.z-building.z)*building.facing)){
      p.slots=p.slots.map(i=>i?.item==='blaster'?null:i)
    }
  }
  private pursue(s:Scene,p:Pack,now:number){
    const me=s.me
    if(!p.stars){this.searches.delete(me.name);return}
    let search=this.searches.get(me.name)
    if(!search){
      search={units:[],last:now,arrived:now,raidAt:now,dogAt:now,searched:[],warning:'Meridian patrol is searching'}
      this.searches.set(me.name,search)
    }
    const dt=Math.max(0,Math.min(1.25,(now-search.last)/1000));search.last=now
    while(search.units.length<RULES.officers[p.stars]){
      const i=search.units.length
      search.units.push({id:'patrol-'+i,label:'Patrol '+(i+1),kind:'officer',x:me.x+10+i*1.5,z:me.z+4-i,zone:me.zone})
    }
    if(p.stars>=3&&now-search.raidAt>=RULES.raidDelay){
      this.store.transaction(tx=>this.sweep(tx,s,p.stars,search!,now))
      search.raidAt=now
    }
    let caught=false
    const health=this.store.metadataValue('npc:'+s.world) as Record<string,NpcHealth>|undefined
    for(const [i,o] of search.units.entries()){
      if((health?.[o.id]?.returns??0)>now)continue
      if(p.stars>=3&&i===search.units.length-1&&search.searched.length&&now-search.raidAt<5000)continue
      if(o.zone!==me.zone){
        if(now-search.arrived<5000)continue
        Object.assign(o,{x:me.x+12,z:me.z+2,zone:me.zone})
      }
      const d=Math.hypot(o.x-me.x,o.z-me.z)
      const speed=RULES.speed[p.stars]
      if(now-search.arrived<RULES.notice)continue
      const step=Math.min(d,speed*dt)
      if(d){o.x+=(me.x-o.x)*step/d;o.z+=(me.z-o.z)*step/d}
      if(d<1.15)caught=true
    }
    if(p.stars===5){
      const lead=search.units[0],d=Math.hypot(lead.x-me.x,lead.z-me.z)
      if(d<=RULES.dogRange&&lead.zone===me.zone&&now-search.dogAt>=RULES.dogCooldown){
        search.dogAt=now;search.warning='Dog team approaching — move away!'
      }
      const elapsed=now-search.dogAt
      if(search.warning.startsWith('Dog team')&&elapsed>=RULES.dogNotice){
        if(elapsed<RULES.dogNotice+1500&&d<2.8&&lead.zone===me.zone)caught=true
        search.warning='Helicopter tracking the area'
      }
    }
    if(caught){
      const b=this.store.transaction(tx=>book(tx,me.name,p.stars,now))
      if(b){this.searches.delete(me.name);return b}
      search.warning='Booking full — patrol holding back'
    }
  }
  run(s:Scene,now:number,data?:Record<string,unknown>){
    const {me,world}=s
    const dropKey='cityDrops:'+world,npcKey='npc:'+world
    const previous=this.searches.get(me.name)
    const staff=[...this.staff(now),...(previous?.units??[])]
    const bookings=roster(this.store,now)
    const people:Contact[]=s.players.filter(o=>o.name!==me.name&&!bookings.some(b=>b.user===o.name)).map(o=>({...o,id:'player:'+o.name,label:o.name,kind:'player'}))
    const targets:Contact[]=[...staff,...people,...s.residents.map(o=>({...o,id:o.id,label:o.name,kind:'resident' as const}))]
    let respawn:string|undefined
    const {p,drops,health}=this.store.transaction(tx=>{
      const a=tx.users.get(me.name)!,p=pack(a)
      for(const [id,contents] of Object.entries(p.drawers))if(!s.keys.includes(id)){
        for(const stack of contents)stash(p.recovery,stack.item,stack.count)
        delete p.drawers[id]
      }
      const drops=tx.metadata<Drop[]>(dropKey)??[],health=tx.metadata<Record<string,NpcHealth>>(npcKey)??{}
      if(data){
        if(data.sequence!==p.sequence)fail(409,'Inventory changed. Review your hotbar.')
        const op=data.operation
        if(op==='fire'){
          if(typeof data.slot!=='number'||!Number.isInteger(data.slot)||p.slots[data.slot]?.item!=='blaster')fail(409,'Select a carried blaster')
          if(now-(p.lastShot??-Infinity)<RULES.shotDelay)fail(409,'Blaster recharging')
          const t=targets.find(c=>c.id===data.target&&c.zone===me.zone&&near(me,c.x,c.z,RULES.range))
          if(data.target&&!t)fail(409,'Target moved out of range')
          p.lastShot=now;advance(p,1)
          if(t?.kind==='player'){
            const victim=tx.users.get(t.label)!,vp=pack(victim)
            vp.hp=Math.max(0,vp.hp-RULES.damage)
            if(!vp.hp){
              const items=vp.slots.filter((i):i is Stack=>!!i)
              if(items.length)drops.push({id:randomUUID(),items,x:t.x,z:t.z,zone:t.zone})
              vp.slots=vp.slots.map(()=>null);vp.hp=MAX_HP;vp.sequence++;mirrorFood(victim)
              if(victim.cave)victim.cave.active=false
              respawn=t.label;advance(p,1);tx.putMetadata(dropKey,drops)
            }
          }else if(t){
            const n=health[t.id]??={hp:MAX_HP,returns:0}
            if(n.returns>now)fail(409,'Target is recovering')
            if(!n.hp)n.hp=MAX_HP
            n.hp=Math.max(0,n.hp-RULES.damage)
            if(!n.hp){n.returns=now+30000;advance(p,1)}
            tx.putMetadata(npcKey,health)
          }
        }else if(op==='pickup'){
          const i=drops.findIndex(d=>d.id===data.target&&d.zone===me.zone&&near(me,d.x,d.z,1.85))
          if(i<0)fail(409,'Move closer to an available drop')
          for(const item of drops[i].items)carry(p,item.item,item.count)
          drops.splice(i,1);tx.putMetadata(dropKey,drops);mirrorFood(a)
        }else transfer(a,op,data.item as Item,quantity(data.amount??1),s.bank,s.shop,s.drawer,now)
        p.sequence++
      }
      return {p,drops,health}
    })
    const booked=this.pursue(s,p,now)
    const search=this.searches.get(me.name)
    const contacts=targets.filter(t=>t.zone===me.zone&&near(me,t.x,t.z,36)&&!(health[t.id]?.returns>now)).map(t=>({...t,hp:t.kind==='player'?JSON.parse(this.store.accountJson(t.label)!).cityPack?.hp??MAX_HP:health[t.id]?.hp||MAX_HP}))
    if(p.stars===5&&search){const lead=search.units[0];contacts.push({...lead,id:'heli',label:'Police helicopter',kind:'helicopter',hp:100},{...lead,x:lead.x+.8,id:'dog',label:'Dog team',kind:'dog',hp:100})}
    const view:ArcadeView={sequence:p.sequence,slots:p.slots,hp:p.hp,stars:p.stars,remaining:p.remaining,contacts,
      drops:drops.filter(d=>d.zone===me.zone&&near(me,d.x,d.z,28)).map(({id,x,z})=>({id,x,z})),
      drawer:s.drawer?p.drawers[s.drawer]??[]:undefined,recovery:s.bank?p.recovery:undefined,warning:search?.warning,searches:search?.searched.slice(-4),custody:booked&&custodyView(booked)}
    return {view,respawn,health}
  }
}

