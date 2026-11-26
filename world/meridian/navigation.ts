import {distance,distSegment,inLane} from '../../src/world/geo.ts'
import type {Resolved} from './parcels.ts'
import type {streetDetails} from './details.ts'

// Static pedestrian preference on the NPC's existing 0.93 m grid. Occupants,
// vehicles and door states remain live constraints during route searches.
export function pedestrianGrid(s:Resolved,paths:ReturnType<typeof streetDetails>['paths']){
  const step=.93,left=-84,right=84,top=-100,bottom=52,rows:string[]=[]
  const segments=paths.filter(p=>p.purpose!=='drive').flatMap(p=>p.points.slice(1).map((b,i)=>({a:p.points[i],b,range:p.width/2+.45})))
  for(let j=top;j<=bottom;j++){
    let row=''
    for(let i=left;i<=right;i++){
      const p={x:i*step,z:j*step},ring=Math.abs(distance(p,s.circle)-s.circle.radius)
      const road=s.streets.some(r=>r.traffic&&inLane(p,r))||ring<s.circle.width/2
      if(road){
        const crossing=s.crossings.some(c=>Math.abs(p.x-c.x)<(c.axis==='x'?c.width/2+.8:1.54)&&Math.abs(p.z-c.z)<(c.axis==='z'?c.width/2+.8:1.54))
        row+=crossing?'C':'R'
      }else{
        const edge=s.streets.some(r=>r.traffic&&inLane(p,r,.05))||ring<s.circle.width/2+.05
        const walk=!edge&&s.streets.some(r=>r.walk>0&&distSegment(p,r.a,r.b)<r.width/2+r.walk+.25)
        row+=walk||segments.some(v=>distSegment(p,v.a,v.b)<v.range)?'W':'.'
      }
    }
    rows.push(row)
  }
  return {step,left,top,rows}
}
