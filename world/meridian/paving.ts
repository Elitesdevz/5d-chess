import type {Street} from '../../src/world/geo.ts'
export function paving(STREETS:Street[],circle:{x:number;z:number;radius:number}){
  const surfaces:number[][]=[],markings:number[][]=[]
  const slab=(...values:number[])=>markings.push(values)
  const roads=STREETS.map(s=>({x:(s.a.x+s.b.x)/2,z:(s.a.z+s.b.z)/2,length:Math.hypot(s.b.x-s.a.x,s.b.z-s.a.z),width:s.width,vertical:s.a.x===s.b.x,major:s.traffic&&s.limit>6.7,walk:s.walk,traffic:s.traffic}))
  const xs=new Set<number>(),zs=new Set<number>()
  for(const r of roads){
    const lateral=r.vertical?xs:zs,along=r.vertical?zs:xs
    const mid=r.vertical?r.x:r.z,end=r.vertical?r.z:r.x
    for(const side of [-1,1]){
      for(const edge of [0,.18,Math.max(.18,r.walk)])lateral.add(mid+side*(r.width/2+edge))
      along.add(end+side*r.length/2)
    }
    if(r.major)for(let a=2-r.length/2;a<r.length/2-1;a+=4.4){
      if(roads.some(other=>other.vertical!==r.vertical&&Math.abs((r.vertical?other.z:other.x)-end-a)<other.width/2+1&&Math.abs((r.vertical?other.x:other.z)-mid)<other.length/2))continue
      if(Math.hypot(r.x+(r.vertical?0:a)-circle.x,r.z+(r.vertical?a:0)-circle.z)<circle.radius+3.45)continue
      slab(r.x+(r.vertical?0:a),r.z+(r.vertical?a:0),r.vertical?.085:1.48,r.vertical?1.48:.085,0xcfbf9a,-.012)
    }
  }
  const xx=[...xs].sort((a,b)=>a-b),zz=[...zs].sort((a,b)=>a-b)

  for(let i=1;i<xx.length;i++)for(let j=1;j<zz.length;j++){
    const l=xx[i-1],r=xx[i],t=zz[j-1],b=zz[j],x=(l+r)/2,z=(t+b)/2
    let layer=0
    for(const street of roads){
      const dx=Math.abs(x-street.x),dz=Math.abs(z-street.z),offset=(street.vertical?dx:dz)-street.width/2
      if((street.vertical?dz:dx)>=street.length/2||offset>=Math.max(.18,street.walk))continue
      layer=Math.max(layer,offset<0&&street.traffic?(street.major?4:3):offset<.18&&street.traffic?2:1)
    }
    if(!layer)continue
    const last=surfaces.at(-1)
    if(last&&last[0]===l&&last[2]===r&&last[3]===t&&last[4]===layer)last[3]=b
    else surfaces.push([l,t,r,b,layer])
  }
  return {surfaces,markings}
}
