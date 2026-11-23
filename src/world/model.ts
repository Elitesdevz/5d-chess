import {CAVE_MOUTH,CAVE_X,OASIS_X,townFixture,houseObstacle,passableLand,terrainHeight} from './terrain.ts'
import {STOCKS,STOCK_SYMBOLS} from '../stock-catalog.ts'
import {TABLES,LOUNGES,type HallPlayer,type HallTable,type HallView,type Position} from '../roulette-hall-model.ts'
export const WORLD_CAPACITY=50
export const WORLD_SPEED=4.7
export const CITY={x:0,z:8,yaw:0}
export const FLOOR_LIST:{symbol:string;name:string}[]=[...STOCKS].sort((a,b)=>a.symbol.localeCompare(b.symbol))
FLOOR_LIST.push({symbol:'CAS',name:'The Casino'},{symbol:'BNK',name:'Fifth Dimension Bank'})
export const stockFloor=(symbol:string)=>symbol==='CAS'||symbol==='BNK'||STOCK_SYMBOLS.has(symbol)
export type PublicZone='city'|'hotel'|'casino'|'bank'|'exchange'|'cave'|'oasis'|`floor:${string}`
export type WorldZone=PublicZone|'private'
export type Destination='city'|'casino'|'bank'|'stocks'
export const DESTINATIONS={city:'city',casino:'hotel',bank:'bank',stocks:'exchange'} as const
export const CITY_PORTALS=[
  {to:'hotel',x:0,z:-7,label:'Royal Hotel & Casino'},
  {to:'bank',x:-24,z:5,label:'Fifth Dimension Bank'},
  {to:'exchange',x:24,z:5,label:'Exchange Tower'},
  {to:'cave',x:CAVE_X,z:CAVE_MOUTH,label:''},
  {to:'oasis',x:OASIS_X,z:CAVE_MOUTH,label:''},
] as const
export const PUBLIC_DICE={name:'Ivory Dice',x:6.1,z:3.0,color:'#e5bd86'} as const
export const WORLD_TABLES=[...TABLES,PUBLIC_DICE]
export const DICE_TABLE_INDEX=TABLES.length
export const ZONE_ARRIVAL:Record<Exclude<WorldZone,`floor:${string}`>,Position>={
  city:CITY,hotel:{x:0,z:5.7,yaw:0},casino:{x:0,z:7.1,yaw:0},
  bank:{x:0,z:6.6,yaw:0},exchange:{x:0,z:6.6,yaw:0},
  cave:{x:0,z:6.7,yaw:0},oasis:{x:0,z:-6.6,yaw:Math.PI},private:{x:0,z:0,yaw:0},
}
export const FLOOR_ARRIVAL={x:0,z:6,yaw:0}
export const FLOOR_HEIGHT=6
export const LIFT={x:0,z:-5.48}
export const PLAN={
  hotel:{x:0,z:-14.78,width:9.5,back:-7.9,front:7.78},
  casino:{x:0,z:-31.58,width:11.25,back:-6.7,front:8.9},
  bank:{x:-24,z:-3.05,width:10.2,back:-6.57,front:8.05},
  exchange:{x:24,z:-2.48,width:8,back:-7.45,front:7.48},
  cave:{x:CAVE_X,z:CAVE_MOUTH+7.7},oasis:{x:OASIS_X,z:CAVE_MOUTH+7.7},
} as const
type Building=keyof typeof PLAN
const building=(zone:WorldZone)=>zone.startsWith('floor:')?'exchange':Object.hasOwn(PLAN,zone)?zone as Building:undefined
const reverse=(zone:WorldZone)=>zone==='cave'||zone==='oasis'?-1:1
export function roomOrigin(zone:WorldZone){return PLAN[building(zone)!]??CITY_ORIGIN}
const CITY_ORIGIN={x:0,z:0}
export const floorNumber=(zone:WorldZone)=>zone.startsWith('floor:')?FLOOR_LIST.findIndex(f=>f.symbol===zone.slice(6))+1:0
export const floorHeight=(zone:WorldZone)=>floorNumber(zone)*FLOOR_HEIGHT
export function site(zone:WorldZone,x:number,z:number){
  const origin=roomOrigin(zone),sign=reverse(zone)
  return {x:origin.x+sign*x,z:origin.z+sign*z}
}
export function localSite(zone:WorldZone,x:number,z:number){
  const origin=roomOrigin(zone),sign=reverse(zone)
  return {x:sign*(x-origin.x),z:sign*(z-origin.z)}
}
export function spawn(zone:WorldZone,point=zone.startsWith('floor:')?FLOOR_ARRIVAL:ZONE_ARRIVAL[zone as keyof typeof ZONE_ARRIVAL]):Position{
  return {...site(zone,point.x,point.z),yaw:point.yaw+(reverse(zone)<0?Math.PI:0)}
}
export type LiftRide={to:WorldZone;started:number;ends:number}
export type WorldPlayer=HallPlayer&{zone:WorldZone;lift?:LiftRide}
export function riderHeight(player:WorldPlayer,now:number){
  const from=floorHeight(player.zone),ride=player.lift
  if(!ride)return player.zone==='city'?terrainHeight(player.x,player.z):from
  const progress=Math.max(0,Math.min(1,(now-ride.started)/(ride.ends-ride.started)))
  return from+(floorHeight(ride.to)-from)*progress*progress*(3-2*progress)
}
export type WorldUse='loans'|'payments'|'reserve'|'elevator'|'banker'|'trader'
export type WorldAction={id:string;label:string;x:number;z:number;range?:number}
export interface WorldView{
  id:string;now:number;you:WorldPlayer;players:WorldPlayer[];coins:number;caveOpen:boolean;hall?:HallView;tableMotion?:Pick<HallTable,'spin'|'recent'>[];interaction?:WorldUse
}
function localInteractions(zone:WorldZone):WorldAction[]{
  if(zone==='casino')return [
    ...WORLD_TABLES.map((t,i)=>({id:'seat:'+i,label:t.name,x:t.x,z:t.z+1.68,range:2.15})),
    ...LOUNGES.map((seat,i)=>({id:'couch:'+i,label:'Sit on couch',x:seat.x,z:seat.z,range:1.75})),
  ]
  if(zone==='bank')return [{id:'loans',label:'Speak to the lender',x:-2.9,z:.73},{id:'payments',label:'Speak to the cashier',x:2.9,z:.73},{id:'reserve',label:'Speak to the reserve clerk',x:7.4,z:.6}]
  if(zone==='exchange'||zone.startsWith('floor:'))return [{id:'elevator',label:'Use elevator',...LIFT,range:1.25},...(zone==='exchange'?[]:[{id:'trader',label:'Speak to the trader',x:-2.7,z:-.4},{id:'trader',label:'Speak to the trader',x:2.7,z:-.4}])]
  return []
}
export const interactions=(zone:WorldZone)=>localInteractions(zone).map(action=>({...action,...site(zone,action.x,action.z)}))
export const near=(p:Position,x:number,z:number,max=1.65)=>Math.hypot(p.x-x,p.z-z)<=max
const box=(x:number,z:number,a:number,b:number,w:number,d:number)=>Math.abs(x-a)<w&&Math.abs(z-b)<d
const buildings=['hotel','casino','bank','exchange'] as const
export function groundZone(x:number,z:number):PublicZone{
  for(const zone of buildings){
    const room=PLAN[zone],p=localSite(zone,x,z)
    if(Math.abs(p.x)<room.width&&p.z>=room.back&&p.z<room.front)return zone
  }
  for(const zone of ['cave','oasis'] as const){
    const p=localSite(zone,x,z)
    if(Math.abs(p.x)<1.75&&p.z>=-7.8&&p.z<7.7)return zone
  }
  return 'city'
}
function roomObstacles(zone:WorldZone,x:number,z:number){
  if(zone==='casino')return WORLD_TABLES.some(t=>box(x,z,t.x,t.z,2.35,1.28))||box(x,z,-5.9,8.23,4.05,.54)
  if(zone==='hotel')return box(x,z,-6.25,-6.26,2.33,.67)
  if(zone==='bank')return z<-.41
  if(zone==='exchange'||zone.startsWith('floor:')){
    const side=Math.abs(x)
    if(side>1.28&&side<1.8&&z<-4.19&&z>-7.5)return true
    if(zone==='exchange')return box(x,z,.63,-1.97,2.18,.62)
    return [-2.7,2.7].some(desk=>box(x,z,desk,-1.77,1.29,.51))
  }
  return false
}
function walkable(zone:WorldZone,x:number,z:number,caveOpen:boolean){
  if(zone==='private')return false
  if(zone.startsWith('floor:')){
    const p=localSite(zone,x,z),shaft=Math.abs(p.x)<1.42
    return Math.abs(p.x)<7.72&&p.z<7.29&&p.z>(shaft?-6.21:-5.98)&&!roomObstacles(zone,p.x,p.z)
  }
  if(!passableLand(x,z)||Math.hypot(x,z)<2.88||townFixture(x,z)||houseObstacle(x,z))return false
  for(const room of buildings){
    const {width,back,front}=PLAN[room],p=localSite(room,x,z),side=Math.abs(p.x),opening=room==='bank'?1.13:room==='exchange'?1.02:1.25
    if(side<width+.28&&side>width-.28&&p.z>back-.28&&p.z<front+.28)return false
    if(side<width+.28&&Math.abs(p.z-front)<.28&&side>=opening)return false
    if(side<width+.28&&Math.abs(p.z-back)<.28&&(room!=='hotel'||side>=1.25))return false
    if(side<width&&p.z>=back&&p.z<front){
      if(room==='exchange'&&p.z<-5.93&&(side>=1.42||p.z<-6.21))return false
      if(roomObstacles(room,p.x,p.z))return false
    }
  }
  for(const cave of ['cave','oasis'] as const){
    const p=localSite(cave,x,z),side=Math.abs(p.x)
    if(side<4.65&&p.z<7.70&&p.z>-8.55&&(side>=1.75||p.z<-7.7||cave==='cave'&&!caveOpen))return false
  }
  return true
}
export function worldMove(zone:WorldZone,from:Position,x:number,z:number,limit:number,caveOpen=true):Position{
  const d=Math.hypot(x-from.x,z-from.z)
  if(!Number.isFinite(d)||d===0||limit<=0)return from
  const scale=Math.min(1,limit/d),steps=Math.max(1,Math.ceil(d*scale/.21))
  const dx=(x-from.x)*scale/steps,dz=(z-from.z)*scale/steps
  let ax=from.x,az=from.z
  for(let i=0;i<steps;i++){
    if(walkable(zone,ax+dx,az,caveOpen))ax+=dx
    if(walkable(zone,ax,az+dz,caveOpen))az+=dz
  }
  return {x:ax,z:az,yaw:from.yaw}
}
