import {facade,LANDMARKS,type LandmarkKind} from './city-plan.ts'
import type {Grocery} from './food.ts'
import {MARKET} from './terrain.ts'

type Counter={label:string;stock?:Grocery[];care?:{cost:number;hp:number}}
const counters:Record<Exclude<LandmarkKind,'police'>,Counter>={
  bakery:{label:'Buy fresh bread',stock:['bread','coffee']},
  cafe:{label:'Order at the coffee window',stock:['coffee','bread','apple']},
  restaurant:{label:'Order at the Blue Lantern',stock:['burger','fries','cola']},
  market:{label:'Shop the produce counter',stock:['apple','bread','cola']},
  florist:{label:'Visit the garden tea counter',stock:['tea']},
  petrol:{label:'Visit the forecourt kiosk',stock:['cola','coffee','fries']},
  fire:{label:'Visit the first-aid post',care:{cost:0,hp:10}},
  hospital:{label:'Visit outpatient reception',care:{cost:18,hp:100}},
  pharmacy:{label:'Visit the pharmacy counter',care:{cost:5,hp:25}},
  hall:{label:'Open the city housing register'},
  barber:{label:'Use the dressing mirror'},
  office:{label:'Review your portfolio'},
  school:{label:'Join the chess class'},
  books:{label:'Browse the chess library'},
  station:{label:'Choose a city connection'},
}
type Front=Counter&{id:string;name:string;x:number;z:number}
export const STOREFRONTS:Front[]=[
  ...LANDMARKS.flatMap(b=>b.id==='police'?[]:[{...counters[b.id],id:b.id,name:b.name,x:b.x,z:facade(b).z+b.facing*.78}]),
  {id:'mill',name:'Mill Green Bakehouse',x:-16.6,z:53.60,label:'Buy a mill roll',stock:['bread']},
  {id:'barn',name:'Mill Green Farm',x:-28,z:50.68,label:'Buy from the farm gate',stock:['apple','bread']},
  ...MARKET.map(([x,z],i):Front=>({id:'stall-'+i,name:i?'Market Coffee Cart':'Orchard Stall',x,z:z-1.30,label:i?'Order a takeaway drink':'Shop the orchard stall',stock:i?['coffee','tea']:['apple','bread']})),
]
export const storefrontPoints=STOREFRONTS.flatMap(f=>{
  const point={id:'front:'+f.id,label:f.label,x:f.x,z:f.z,range:1.4}
  const b=LANDMARKS.find(b=>b.id===f.id)
  return b?[point,{...point,x:b.x,z:b.z+b.facing*(counterLayout(b).counterZ+.85),range:1.03}]:[point]
})
export function storefront(service:string|undefined){return STOREFRONTS.find(f=>service==='front:'+f.id)}

type Landmark=typeof LANDMARKS[number]
export function counterLayout(b:Landmark){
  const half=b.d/2
  return {counterZ:-half+1.16,counterW:Math.min(b.w-.49,4.35),shelfX:-b.w/2+.25,
    benchX:b.w/2-.46,bench:b.w>=4.35&&b.id!=='fire',benchZ:half*.28}
}
export const counterSeats=LANDMARKS.flatMap(b=>{
  const layout=counterLayout(b)
  if(b.id==='police'||!layout.bench)return []
  const x=b.x+b.facing*layout.benchX,z=b.z+b.facing*layout.benchZ,id='window-seat-'+b.id
  const exit={x:x-b.facing*.63,z}
  return [{...exit,id:'furniture:'+id,label:'Sit by the window',range:.78,exit,
    pose:{x,z,yaw:b.facing*Math.PI/2,id,kind:'sit' as const,height:.48}}]
})
export function counterInterior(b:Landmark,x:number,z:number,y:number,pad:number){
  const dx=(x-b.x)*b.facing,dz=(z-b.z)*b.facing,w=b.w/2,d=b.d/2
  if(Math.abs(dx)>w+pad||Math.abs(dz)>d+pad||y<0||y>b.h)return false
  const entry=b.id==='fire'?1.38:.77
  if(Math.abs(dx)>w-.09-pad||dz< -d+.09+pad||dz>d-.09-pad&&(Math.abs(dx)>entry-pad||y>2.26))return true
  const layout=counterLayout(b)
  if(y>Math.min(3.1,b.h-.19))return true
  return y<1.03&&Math.abs(dx)<layout.counterW/2+pad&&Math.abs(dz-layout.counterZ)<.32+pad||
    y<2.05&&Math.abs(dx-layout.shelfX)<.22+pad&&Math.abs(dz)<d*.52+pad||
    layout.bench&&y<.94&&Math.abs(dx-layout.benchX)<.31+pad&&Math.abs(dz-layout.benchZ)<.72+pad
}
