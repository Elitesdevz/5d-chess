import type {Resolved,civicParcels} from './parcels.ts'
import type {residences} from './residences.ts'
import type {streetDetails} from './details.ts'
type Lot={id:string;x:number;z:number;w:number;d:number}
export function validateLots(s:Resolved,civic:ReturnType<typeof civicParcels>,homes:ReturnType<typeof residences>,detail:ReturnType<typeof streetDetails>){
  const lots:Lot[]=[
    ...s.landmarks.filter(b=>b.id!==s.precinct.landmark),...s.offices.map((b,i)=>({...b,id:'office-'+i})),
    ...(['gunshop','station'] as const).map(id=>({id:id==='station'?'police':id,...civic.origins[id],...civic.footprint[id]})),
    ...homes.buildings.map(b=>({id:b.id,x:b.x+(b.rect.l+b.rect.r)/2*b.facing,z:b.z+(b.rect.b+b.rect.f)/2*b.facing,w:b.rect.r-b.rect.l,d:b.rect.f-b.rect.b})),
    ...Object.entries(s.rooms).flatMap(([id,b])=>'width' in b?[{id,x:b.x,z:b.z+(b.back+b.front)/2,w:b.width*2,d:b.front-b.back}]:[])
  ]
  const inside=(x:number,z:number,lot:Lot)=>Math.abs(x-lot.x)<lot.w/2-.001&&Math.abs(z-lot.z)<lot.d/2-.001
  for(const [i,b] of lots.entries()){
    for(const a of lots.slice(0,i))if(Math.abs(a.x-b.x)<(a.w+b.w)/2-.001&&Math.abs(a.z-b.z)<(a.d+b.d)/2-.001)throw Error(b.id+': footprint overlaps '+a.id)
  }
  for(const e of detail.entrances){
    const conflict=lots.find(b=>inside(e.front.x,e.front.z,b))
    if(conflict)throw Error(e.id+': entrance blocked by '+conflict.id)
  }
  for(const area of s.keepClear){
    const blocked=lots.find(b=>Math.abs(area.x-b.x)<(area.w+b.w)/2&&Math.abs(area.z-b.z)<(area.d+b.d)/2)
    if(blocked)throw Error(area.id+': keep-clear area intersects '+blocked.id)
  }
  return lots
}
