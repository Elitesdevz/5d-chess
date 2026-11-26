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
export const storefrontPoints=STOREFRONTS.map(f=>({id:'front:'+f.id,label:f.label,x:f.x,z:f.z,range:1.4}))
export function storefront(service:string|undefined){return STOREFRONTS.find(f=>service==='front:'+f.id)}
