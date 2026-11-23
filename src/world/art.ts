import * as T from 'three'
import {box,cylinder,mesh,v,dice,resultRotation} from '../casino/scene/geometry.ts'
import {materials} from '../casino/scene/materials.ts'
import {batchStatic} from '../casino/scene/static-batch.ts'
import {buildBankArchitecture,buildBankVault} from '../bank-stage.ts'
import {buildHall,buildHallTables,WHEEL_X,WHEEL_Z} from '../casino/hall-decor.ts'
import {ClubGuest} from '../casino/roulette-cast.ts'
import {ROULETTE_ORDER} from '../casino-model.ts'
import {SEAT_OFFSETS} from '../roulette-hall-model.ts'
import {FLOOR_HEIGHT,FLOOR_LIST,HOUSE_ROWS,PLAN,PUBLIC_DICE,floorHeight,type WorldZone} from './model.ts'

const std=(color:number,metalness=0,roughness=.74)=>new T.MeshStandardMaterial({color,metalness,roughness})
const brass=std(0xb78b57,.65,.35),oak=std(0x372725,.15,.48),ink=std(0x182930,.28,.57)
const ivory=std(0xd6c4a8,.12,.55),blue=std(0x334f60,.14,.46),gold=new T.MeshBasicMaterial({color:0xffc980})
const glass=new T.MeshStandardMaterial({color:0x8ebfcb,transparent:true,opacity:.23,roughness:.16,metalness:.35,depthWrite:false,side:T.DoubleSide})
const stone=std(0x7c7770,.12,.64),rock=std(0x504847,.14,.91),leather=std(0x3c5665),rug=std(0x54353a)
const foliage=[std(0x2c604d),std(0x43805b),std(0x557c56)]
const tau=Math.PI*2
const light=(scene:T.Object3D,c:number,p:number,r:number,x:number,y:number,z:number)=>{
  const lamp=new T.PointLight(c,p,r)
  lamp.position.set(x,y,z);scene.add(lamp)
}
function block(parent:T.Object3D,w:number,h:number,d:number,x:number,y:number,z:number,material:T.Material){
  return mesh(new T.BoxGeometry(w,h,d),material,parent,[x,y,z])
}
function texture(width:number,height:number,paint:(ctx:CanvasRenderingContext2D)=>void){
  const c=document.createElement('canvas');c.width=width;c.height=height
  paint(c.getContext('2d')!)
  const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;return texture
}
export function banner(parent:T.Object3D,text:string,size:[number,number],point:number[],color='#f5dba5',backdrop='transparent'){
  const map=texture(768,160,c=>{
    if(backdrop!=='transparent'){c.fillStyle=backdrop;c.fillRect(0,0,768,160)}
    c.fillStyle=color;c.font='600 78px Georgia';c.textAlign='center';c.textBaseline='middle';c.fillText(text,384,80,731)
  })
  return mesh(new T.PlaneGeometry(...size),new T.MeshBasicMaterial({map,transparent:true,depthWrite:false}),parent,point,false)
}
function plane(parent:T.Object3D,w:number,d:number,x:number,y:number,z:number,material:T.Material){
  const m=mesh(new T.PlaneGeometry(w,d),material,parent,[x,y,z])
  m.rotation.x=-Math.PI/2;return m
}
function paving(){
  const map=texture(256,256,c=>{
    c.fillStyle='#27393e';c.fillRect(0,0,256,256)
    for(let j=0;j<8;j++)for(let i=-1;i<8;i++){
      const x=i*40+(j%2)*20,y=j*32
      const shade=['#3a4a4b','#405356','#46585a','#49575a','#374b51'][(j*7+i+10)%5]
      c.fillStyle=shade;c.fillRect(x+1,y+1,38,30)
      c.strokeStyle='#abb6ac30';c.beginPath();c.moveTo(x+3,y+3);c.lineTo(x+37,y+3);c.stroke()
    }
  })
  map.wrapS=map.wrapT=T.RepeatWrapping;map.repeat.set(15,13)
  return new T.MeshStandardMaterial({map,roughness:.62})
}
function bench(parent:T.Object3D,x:number,z:number,yaw=0,material=oak){
  const g=new T.Group();parent.add(g);g.position.set(x,0,z);g.rotation.y=yaw
  box(g,[2.4,.13,.66],[0,.47,0],material,.045)
  box(g,[2.38,.43,.1],[0,.71,.28],material,.041)
  for(const dx of [-.89,.89]){
    block(g,.10,.40,.52,dx,.22,0,brass);box(g,[.08,.28,.55],[dx,.61,0],ink,.02)
  }
  batchStatic(g)
}
function chairSeat(g:T.Object3D,x:number){
  box(g,[.76,.18,.63],[x,.43,1.68],leather,.07)
  box(g,[.75,.52,.13],[x,.73,1.99],leather,.05)
  for(const dx of [-.26,.26])for(const z of [1.44,1.91])cylinder(g,.024,.43,[x+dx,.22,z],brass,9)
}
function potted(parent:T.Object3D,x:number,z:number,scale=1){
  const group=new T.Group();group.position.set(x,0,z);group.scale.setScalar(scale);parent.add(group)
  mesh(new T.CylinderGeometry(.31,.23,.48,13),stone,group,[0,.24,0])
  cylinder(group,.11,1.45,[0,.94,0],oak,9)
  for(let i=0;i<5;i++){
    const a=i*2.4
    mesh(new T.IcosahedronGeometry(.33+i*.02,1),foliage[i%3],group,[Math.sin(a)*.22,1.22+i*.19,Math.cos(a)*.28]).scale.y=1.35
  }
  batchStatic(group)
}
function lamp(parent:T.Object3D,x:number,z:number){
  const g=new T.Group();g.position.set(x,0,z);parent.add(g)
  cylinder(g,.16,.27,[0,.16,0],brass,12);cylinder(g,.039,3.15,[0,1.65,0],ink,10)
  block(g,.44,.055,.44,0,3.28,0,brass);block(g,.21,.28,.21,0,3.46,0,gold)
  mesh(new T.ConeGeometry(.28,.19,4),ink,g,[0,3.68,0])
  const pool=texture(48,48,c=>{
    const gradient=c.createRadialGradient(24,24,2,24,24,24);gradient.addColorStop(0,'#ffcb6c46');gradient.addColorStop(1,'#ffcb6c00');c.fillStyle=gradient;c.fillRect(0,0,48,48)
  })
  plane(g,5,5,0,.013,0,new T.MeshBasicMaterial({map:pool,transparent:true,depthWrite:false}))
  batchStatic(g)
}
function glazing(parent:T.Object3D,x:number,y:number,z:number,w:number,h:number){
  const pane=mesh(new T.PlaneGeometry(w,h),glass,parent,[x,y,z],false)
  pane.renderOrder=2
  block(parent,.043,h,.067,x,y,z+.027,brass);block(parent,w,.035,.061,x,y+.12,z+.027,brass)
}
function frontage(parent:T.Object3D,width:number,depth:number,levels:number,columns:number,finish:T.Material,ornate=false,entry=true){
  const xEdge=width/2,z=depth/2,step=width/columns
  for(let floor=0;floor<levels;floor++){
    const base=floor*2.9
    block(parent,width,.24,depth,0,base+.095,0,ivory)
    block(parent,width,.28,.32,0,base+2.76,z,finish)
    if(floor>0)block(parent,width,.55,.32,0,base+.39,z,finish)
    for(let i=0;i<=columns;i++){
      const x=-xEdge+i*step,pier=i===0||i===columns?.36:ornate?.29:.15
      block(parent,pier,2.53,.34,x,base+1.45,z,finish)
      if(ornate){block(parent,pier+.13,.11,.41,x,base+2.64,z,brass);block(parent,pier+.13,.1,.39,x,base+.22,z,brass)}
      if(i===columns)continue
      const bay=x+step/2,door=floor===0&&entry&&Math.abs(bay)<.1
      if(!door){
        const height=floor===0?2.14:1.79
        glazing(parent,bay,base+(floor===0?1.37:1.68),z+.012,step-.26,height)
        if(floor===0)block(parent,step-.24,.26,.27,bay,.28,z,finish)
      }
    }
    // Side returns, rear wall and visible floor slabs give the openings depth.
    block(parent,.27,2.85,depth,-xEdge,base+1.46,0,finish)
    block(parent,.27,2.85,depth,xEdge,base+1.46,0,finish)
    block(parent,width,2.85,.27,0,base+1.46,-z,finish)
  }
  block(parent,width+.5,.22,depth+.47,0,levels*2.9,0,ornate?ivory:finish)
  batchStatic(parent)
}
function landmarks(parent:T.Object3D){
  for(const [type,label,material] of [['hotel','ROYAL HOTEL & CASINO',rug],['bank','FIFTH DIMENSION BANK',blue],['exchange','THE EXCHANGE',blue]] as const){
    const {x,z,width,front}=PLAN[type],root=new T.Group();root.position.set(x,0,z);parent.add(root)
    box(root,[width*1.32,.5,.34],[0,4.28,front+.19],ink,.05)
    banner(root,label,[width*1.22,.42],[0,4.28,front+.368])
    for(const side of [-1,1]){
      block(root,.22,3.3,.62,side*1.55,1.66,front+.32,ivory)
      block(root,.40,.14,.74,side*1.55,3.29,front+.32,brass)
      potted(root,side*(width*.8),front+.7,1.03)
    }
    box(root,[3.75,.16,1.43],[0,3.4,front+.66],material,.045)
  }
}
function houses(parent:T.Object3D){
  HOUSE_ROWS.forEach(([x,z],idx)=>{
    const g=new T.Group();g.position.set(x,0,z);parent.add(g)
    const m=std([0x5b7c76,0x88716f,0x889396,0x8a8466][idx%4],.09,.7)
    frontage(g,6,5.8,2,3,m,false,false)
      box(g,[6.34,.25,6.13],[0,5.84,0],ink,.035)
      box(g,[.88,1.70,.1],[0,.98,2.96],oak,.03)
      box(g,[.65,.18,.3],[1.64,.82,3.04],brass,.024)
      cylinder(g,.09,.14,[1.64,1.4,3.15],gold,9)
  })
}
function fountain(scene:T.Scene){
  const plaza=new T.Group();scene.add(plaza)
  cylinder(plaza,2.87,.18,[0,.13,0],ivory,64);cylinder(plaza,2.68,.35,[0,.345,0],stone,64)
  cylinder(plaza,2.57,.021,[0,.535,0],std(0x3a7b88,.36,.16),60)
  cylinder(plaza,.42,1.02,[0,.81,0],stone,22);cylinder(plaza,.71,.12,[0,1.32,0],brass,32)
  const crest=mesh(new T.OctahedronGeometry(.53),brass,plaza,[0,1.91,0]);crest.scale.y=1.4
  const ripples=Array.from({length:3},()=>{
    const ring=mesh(new T.RingGeometry(.94,1,56),new T.MeshBasicMaterial({color:0xb7eddf,transparent:true,opacity:.19,depthWrite:false}),plaza,[0,.553,0],false)
    ring.rotation.x=-Math.PI/2;return ring
  })
  const spray=new T.InstancedMesh(new T.SphereGeometry(.031,6,4),std(0xacf1e1,.19,.2),60),matrix=new T.Matrix4()
  spray.frustumCulled=false;plaza.add(spray)
  const animate=(time:number)=>{
    ripples.forEach((ring,i)=>{
      const progress=(time/2200+i/3)%1
      ring.scale.setScalar(.7+progress*1.76);ring.material.opacity=.21*Math.sin(progress*Math.PI)
    })
    for(let i=0;i<spray.count;i++){
      const angle=Math.floor(i/10)*tau/6,steps=(time/1380+i%10/10)%1,d=.62+steps*1.58
      matrix.makeTranslation(Math.sin(angle)*d,1.31+steps*(1.48-2.26*steps),Math.cos(angle)*d)
      spray.setMatrixAt(i,matrix)
    }
    spray.instanceMatrix.needsUpdate=true
  }
  animate(0)
  return animate
}
function street(){
  const group=new T.Group()
  plane(group,112,108,0,-.053,2,paving())
  const road=std(0x2e3d49,.15,.53),mark=std(0xb5a688)
  plane(group,11,77,0,-.015,3,road);plane(group,105,8,0,-.014,11,road)
  for(const z of [-27,-21,-15,-9,-3,3,18,24,30,36])plane(group,.11,1.95,0,-.010,z,mark)
  for(const sign of [-1,1])for(let n=1;n<=11;n++)plane(group,1.98,.095,n*4*sign,-.009,11,mark)
  plane(group,23.6,17.85,0,.014,1.925,paving())
  landmarks(group);houses(group)
  for(const [x,z] of [[-10,2],[10,2],[-11,13],[11,13],[-15,-8],[15,-8],[-17,12],[17,12],[-33,12],[33,12],[-44,-5],[44,-5],[-9,26],[9,26],[-25,26],[25,26]]){
    lamp(group,x,z)
  }
  for(const [x,z] of [[-10.8,-2],[10.8,-2],[-15,15],[15,15],[-32,-6],[32,-6],[-35,22],[35,22],[-27,-13],[27,-13],[-15,-21],[15,-21]]){
    potted(group,x,z,1.4)
  }
  for(const [x,z] of [[-8,2],[8,2],[-14,14],[14,14],[-18,7],[18,7]])bench(group,x,z,x>0?Math.PI/2:-Math.PI/2)
  const guide=new T.Group();guide.position.set(-4.22,0,3.63);guide.rotation.y=.24;group.add(guide)
  box(guide,[2.53,1.31,.17],[0,1.43,0],ink,.06)
  banner(guide,'CITY SQUARE',[2.24,.28],[0,1.81,.093])
  banner(guide,'‹  BANK     CASINO  ↑',[2.18,.28],[0,1.42,.093])
  banner(guide,'EXCHANGE  ›',[2.03,.27],[0,1.11,.093])
  for(const x of [-.98,.98])block(guide,.10,.81,.15,x,.43,0,brass)
  return group
}
function frontWindow(scene:T.Object3D,width:number,z:number,wall:T.Material,openDoor=true){
  const g=new T.Group();scene.add(g)
  block(g,width,.39,.25,0,3.84,z,wall)
  const span=width/7
  for(let n=0;n<=7;n++)block(g,n===0||n===7?.49:.20,3.88,.31,-width/2+n*span,1.94,z,wall)
  for(let n=0;n<7;n++){
    if(n===3&&openDoor)continue
    const x=-width/2+(n+.5)*span
    block(g,span-.13,.72,.23,x,.36,z,wall)
    glazing(g,x,2.237,z,span-.18,3.04)
  }
  batchStatic(g)
}
function gallery(scene:T.Object3D,type:'hotel'|'exchange'){
  const w=type==='hotel'?19:16,dep=type==='hotel'?15.8:15
  const metal=type==='hotel'?brass:blue,wall=type==='hotel'?std(0x583741):std(0x234653)
  if(type==='hotel'){
    plane(scene,w,dep,0,0,0,paving())
    block(scene,w,.25,dep,0,5.82,0,ink)
  }else liftDeck(scene,paving())
  block(scene,.24,5.75,dep,-w/2,2.855,0,wall);block(scene,.24,5.75,dep,w/2,2.855,0,wall)
  if(type==='hotel'){
    block(scene,(w-2.8)/2,5.7,.26,-(w+2.8)/4,2.85,-7.9,wall)
    block(scene,(w-2.8)/2,5.7,.26,(w+2.8)/4,2.85,-7.9,wall)
    block(scene,2.9,2.1,.27,0,4.67,-7.9,wall)
    box(scene,[4.4,.38,.23],[0,3.62,-7.64],ink,.06)
    banner(scene,'GAMING FLOOR',[4.18,.34],[0,3.62,-7.51])
    plane(scene,3.65,15.5,0,.016,0,rug)
    for(const x of [-1.70,1.70])plane(scene,.039,15.38,x,.022,0,brass)
    for(const x of [-6.58,6.58])for(const z of [-4.7,-.7,3.6]){
      bench(scene,x,z,x>0?Math.PI/2:-Math.PI/2,leather);potted(scene,x*.92,z+.77)
    }
    for(const side of [-1,1]){
      block(scene,4.6,.15,12,side*6.85,3.27,-.75,oak)
      block(scene,.06,.092,11.5,side*4.58,4.21,-.75,metal)
      for(const z of [-5.8,-4,-2.2,-.4,1.4,3.2,4.8])block(scene,.05,1,.05,side*4.58,3.73,z,metal)
    }
    for(const x of [-4.24,4.24]){
      box(scene,[.17,2.94,.16],[x,1.53,-7.68],brass,.025)
      block(scene,.074,1.36,.05,x,2.64,-7.57,gold)
    }
    frontWindow(scene,w,7.78,wall)
  }else{
    liftDoorway(scene,wall)
    banner(scene,'ELEVATOR',[2.28,.3],[0,3.65,-4.07])
    frontWindow(scene,w,7.48,wall)
    plane(scene,3.38,11.48,0,.013,1.84,std(0x294e55))
    for(const x of [-3.78,3.78])potted(scene,x,.8,1.3)
    box(scene,[4.06,1.08,1.01],[.63,.55,-1.97],blue,.09)
    box(scene,[4.16,.066,1.05],[.63,1.095,-1.97],ivory,.055)
    banner(scene,'EXCHANGE RECEPTION',[3.7,.32],[.63,2.52,-2.14])
    for(const x of [-5.8,5.8])bench(scene,x,3,x>0?Math.PI/2:-Math.PI/2,leather)
  }
  for(const x of [-w*.38,w*.38])for(const z of [-3.0,1.4,5.6]){
    cylinder(scene,.13,5.66,[x,2.84,z],ivory,14)
    cylinder(scene,.2,.11,[x,5.5,z],metal,14)
  }
  for(const x of [-4.3,4.3]){
    light(scene,0xffd298,47,11,x,4,1.2)
    const band=box(scene,[2.2,.077,.51],[x,4.59,-2.7],gold,.028)
    band.castShadow=false
  }
}
function makeScreen(scene:T.Object3D,symbol:string,x:number){
  const canvas=document.createElement('canvas');canvas.width=704;canvas.height=368
  const ctx=canvas.getContext('2d')!,tex=new T.CanvasTexture(canvas)
  tex.colorSpace=T.SRGBColorSpace
  box(scene,[4.07,2.27,.15],[x,2.59,-4.25],ink,.064)
  mesh(new T.PlaneGeometry(3.96,2.16),new T.MeshBasicMaterial({map:tex}),scene,[x,2.59,-4.16])
  return (points:{price:number}[],current?:number)=>{
    const w=704,h=368
    ctx.fillStyle=symbol==='CAS'?'#221c25':'#12282e';ctx.fillRect(0,0,w,h)
    ctx.font='600 35px Georgia';ctx.fillStyle='#cae7e0';ctx.fillText(symbol,30,53)
    if(current!==undefined){ctx.font='600 26px system-ui';ctx.textAlign='right';ctx.fillText(current.toLocaleString('en',{maximumFractionDigits:2})+' coins',670,53);ctx.textAlign='left'}
    for(let i=0;i<5;i++){ctx.beginPath();ctx.moveTo(32,85+i*53);ctx.lineTo(671,85+i*53);ctx.strokeStyle='#c7e5e241';ctx.stroke()}
    if(points.length){
      const values=points.map(p=>p.price),lo=Math.min(...values),hi=Math.max(...values),range=Math.max(.01,hi-lo)
      const display=points.length===1?[points[0],points[0]]:points
      ctx.beginPath();display.forEach((p,i)=>{const a=32+639*i/(display.length-1),b=285-(p.price-lo)/range*174;i?ctx.lineTo(a,b):ctx.moveTo(a,b)})
      ctx.strokeStyle=symbol==='CAS'?'#e9bd73':'#89dfbf';ctx.lineWidth=5;ctx.stroke()
      ctx.lineTo(671,307);ctx.lineTo(32,307);ctx.closePath();ctx.fillStyle='#76cfa522';ctx.fill()
    }
    ctx.fillStyle='#a4bfb8';ctx.font='20px system-ui';ctx.fillText(points.length?'Price history':'Waiting for market data',32,344)
    tex.needsUpdate=true
  }
}
function cave(scene:T.Object3D,oasis:boolean){
  const rockStops=Array.from({length:14},(_,i)=>7.39-i*1.16)
  plane(scene,5.76,16.9,0,0,0,std(oasis?0x546b58:0x444441))
  for(const z of rockStops){
    for(const side of [-1,1]){
      const o=mesh(new T.IcosahedronGeometry(1,1),rock,scene,[side*3.09,1.57,z]);o.scale.set(1.5,2.3,1.55);o.rotation.y=z*side*.53
    }
    const crown=mesh(new T.IcosahedronGeometry(1,1),rock,scene,[0,3.25,z]);crown.scale.set(3.9,.9,1.47);crown.rotation.y=z*.71
  }
  if(oasis){
    const pool=mesh(new T.CircleGeometry(1.68,44),new T.MeshStandardMaterial({color:0x3b9c94,roughness:.19,metalness:.44}),scene,[.66,.018,-.31])
    pool.rotation.x=-Math.PI/2;pool.scale.y=1.55
    for(const [x,z] of [[-1.86,-2.7],[1.84,2.4],[-1.85,1.7],[1.81,-3.5]])potted(scene,x,z,.73)
    light(scene,0x87dee1,17,8,0,2.6,.48);light(scene,0xf0cb9a,18,8,0,2.9,6.4)
  }else{
    light(scene,0xc6c09c,10,5,0,2.51,6.77)
    block(scene,5.8,3.44,.18,0,1.67,-8,new T.MeshBasicMaterial({color:0x050606}))
  }
  batchStatic(scene)
}

