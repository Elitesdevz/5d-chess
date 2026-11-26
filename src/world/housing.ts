import {shared} from './map-data.ts'
export * from './house-styles.ts'
export const RESIDENCES=shared.apartments
export type Tenure='buy'|'rent'|'resident'
export interface Unit {id:string;name:string;x:number;z:number;facing:number;width:number;block?:number;floor:number;bedrooms:number;layout:string;tenure:Tenure;price:number}
export const UNITS:Unit[]=shared.units
export const OFFICES=shared.offices
export type Deeds=Record<string,{holder:string;until:number}>
export type HousingView={keys:string[];occupied:string[];expires:Record<string,number>}
export function propertyPoints(){
  return [...UNITS.filter(u=>u.block===undefined&&u.tenure!=='resident').map(u=>({id:'property:'+u.id,label:'View '+u.name,x:u.x+1.15,z:u.z+u.facing*3.65,range:1.55})),
    ...RESIDENCES.slice(0,2).map((b,i)=>({id:'property:desk-'+i,label:'Speak to the housing clerk',x:b.x+4.6,z:b.z+.8,range:1.8}))]
}
export function officeObstacle(x:number,z:number){
  return OFFICES.some(o=>Math.abs(x-o.x)<o.w/2+.15&&Math.abs(z-o.z)<o.d/2+.15)
}
