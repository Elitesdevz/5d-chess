import {STOCKS,STOCK_SYMBOLS} from '../stock-catalog.ts'
import {TABLES,LOUNGES,type HallPlayer,type HallView,type Position} from '../roulette-hall-model.ts'
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
  {to:'cave',x:-37,z:30,label:''},
  {to:'oasis',x:37,z:30,label:''},
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
export type WorldPlayer=HallPlayer&{zone:WorldZone}
export type WorldUse='loans'|'payments'|'reserve'|'elevator'|'banker'|'trader'
export type WorldAction={id:string;label:string;x:number;z:number;range?:number}
export interface WorldView{
  id:string;now:number;you:WorldPlayer;players:WorldPlayer[];coins:number;caveOpen:boolean;hall?:HallView;interaction?:WorldUse
}
export function interactions(zone:WorldZone):WorldAction[]{
  if(zone==='casino')return [
    ...WORLD_TABLES.map((t,i)=>({id:'seat:'+i,label:t.name,x:t.x,z:t.z+1.68,range:2.15})),
    ...LOUNGES.map((seat,i)=>({id:'couch:'+i,label:'Sit on couch',x:seat.x,z:seat.z,range:1.75})),
  ]
  if(zone==='bank')return [{id:'loans',label:'Speak to the lender',x:-2.9,z:.73},{id:'payments',label:'Speak to the cashier',x:2.9,z:.73},{id:'reserve',label:'Speak to the reserve clerk',x:7.4,z:.6}]
  if(zone==='exchange'||zone.startsWith('floor:'))return [{id:'elevator',label:'Use elevator',x:0,z:-4.5,range:1.6},...(zone==='exchange'?[]:[{id:'trader',label:'Speak to the trader',x:-2.7,z:-.4},{id:'trader',label:'Speak to the trader',x:2.7,z:-.4}])]
  return []
}
export const near=(p:Position,x:number,z:number,max=1.65)=>Math.hypot(p.x-x,p.z-z)<=max
const box=(x:number,z:number,a:number,b:number,w:number,d:number)=>Math.abs(x-a)<w&&Math.abs(z-b)<d
export const HOUSE_ROWS=[[-40,-15],[-32,-20],[-22,-21],[22,-22],[32,-19],[42,-15],[-42,11],[-27,18],[-17,24],[16,25],[27,18],[42,10]] as const
export function walkable(zone:WorldZone,x:number,z:number,caveOpen=true){
  if(zone==='city'){
    if(Math.abs(x)>52||z<-34||z>40)return false
    if(box(x,z,0,-17,11,9.3)||box(x,z,-24,-1.7,8.2,6)||box(x,z,24,-2,8,6.2))return false
    if(HOUSE_ROWS.some(([a,b])=>box(x,z,a,b,3.15,3.15)))return false
    return !box(x,z,-37,34,6,3.6)&&!box(x,z,37,34,6,3.6)&& (caveOpen||!box(x,z,-37,30.8,2.3,1.6))
  }
  if(zone==='casino')return Math.abs(x)<=10.3&&z>=-6.05&&z<=7.85&&WORLD_TABLES.every(t=>!box(x,z,t.x,t.z,2.35,1.28))
  if(zone==='bank')return Math.abs(x)<=8.8&&z>=-.41&&z<=7.75
  if(zone==='hotel')return Math.abs(x)<=9.2&&z>=-7.7&&z<=7.7
  if(zone==='cave'||zone==='oasis')return Math.abs(x)<=2.32&&Math.abs(z)<=7.8
  if(zone==='exchange'||zone.startsWith('floor:'))return Math.abs(x)<=7.9&&z>=-5.7&&z<=7.7
  return false
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
