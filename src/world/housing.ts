import {shared} from './map-data.ts'
export * from './house-styles.ts'
export {EXCHANGE_STOREY} from './exchange-floors.ts'
import {towerClerk} from './house-styles.ts'
export {towerClerk}
export const COURTS=shared.apartments,TOWERS=shared.towers
export const RESIDENCES=[...COURTS,...TOWERS]
export const crownBlock=RESIDENCES.findIndex(b=>'baseY' in b&&b.baseY)
export type Tenure='buy'|'rent'|'resident'
export interface Unit {id:string;name:string;x:number;z:number;facing:number;width:number;block?:number;floor:number;bedrooms:number;layout:string;tenure:Tenure;price:number}
export const UNITS:Unit[]=shared.units
export type Deeds=Record<string,{holder:string;until:number}>
export type HousingView={keys:string[];occupied:string[];expires:Record<string,number>}
export function propertyPoints(){
  return [...UNITS.filter(u=>u.block===undefined&&u.tenure!=='resident').map(u=>({id:'property:'+u.id,label:'View '+u.name,x:u.x+1.15,z:u.z+u.facing*3.65,range:1.55})),
    ...RESIDENCES.flatMap((b,i)=>i===2?[]:[{id:'property:desk-'+i,label:'Speak to the housing clerk',x:b.x+(i<COURTS.length?4.6:towerClerk.x),z:b.z+(i<COURTS.length?.8:TOWERS[i-COURTS.length].d/2-4.6+towerClerk.z+1.62),range:1.8}])]
}
