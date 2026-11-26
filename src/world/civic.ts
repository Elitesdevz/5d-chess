import * as T from 'three'
import {Scenery} from './landscape.ts'
import {MARKET,BOULEVARD_TREES} from './terrain.ts'
import {CROSSINGS,STREETS,circle} from './city-plan.ts'
import {PATHS} from './urban-layout.ts'
import {STOP_LINES} from './traffic.ts'
const cream=0xe1d0a8,bronze=0xa77b45,wood=0x684c3e,green=0x486552

export function avenues(parent:T.Object3D){
  const p=new Scenery()
  const slab=(x:number,z:number,w:number,d:number,color:number,y:number)=>p.add('box',x,y,z,w,.012,d,color)
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
  const positions:number[]=[],colors:number[]=[],color=new T.Color()
  for(let i=1;i<xx.length;i++)for(let j=1;j<zz.length;j++){
    const l=xx[i-1],r=xx[i],t=zz[j-1],b=zz[j],x=(l+r)/2,z=(t+b)/2
    let layer=0
    for(const street of roads){
      const dx=Math.abs(x-street.x),dz=Math.abs(z-street.z),offset=(street.vertical?dx:dz)-street.width/2
      if((street.vertical?dz:dx)>=street.length/2||offset>=Math.max(.18,street.walk))continue
      layer=Math.max(layer,offset<0&&street.traffic?(street.major?4:3):offset<.18&&street.traffic?2:1)
    }
    if(!layer)continue
    color.setHex([0,0xb4aaa0,0xd1c5af,0x726d64,0x535a5b][layer])
    const y=-.026
    positions.push(l,y,t,l,y,b,r,y,b,l,y,t,r,y,b,r,y,t)
    for(let k=0;k<6;k++)colors.push(color.r,color.g,color.b)
  }
  const network=new T.BufferGeometry()
  network.setAttribute('position',new T.Float32BufferAttribute(positions,3));network.setAttribute('color',new T.Float32BufferAttribute(colors,3));network.computeVertexNormals()
  parent.add(new T.Mesh(network,new T.MeshStandardMaterial({vertexColors:true,roughness:.92})))
  const ring=new T.Mesh(new T.RingGeometry(circle.radius-circle.width/2,circle.radius+circle.width/2,96),new T.MeshStandardMaterial({color:0x535a5b,roughness:.92}))
  ring.rotation.x=-Math.PI/2;ring.position.set(circle.x,-.021,circle.z);parent.add(ring)
  for(const r of [circle.radius-circle.width/2,circle.radius+circle.width/2]){
    const outer=r>circle.radius
    for(let arc=0;arc<(outer?4:1);arc++){
      const curb=new T.Mesh(new T.RingGeometry(r-.12,r+.13,outer?21:96,outer?arc*Math.PI/2+.32:0,outer?Math.PI/2-.64:Math.PI*2),
        new T.MeshStandardMaterial({color:0xc7baa2}))
      curb.rotation.x=-Math.PI/2;curb.position.set(circle.x,-.016,circle.z);parent.add(curb)
    }
  }
  for(const approach of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
    for(let j=-2;j<=2;j++){
      const x=Math.cos(approach)*10.65-Math.sin(approach)*j*.39,z=Math.sin(approach)*10.65+Math.cos(approach)*j*.39
      p.add('box',circle.x+x,-.007,circle.z+z,.22,.008,.23,0xe2d8bc)
    }
  }
  for(const stop of STOP_LINES)p.add('box',stop.x,-.009,stop.z,stop.width,.011,.162,0xe1d7bc,stop.yaw)
  for(const c of CROSSINGS)for(let across=-c.width/2+.27;across<c.width/2-.16;across+=.62){
    slab(c.x+(c.axis==='x'?across:0),c.z+(c.axis==='z'?across:0),c.axis==='x'?.255:1.62,c.axis==='z'?.255:1.62,0xd9d4bf,-.009)
  }
  for(const path of PATHS)for(let i=1;i<path.points.length;i++){
    const a=path.points[i-1],b=path.points[i],dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz)
    if(len>.07)p.add('box',(a.x+b.x)/2,path.purpose==='drive'?-.034:-.038,(a.z+b.z)/2,path.width,.016,len+.1,
      path.purpose==='park'?0xbda784:path.purpose==='drive'?0x827b70:0xbfb29b,Math.atan2(dx,dz))
  }
  for(const side of [-1,1]){
    // Boulevard trees, root grates, and low rectangular parterres.
    for(const x of BOULEVARD_TREES){
      const ax=side*x,z=14.85
      slab(ax,z,1.48,1.46,0x796f60,-.004)
      p.add('post',ax,.99,z,.23,2.02,.23,wood)
      for(let n=0;n<4;n++)p.add('crown',ax+Math.sin(n*2)*.44,2.35+n*.25,z+Math.cos(n*2)*.36,1.85,1.65,1.62,[0x638062,0x70875d,0x7d925e,0x89965f][n],n)
    }
    for(const z of [-3,4]){
      const x=side*6.25
      slab(x,z,1.04,3.8,0xbca47c,.085)
      p.add('box',x,.21,z,.88,.29,3.56,green)
      for(let i=0;i<11;i++)p.add('crown',x+Math.sin(i*3.2)*.24,.41,z+(i-5)*.31,.28,.18,.30,i%3?0xe3bb93:0xc58b8b)
    }
  }
  for(const [index,[x,z]] of MARKET.entries()){
    const stripe=index?0x50877e:0xab6055
    p.add('box',x,.55,z,2.6,.98,1.25,wood)
    for(const dx of [-1.26,1.26])for(const dz of [-.63,.63])p.add('box',x+dx,1.34,z+dz,.095,2.64,.095,wood)
    for(let i=0;i<9;i++){
      p.add('box',x+(i-4)*.36,2.54,z,.36,.16,1.85,i%2?cream:stripe)
      p.add('box',x+(i-4)*.36,2.40,z-.88,.36,.24,.105,i%2?cream:stripe)
    }
    for(let j=0;j<3;j++){
      const ax=x+(j-1)*.81
      p.add('box',ax,1.10,z,.73,.17,.83,0xb48a5b)
      for(let a=0;a<3;a++)for(let b=0;b<3;b++)p.add('crown',ax+(a-1)*.21,1.24,z+(b-1)*.23,.20,.23,.20,[0xb75742,0xe0ab58,0x93a459][j])
    }
  }
  p.finish(parent)
}

