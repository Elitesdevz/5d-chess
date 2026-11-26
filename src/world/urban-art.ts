import * as T from 'three'
import {Scenery} from './landscape.ts'
import {circle,FLEET,LANDMARKS,PARK_FEATURES,PARKING,PARKS,pond,railZ,STREETS,type Landmark, type VehicleKind} from './city-plan.ts'
import {JUNCTIONS,SIGNAL_HEADS,type TrafficView,type Vehicle} from './traffic.ts'
import {groundShadow} from './shade.ts'
import {finishFloor} from './hotel-finishes.ts'
import {coachwork} from './coachwork.ts'
import {batchOpaque} from '../casino/scene/static-batch.ts'
import {counterLayout,STOREFRONTS} from './storefronts.ts'
import {STREET_PROPS} from './urban-layout.ts'
import type {Letter} from './residential-art.ts'
import {TERRAIN_EXTENT,terrainHeight} from './terrain.ts'

const cream=0xe4d4b4,stone=0xbba991,coal=0x38454a,wood=0x856146,metal=0xa3aab0,leaf=0x64825d,glass=0x71939c,light=0xffe2a2
const solid=new T.MeshStandardMaterial({roughness:.83,flatShading:true})
const glow=new T.MeshBasicMaterial({color:light})
const disc=new T.CylinderGeometry(1,1,1,24)
const color=(x:number)=>new T.MeshStandardMaterial({color:x,roughness:.69,flatShading:true})
const daylight=0xccdde0
const palette={
  hall:[0xc5aa89,cream,0x54736e],police:[0x97a3a5,0xcbd1c8,0x446277],fire:[0xab6251,cream,0x8a3e3c],
  hospital:[0xc4ccbf,0xe5deca,0x547b7d],market:[0xa7ab83,cream,0x53704e],petrol:[0xd1c3a5,0xe4c877,0x406964],
  school:[0xab7663,cream,0x536c73],station:[0xb58c6b,cream,0x466862],bakery:[0xa47a54,cream,0x915b4d],
  cafe:[0xbc9e74,cream,0x496c58],books:[0x877678,cream,0x64677b],florist:[0xb4ab8d,cream,0x4d775a],
  pharmacy:[0xc1c9b9,cream,0x5e8c79],barber:[0xaf9382,cream,0x52677c],office:[0x70858b,0xabb8af,0x4c696e],
  restaurant:[0x8d7e82,cream,0x435b78],
}
class Props{
  constructor(private s=new Scenery()){}
  box(x:number,y:number,z:number,w:number,h:number,d:number,color:number,yaw=0,roll=0){this.s.add('box',x,y,z,w,h,d,color,yaw,roll)}
  post(x:number,y:number,z:number,w:number,h:number,d:number,color:number){this.s.add('post',x,y,z,w,h,d,color)}
  orb(x:number,y:number,z:number,w:number,h:number,d:number,color:number){this.s.add('crown',x,y,z,w,h,d,color)}
  gable(x:number,y:number,z:number,w:number,h:number,d:number,color:number){this.s.add('gable',x,y,z,w,h,d,color)}
  finish(g:T.Object3D){this.s.finish(g,solid)}
  slab(x:number,z:number,w:number,d:number,c=stone,y=-.035){this.box(x,y,z,w,.035,d,c)}
  bar(ax:number,az:number,bx:number,bz:number,y:number,w:number,h:number,c:number){
    this.box((ax+bx)/2,y,(az+bz)/2,w,h,Math.hypot(bx-ax,bz-az),c,Math.atan2(bx-ax,bz-az))
  }
}
function tree(p:Props,x:number,z:number,size=1,y=0){
  p.post(x,y+.99*size,z,.23*size,2.02*size,.23*size,wood)
  for(let i=0;i<4;i++)p.orb(x+Math.sin(i*2.2)*.56*size,y+(2.33+i*.29)*size,z+Math.cos(i*2.2)*.47*size,2.18*size,1.93*size,2.02*size,[0x577859,0x70865d,0x8f9a63,0x64875e][i])
}
function garden(p:Props,x:number,z:number,w:number,d:number,tone:number){
  p.box(x,.13,z,w,.28,d,stone)
  p.box(x,.28,z,w-.14,.075,d-.13,0x72644e)
  for(let i=0;i<Math.ceil(w*3);i++){
    const xx=x+(i/Math.ceil(w*3)-.47)*w
    p.orb(xx,.43,z+.19*Math.cos(i*2.4),.31,.23,.36,leaf)
    p.orb(xx,.53,z+.18*Math.cos(i*2.4),.15,.12,.15,i%4?tone:0xf1d5a4)
  }
}
function clock(parent:T.Object3D,x:number,y:number,z:number){
  for(const [r,c,dz] of [[.46,coal,0],[.395,cream,.043]]){
    const face=new T.Mesh(disc,color(c));face.scale.set(r,.058,r);face.position.set(x,y,z+dz);face.rotation.x=Math.PI/2;parent.add(face)
  }
  const p=new Props()
  for(let i=0;i<12;i++){
    const a=i*Math.PI/6
    p.box(x+Math.sin(a)*.32,y+Math.cos(a)*.32,z+.077,.025,.06,.021,coal,0,-a)
  }
  p.box(x+.056,y+.083,z+.086,.035,.22,.018,coal,0,-.64)
  p.box(x-.081,y+.04,z+.088,.024,.28,.018,coal,0,1.05);p.finish(parent)
}
function building(parent:T.Object3D,b:Landmark,label:Letter){
  const g=new T.Group();g.position.set(b.x,0,b.z);g.rotation.y=b.facing<0?Math.PI:0;parent.add(g)
  const p=new Props(),[wall,trim,accent]=palette[b.id],{w,d,h}=b,front=d/2
  const sign=(name:string,x:number,y:number,z:number,width:number,height=.37)=>label(g,name,[width,height],[x,y,z],'#fff2d3','#2c413f')
  const reveal=(x:number,y:number,z:number,width:number,height:number,edge=trim,c=glass)=>{
    p.box(x,y,z-.04,width,height,.10,coal)
    p.box(x,y,z+.029,width-.105,height-.11,.038,c)
    for(const dx of [-.5,.5])p.box(x+dx*(width-.02),y,z+.08,.057,height+.032,.05,edge)
    for(const dy of [-.5,.5])p.box(x,y+dy*height,z+.075,width+.09,.056,.075,edge)
    p.box(x,y,z+.062,.034,height,.046,edge)
    p.box(x,y-height/2,z+.137,width+.18,.078,.25,edge)
  }
  const publicRoom=b.id!=='police'
  if(publicRoom){
    const entry=b.id==='fire'?1.38:.77
    p.box(0,-.018,0,w,.085,d,trim)
    p.box(0,h*.5,-front,w,h,.15,wall)
    for(const side of [-1,1]){
      p.box(side*(w/2-.062),h*.5,0,.125,h,d,wall)
      const wing=w/2-entry
      p.box(side*(entry+wing/2),h*.5,front,wing,h,.15,wall)
      p.box(side*(entry+.02),1.15,front+.025,.085,2.3,.22,accent)
    }
    p.box(0,(h+2.29)/2,front,entry*2,h-2.29,.15,wall)
    p.box(0,2.31,front+.03,2*entry+.12,.11,.23,accent)
    counterRoom(g,p,b,label,accent)
  }else p.box(0,h/2,0,w,h,d,wall)
  p.box(0,h-.06,0,w+.22,.20,d+.25,accent)
  p.box(0,h+.12,0,w+.38,.14,d+.42,trim)
  const upper=Math.max(0,Math.floor((h-3.3)/2.2))
  for(let floor=0;floor<=upper;floor++){
    const y=floor*2.12+1.44
    const windows=Math.max(2,Math.floor((w-.4)/2.4))
    if(!floor&&b.id==='fire')continue
    for(let i=0;i<windows;i++){
      const x=(i+.5)*w/windows-w/2
      if(!floor&&Math.abs(x)<(b.id==='hall'?1.62:1.26))continue
      reveal(x,y,front+.055,w/windows*.72,floor?1.33:1.78,trim,i%3===2?0x536f75:glass)
    }
    for(const side of [-1,1])for(let i=0;i<Math.floor(d/2.05);i++){
      const z=(i+.55)*d/Math.floor(d/2.05)-d/2
      p.box(side*(w/2+.034),y,z,.044,1.30,1.23,trim)
      p.box(side*(w/2+.066),y,z,.024,1.13,1.04,glass)
      p.box(side*(w/2+.104),y-.67,z,.19,.085,1.37,trim)
    }
  }
  if(b.id!=='station')p.slab(0,front+.48,w,.98,0xad9f87,-.008)
  const entranceSignWidth=Math.min(w-.4,w*.84,b.id==='hall'?7:8.2)
  const entranceSignHeight=w>8?.55:.42
  sign(b.name,0,b.id==='fire'?3.83:b.id==='hospital'?3.45:2.77,front+.18,entranceSignWidth,entranceSignHeight)
  for(const side of [-1,1]){
    const x=side*(w/2-.27)
    p.box(x,1.67,front+.15,.09,3.31,.09,accent)
    p.box(x,3.31,front+.085,.11,.28,.28,trim)
    p.box(x,.48,-front-.045,.52,.77,.15,coal)
    for(let i=0;i<4;i++)p.box(x,.25+i*.145,-front-.138,.36,.034,.032,metal)
  }
  if(b.id==='hall'){
    p.box(0,h+1.37,-.35,3.75,2.7,3.58,wall)
    p.box(0,h+2.76,-.35,4.09,.19,3.87,accent)
    p.gable(0,h+3.55,-.35,4.25,1.52,4.12,accent)
    clock(g,0,h+1.6,1.46)
    p.gable(0,3.72,front+.03,7.22,1.13,.16,trim)
    p.box(0,3.18,front+.54,7.18,.24,1.17,trim)
    for(const dx of [-3.24,-2.36,2.36,3.24]){
      p.post(dx,1.62,front+.62,.33,2.92,.34,cream)
      p.post(dx,.23,front+.62,.49,.22,.49,trim)
    }
    p.slab(0,front+.81,7.72,1.6,trim,.049)
    p.slab(0,front+1.18,8.1,1.55,trim,.008)
    for(const dx of [-4.9,4.9]){
      garden(p,dx,front+.43,1.55,.89,0xd98d76)
      p.post(dx,2.34,front+.58,.053,4.52,.055,metal)
      p.box(dx+.46,4.13,front+.56,.89,.51,.024,dx<0?0xb46564:0x597d80)
    }
  }else if(b.id==='fire'){
    for(const x of [-4.55,-.69,3.22]){
      const z=front+.065
      if(x===-.69){p.box(0,2.94,z,3.37,.69,.13,metal);continue}
      p.box(x,1.65,z,3.35,3.23,.11,0xc1bfb0)
      for(let i=0;i<13;i++)p.box(x,.15+i*.245,z+.071,3.20,.017,.043,coal)
      p.box(x,2.34,z+.102,2.4,.38,.037,0x6d9199)
    }
    reveal(5.98,1.09,front+.03,.94,2.03,cream,0x5c3941)
    p.box(-5.27,h+.98,-2.36,2.62,1.93,2.14,wall)
    p.box(-5.27,h+2.05,-2.36,2.91,.16,2.44,accent)
    p.slab(0,front+1.04,w-.25,2.08,0x958975)
  }else if(b.id==='hospital'){
    for(const side of [-1,1]){
      p.box(side*6.99,h+.61,-1.14,5.58,1.19,4.48,wall)
      p.box(side*6.99,h+1.26,-1.14,5.83,.15,4.71,accent)
    }
    p.box(-.76,2.60,front+1.01,7.85,.21,2.10,accent)
    for(const x of [-4.44,2.86])p.post(x,1.27,front+1.87,.13,2.49,.13,trim)
    p.box(-6.65,4.25,front+.141,.32,1.15,.06,0xbf534d);p.box(-6.65,4.25,front+.146,1.11,.31,.07,0xbf534d)
    reveal(7.28,1.30,front+.03,2.48,2.51,accent,0x4f6f72)
    sign('EMERGENCY',7.28,2.9,front+.177,2.90,.34)
    garden(p,-7.10,front+.51,2.43,.85,0xcaa394)
  }else if(b.id==='police'){
    p.box(-3.88,1.6,front+.27,3.59,3.2,.50,accent)
    reveal(-3.88,1.69,front+.548,2.83,2.28,trim,0x85a6af)
    p.post(5.4,2.51,front+1.4,.061,5.0,.061,metal)
    p.box(5.89,4.59,front+1.39,.94,.53,.03,0x466b85)
    p.box(5.89,4.61,front+1.414,.17,.23,.012,cream)
    p.box(4.6,3.49,front+.21,.24,.17,.41,coal,Math.PI/8)
    for(const side of [-1,1])for(let i=0;i<8;i++)p.post(side*(w*.53),.51,-front+.55+i*.4,.041,1.02,.041,coal)
  }else if(b.id==='school'){
    p.box(0,h+.26,0,w+.20,.36,d+.4,accent)
    for(const x of [-w*.35,w*.35])p.box(x,h*.53,front+.23,.6,h*1.05,.49,trim)
    p.box(0,2.52,front+.7,4.1,.17,1.4,accent)
    for(const x of [-1.88,1.88])p.post(x,1.27,front+1.15,.11,2.48,.11,trim)
    const groundX=PARK_FEATURES.schoolPlay.x-b.x
    p.slab(groundX,.0,4.2,6.3,0x78948a)
    for(const z of [-2.5,2.5])p.box(groundX,.001,z,3.87,.017,.07,cream)
    for(const x of [groundX-1.95,groundX+1.95])p.box(x,.001,0,.07,.017,5,cream)
    for(let j=0;j<12;j++)p.post(groundX-2.27,.76,j*.58-3.13,.049,1.48,.049,coal)
    p.bar(groundX-2.27,-3.13,groundX-2.27,3.25,1.24,.05,.05,coal)
    p.post(groundX,1.13,-2.27,.087,2.26,.087,coal)
    p.box(groundX,2.17,-2.21,.85,.48,.075,trim)
    p.box(groundX,1.99,-1.97,.33,.047,.31,0xa96555)
    p.bar(groundX-1.37,1.4,groundX+1.37,1.4,1.53,.071,.074,accent)
    for(const dx of [-1.28,1.28])for(const dz of [-.36,.36])
      p.box(groundX+dx,.77,1.4+dz,.074,1.61,.074,accent,0,-dx*.11)
    for(const dx of [-.52,.52]){
      for(const edge of [-.10,.10])p.post(groundX+dx+edge,.91,1.4,.028,1.07,.028,metal)
      p.box(groundX+dx,.39,1.4,.30,.055,.22,wood)
    }
  }else if(b.id==='station'){
    p.gable(0,h+.73,0,w+.47,1.43,d+.63,accent)
    p.gable(0,3.85,front+.176,5.85,1.8,.2,trim)
    clock(g,0,3.85,front+.303)
    for(const x of [-5.70,-3.05,3.05,5.70]){
      reveal(x,2.02,front+.082,1.78,2.41,trim,0x7f9b9d)
      p.box(x,2.1,front+.13,1.59,.043,.08,trim)
    }
    p.slab(0,front+.75,w+.3,1.62,trim)
  }else if(b.id==='petrol'){
    const canopy=front+2.9
    p.box(0,2.54,canopy,w+.62,.27,3.28,accent)
    p.box(0,2.76,canopy,w+.73,.16,3.35,trim)
    for(const x of [-3.75,3.75])p.post(x,1.26,canopy,.19,2.48,.19,coal)
    for(const x of [-2.5,0,2.5]){
      p.slab(x,canopy,1.16,1.45,cream,.045)
      p.box(x,.72,canopy,.47,1.22,.43,trim);p.box(x,.96,canopy+.23,.27,.29,.035,coal)
      p.box(x+.245,.62,canopy+.09,.028,.59,.056,coal)
      for(const dx of [-.47,.47])p.post(x+dx,.33,canopy+.54,.14,.63,.14,accent)
    }
    sign('95  ·  DIESEL  ·  EV',-3.25,2.92,canopy+1.74,3.66,.33)
  }else if(b.id==='market'){
    p.box(0,2.62,front+.34,w+.25,.22,.88,accent)
    for(const x of [-4.7,-2.95,2.95,4.7])reveal(x,1.51,front+.134,1.63,1.98,trim,0x84a69f)
    p.box(5.41,.61,front+.65,1.25,.09,.65,coal)
    for(let i=0;i<3;i++){
      const x=5.02+.37*i
      p.box(x,.42,front+.68,.29,.29,.48,metal)
      for(const dx of [-.117,.117])p.post(x+dx,.15,front+.74,.065,.15,.065,coal)
    }
    p.box(3.8,1.18,-front-.059,2.86,2.26,.12,accent)
    for(let i=0;i<7;i++)p.box(3.8,.26+i*.3,-front-.132,2.69,.035,.031,metal)
  }else{
    if(b.id==='books'||b.id==='bakery'||b.id==='florist')p.gable(0,h+.55,0,w+.47,1.02,d+.35,accent)
    else p.box(w*.14,h+.38,-.68,Math.max(1.1,w*.35),.65,1.21,accent)
    if(b.id!=='office')for(let i=0;i<9;i++)p.box((i-4)*w*.115,2.35,front+.33,w*.112,.105,.76,i%2?cream:accent)
    for(const x of [-w*.32,w*.32]){
      reveal(x,1.4,front+.087,w*.255,1.57,trim,b.id==='barber'?0x617e89:0x536a6a)
      for(let j=0;j<4;j++){
        const xx=x+(j-1.5)*w*.045
        if(b.id==='florist'){
          p.post(xx,.77,front+.183,.105,.20,.11,0xb98067)
          p.orb(xx,.99,front+.22,.19,.26,.20,j%2?0xe8b285:0xbc7588)
        }else if(b.id==='books')p.box(xx,.89+(j%2)*.08,front+.187,.104,.37+j*.052,.077,[0xbf855f,trim,0x8a7890,accent][j])
        else if(b.id==='bakery')p.orb(xx,.91,front+.206,.22,.14,.15,j%2?0xe5b878:0xaf744d)
      }
    }
    if(b.id==='barber'){
      p.post(w*.41,1.43,front+.28,.19,.74,.19,cream)
      for(let i=0;i<4;i++)p.box(w*.41,1.16+i*.15,front+.384,.165,.055,.041,i%2?0xaf5050:accent,0,-.33)
    }
  }
  const service=STOREFRONTS.find(f=>f.id===b.id)
  if(service){
    const x=w*.34
    // Perpendicular blade and sconce remain legible walking along the shopfront.
    p.box(x,2.88,front+.31,.06,.07,.67,coal)
    p.box(x,2.59,front+.52,.12,.53,.65,accent)
    const emblem=service.care?'✚':b.id==='station'?'↔':b.id==='school'||b.id==='books'?'♞':b.id==='bakery'?'B':b.name[0]
    for(const side of [-1,1])sign(emblem,x+side*.068,2.59,front+.52,.58,.42).rotation.y=side*Math.PI/2
    p.box(-x,1.87,front+.19,.22,.36,.16,coal)
    p.box(-x,1.87,front+.28,.15,.25,.07,light)
    if(service.stock){
      p.box(x,.80,front+.27,w*.27,.09,.48,wood)
      p.box(x,.72,front+.45,w*.28,.10,.06,trim)
      for(let j=0;j<3;j++){
        const xx=x+(j-1)*w*.073
        p.box(xx,.89,front+.28,w*.07,.11,.26,0xbd926b)
        if(service.stock.includes('apple'))for(let k=0;k<3;k++)p.orb(xx+(k-1)*.061,1.00,front+.27+(k%2)*.06,.11,.11,.11,j%2?0xad5941:0x9ca95e)
        else if(b.id==='bakery')p.orb(xx,.99,front+.29,.22,.12,.13,0xd6a665)
        else p.post(xx,1.01,front+.27,.11,.18,.11,j%2?accent:trim)
      }
    }
  }
  for(const side of [-1,1]){
    const x=side*(w*.26)
    p.box(x,h+.21,-d*.24,.57,.27,.58,coal)
    for(let i=0;i<3;i++)p.box(x,h+.358,-d*.25+(i-1)*.12,.45,.035,.045,metal)
  }
  p.finish(g)
}
function counterRoom(g:T.Group,p:Props,b:Landmark,label:Letter,accent:number){
  const {w,d,h}=b,back=-d/2,ceiling=Math.min(3.1,h-.19)
  const {counterW,counterZ,shelfX,benchX,benchZ,bench}=counterLayout(b)
  const care=['hospital','fire','pharmacy'].includes(b.id),food=['bakery','market','petrol','restaurant','cafe'].includes(b.id)
  const floor=care?0xdce2d7:food?0xc6ac88:0xaf9477
  p.box(0,.006,0,w-.13,.052,d-.13,floor)
  p.box(0,ceiling,0,w-.08,.09,d-.09,0xe5dcc9)
  finishFloor(g,care||b.id==='bakery'||b.id==='station'?'terrazzo':'parquet',0,.036,0,w-.13,d-.13,care?1.12:2.1)
  for(const side of [-1,1]){
    p.box(side*(w/2-.10),.46,0,.07,.90,d-.15,accent)
    p.box(side*(w/2-.14),.94,0,.07,.055,d-.15,wood)
  }
  p.box(0,.47,counterZ,counterW,.86,.57,accent)
  p.box(0,.93,counterZ,counterW+.06,.10,.65,care?cream:wood)
  const panels=Math.max(3,Math.round(counterW/.45))
  for(let i=0;i<panels;i++)p.box((i+.5-panels/2)*counterW/panels,.45,counterZ+.298,counterW/panels-.045,.68,.045,wood)
  p.box(-counterW*.28,1.029,counterZ,.29,.085,.24,coal)
  p.box(-counterW*.28,1.172,counterZ-.04,.26,.21,.04,coal)
  p.box(-counterW*.28,1.17,counterZ-.012,.20,.145,.012,0x87b4ac)
  const boardW=Math.min(2.25,w*.53)
  p.box(0,2.13,back+.12,boardW+.13,.81,.062,wood)
  label(g,b.name,[boardW,.69],[0,2.13,back+.159],'#ffefd0','#344d49')
  for(const y of [.69,1.25,1.81]){
    p.box(shelfX,y,0,.39,.052,d*.52,wood)
    for(let j=0;j<6;j++){
      const z=(j-2.5)*d*.078,col=[cream,accent,0xb77e59,0x748e85][(j+Math.round(y*4))%4]
      if(b.id==='bakery'){
        p.orb(shelfX+.04,y+.097,z,.23,.14,.21,0xe0ae6d)
        for(const dz of [-.05,.04])p.box(shelfX+.04,y+.154,z+dz,.12,.013,.018,cream,.2)
      }else if(b.id==='florist'){
        p.post(shelfX,y+.10,z,.13,.16,.13,0xb97b59)
        p.orb(shelfX+.03,y+.23,z,.22,.16,.22,leaf);p.orb(shelfX+.055,y+.32,z,.11,.12,.11,col)
      }else if(b.id==='books'||b.id==='hall'||b.id==='school'||b.id==='office'){
        p.box(shelfX,y+.17,z,.22,.28+(j%3)*.037,.096,col)
        p.box(shelfX+.115,y+.22,z,.011,.033,.072,cream)
      }else if(care||b.id==='barber'){
        p.post(shelfX,y+.13,z,.114,.21,.114,col);p.post(shelfX,y+.257,z,.078,.042,.078,coal)
      }else {
        p.box(shelfX,y+.14,z,.18,.23,.16,col);p.box(shelfX+.094,y+.14,z,.014,.083,.125,cream)
      }
    }
  }
  if(bench){
    p.box(benchX,.23,benchZ,.43,.37,1.22,wood)
    p.box(benchX,.45,benchZ,.58,.13,1.41,accent)
    p.box(benchX+.255,.70,benchZ,.095,.49,1.4,accent)
    for(const z of [-.63,.63])p.box(benchX,.55,benchZ+z,.52,.073,.065,wood)
  }
  for(const x of (w>7?[-w*.28,0,w*.28]:[0])){
    p.post(x,ceiling-.20,.34,.034,.35,.034,coal)
    p.post(x,ceiling-.39,.34,.47,.13,.47,accent)
    p.post(x,ceiling-.465,.34,.40,.026,.40,light)
  }
  const cx=counterW*.23
  if(b.id==='cafe'||b.id==='restaurant'){
    p.box(cx,1.23,counterZ-.12,.51,.43,.31,metal)
    p.box(cx,1.21,counterZ+.047,.42,.18,.038,coal)
    for(const x of [-.12,.12]){p.post(cx+x,1.033,counterZ+.10,.101,.11,.101,cream);p.post(cx+x,1.16,counterZ+.075,.033,.09,.033,metal)}
  }else if(b.id==='school'){
    for(let i=0;i<8;i++)for(let j=0;j<8;j++)p.box(cx+(i-3.5)*.061,.989,counterZ+(j-3.5)*.061,.06,.013,.06,(i+j)%2?coal:cream)
    for(let i=0;i<6;i++)p.post(cx+(i-2.5)*.061,1.046,counterZ+(i%2?.15:-.15),.038,.10,.038,i%2?coal:cream)
  }else if(care){
    p.box(cx,1.14,counterZ,.41,.32,.23,cream)
    p.box(cx,1.14,counterZ+.12,.066,.19,.018,0xa8554d);p.box(cx,1.14,counterZ+.13,.19,.059,.018,0xa8554d)
  }else if(b.id==='barber'){
    p.box(cx,1.58,back+.11,.73,1.18,.09,wood)
    p.box(cx,1.58,back+.173,.65,1.10,.045,0xa8c1bf)
  }else if(b.id==='bakery'||b.id==='market'){
    p.box(cx,1.0,counterZ,.62,.045,.37,cream)
    for(let i=0;i<6;i++)p.orb(cx+((i%3)-1)*.17,1.078,counterZ+(Math.floor(i/3)-.5)*.14,.16,.12,.14,b.id==='bakery'?0xc99a61:i%2?0xb96849:0x92a165)
  }
}
function railway(parent:T.Object3D,label:Letter){
  const trackside=new T.Group();trackside.name='Railway';parent.add(trackside)
  const p=new Props(new Scenery(34)),c=0xa09884
  for(let i=-TERRAIN_EXTENT;i<TERRAIN_EXTENT;i+=2){
    const j=i+2,a=railZ(i),b=railZ(j)
    p.bar(i,a,j,b,-.034,5.35,.08,c)
    for(const track of [-1.04,1.04]){
      for(const gauge of [-.58,.58])p.bar(i,a+track+gauge,j,b+track+gauge,.079,.062,.072,0x5b6366)
      for(let offset=0;offset<2;offset+=.5){
        const x=i+offset,z=railZ(x)+track
        p.box(x,.019,z,.147,.065,1.56,0x66574a)
      }
    }
    for(const side of [-1,1]){
      const z=a+side*2.73
      p.post(i,.56,z,.047,1.09,.047,coal)
      for(const y of [.22,.64,1.04])p.bar(i,z,j,b+side*2.73,y,.046,.043,coal)
    }
    if(i%8===0){
      p.post(i,1.9,a+3.15,.11,3.8,.11,0x5f6e69)
      p.box(i,3.73,a+1.80,.102,.09,2.83,0x5f6e69)
      p.bar(i,a+.10,i+8,railZ(i+8)+.10,3.64,.018,.019,coal)
    }
  }
  for(const s of [-1,1]){
    const z=railZ(0)+s*4.16
    p.slab(-.3,z,34.8,2.16,0xbcb6aa,.021)
    p.box(0,.055,z-s*.93,34.4,.032,.091,0xe6c271)
    for(let i=0;i<8;i++)p.post(-14.3+i*4.1,1.46,z+s*.72,.10,2.87,.10,coal)
    p.box(0,2.91,z,31.57,.15,2.40,0x667d78)
    for(let i=0;i<5;i++){
      p.box(-9.7+i*4.75,.422,z+s*.52,1.35,.075,.36,wood)
      p.post(-9.7+i*4.75,.22,z+s*.52,.12,.45,.29,coal)
    }
    for(const x of [-12.6,12.1]){
      p.box(x,.73,z+s*.61,.42,1.44,.44,coal)
      p.box(x,1.17,z+s*.356,.32,.29,.06,0x8aaca6)
    }
    const plaque=label(parent,'PLATFORM '+(s===1?'1':'2'),[3.06,.35],[4.05,2.54,z+.05],'#f6eed9','#344b4a')
    if(s<0)plaque.rotation.y=Math.PI
  }
  for(const x of [-17.6,18]){
    const z=railZ(x)+1.90
    p.post(x,1.34,z,.11,2.62,.11,coal)
    p.box(x,2.46,z,.21,.57,.24,coal)
    p.orb(x+.128,2.49,z,.093,.098,.097,0xb75949)
  }
  p.finish(trackside)
}
function parks(parent:T.Object3D,label:Letter){
  const p=new Props()
  for(const park of PARKS){
    p.slab(park.x,park.z,park.w,park.d,0x7e986a,-.061)
    label(parent,park.name,[3.5,.37],[park.x,1.33,park.z+park.d/2-.53],'#f6ecd3','#476550')
    for(const side of [-1,1])p.post(park.x+1.39*side,.66,park.z+park.d/2-.57,.074,1.28,.074,wood)
    if(park.sport){
      const x=park.x+8.3,z=park.z-.2
      p.slab(x,z,7.65,5.32,0x699577,-.027)
      for(const sz of [-1,1]){
        p.box(x,-.003,z+sz*2.42,7.08,.009,.048,cream)
        p.box(x+sz*3.53,-.003,z,.048,.009,4.87,cream)
        p.post(x+sz*3.2,1.22,z,.084,2.45,.084,coal)
        p.box(x+sz*3.23,2.29,z,.073,.51,.78,cream)
        p.box(x+sz*2.99,2.21,z,.35,.041,.38,0xb46552)
      }
      p.box(x,-.001,z,.05,.009,4.82,cream)
      const {x:playX,z:zPlay}=PARK_FEATURES.gardensPlay
      for(const dx of [-.73,.73])for(const dz of [-.61,.61])p.post(playX+dx,.8,zPlay+dz,.093,1.61,.095,0xb87b4e)
      p.box(playX,1.04,zPlay,1.39,.13,1.11,wood)
      p.gable(playX,1.77,zPlay,1.55,.47,1.39,0x568779)
      p.box(playX+.64,.55,zPlay+.82,.44,.086,1.81,0xd0a66f,-.19,-.26)
    }
    if(park.id==='south')garden(p,park.x-5.3,park.z-2.61,1.61,1.0,0xbb849a)
  }
  for(const {x,z} of PARK_FEATURES.picnic){
    p.box(x,.76,z,1.73,.081,.65,wood)
    for(const dx of [-.66,.66])for(const dz of [-.27,.27])p.box(x+dx,.382,z+dz,.076,.76,.081,coal,0,dz*.6)
    p.box(x,.105,z,1.53,.061,.13,wood)
    for(const dz of [-.52,.52])p.box(x,.44,z+dz,1.73,.08,.26,0xa57c55)
  }
  const water=new T.Mesh(new T.CircleGeometry(1,48),new T.MeshStandardMaterial({color:0x568e90,metalness:.43,roughness:.33}))
  water.rotation.x=-Math.PI/2;water.scale.set(pond.w/2,pond.d/2,1);water.position.set(pond.x,-.017,pond.z);parent.add(water)
  for(let i=0;i<32;i++){
    const a=i*Math.PI/16
    if(Math.abs(Math.cos(a)*pond.w/2)<.94)continue
    p.orb(pond.x+Math.cos(a)*pond.w*.50,.12,pond.z+Math.sin(a)*pond.d*.50,.53,.29,.48,i%3?stone:0x8c8c77)
  }
  for(let i=0;i<18;i++)p.box(pond.bridge,.017,pond.z+(i-8.5)*.257,1.31,.07,.235,wood)
  for(const dx of [-.63,.63]){
    p.box(pond.bridge+dx,.70,pond.z,.063,.08,4.45,wood)
    for(let i=0;i<6;i++)p.post(pond.bridge+dx,.371,pond.z+(i-2.5)*.79,.046,.65,.048,coal)
  }
  p.post(circle.x,.14,circle.z,11.9,.3,11.9,0x8d9c72)
  for(let i=0;i<5;i++){
    const a=i*Math.PI*.4
    garden(p,Math.sin(a)*3.06+circle.x,Math.cos(a)*3.06+circle.z,1.70,.93,0xc09177)
  }
  p.post(circle.x,.55,circle.z,2.36,.63,2.36,stone)
  p.post(circle.x,1.40,circle.z,.88,1.58,.88,trimStone)
  p.orb(circle.x,2.46,circle.z,.87,1.44,.87,0x718d83)
  p.finish(parent)
}
const trimStone=0xd2c6aa
function streetFurniture(parent:T.Object3D,label:Letter){
  const p=new Props()
  for(const s of STREET_PROPS){
    const g=new T.Group();parent.add(g);g.position.set(s.x,terrainHeight(s.x,s.z),s.z);g.rotation.y=s.yaw
    const b=new Props()
    if(s.kind==='tree'){tree(p,s.x,s.z,s.style===2?.67:1.11,terrainHeight(s.x,s.z));parent.remove(g);continue}
    if(s.kind==='lamp'){
      const modern=s.style===1
      b.post(0,1.75,0,.088,3.52,.083,coal);b.post(0,.14,0,.19,.28,.19,coal)
      b.box(0,3.43,-.34,.093,.088,.73,coal)
      b.box(0,3.41,-.67,modern?.46:.23,.105,modern?.43:.24,coal)
      const shade=new T.Mesh(new T.BoxGeometry(modern?.33:.16,.026,modern?.32:.165),glow)
      shade.position.set(0,3.35,-.67);g.add(shade)
    }else if(s.kind==='bench'){
      b.box(0,.43,0,1.92,.087,.45,wood);b.box(0,.69,.17,1.91,.36,.08,wood)
      for(const x of [-.80,.80]){b.box(x,.22,0,.076,.44,.41,coal);b.box(x,.615,-.04,.061,.074,.43,coal)}
    }else if(s.kind==='bus'){
      for(const x of [-1.23,1.23])for(const z of [-.52,.52])b.box(x,1.13,z,.074,2.23,.075,coal)
      b.box(0,2.26,0,2.56,.10,1.24,0x698387)
      b.box(0,1.23,.54,2.38,1.65,.04,0x728f91)
      b.box(0,.45,.26,1.86,.07,.21,wood);b.box(0,.26,.32,1.68,.39,.07,coal)
      label(g,'BUS STOP',[1.25,.23],[0,1.94,.49],'#f6edcc','#38504c')
    }else if(s.kind==='bike'||s.kind==='scooter'){
      for(let k=0;k<(s.kind==='bike'?3:1);k++){
        const x=(k-1)*.48
        for(const z of [-.43,.44]){
          const wheel=new T.Mesh(disc,color(coal));wheel.scale.set(.22,.062,.22);wheel.rotation.z=Math.PI/2;wheel.position.set(x,.224,z);g.add(wheel)
        }
        b.box(x,.40,0,.055,.07,.86,0xc0805d);b.box(x,.56,.21,.062,.45,.051,coal,0,.20)
        b.box(x,.58,.27,.17,.05,.24,coal);b.box(x,.63,-.40,.076,.43,.06,metal,0,-.13)
        b.box(x,.838,-.40,.31,.04,.06,coal)
      }
    }else if(s.kind==='sign'||s.kind==='notice'){
      b.post(0,.91,0,.061,1.84,.061,coal)
      label(g,s.label??'CITY DIRECTORY',[s.label?1.43:1.37,.27],[0,1.62,.049],'#fff1cb','#365854')
    }else{
      const info={bin:[.37,.71,coal],recycling:[.84,.95,0x4a786d],hydrant:[.26,.52,0xc06149],mail:[.25,.76,0x5b6862],cabinet:[.74,1.15,0x59716b],bollard:[.16,.72,coal]} as const
      const [w,h,tone]=info[s.kind]
      b.box(0,h/2,0,w,h,w*.75,tone)
      b.box(0,h,0,w*1.08,.064,w*.86,s.kind==='hydrant'?0xeca273:metal)
      b.box(0,h*.80,w*.40,w*.56,.044,.041,coal)
    }
    b.finish(g)
  }
  for(const lot of PARKING){
    const g=new T.Group();g.position.set(lot.x,0,lot.z);g.rotation.y=lot.yaw;parent.add(g)
    const b=new Props()
    b.slab(0,0,2.39,4.88,0x8b8981)
    for(const side of [-1,1])b.box(side*1.10,.001,0,.068,.015,4.56,cream)
    b.box(0,.004,2.25,2.18,.013,.063,cream)
    b.finish(g)
  }
  for(const s of STREETS.filter(s=>s.traffic)){
    const vertical=s.a.x===s.b.x,a=vertical?s.a.z:s.a.x,b=vertical?s.b.z:s.b.x
    for(let t=Math.min(a,b)+9;t<Math.max(a,b)-7;t+=28){
      const x=vertical?s.a.x+.33:t,z=vertical?t:s.a.z+.33
      p.post(x,-.02,z,.56,.016,.56,0x667071)
      const zx=x+(vertical?1:0)*s.width*.45,zz=z+(vertical?0:1)*s.width*.45
      p.box(zx,-.017,zz,.31,.013,.41,0x576264)
    }
  }
  p.finish(parent)
}
const tire=new T.CylinderGeometry(.285,.285,.16,24),rim=new T.CylinderGeometry(.164,.164,.17,24),wheelFace=new T.CircleGeometry(.16,24)
function hubcap(){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=96
  const c=canvas.getContext('2d')!
  c.translate(48,48)
  c.fillStyle='#b3b7ad';c.fillRect(-48,-48,96,96);c.fillStyle='#3a454a'
  c.beginPath();c.arc(0,0,40,0,2*Math.PI);c.fill()
  for(let i=0;i<7;i++){
    c.rotate(2*Math.PI/7);c.fillStyle='#a9b4ad';c.beginPath()
    c.moveTo(-4,1);c.lineTo(-7,-38);c.lineTo(-1,-40);c.lineTo(5,-13);c.lineTo(12,-38);c.lineTo(16,-35);c.lineTo(7,0);c.fill()
  }
  c.fillStyle='#d3d3bf';c.beginPath();c.arc(0,0,11,0,2*Math.PI);c.fill()
  const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;map.anisotropy=4
  return new T.MeshStandardMaterial({map,roughness:.44})
}
const tireMat=color(0x283136),rimMat=color(0xa0a4a1),headMat=color(0xffe3a7),brakeMat=new T.MeshBasicMaterial({color:0xfe4c37})
const darkBrake=color(0x803b3b)
function car(v:Vehicle,parent:T.Object3D,alloy:T.Material,shade:T.Material,label:Letter){
  const g=new T.Group(),p=new Props();parent.add(g)
  const {w,length:l,height:h}=FLEET[v.kind],paint=v.paint??(v.kind==='fire'?0xbb3f3e:v.kind==='taxi'?0xcfa652:v.kind==='police'?0xe2e4d5:0xe8dfcf)
  const dispatch=v.kind==='fire'||v.kind==='police'||v.kind==='ambulance'
  const commercial=['van','truck','ambulance','fire'].includes(v.kind)
  const wheels:T.Mesh[]=[],brakes:T.Mesh[]=[]
  const shadow=new T.Mesh(new T.PlaneGeometry(w*1.74,l*1.27),shade)
  shadow.rotation.x=-Math.PI/2;shadow.position.set(.065,.019,.045);g.add(shadow)
  coachwork(g,v.kind,paint,commercial)
  p.box(0,.39,0,w*.82,.19,l*.83,coal)
  p.box(0,.40,l*.475,w*.96,.13,.15,coal);p.box(0,.42,-l*.48,w*.95,.14,.126,coal)
  p.box(0,.563,l*.485,w*.39,.13,.039,coal)
  if(commercial){
    p.box(0,(h+.56)/2,-l*.136,w*.97,h-.57,l*.70,paint)
    p.box(0,(h+.55)*.51,l*.280,w*.91,h*.77-.32,l*.40,paint)
    p.box(0,h*.77,l*.486,w*.79,h*.24,.054,glass)
    for(const side of [-1,1])p.box(side*w*.468,h*.75,l*.31,.044,h*.21,l*.24,glass)
    if(v.kind==='fire')for(const side of [-1,1])for(let i=0;i<6;i++)p.box(side*w*.49,.89+i*.126,-l*.19,.045,.036,l*.42,metal)
  }else{
    // Hood creases, rear deck and paired grille bars catch the sky at street level.
    for(const side of [-1,1]){
      p.box(side*w*.275,.732,l*.35,.021,.017,l*.12,paint)
      p.box(side*w*.49,.62,-l*.08,.024,.035,.15,metal)
    }
    for(let j=0;j<3;j++)p.box(0,.51+j*.044,l*.492,w*(.42-j*.025),.019,.024,metal)
    if(v.kind==='suv'||v.kind==='wagon')for(const side of [-1,1])p.box(side*w*.28,h+.032,-l*.1,.045,.058,l*.36,coal)
  }
  for(const side of [-1,1]){
    p.box(side*w*.493,.775,l*.184,.15,.047,.065,coal)
    p.box(side*w*.54,.807,l*.181,.12,.088,.137,paint)
    p.box(side*w*.508,.701,.04,.038,.039,.16,darkBrake.color.getHex())
    p.box(side*w*.467,.405,0,.055,.06,l*.58,coal)
    for(const z of [-l*.30,l*.30]){
      const a=new T.Group();a.position.set(side*w*.449,.266,z);g.add(a)
      const tyre=new T.Mesh(tire,tireMat);tyre.rotation.z=Math.PI/2;a.add(tyre)
      const hub=new T.Mesh(rim,rimMat);hub.rotation.z=Math.PI/2;hub.position.x=.022*side;const face=new T.Mesh(wheelFace,alloy)
      face.rotation.x=side*Math.PI/2;face.position.y=-side*.087;hub.add(face);a.add(hub);wheels.push(hub)
    }
    if(!commercial){
      for(const z of [-.094,.164]){
        p.box(side*w*.492,.586,l*z,.012,.245,.014,coal)
        p.box(side*w*.496,.679,l*(z+.037),.025,.021,.109,metal)
      }
    }
    p.box(side*w*.337,.636,l*.484,.34,.174,.064,coal)
    p.box(side*w*.425,.634,l*.487,.073,.12,.071,0xd5a45e)
    const head=new T.Mesh(new T.BoxGeometry(.27,.135,.047),headMat);head.position.set(side*w*.323,.641,l*.499);g.add(head)
    const rear=new T.Mesh(new T.BoxGeometry(.255,.11,.049),darkBrake);rear.position.set(side*w*.342,.648,-l*.487);g.add(rear);brakes.push(rear)
    if(dispatch)p.box(side*w*.507,.66,0,.016,.11,l*.87,v.kind==='fire'?0xefcf9e:0x467b99)
  }
  if(commercial){
    for(const side of [-1,1]){
      p.box(side*w*.245,h*.59,-l*.489,w*.462,h*.64,.038,paint)
      p.box(side*w*.06,h*.50,-l*.514,.039,.18,.027,coal)
      p.box(side*w*.49,h*.51,-l*.15,.030,.081,l*.65,v.kind==='ambulance'?0xca624d:metal)
      if(v.kind==='ambulance'){
        p.box(side*w*.498,h*.72,-l*.20,.032,.39,.111,0xab4d45)
        p.box(side*w*.498,h*.72,-l*.20,.032,.11,.39,0xab4d45)
      }
    }
    if(v.kind==='fire'){
      for(const x of [-.19,.19])p.box(x,h+.078,-l*.12,.052,.072,l*.65,metal)
      for(let i=0;i<9;i++)p.box(0,h+.089,l*(-.41+i*.074),.38,.043,.033,metal)
    }
  }
  if(v.kind==='taxi')for(const side of [-1,1])for(let j=0;j<8;j++)
    p.box(side*w*.495,.65,l*(j-3.5)*.053,.021,.075,.11,j%2?coal:cream)
  if(dispatch||v.kind==='taxi')p.box(0,h+.049,l*.10,w*.49,.096,.21,v.kind==='taxi'?0xf2db78:v.kind==='fire'?0xdb5b44:0x5297b8)
  if(v.kind==='taxi'){
    const sign=label(g,'TAXI',[.45,.11],[0,h+.058,l*.10+.108],'#313434','#e7c065')
    const rear=sign.clone();rear.position.z-=.216;rear.rotation.y=Math.PI;g.add(rear)
  }
  for(const side of [-1,1])p.box(0,.447,l*.493*side,.26,.104,.022,daylight)
  p.finish(g)
  batchOpaque(g,new Set<T.Object3D>([...wheels,...brakes]))
  return {g,wheels,brakes}
}
export function urbanArt(scene:T.Scene,label:Letter){
  LANDMARKS.filter(b=>b.id!=='police').forEach(b=>building(scene,b,label))
  railway(scene,label);parks(scene,label);streetFurniture(scene,label)
  const lamps=new Map<string,Record<'x'|'z',T.Mesh[]>>()
  for(const p of JUNCTIONS.filter(j=>j.signal)){
    const x:T.Mesh[]=[],z:T.Mesh[]=[],props=new Props()
    for(const {x:bx,z:bz,axis} of SIGNAL_HEADS.filter(head=>head.junction===p.id)){
      props.post(bx,1.36,bz,.096,2.73,.099,coal)
      props.box(bx,2.54,bz,.22,.61,.21,coal)
      const bulb=new T.Mesh(new T.BoxGeometry(.14,.16,.16),brakeMat)
      bulb.position.set(bx,2.61,bz);scene.add(bulb);(axis==='x'?x:z).push(bulb)
    }
    lamps.set(p.id,{x,z});props.finish(scene)
  }
  const green=new T.MeshBasicMaterial({color:0x83e3ac})
  const alloy=hubcap(),shade=groundShadow()
  const models=new Map<string,ReturnType<typeof car>>(),clock=new Map<string,number>()
  return (t:TrafficView|undefined,dt:number,reduced:boolean)=>{
    if(!t)return
    const active=new Set<string>()
    for(const v of t.vehicles){
      active.add(v.id)
      let view=models.get(v.id)
      if(!view){view=car(v,scene,alloy,shade,label);models.set(v.id,view);view.g.position.set(v.x,terrainHeight(v.x,v.z),v.z);view.g.rotation.y=v.yaw}
      const {g}=view,weight=reduced?1:1-Math.exp(-dt*10)
      g.visible=true
      g.position.x+=(v.x-g.position.x)*weight
      g.position.z+=(v.z-g.position.z)*weight
      g.position.y=terrainHeight(g.position.x,g.position.z)
      g.rotation.y+=Math.atan2(Math.sin(v.yaw-g.rotation.y),Math.cos(v.yaw-g.rotation.y))*weight
      const spin=(clock.get(v.id)??0)+v.speed*dt*3.8;clock.set(v.id,spin)
      for(const wheel of view.wheels)wheel.rotation.x=spin
      for(const brake of view.brakes)brake.material=v.brake?brakeMat:darkBrake
    }
    for(const [id,{g}] of models)if(!active.has(id))g.visible=false
    for(const [id,phase] of Object.entries(t.signals)){
      const group=lamps.get(id)
      if(group)for(const axis of ['x','z'] as const)for(const l of group[axis])l.material=phase===axis?green:brakeMat
    }
  }
}
