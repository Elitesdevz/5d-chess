import {distance,type Landmark} from '../../src/world/geo.ts'
import type {MeridianSource} from './source.ts'
import type {Parking} from '../../src/world/city-plan.ts'

function unique(items:{id:string}[],group:string){
  const ids=new Set<string>()
  for(const {id} of items){
    if(!id||ids.has(id))throw Error(group+': duplicate or empty ID "'+id+'"')
    ids.add(id)
  }
}
type Placement={street:string;along:number;side:string;setback:number;beyondEnd?:number}
// Along is measured from endpoint A. Right and left are relative to A → B on the map.
export function resolveParcels(s:MeridianSource){
  if(!Number.isSafeInteger(s.seed))throw Error('seed: expected an integer')
  unique(s.streets,'streets')
  unique([...s.landmarks,...s.houses,...s.apartments,{id:'gunshop'}],'parcels')
  const roads=new Map(s.streets.map(r=>[r.id,r]))
  for(const r of s.streets){
    if(![r.a.x,r.a.z,r.b.x,r.b.z,r.width,r.walk,r.limit].every(Number.isFinite)||!(r.width>0&&r.walk>=0&&distance(r.a,r.b)>0)||(r.a.x!==r.b.x&&r.a.z!==r.b.z))throw Error(r.id+': expected a nonempty axis-aligned street with positive width')
  }
  const round=(n:number)=>Math.round(n*1e6)/1e6
  function locate(id:string,p:Placement){
    const r=roads.get(p.street)
    if(!r)throw Error(id+': unknown frontage street '+p.street)
    const length=distance(r.a,r.b)
    if(!Number.isFinite(p.along)||!Number.isFinite(p.setback)||p.setback<0||!['left','right'].includes(p.side))throw Error(id+': invalid frontage, check along, side and setback')
    if(p.along<0||p.along>length+(p.beyondEnd??0)+.00001)throw Error(id+': frontage outside '+r.id+' endpoints')
    const u=(r.b.x-r.a.x)/length,v=(r.b.z-r.a.z)/length
    const side=p.side==='right'?p.setback:-p.setback
    return {x:round(r.a.x+u*p.along-v*side),z:round(r.a.z+v*p.along+u*side),street:r.id}
  }
  function parcel<T extends {id:string;frontage:Placement}>(p:T){const {frontage,...rest}=p;return {...rest,...locate(p.id,frontage)}}
  const parking:Parking[]=s.parking.map(b=>{
    const {frontage,...rest}=b,p=locate(b.id,frontage)
    return {...rest,...p,kind:'kind' in b?b.kind as Parking['kind']:undefined,accessX:b.accessOffset===undefined?undefined:p.x+b.accessOffset}
  })
  const crossings=s.crossings.map(c=>{
    const p=locate('crossing',{...c,side:'left',setback:0}),r=roads.get(c.street)!
    if(c.along<0||c.along>distance(r.a,r.b))throw Error(r.id+': crossing beyond street end')
    return {x:p.x,z:p.z,width:r.width,axis:r.a.x===r.b.x?'x' as const:'z' as const,signal:c.signal}
  })
  function room(id:'hotel'|'bank'|'kfc'|'exchange'){
    const {frontage,...rest}=s.rooms[id];return {...rest,...locate(id,frontage)}
  }
  const hotel=room('hotel'),{parent,offset,...casino}=s.rooms.casino
  if(parent!=='hotel')throw Error('casino: expected the attached hotel')
  const rooms={hotel,casino:{...casino,x:hotel.x,z:Math.round((hotel.z+offset)*1e6)/1e6},bank:room('bank'),exchange:room('exchange'),kfc:room('kfc'),cave:s.rooms.cave,oasis:s.rooms.oasis}
  unique(s.keepClear,'keep-clear areas')
  for(const path of s.paths)if(path.points.length<2||!(path.width>0))throw Error(path.id+': public path needs at least two points and positive width')
  for(const h of s.houses)if(![1,2].includes(h.levels))throw Error(h.id+': house requires one or two storeys')
  for(const a of s.apartments)if(a.levels!==5)throw Error(a.id+': expected lobby and four residential storeys')
  for(const a of s.keepClear)if(!(a.w>0&&a.d>0))throw Error(a.id+': keep-clear dimensions must be positive')
  for(const id of Object.keys(s.overrides))if(!roads.has(id)&&!s.parks.some(p=>p.id===id))throw Error('override: unknown street or park '+id)
  for(const l of s.landmarks)if(!(l.w>0&&l.h>0&&l.d>0))throw Error(l.id+': footprint dimensions must be positive')
  // The legacy lease, fixture and flat IDs include a numeric residence index.
  // Keep those identities independent of the order in which authors list parcels.
  function residencesById<T extends {id:string;frontage:Placement}>(items:T[],prefix:string){
    const sorted=items.map(parcel).sort((a,b)=>Number(a.id.slice(prefix.length))-Number(b.id.slice(prefix.length)))
    for(const [i,b] of sorted.entries())if(b.id!==prefix+i)throw Error(b.id+': expected stable residence ID '+prefix+i)
    return sorted
  }
  const landmarks=s.landmarks.map(parcel) as Landmark[],shop={...s.shop,...locate('gunshop',s.shop.frontage)}
  const anchors=new Map([...landmarks,...s.parks,{...shop,id:'gunshop'},{...s.square,id:'square'},...Object.entries(rooms).map(([id,r])=>({...r,id}))].map(p=>[p.id,{x:p.x,z:p.z}]))
  const keepClear=s.keepClear.map(k=>{
    const anchor=anchors.get(k.anchor)
    if(!anchor)throw Error(k.id+': unknown keep-clear anchor '+k.anchor)
    return {id:k.id,x:anchor.x+k.across,z:anchor.z+k.along,w:k.w,d:k.d}
  })
  return {...s,landmarks,keepClear,spawn:{x:s.square.x+s.spawn.across,z:s.square.z+s.spawn.along,yaw:s.spawn.yaw},houses:residencesById(s.houses,'house-'),apartments:residencesById(s.apartments,'block-'),
    rooms,crossings,parking,shop}
}
export type Resolved=ReturnType<typeof resolveParcels>
export function civicParcels(s:Resolved){
  const p=s.precinct,b=s.landmarks.find(b=>b.id===p.landmark)
  if(!b)throw Error('precinct: missing landmark '+p.landmark)
  const origins={station:{x:b.x+p.dx,z:b.z+p.dz},gunshop:{x:s.shop.x,z:s.shop.z}}
  const footprint={station:{w:p.width,d:b.d},gunshop:{w:s.shop.w,d:s.shop.d}}
  const front={station:{x:p.doorX,z:-b.d/2,sign:-1},gunshop:{x:s.shop.doorX,z:s.shop.d/2,sign:1}}
  for(const id of ['station','gunshop'] as const){
    if(Math.abs(front[id].x)+1>=footprint[id].w/2)throw Error(id+': doorway outside frontage')
  }
  if(p.storeys!==5)throw Error('precinct: the 50 single-occupancy cells require five gallery levels')
  const cells=Array.from({length:50},(_,i)=>{
    const wing=i<25?-1:1,slot=i%5,row=slot<3?-1:1,column=slot%3
    const x=wing*(2.63+column*2.55),z=row*2.08
    return {number:i+1,level:1+Math.floor(i%25/5),wing,row,x,z,w:2.55,d:2.45}
  })
  return {cells,origins,footprint,front,rise:p.rise,stair:s.stair,deskFurniture:s.desks,shopCounter:s.counter,shopCases:s.cases}
}
