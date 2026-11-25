import type {MenuItem} from './restaurant-model.ts'

export type Item = MenuItem | 'cash' | 'blaster'
export type Stack = {item:Item; count:number}
export const SLOT_COUNT=9
export const MAX_HP=100
export const PRICE=25
export const CLEAR_MINUTES=[0,10,20,40,60,90]
export const JAIL_MINUTES=[0,2,10,60,360,1440]
export const CELL_COUNT=50
export const PUZZLE_SIZE=1000
export const alias=(cell:number)=>'Inmate '+String(cell).padStart(2,'0')
export const entrances={station:{x:-50,z:-60},gunshop:{x:66,z:-60}}
export type Venue=keyof typeof entrances
export const venue=(zone:string):zone is Venue=>zone==='station'||zone==='gunshop'
// Interiors use shared city coordinates on their own plots.
export const origins={station:{x:210,z:0},gunshop:{x:240,z:0}}
export function cellPosition(cell:number){
  return {x:origins.station.x+(cell%2?-4.2:4.2),z:-6-Math.floor((cell-1)/2)*3.2,yaw:cell%2?-Math.PI/2:Math.PI/2}
}
export function venueWalk(zone:Venue,x:number,z:number){
  const dx=Math.abs(x-origins[zone].x)
  if(zone==='gunshop')return dx<3.8&&z>-1.8&&z<3.8
  return dx<5.8&&z>=-3.9&&z<4.8&&!(x<209&&z<-.8&&z>-2.4)||dx<1.75&&z>=-84.1&&z<0
}
export interface CustodyView {cell:number;name:string;ends:number|null;noRelease:boolean;x:number;z:number;yaw:number}
export interface Contact {id:string;label:string;x:number;z:number;zone:string;hp?:number;kind:'officer'|'dog'|'helicopter'|'resident'|'player'}
export interface ArcadeView {
  sequence:number;slots:(Stack|null)[];hp:number;stars:number;remaining:number;contacts:Contact[]
  drawer?:Stack[];recovery?:Stack[];drops:{id:string;x:number;z:number}[];warning?:string;searches?:string[];custody?:CustodyView
}

