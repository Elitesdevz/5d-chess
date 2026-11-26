import {distance,point,type Point,type Street} from '../../src/world/geo.ts'
import type {Junction,Lane,Axis} from '../../src/world/traffic.ts'
export function laneNetwork(STREETS:Street[],circle:{x:number;z:number;radius:number}){
  const intersections=new Map<string,Junction>()
  const key=(p:Point)=>p.x+','+p.z
  function vertex(p:Point,road:string){
    const id=key(p)
    let v=intersections.get(id)
    if(!v){v={...p,id,roads:new Set(),signal:false};intersections.set(id,v)}
    v.roads.add(road)
    return v
  }
  const streets=STREETS.filter(s=>s.traffic)
  function nearSegment(p:Point,a:Point,b:Point){
    return p.x>=Math.min(a.x,b.x)&&p.x<=Math.max(a.x,b.x)&&p.z>=Math.min(a.z,b.z)&&p.z<=Math.max(a.z,b.z)
  }
  for(const s of streets){vertex(s.a,s.id);vertex(s.b,s.id)}
  for(const a of streets)for(const b of streets){
    if(a.a.x!==a.b.x||b.a.z!==b.b.z)continue
    const cross=point(a.a.x,b.a.z)
    if(nearSegment(cross,a.a,a.b)&&nearSegment(cross,b.a,b.b)){vertex(cross,a.id).roads.add(b.id)}
  }
  const roundPoints=Array.from({length:4},(_,i)=>vertex(point(circle.x+[circle.radius,0,-circle.radius,0][i],circle.z+[0,-circle.radius,0,circle.radius][i]),'ring'))
  roundPoints.forEach((p,i)=>p.round=i)
  const JUNCTIONS=[...intersections.values()]
  for(const j of JUNCTIONS)j.signal=j.roads.size>1&&!j.roads.has('ring')&&(j.roads.has('boulevard')||j.roads.has('court'))
  const SIGNAL_HEADS=JUNCTIONS.filter(j=>j.signal).flatMap(j=>
    [[-3.65,-3.65,'z'],[3.65,3.65,'z'],[-3.65,3.65,'x'],[3.65,-3.65,'x']].map(([dx,dz,axis])=>
      ({x:j.x+Number(dx),z:j.z+Number(dz),junction:j.id,axis:axis as Axis})))
  const length=(path:Point[])=>path.slice(1).reduce((l,p,i)=>l+distance(p,path[i]),0)
  const LANES=new Map<string,Lane>()
  function add(id:string,street:string,from:Junction,to:Junction,points:Point[],limit:number,axis:Axis){
    LANES.set(id,{id,street,from:from.id,to:to.id,points,length:length(points),limit,axis,next:[]})
  }
  for(const s of streets){
    const order=[...intersections.values()].filter(j=>j.roads.has(s.id)).sort((a,b)=>a.x-b.x||a.z-b.z)
    for(let i=1;i<order.length;i++)for(const direction of [-1,1]){
      const a=order[direction===1?i-1:i],b=order[direction===1?i:i-1]
      const span=distance(a,b),dx=(b.x-a.x)/span,dz=(b.z-a.z)/span,lateral=s.width/4
      const trim=Math.min(2.6,span*.27),lane=(p:Point,d:number)=>point(p.x+dx*d-dz*lateral,p.z+dz*d+dx*lateral)
      add(s.id+':'+i+':'+direction,s.id,a,b,[lane(a,trim),lane(b,-trim)],s.limit,dx?'x':'z')
    }
  }
  for(const [i,src] of roundPoints.entries()){
    const dst=roundPoints[(i+1)%4]
    const pts=Array.from({length:11},(_,k)=>{
      const a=(i+k/10)*Math.PI/2,r=circle.radius-.12
      return point(circle.x+Math.cos(a)*r,circle.z-Math.sin(a)*r)
    })
    add('ring:'+i,'ring',src,dst,pts,4.6,'x')
  }
  for(const lane of LANES.values()){
    const exits=[...LANES.values()].filter(to=>to.from===lane.to&&to.id!==lane.id)
    const choices=exits.filter(to=>to.to!==lane.from&&(!(lane.street==='ring'&&to.street==='ring')||lane.id!==to.id))
    lane.next=(choices.length?choices:exits).map(to=>to.id)
  }
  return {junctions:JUNCTIONS.map(j=>({...j,roads:[...j.roads]})),signalHeads:SIGNAL_HEADS,lanes:[...LANES.values()]}
}