export function venueDetail(parent:T.Object3D,zone:'hotel'|'bank'|'exchange'|'casino'|'floor'|'oasis'|'cave',symbol=''){
  const p=new Scenery()
  const box=(x:number,y:number,z:number,w:number,h:number,d:number,c:number,r=0)=>p.add('box',x,y,z,w,h,d,c,0,r)
  const post=(x:number,y:number,z:number,w:number,h:number,c:number)=>p.add('post',x,y,z,w,h,w,c)
  const ball=(x:number,y:number,z:number,w:number,h:number,d:number,c:number)=>p.add('crown',x,y,z,w,h,d,c)
  const clock=(x:number,y:number,z:number,size:number,hour:number)=>{
    const face=(thick:number,rad:number,color:number,dz:number)=>{
      const m=new T.Mesh(new T.CylinderGeometry(rad,rad,thick,40),new T.MeshStandardMaterial({color}))
      m.rotation.x=Math.PI/2;m.position.set(x,y,z+dz);parent.add(m)
    }
    face(.1,size,bronze,0);face(.055,size*.89,cream,.075)
    for(let n=0;n<12;n++){const a=n*Math.PI/6;box(x+Math.sin(a)*size*.72,y+Math.cos(a)*size*.72,z+.118,.025,size*.12,.024,wood,-a)}
    const hand=(a:number,len:number)=>box(x+Math.sin(a)*len/2,y+Math.cos(a)*len/2,z+.145,.039,len,.026,wood,-a)
    hand(hour*Math.PI/6,size*.51);hand(Math.PI*.47,size*.68)
  }
  if(zone==='hotel'){
    // Concierge wall and countertop, in the quiet end of the west gallery.
    box(-6.25,.51,-6.26,4.3,1.02,.93,wood);box(-6.25,1.06,-6.26,4.48,.13,1.10,cream)
    for(let i=0;i<13;i++)box(-8.12+i*.31,.57,-5.77,.075,.74,.04,bronze)
    box(-6.22,2.09,-7.61,4.04,1.58,.30,wood)
    for(let r=0;r<3;r++)for(let c=0;c<8;c++){
      const x=-7.88+c*.47,y=1.65+r*.44
      box(x,y,-7.42,.39,.34,.025,0x3a3333);box(x+.11,y-.062,-7.385,.082,.12,.032,bronze)
    }
    post(-5.45,1.155,-6.13,.29,.067,bronze);ball(-5.45,1.234,-6.13,.23,.16,.23,0xe2b76e)
    for(let i=0;i<3;i++)box(-7.56,1.15+i*.073,-6.21,.57,.07,.38,i%2?0x596859:0x905648)
    for(const x of [-3,3]){
      for(const y of [4.39,4.59,4.79])post(x,y,.58,.86+(y-4.39)*1.6,.088,bronze)
      for(let k=0;k<14;k++){const a=k*Math.PI/7;ball(x+Math.cos(a)*.46,4.27,.58+Math.sin(a)*.46,.10,.44,.10,cream)}
      post(x,5.18,.58,.046,1.15,bronze)
    }
  }else if(zone==='bank'){
    clock(0,4.64,-6.05,.72,10)
    for(let row=0;row<4;row++)for(let col=0;col<5;col++){
      const x=-7.55+col*.72,y=1.28+row*.51
      box(x,y,-6.20,.69,.48,.14,0x58696b);box(x-.16,y,-6.096,.16,.042,.065,bronze)
    }
    for(const x of [-3.67,3.68]){
      post(x,1.38,-1.33,.09,.46,bronze);ball(x,1.66,-1.33,.63,.24,.30,0x487767)
    }
  }else if(zone==='casino'){
    // Gilt fan panels catch the light behind the tables.
    for(const x of [-7.45,0,7.45]){
      box(x,2.83,-6.44,3.54,2.91,.11,0x385357)
      for(let i=-4;i<=4;i++){
        const a=i*.218,len=2.26
        box(x+Math.sin(a)*len/2,1.57+Math.cos(a)*len/2,-6.34,.044,len,.05,bronze,-a)
      }
      for(const side of [-1,1])box(x+side*1.77,2.84,-6.33,.073,3.02,.06,bronze)
    }
    for(const [x,z] of [[-5,-2.55],[5,-2.55],[0,2.55],[6.1,3]]){
      for(let n=0;n<8;n++){const a=n*Math.PI/4;ball(x+Math.sin(a)*.83,4.46,z+Math.cos(a)*.83,.105,.33,.105,cream)}
    }
  }else if(zone==='exchange'||zone==='floor'){
    if(zone==='exchange'){
      for(let i=0;i<3;i++)clock(-4.99+i*1.13,3.72,-5.95,.41,3+i*3)
      for(const x of [-6.75,6.75]){
        box(x,2.81,-5.92,1.65,2.15,.16,0x304e55)
        for(let j=0;j<7;j++){const h=.38+((j*3+2)%6)*.17;box(x+(j-3)*.19,2.05+h/2,-5.80,.11,h,.04,j%3?0x8eb4a0:bronze)}
      }
    }
    const desks=zone==='floor'?[-2.7,2.7]:[.63]
    for(const x of desks){
      const monitor=symbol==='LOT'?x+Math.sign(x)*.66:x
      post(monitor,1.18,-1.89,.085,.31,bronze);box(monitor,1.48,-1.91,.85,.48,.11,0x273b3f)
      box(monitor,1.47,-1.842,.73,.36,.012,symbol==='CAS'?0xa78253:0x578f8b)
      box(x+.68,1.08,-1.68,.36,.033,.29,cream)
    }
  }else{
    for(let i=0;i<26;i++){
      const side=i%2?1:-1,z=6.5-i*.52,x=side*(1.53+.18*Math.cos(i*3))
      if(zone==='oasis'){
        p.add('pine',x,.33,z,.23,.72,.23,0x699675,i,.24*side)
        if(i%3===0)p.add('stone',x,.28,z,.30,.87,.36,0x78afa5,i,.13*side)
      }else p.add('pine',x,2.68,z,.39,.84,.37,0x756d60,i,Math.PI)
    }
  }
  p.finish(parent)
}
