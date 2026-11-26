import {STOCKS} from '../stock-catalog.ts'
import {STREETS} from './city-plan.ts'
import {HOMES,homeFacing} from './terrain.ts'
export const EXCHANGE_STOREY=6
export const TOWERS=[
  {name:'Copperline Lofts',x:-68,z:-22,w:8,d:11,levels:6,style:0},
  {name:'Atlas House',x:-70,z:0,w:10,d:12,levels:9,style:1},
  {name:'Garden Terrace',x:-68,z:24,w:9,d:8,levels:4,style:3},
  {name:'Glassworks',x:66,z:-20,w:9,d:10,levels:5,style:4},
  {name:'Exchange Crown',x:24,z:-2.48,w:15.7,d:14.8,levels:4,style:1,baseY:(STOCKS.length+3)*EXCHANGE_STOREY},
]
export const COURTS=[
  {name:'Linden Court',x:-50.2,z:-39},
  {name:'Eastbank Flats',x:54,z:-39},
  {name:'Meridian House',x:-39,z:-75.65},
] as const
export const RESIDENCES=[...COURTS,...TOWERS]
export const crownBlock=COURTS.length+TOWERS.findIndex(t=>t.baseY)
export const towerClerk={x:-1.74,z:-1.85}
export type Tenure='buy'|'rent'|'resident'
export interface Unit {id:string;name:string;x:number;z:number;facing:number;width:number;block?:number;floor:number;bedrooms:number;layout:string;tenure:Tenure;price:number}
export const layouts=['Compact one-bedroom','Standard apartment','Family apartment'] as const
export const houseStyles=['Traditional cottage','Modern family house','Brick townhouse','Detached home'] as const
export const houseDesign=(i:number)=>Math.floor(i/2)%4
export const houseLevels=(i:number)=>houseDesign(i)===2?2:1
export const flatEdges=[-10.4,-4.55,1.9,10.4]
function address(x:number,z:number,i:number){
  const facing=homeFacing(z)
  const id=facing<0?'boulevard':z<-32?(z<-37?'court':x<0?'westbank':'eastbank'):z<-11?(x>0?'glass':'linden'):z<4?'boulevard':z<34?'garden':'mill'
  return (i+1)+' '+STREETS.find(s=>s.id===id)!.name
}
export const UNITS:Unit[]=[
  ...HOMES.map(([x,z],i)=>({id:'house-'+i,name:address(x,z,i),x,z,facing:homeFacing(z),width:6,floor:0,
    bedrooms:houseDesign(i)===2?2:1,layout:houseStyles[houseDesign(i)],tenure:(i%3===0?'resident':i%4===0?'resident':i%2?'buy':'rent') as Tenure,price:i%2?2800+i*135:140+i*8})),
  ...COURTS.flatMap((b,block)=>[1,2,3,4].flatMap(floor=>layouts.map((layout,i)=>({
    id:'flat-'+block+'-'+(floor===1?i:(floor-1)*3+i),name:b.name+' · '+(floor*100+i+1),
    x:b.x+(flatEdges[i]+flatEdges[i+1])/2,z:b.z-4.85,facing:1,width:flatEdges[i+1]-flatEdges[i],block,floor,
    bedrooms:i===2?2:1,layout,tenure:(floor===1&&i===block||block===2?'resident':(i+block+floor-1)%2?'rent':'buy') as Tenure,
    price:((i+block+floor-1)%2?60+(4+i)*18:800+(4+i)*280)+(floor-1)*((i+block+floor-1)%2?18:180),
  })))),
  ...TOWERS.flatMap((t,i)=>Array.from({length:t.levels-1},(_,j):Unit=>{
    const floor=j+1,block=COURTS.length+i
    return {id:'loft-'+i+'-'+floor,name:t.name+' · '+floor+'01',x:t.x-1.43,z:t.z,facing:1,width:t.w-2.86,block,floor,
      bedrooms:1,layout:floor===t.levels-1?'Top-floor apartment':'Full-floor apartment',
      tenure:floor%2?'rent':'buy',price:floor%2?90+floor*16:1000+floor*240}
  })),
]
export type Deeds=Record<string,{holder:string;until:number}>
export type HousingView={keys:string[];occupied:string[];expires:Record<string,number>}
export function propertyPoints(){
  return [...UNITS.filter(u=>u.block===undefined&&u.tenure!=='resident').map(u=>({id:'property:'+u.id,label:'View '+u.name,x:u.x+1.15,z:u.z+u.facing*3.65,range:1.55})),
    ...RESIDENCES.flatMap((b,i)=>i===2?[]:[{id:'property:desk-'+i,label:'Speak to the housing clerk',x:b.x+(i<COURTS.length?4.6:towerClerk.x),z:b.z+(i<COURTS.length?.8:TOWERS[i-COURTS.length].d/2-4.6+towerClerk.z+1.62),range:1.8}])]
}
