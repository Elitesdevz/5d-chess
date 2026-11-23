import type {CasinoRound,RouletteChoice} from './casino-model.ts'

export const HALL_CAPACITY = 10
export const BET_WINDOW = 60_000
export const SPIN_TIME = 6_800
export const RESULT_TIME = 7_500
export const WALK_SPEED = 3.6
export const SPAWN = {x:0,z:7.3,yaw:0}
export const TABLES = [
  {name:'Ivory',x:-5,z:-3.4,color:'#d8bc86'},
  {name:'Obsidian',x:5,z:-3.4,color:'#9bc9d7'},
  {name:'The Rift',x:0,z:2.1,color:'#cbb0e4'},
] as const
export const LOUNGES=[
  {name:'West lounge',x:-9.65,z:2.75,yaw:-Math.PI/2},
  {name:'East lounge',x:9.65,z:2.75,yaw:Math.PI/2},
  {name:'West alcove',x:-9.65,z:-.54,yaw:-Math.PI/2},
  {name:'East bar couch',x:8,z:6.7,yaw:0},
] as const
export const COUCH_SEATS=[-.82,0,.82]
export type LoungeSeat={couch:number;index:number}
export function loungePosition({couch,index}:LoungeSeat,stand=false):Position {
  const site=LOUNGES[couch],offset=COUCH_SEATS[index],a=site.yaw,d=stand?1.47:0
  return {x:site.x+Math.cos(a)*offset-Math.sin(a)*d,z:site.z-Math.sin(a)*offset-Math.cos(a)*d,yaw:a}
}
export const SEAT_OFFSETS = [-1.7,-.57,.57,1.7]
export type Position = {x:number;z:number;yaw:number}
export type Chair = {table:number;index:number}
export type HallPlayer = Position & {name:string;avatar:string;chair?:Chair;lounge?:LoungeSeat;online:boolean}
export type TablePrize = {name:string;net:number;won:boolean}
export type HallSpin = {round:string;pocket:number;started:number;ends:number}
export interface HallTable {
  round:string
  phase:'idle'|'betting'|'spin'|'result'
  until:number
  seats:({name:string;avatar:string;locked:boolean;online:boolean}|null)[]
  spin?:HallSpin
  prizes?:TablePrize[]
  wagers?:{name:string;stake:number;choice:RouletteChoice}[]
  recent:number[]
}
export interface HallView {
  houseEdge?:number;maxStake?:number;open?:boolean
  room:string; now:number; coins:number; you:HallPlayer; players:HallPlayer[]; tables:HallTable[]
  receipt?:CasinoRound
}
export function chairPosition({table,index}:Chair):Position {
  return {x:TABLES[table].x+SEAT_OFFSETS[index],z:TABLES[table].z+1.68,yaw:0}
}
export function freeFloor(x:number,z:number){
  return Math.abs(x)<=10.3&&z>=-6.05&&z<=7.85&&TABLES.every(t=>Math.abs(t.x-x)>2.38||Math.abs(t.z-z)>1.28)
}
export function walk(from:Position,x:number,z:number,limit:number):Position {
  const distance=Math.hypot(x-from.x,z-from.z)
  const fraction=distance>limit?limit/distance:1
  const dx=(x-from.x)*fraction,dz=(z-from.z)*fraction
  // Check intermediate points so a delayed update cannot hop through a table.
  const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.25))
  let nextX=from.x,nextZ=from.z
  for(let i=0;i<steps;i++){
    if(freeFloor(nextX+dx/steps,nextZ))nextX+=dx/steps
    if(freeFloor(nextX,nextZ+dz/steps))nextZ+=dz/steps
  }
  return {x:nextX,z:nextZ,yaw:from.yaw}
}
