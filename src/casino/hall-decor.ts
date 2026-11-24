import * as T from 'three'
import {ROULETTE_ORDER,pocketColor} from '../casino-model.ts'
import {LOUNGES,SEAT_OFFSETS,TABLES} from '../roulette-hall-model.ts'
import {box,cylinder,limb,mesh,v} from './scene/geometry.ts'
import {batchStatic} from './scene/static-batch.ts'

const standard=(color:number,metalness=0,roughness=.68)=>new T.MeshStandardMaterial({color,metalness,roughness})
const oak=standard(0x35201b,.1,.32),ebony=standard(0x131719,.12,.35),brass=standard(0xb98d50,.72,.3)
const trim=standard(0x54402a,.36,.41),wall=standard(0x18312f,.1,.58),stone=standard(0x364543,.18,.43)
const wine=standard(0x601e37,0,.72),leather=standard(0x205a4e,0,.6),cream=standard(0xe6d7bf)
const bulb=new T.MeshBasicMaterial({color:0xffd89a}),warm=new T.MeshBasicMaterial({color:0xffc370})
const light=(color:number,power:number,distance:number,x:number,y:number,z:number)=>{
  const lamp=new T.PointLight(color,power,distance,2)
  lamp.position.set(x,y,z)
  return lamp
}
const ring=(parent:T.Object3D,r:number,t:number,x:number,y:number,z:number,material:T.Material=brass)=>{
  const obj=mesh(new T.TorusGeometry(r,t,8,56),material,parent,[x,y,z],false)
  obj.rotation.x=-Math.PI/2
  return obj
}
function canvasTexture(width:number,height:number,paint:(ctx:CanvasRenderingContext2D)=>void){
  const canvas=document.createElement('canvas')
  canvas.width=width;canvas.height=height
  paint(canvas.getContext('2d')!)
  const texture=new T.CanvasTexture(canvas)
  texture.colorSpace=T.SRGBColorSpace
  texture.anisotropy=4
  return texture
}
function lettering(parent:T.Object3D,text:string,width:number,height:number,color='#f0d6a2'){
  const map=canvasTexture(512,128,ctx=>{
    ctx.font='600 69px Georgia';ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,65,480)
  })
  return mesh(new T.PlaneGeometry(width,height),new T.MeshBasicMaterial({map,transparent:true,depthWrite:false}),parent,undefined,false)
}
function floor(parent:T.Object3D,city:boolean){
  const parquet=canvasTexture(256,256,c=>{
    c.fillStyle='#2a1d1a';c.fillRect(0,0,256,256)
    for(let i=0;i<16;i++){
      const x=i%4*64,y=Math.floor(i/4)*64
      c.save();c.translate(x+32,y+32);if(i%2!==Math.floor(i/4)%2)c.rotate(Math.PI/2)
      for(let j=0;j<4;j++){
        c.fillStyle=['#553b2c','#4b3327','#654638','#583a2d'][(i*5+j*3)%4];c.fillRect(-32,j*16-32,63,15)
        c.strokeStyle='#956f4e30'
        for(let k=0;k<4;k++){c.beginPath();c.moveTo(-31,j*16-30+k*3);c.bezierCurveTo(-12,j*16-31+k*3,10,j*16-27+k*3,31,j*16-29+k*3);c.stroke()}
      }
      c.restore()
    }
  })
  parquet.wrapS=parquet.wrapT=T.RepeatWrapping;parquet.repeat.set(13,10)
  const woodFloor=mesh(new T.PlaneGeometry(city?22.5:24,city?15.6:18),new T.MeshStandardMaterial({map:parquet,roughness:.46}),parent,[0,-.015,city?1.1:.5])
  woodFloor.rotation.x=-Math.PI/2
  const carpet=canvasTexture(512,1024,c=>{
    c.fillStyle='#39222b';c.fillRect(0,0,512,1024)
    for(let y=0;y<1024;y+=48)for(let x=0;x<512;x+=48){
      c.strokeStyle='#ad78551d';c.beginPath();c.moveTo(x+24,y+5);c.lineTo(x+42,y+24);c.lineTo(x+24,y+43);c.lineTo(x+6,y+24);c.closePath();c.stroke()
      c.fillStyle='#c1a37939';c.fillRect(x+23,y+23,3,3)
    }
    for(const inset of [5,10,24,31]){
      c.strokeStyle=inset===24?'#bb905f':'#886046';c.lineWidth=inset===24?3:1;c.strokeRect(inset,inset,512-2*inset,1024-2*inset)
    }
    for(let i=0;i<3;i++){
      c.save();c.translate(256,224+i*288);c.scale(1,1.4)
      for(let j=0;j<16;j++){
        c.rotate(Math.PI/8);c.strokeStyle='#b28a6655';c.beginPath();c.ellipse(0,34,13,36,0,0,Math.PI*2);c.stroke()
      }
      c.restore()
    }
  })
  const rug=new T.MeshStandardMaterial({map:carpet,roughness:.91})
  for(const [x,z,w,d,y] of [[0,1.2,3,12.6,.003],[-5,-3.3,6.0,4.5,.009],[5,-3.3,6.0,4.5,.009],[0,2.25,6.2,4.5,.013]]){
    const plane=mesh(new T.PlaneGeometry(w,d),rug,parent,[x,y,z]);plane.rotation.x=-Math.PI/2
  }
}
function archWindow(parent:T.Object3D,x:number){
  const group=new T.Group();group.position.set(x,1.6,-6.46);parent.add(group)
  const outer=new T.Shape()
  outer.moveTo(-1.16,0);outer.lineTo(1.16,0);outer.lineTo(1.16,2.1);outer.absarc(0,2.1,1.16,0,Math.PI,false);outer.closePath()
  const seed=Math.round((x+10)*101)
  const glass=canvasTexture(256,384,c=>{
    c.scale(.8,.8)
    const gradient=c.createLinearGradient(0,0,0,480)
    gradient.addColorStop(0,'#081e37');gradient.addColorStop(.64,'#1f5265');gradient.addColorStop(1,'#ae785d')
    c.fillStyle=gradient;c.fillRect(0,0,320,480);c.fillStyle='#f6dbac'
    if(x===1.85){c.beginPath();c.arc(207,113,24,0,Math.PI*2);c.fill()}
    for(let i=0;i<42;i++){c.globalAlpha=.2+(i%9)/14;c.fillRect((i*67+seed)%313,(i*31+seed)%300,2,2)}
    c.globalAlpha=1
    for(let i=0;i<20;i++){
      const h=28+((i*37+seed)%107),x=i*17
      c.fillStyle=i%2?'#1b2d3c':'#11232e';c.fillRect(x,480-h,15,h)
      c.fillStyle='#c29d68';for(let y=490-h;y<477;y+=15)if((x+y)%3)c.fillRect(x+4,y,2,4)
    }
  })
  const g=new T.ShapeGeometry(outer),uv=g.getAttribute('uv')
  for(let i=0;i<uv.count;i++)uv.setXY(i,(uv.getX(i)+1.16)/2.32,uv.getY(i)/3.26)
  mesh(g,new T.MeshBasicMaterial({map:glass}),group,undefined,false)
  const arc=mesh(new T.TorusGeometry(1.16,.055,8,48,Math.PI),brass,group,[0,2.1,.046],false)
  arc.rotation.z=0
  for(const side of [-1,1])box(group,[.105,2.1,.12],[side*1.16,1.05,.055],brass)
  box(group,[2.48,.12,.20],[0,0,.06],oak);box(group,[.055,3.2,.09],[0,1.60,.055],trim)
  for(const y of [.72,1.42,2.1])box(group,[2.29,.042,.083],[0,y,.065],trim)
  batchStatic(group)
}
function fixture(parent:T.Object3D,x:number,z:number){
  const g=new T.Group();g.position.set(x,4.03,z);parent.add(g)
  cylinder(g,.035,1.18,[0,.74,0],brass,12)
  ring(g,.71,.021,0,0,0);ring(g,.51,.015,0,-.22,0);ring(g,.39,.012,0,.075,0)
  for(let i=0;i<12;i++){
    const a=i*Math.PI/6,xx=Math.cos(a),zz=Math.sin(a)
    limb(g,v(xx*.18,.03,zz*.18),v(xx*.69,.02,zz*.69),.017,brass)
    cylinder(g,.065,.12,[xx*.68,.11,zz*.68],bulb,12)
    mesh(new T.OctahedronGeometry(.092),i%2?bulb:brass,g,[xx*.50,-.27,zz*.50],false).scale.y=1.65
  }
  batchStatic(g)
}
function chair(parent:T.Object3D,x:number,z:number,material=leather){
  const g=new T.Group();parent.add(g);g.position.set(x,0,z)
  box(g,[.73,.19,.74],[0,.43,0],material,.085)
  box(g,[.74,.62,.16],[0,.79,.34],material,.071)
  box(g,[.63,.06,.19],[0,1.09,.34],brass,.025)
  for(const x of [-.29,.29])for(const z of [-.29,.29])cylinder(g,.028,.38,[x,.19,z],trim,10)
  batchStatic(g)
}
function lounge(parent:T.Object3D,x:number,z:number,direction:number){
  const g=new T.Group();g.position.set(x,0,z);g.rotation.y=direction;parent.add(g)
  box(g,[2.7,.27,.94],[0,.32,0],oak,.08)
  box(g,[2.73,.65,.23],[0,.73,.40],wine,.108)
  for(const x of [-.82,0,.82])box(g,[.81,.18,.72],[x,.55,-.05],wine,.075)
  for(const x of [-1.33,1.33])box(g,[.21,.37,.91],[x,.58,0],wine,.095)
  cylinder(g,.59,.085,[0,.49,-1.01],oak,36);cylinder(g,.15,.44,[0,.23,-1.01],brass,18)
  for(const x of [-.22,.25]){
    cylinder(g,.067,.14,[x,.6,-.98],cream,12);cylinder(g,.052,.016,[x,.676,-.98],warm,12)
  }
  batchStatic(g)
}
function plant(parent:T.Object3D,x:number,z:number){
  const g=new T.Group();g.position.set(x,0,z);parent.add(g);cylinder(g,.26,.47,[0,.24,0],oak,18);ring(g,.25,.022,0,.48,0)
  const leaf=standard(0x43735b)
  for(let i=0;i<12;i++){
    const a=i*2.4,h=.66+i*.073
    limb(g,v(0,.44,0),v(Math.sin(a)*.35,h,Math.cos(a)*.35),.012,trim)
    const l=mesh(new T.SphereGeometry(1,10,7),leaf,g,[Math.sin(a)*.34,h,Math.cos(a)*.34],false)
    l.scale.set(.11,.25,.029);l.rotation.set(.25,a,.5)
  }
  batchStatic(g)
}
export function buildHall(scene:T.Object3D,city=false){
  const architecture=new T.Group();scene.add(architecture)
  floor(architecture,city)
  box(architecture,[24,5.5,.3],[0,2.75,-6.7],wall)
  if(!city)box(architecture,[24,5.5,.3],[0,2.75,8.9],wall)
  if(!city)for(const x of [-11.25,11.25])box(architecture,[.3,5.5,15.5],[x,2.75,1.1],wall)
  box(architecture,[23,.25,16],[0,5.42,1.15],ebony)
  for(const x of [-11,-7.4,-3.7,0,3.7,7.4,11]){
    cylinder(architecture,.20,4.5,[x,2.35,-6.28],stone,20)
    for(const y of [.23,.48,4.55,4.78])cylinder(architecture,.27,.1,[x,y,-6.28],brass,20)
  }
  if(!city)for(const x of [-9.25,-5.55,-1.85,1.85,5.55,9.25])archWindow(architecture,x)
  for(const x of [-10.95,10.95]){
    for(const z of [-5.4,-2.1,1.2,4.5,7.7]){
      box(architecture,[.26,4.6,.18],[x,2.3,z],stone)
      box(architecture,[.18,.58,.14],[x*.988,2.55,z+.18],brass)
      box(architecture,[.22,.24,.12],[x*.973,2.65,z+.18],bulb,.04)
    }
    for(const y of [.22,1.5,4.76])box(architecture,[.16,.075,15.3],[x,y,1.12],trim)
  }
  for(const y of [.22,1.34,4.98])box(architecture,[22,.11,.18],[0,y,-6.43],brass)
  for(const z of [-5,-2,1,4,7.6])box(architecture,[22.2,.15,.19],[0,5.20,z],trim)
  for(const x of [-9,-6,-3,0,3,6,9])box(architecture,[.12,.11,15.3],[x,5.23,1.18],trim)
  for(const [x,z] of [[-5,-2.55],[5,-2.55],[0,2.55]]){
    fixture(architecture,x,z)
    scene.add(light(0xffcf91,44,9,x,3.75,z))
  }
  scene.add(light(0x95c8ec,40,14,0,3,-5.8))
  for(const site of LOUNGES)lounge(architecture,site.x,site.z,site.yaw)
  for(const [x,z] of [[-9.5,-5.3],[9.5,-5.3],[-10,5.8],[10,5.8]])plant(architecture,x,z)
  if(city){batchStatic(architecture);return}
  const bar=new T.Group();bar.position.set(city?-5.9:0,0,8.23);scene.add(bar)
  box(bar,[7.6,1,.66],[0,.50,0],oak,.075);box(bar,[7.86,.08,.77],[0,1.03,0],brass,.038)
  for(let i=0;i<15;i++)box(bar,[.22,.67,.025],[(i-7)*.48,.5,-.343],trim,.006)
  const bottleGlass=[0x356569,0x8d6343,0x3b6252].map(color=>standard(color,.25,.35))
  for(const y of [1.70,2.29,2.89]){
    box(bar,[6.4,.06,.40],[0,y,.32],brass)
    for(let i=0;i<19;i++){
      const x=(i-9)*.32, h=.16+(i*7%6)*.021
      cylinder(bar,.065,h,[x,y+h/2,.29],bottleGlass[i%3],10)
      cylinder(bar,.027,.065,[x,y+h+.028,.29],brass,10)
    }
  }
  const sign=lettering(bar,'THE ROYAL SALON',4.8,.83);sign.position.set(0,3.54,.34);sign.rotation.y=Math.PI
  batchStatic(bar);batchStatic(architecture)
}

