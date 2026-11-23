import * as T from 'three'
import {Scenery} from './landscape.ts'
import {HOMES,MARKET,BOULEVARD_TREES} from './terrain.ts'
const cream=0xe1d0a8,bronze=0xa77b45,wood=0x684c3e,green=0x486552

export function avenues(parent:T.Object3D){
  const p=new Scenery()
  const slab=(x:number,z:number,w:number,d:number,color:number,y:number)=>p.add('box',x,y,z,w,.012,d,color)
  function road(x:number,z:number,length:number,width:number,vertical=false,major=false){
    const rect=(offset:number,along:number,w:number,l:number,color:number,y:number)=>slab(x+(vertical?offset:along),z+(vertical?along:offset),vertical?w:l,vertical?l:w,color,y)
    rect(0,0,width+2.8,length,0xb4aaa0,-.041);rect(0,0,width,length,major?0x535a5b:0x726d64,-.024)
    for(const side of [-1,1])rect(side*(width/2+.09),0,.18,length,0xd1c5af,-.005)
    if(major)for(let a=2-length/2;a<length/2-1;a+=4.4)rect(0,a,.085,1.48,0xcfbf9a,-.009)
  }
  road(0,11,122,5.4,false,true)
  road(0,29,32,4.3,true,true)
  for(const side of [-1,1]){
    road(side*37,31,49,3.5);road(side*37,-10.65,48,2.9)
    road(side*31,-30,38,3.1);road(side*48,0,60,3.1,true)
    road(side*10.4,22,18.5,2.4,true)
    slab(side*24,6.78,3.9,3.6,0xc3b9a2,-.001)
    for(let j=0;j<8;j++)slab(side*11.8,8.76+j*.63,1.82,.27,0xe2d7bc,.005)
  }
  slab(0,45,46,1.75,0xb9a88a,-.038)
  for(const [x,z] of HOMES){
    const lane=z<-32?-30:z<-11?-10.65:z<4?11:z>35?45:31
    const start=z+3,end=Math.max(start+.68,lane)
    slab(x,(start+end)/2,1.45,end-start,0xc3b69c,-.053)
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
      post(x,1.18,-1.89,.085,.31,bronze);box(x,1.48,-1.91,.85,.48,.11,0x273b3f)
      box(x,1.47,-1.842,.73,.36,.012,symbol==='CAS'?0xa78253:0x578f8b)
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