function liftDeck(room:T.Object3D,finish:T.Material){
  const edge=-4.17,front=7.48
  plane(room,16,front-edge,0,0,(front+edge)/2,finish)
  for(const x of [-4.76,4.76])plane(room,6.48,3.31,x,0,-5.825,finish)
}
function liftDoorway(room:T.Object3D,finish:T.Material){
  for(const x of [-4.74,4.74])block(room,6.52,5.75,.25,x,2.86,-6.12,finish)
  block(room,3.07,2.5,.25,0,4.64,-4.21,finish)
  for(const x of [-1.52,1.52])block(room,.065,3.44,.10,x,1.73,-4.20,brass)
  block(room,3.13,.075,.10,0,3.42,-4.20,brass)
}
function elevator(scene:T.Object3D){
  const shaft=new T.Group();shaft.position.set(PLAN.exchange.x,0,PLAN.exchange.z);scene.add(shaft)
  const height=(FLOOR_LIST.length+1)*FLOOR_HEIGHT
  block(shaft,3.15,height,.22,0,height/2,-7.45,ink)
  for(const side of [-1,1]){
    block(shaft,.13,height,3.23,side*1.53,height/2,-5.83,ink)
    block(shaft,.072,height,.065,side*1.34,height/2,-7.26,brass)
  }
  return shaft
}
function tower(shaft:T.Object3D){
  const tile=paving(),wall=std(0x234653),trim=std(0x90adb2,.28,.48)
  const rooms=new Map<string,T.Group>()
  for(const {symbol} of FLOOR_LIST){
    const room=new T.Group();room.position.y=floorHeight(`floor:${symbol}`);shaft.add(room);rooms.set(symbol,room)
    liftDeck(room,tile);liftDoorway(room,wall)
    for(const x of [-7.96,7.96])block(room,.18,5.8,15,x,2.89,0,wall)
    block(room,16,.18,11.65,0,5.91,1.655,ink)
    block(room,16,1.16,.16,0,.58,7.48,wall)
    block(room,16,.44,.22,0,5.68,7.48,trim)
    const pane=mesh(new T.PlaneGeometry(15.8,4.32),glass,room,[0,3.31,7.47],false);pane.renderOrder=2
    for(const x of [-7.9,-5.26,-2.63,0,2.63,5.26,7.9])block(room,.082,4.56,.092,x,3.31,7.446,trim)
    for(const x of [-2.7,2.7]){
      block(room,2.33,.98,.70,x,.49,-1.77,symbol==='CAS'?oak:blue)
      block(room,2.45,.06,.74,x,1.015,-1.77,symbol==='CAS'?brass:ivory)
    }
    for(const x of [-4.53,4.53])block(room,4.07,2.27,.15,x,2.59,-4.25,ink)
    for(const x of [-3.8,3.8])block(room,2.6,.055,.37,x,5.77,1.07,gold)
    if(symbol==='CAS'){
      mesh(new T.TorusGeometry(.76,.07,10,44),brass,room,[0,1.97,-3.27],false).rotation.x=.19
      banner(room,'CASINO SHAREHOLDERS',[3.4,.23],[0,3.12,-3.12],'#ffdb92')
    }else if(symbol==='BNK'){
      box(room,[1.34,1.68,.55],[0,.87,-3.2],blue,.13);ringVault(room)
    }
    batchStatic(room)
  }
  const decor=new Map<string,{actors:ClubGuest[];screens:ReturnType<typeof makeScreen>[]}>()
  return (symbol:string)=>{
    const room=rooms.get(symbol)
    if(!room)return
    let entry=decor.get(symbol)
    if(!entry){
      const name=FLOOR_LIST.find(stock=>stock.symbol===symbol)!.name
      banner(room,name,[6,.39],[0,4.17,-4.08],symbol==='CAS'?'#ffdca1':'#ccecee')
      const actors=[new ClubGuest(room,-2.7,-2.38,0xaa7c61,0x365263,true),new ClubGuest(room,2.7,-2.38,0xd2a17d,symbol==='CAS'?0x674451:0x374d5d,true,1)]
      const screens=[makeScreen(room,symbol,-4.53),makeScreen(room,symbol,4.53)]
      entry={actors,screens};decor.set(symbol,entry)
    }
    return entry
  }
}
export function liftPlatform(parent:T.Object3D){
  const car=new T.Group();parent.add(car)
  car.position.set(PLAN.exchange.x,0,PLAN.exchange.z)
  block(car,2.93,.16,3.06,0,-.075,-5.74,bronzeFloor)
  block(car,2.93,.052,.1,0,.038,-4.22,brass)
  return car
}
const bronzeFloor=std(0x60584c,.35,.74)
export function makeWorldArt(open:boolean){
  const scene=new T.Scene()
  scene.background=new T.Color(0x7495a9)
  scene.fog=new T.FogExp2(scene.background as T.Color,.0064)
  scene.add(new T.HemisphereLight(0xdbe9ff,0xa89072,1.95))
  const sun=new T.DirectionalLight(0xffe2bb,1.47);sun.position.set(-12,18,10);scene.add(sun)
  scene.add(street());const ambient=fountain(scene)
  const rooms={} as Record<keyof typeof PLAN,T.Group>
  for(const zone of Object.keys(PLAN) as (keyof typeof PLAN)[]){
    const group=new T.Group(),{x,z}=PLAN[zone];group.position.set(x,0,z);scene.add(group);rooms[zone]=group
  }
  const {hotel,casino,bank,exchange}=rooms
  gallery(hotel,'hotel')
  buildHall(casino,true)
  const wheels=buildHallTables(casino),actors:ClubGuest[]=[]
  for(const [x,z] of [[-5,-4.9],[5,-4.9],[0,.61]])actors.push(new ClubGuest(casino,x-.35,z,0xb78968,0x29323d,true))
  const table=new T.Group();casino.add(table);table.position.set(PUBLIC_DICE.x,0,PUBLIC_DICE.z)
  box(table,[4.05,.24,2.03],[0,.88,0],oak,.13);box(table,[4.14,.042,2.13],[0,1.008,0],brass,.045)
  box(table,[3.95,.039,1.94],[0,1.045,0],std(0x653f57),.033)
  for(const offset of SEAT_OFFSETS)chairSeat(table,offset)
  banner(table,'IVORY DICE',[2.45,.40],[0,1.68,-.87])
  const publicDie=dice(materials());table.add(publicDie);publicDie.position.set(0,1.165,.08);publicDie.quaternion.copy(resultRotation(1))
  actors.push(new ClubGuest(casino,PUBLIC_DICE.x,PUBLIC_DICE.z-1.5,0x9a6e53,0x57363e,true,1))
  for(const x of [-1,1]){
    const wall=new T.Group();casino.add(wall);wall.position.set(x*11.25,0,1.1);wall.rotation.y=x*Math.PI/2
    frontWindow(wall,15.59,0,ink,false)
    block(wall,15.5,1.62,.30,0,4.68,0,ink)
  }
  for(const side of [-1,1]){
    const width=(22.5-2.8)/2
    block(casino,width,3.74,.25,side*(2.8+width)/2,1.87,8.9,ink)
  }
  block(casino,22.5,1.65,.25,0,4.56,8.9,ink)
  buildBankArchitecture(bank,true);buildBankVault(bank);frontWindow(bank,20.4,8.05,blue)
  block(bank,20.4,2.68,.25,0,5.33,8.05,blue)
  const staff=[new ClubGuest(bank,-2.9,-2.72,0xb38469,0x284557,true,1),new ClubGuest(bank,2.9,-2.71,0xd5ad86,0x313c59,true,2),new ClubGuest(bank,7.4,-1.32,0x946344,0x213344,true)]
  gallery(exchange,'exchange');staff.push(new ClubGuest(exchange,.65,-3.11,0xc89b79,0x4b3d58,true,1))
  const floor=tower(elevator(scene))
  for(const zone of ['cave','oasis'] as const){rooms[zone].rotation.y=Math.PI;cave(rooms[zone],zone==='oasis')}
  const seal=mesh(new T.IcosahedronGeometry(1,2),rock,rooms.cave,[0,1.34,7.01]);seal.scale.set(1.84,1.8,1.1);seal.visible=!open
  return {scene,actors,staff,wheels,publicDie,floor,ambient,seal}
}
function ringVault(scene:T.Object3D){
  mesh(new T.TorusGeometry(.48,.041,8,44),brass,scene,[0,.89,-2.9],false)
  mesh(new T.TorusGeometry(.17,.032,8,28),brass,scene,[0,.89,-2.89],false)
}
export function spinWheel(wheel:ReturnType<typeof buildHallTables>[number],result:number,p:number){
  const step=tau/37,rot=(1-(1-p)**2.45)*(tau*5+.62)
  wheel.rotor.rotation.y=rot
  const stop=-(ROULETTE_ORDER.indexOf(result)+.5)*step+.62
  const angle=stop-8*tau*(1-p)**2.5
  const r=T.MathUtils.lerp(.637,.486,T.MathUtils.smoothstep(p,.62,.98))
  wheel.marker.position.set(WHEEL_X+Math.cos(angle)*r,1.207,WHEEL_Z-Math.sin(angle)*r)
  wheel.aura.material.opacity=.22+.31*p
}
