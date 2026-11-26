import type {streetDetails} from './details.ts'
import type {Resolved} from './parcels.ts'
import {distance} from '../../src/world/geo.ts'

// Shallow stone landings, contrasting inlays and crossing ramps use the same metres as the approach paths.
export function frontages(s:Resolved,layout:ReturnType<typeof streetDetails>){
  const inlays:{x:number;z:number;w:number;d:number;yaw:number;color:number}[]=[]
  for(const p of layout.paths.filter(p=>p.purpose==='entry'&&!/^(house|block)-/.test(p.id))){
    for(const [i,b] of p.points.slice(1).entries()){
      const a=p.points[i],len=distance(a,b)
      if(len<.25)continue
      const dx=(b.x-a.x)/len,dz=(b.z-a.z)/len,yaw=Math.atan2(dx,dz)
      const shade=p.id.startsWith('hotel')?0xd2bc99:0xcabda9
      inlays.push({x:(a.x+b.x)/2,z:(a.z+b.z)/2,w:p.width,d:len,yaw,color:shade})
      for(const side of [-1,1]){
        inlays.push({x:(a.x+b.x)/2+side*dz*p.width*.45,z:(a.z+b.z)/2-side*dx*p.width*.45,w:.065,d:len,yaw,color:0x957958})
      }
      for(let j=.9;j<len;j+=1.2)inlays.push({x:a.x+dx*j,z:a.z+dz*j,w:p.width*.86,d:.035,yaw,color:0xa69985})
    }
  }
  for(const c of s.crossings)for(const side of [-1,1]){
    const offset=side*(c.width/2+.35),horizontal=c.axis==='x'
    inlays.push({x:c.x+(horizontal?offset:0),z:c.z+(horizontal?0:offset),w:1.65,d:.67,yaw:horizontal?Math.PI/2:0,color:0xb5a17e})
  }
  return inlays
}

// Keyed variation keeps an unrelated parcel edit from repainting every facade.
export function facadeFinishes(s:Resolved){
  return Object.fromEntries(s.landmarks.map(l=>{
    let hash=s.seed
    for(const c of l.id)hash=Math.imul(hash^c.charCodeAt(0),16777619)>>>0
    return [l.id,hash%3]
  }))
}
