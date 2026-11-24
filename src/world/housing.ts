import {STREETS} from './city-plan.ts'
import {HOMES,homeFacing} from './terrain.ts'
export const RESIDENCES=[
  {name:'Linden Court',x:-50.2,z:-39},
  {name:'Eastbank Flats',x:54,z:-39},
  {name:'Meridian House',x:-39,z:-75.65},
] as const
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
  ...RESIDENCES.flatMap((b,block)=>[1,2,3,4].flatMap(floor=>layouts.map((layout,i)=>({
    id:'flat-'+block+'-'+(floor===1?i:(floor-1)*3+i),name:b.name+' · '+(floor*100+i+1),
    x:b.x+(flatEdges[i]+flatEdges[i+1])/2,z:b.z-4.85,facing:1,width:flatEdges[i+1]-flatEdges[i],block,floor,
    bedrooms:i===2?2:1,layout,tenure:(floor===1&&i===block||block===2?'resident':(i+block+floor-1)%2?'rent':'buy') as Tenure,
    price:((i+block+floor-1)%2?60+(4+i)*18:800+(4+i)*280)+(floor-1)*((i+block+floor-1)%2?18:180),
  })))),
]
export const OFFICES=[{x:-68,z:-22,w:8,d:11,h:19},{x:-70,z:0,w:10,d:12,h:29},{x:-68,z:24,w:9,d:8,h:13},{x:66,z:-20,w:9,d:10,h:17}]
export type Deeds=Record<string,{holder:string;until:number}>
export type HousingView={keys:string[];occupied:string[];expires:Record<string,number>}
export function propertyPoints(){
  return [...UNITS.filter(u=>u.block===undefined&&u.tenure!=='resident').map(u=>({id:'property:'+u.id,label:'View '+u.name,x:u.x+1.15,z:u.z+u.facing*3.65,range:1.55})),
    ...RESIDENCES.slice(0,2).map((b,i)=>({id:'property:desk-'+i,label:'Speak to the housing clerk',x:b.x+4.6,z:b.z+.8,range:1.8}))]
}
export function officeObstacle(x:number,z:number){
  return OFFICES.some(o=>Math.abs(x-o.x)<o.w/2+.15&&Math.abs(z-o.z)<o.d/2+.15)
}