const wheelStep=Math.PI*2/37
export const WHEEL_X=-1.08,WHEEL_Z=-.12
function wheelTexture(){
  return canvasTexture(768,768,c=>{
    c.translate(384,384)
    for(const [i,number] of ROULETTE_ORDER.entries()){
      const a=i*wheelStep,b=a+wheelStep,color=pocketColor(number)
      c.beginPath();c.arc(0,0,367,a,b);c.arc(0,0,225,b,a,true);c.closePath()
      c.fillStyle=color==='white'?'#e9d8ba':color==='black'?'#18292e':'#8b509e';c.fill();c.strokeStyle='#c4a975';c.lineWidth=3;c.stroke()
      c.save();c.rotate((a+b)/2);c.translate(324,0);c.rotate(Math.PI/2)
      c.font='600 34px Georgia';c.textAlign='center';c.textBaseline='middle';c.fillStyle=color==='white'?'#2d2723':'#fff1d5';c.fillText(String(number),0,0);c.restore()
    }
  })
}
function feltTexture(tint:string){
  return canvasTexture(640,384,c=>{
    const gold='#ddc094',line='#c09b697c'
    c.strokeStyle=gold;c.fillStyle=tint;c.fillRect(0,0,640,384)
    c.lineWidth=3;c.strokeRect(9,9,622,366);c.strokeStyle=line;c.strokeRect(19,19,602,346)
    const size=46
    for(let i=0;i<36;i++){
      const n=i+1,x=64+(i%12)*size,y=89+Math.floor(i/12)*60,white=pocketColor(n)==='white'
      c.fillStyle=white?'#c5b795':'#182928';c.fillRect(x,y,size-3,56)
      c.font='600 26px Georgia';c.fillStyle=white?'#242a26':'#eadabb';c.textAlign='center';c.fillText(String(n),x+22,y+38)
    }
    c.fillStyle='#6e4279';c.fillRect(25,89,34,176);c.fillStyle='#f2d3fd';c.font='bold 26px Georgia';c.fillText('0',42,185)
    for(const [i,label] of ['1–18','EVEN','IVORY','OBSIDIAN','ODD','19–36'].entries()){
      const x=64+i*size*2;c.strokeStyle=gold;c.strokeRect(x,280,87,42);c.font='600 14px Georgia';c.fillStyle=gold;c.fillText(label,x+44,306)
    }
    c.fillStyle=gold;c.font='600 19px Georgia';c.fillText('◆   R O Y A L   S A L O N   ◆',320,54)
  })
}
function chips(group:T.Group,x:number,z:number,stacks:number){
  const colors=[standard(0xd0c2a1),standard(0x6d8d82),standard(0xa55166),standard(0x476788),brass]
  for(let i=0;i<stacks;i++){
    const count=3+(i*3%6)
    for(let k=0;k<count;k++){
      cylinder(group,.049,.014,[x+i*.108,1.055+k*.016,z],colors[i%5],14)
      if(k===count-1)ring(group,.035,.002,x+i*.108,1.064+k*.016,z,cream)
    }
  }
}
export function buildHallTables(scene:T.Object3D){
  const wheelMap=wheelTexture()
  return TABLES.map((site,index)=>{
    const group=new T.Group();group.position.set(site.x,0,site.z);scene.add(group)
    const felt=standard([0x246254,0x264b56,0x554062][index])
    box(group,[4.44,.22,2.33],[0,.89,0],oak,.107)
    box(group,[4.39,.064,2.29],[0,.986,0],brass,.031)
    box(group,[4.31,.055,2.20],[0,1.014,0],felt,.027)
    box(group,[4.04,.18,.14],[0,.855,1.143],ebony,.06)
    for(const x of [-1.53,1.53]){
      box(group,[.26,.81,.62],[x,.42,0],oak,.07);box(group,[.32,.08,.74],[x,.08,0],brass,.028)
      for(const z of [-.4,.4])limb(group,v(x,.15,0),v(x,.8,z),.042,trim)
    }
    for(const x of SEAT_OFFSETS)chair(group,x,1.68,index===2?wine:leather)
    const mat=mesh(new T.PlaneGeometry(1.92,1.29),new T.MeshStandardMaterial({map:feltTexture(['#215347','#23444c','#483550'][index]),roughness:.85}),group,[.84,1.044,-.11])
    mat.rotation.x=-Math.PI/2
    box(group,[1.03,.055,.16],[.89,1.067,.84],ebony,.021)
    const plaque=lettering(group,site.name,1.36,.25);plaque.rotation.x=-Math.PI/2;plaque.position.set(.89,1.098,.84)
    chips(group,-.14,-.91,5);chips(group,-1.85,.88,2);chips(group,.16,.83,3)
    cylinder(group,.72,.09,[WHEEL_X,1.085,WHEEL_Z],oak,64)
    cylinder(group,.69,.045,[WHEEL_X,1.14,WHEEL_Z],ebony,64)
    ring(group,.678,.016,WHEEL_X,1.161,WHEEL_Z);ring(group,.623,.008,WHEEL_X,1.164,WHEEL_Z)
    const rotor = new T.Group();rotor.position.set(WHEEL_X,1.16,WHEEL_Z);group.add(rotor)
    cylinder(rotor,.57,.035,[0,-.005,0],oak,64)
    const pockets=mesh(new T.PlaneGeometry(1.18,1.18),new T.MeshStandardMaterial({map:wheelMap,transparent:true,roughness:.48}),rotor,[0,.014,0],false)
    pockets.rotation.x=-Math.PI/2
    ring(rotor,.348,.009,0,.02,0)
    mesh(new T.ConeGeometry(.34,.105,48),brass,rotor,[0,.045,0])
    cylinder(rotor,.064,.09,[0,.12,0],ebony,20)
    mesh(new T.SphereGeometry(.04,14,10),brass,rotor,[0,.175,0])
    for(let i=0;i<4;i++){
      const a=i*Math.PI/2;limb(rotor,v(0,.143,0),v(Math.cos(a)*.14,.141,Math.sin(a)*.14),.012,brass)
    }
    const marker=mesh(new T.SphereGeometry(.038,18,12),cream,group,[WHEEL_X,1.201,WHEEL_Z-.59],false)
    const aura=ring(group,.735,.008,WHEEL_X,1.171,WHEEL_Z,new T.MeshBasicMaterial({color:site.color,transparent:true,opacity:.25}))
    batchStatic(group,new Set([marker,aura]));batchStatic(rotor)
    return {group,rotor,marker,aura}
  })
}
