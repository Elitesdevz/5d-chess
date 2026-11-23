import * as T from 'three'
import {box,mesh,cylinder} from '../casino/scene/geometry.ts'
import {batchStatic} from '../casino/scene/static-batch.ts'
import {COUNTERS,GRILLS,RESTAURANT,RESTAURANT_NAME,MENU,SEATS,TABLES,type KfcMess,type Meal,type RestaurantView} from './restaurant-model.ts'

const red=metal(0x992e35),redTrim=metal(0xc9383f),cream=metal(0xffe9c8)
const grey=metal(0x394349),ink=metal(0x202b2e),teal=metal(0x426b69)
const wood=metal(0x9a634a),birch=metal(0xdeb68a),silver=metal(0xb0b6ae,.46)
const kitchenTile=metal(0xd7cbc0),darkRed=metal(0x643239),chip=metal(0xf0b958),sauce=metal(0xcc783d)
const glow=new T.MeshBasicMaterial({color:0xffe5b2}),ice=new T.MeshBasicMaterial({color:0xbce3db})
const windowGlass=new T.MeshStandardMaterial({color:0x9bbfc1,opacity:.19,transparent:true,depthWrite:false,side:T.DoubleSide,roughness:.16})
function metal(color:number,metalness=0){return new T.MeshStandardMaterial({color,metalness,roughness:.72})}
function block(g:T.Object3D,w:number,h:number,d:number,x:number,y:number,z:number,m:T.Material){
  return mesh(new T.BoxGeometry(w,h,d),m,g,[x,y,z])
}
function sign(g:T.Object3D,lines:string[],x:number,y:number,z:number,w:number,h:number,{color='#fff0d4',bg='#263538',rotation=0,font=56}:{color?:string;bg?:string;rotation?:number;font?:number}={}){
  const canvas=document.createElement('canvas')
  canvas.width=Math.ceil(w/h*256);canvas.height=256
  const c=canvas.getContext('2d')!
  c.fillStyle=bg;c.fillRect(0,0,canvas.width,256)
  c.strokeStyle='#ffffff3c';c.lineWidth=2;c.strokeRect(14,14,canvas.width-28,228)
  c.fillStyle=color;c.textAlign='center';c.textBaseline='middle'
  lines.forEach((line,i)=>{
    c.font=`800 ${font}px system-ui`
    c.fillText(line,canvas.width/2,256*(i+1)/(lines.length+1),canvas.width-55)
  })
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace
  const label=mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map:texture}),g,[x,y,z],false)
  label.rotation.y=rotation
  return label
}
function pane(g:T.Object3D,x:number,y:number,z:number,w:number,h:number,rotation=0){
  const glass=mesh(new T.PlaneGeometry(w,h),windowGlass,g,[x,y,z],false)
  glass.rotation.y=rotation
  glass.renderOrder=2
}
function tiled(g:T.Object3D){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128
  const c=canvas.getContext('2d')!
  for(let y=0;y<4;y++)for(let x=0;x<4;x++){
    c.fillStyle=['#c5b5a1','#e2cbb0','#bca795','#d5bea8'][(x+3*y)%4]
    c.fillRect(x*32,y*32,32,32);c.strokeStyle='#4a383138';c.strokeRect(x*32+1,y*32+1,30,30)
  }
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace
  texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.repeat.set(6,6)
  const floor=mesh(new T.PlaneGeometry(12.6,13.5),new T.MeshStandardMaterial({map:texture,roughness:.84}),g,[0,.012,-.25])
  floor.rotation.x=-Math.PI/2
}
function trimFront(g:T.Object3D){
  const z=RESTAURANT.front
  block(g,12.9,1.21,.55,0,3.37,z-.11,red)
  block(g,13.1,.18,.84,0,3.96,z-.05,cream)
  block(g,13.1,.14,.76,0,2.77,z+.02,redTrim)
  block(g,12.88,.18,.87,0,2.63,z+.1,ink)
  for(const side of [-1,1]){
    block(g,.39,2.61,.44,side*6.11,1.3,z,ink)
    block(g,.24,2.61,.32,side*1.31,1.3,z,redTrim)
    block(g,4.68,.37,.31,side*3.72,.186,z,red)
    pane(g,side*3.72,1.48,z,4.64,2.21)
    for(const x of [2.49,3.72,4.99])block(g,.058,2.28,.13,side*x,1.46,z+.01,ink)
    block(g,4.7,.058,.14,side*3.72,1.12,z,ink)
    for(let i=0;i<9;i++)block(g,.28,.11,1.01,side*(1.68+i*.51),2.58,z+.43,i%2?cream:redTrim)
    const door=new T.Group();door.position.set(side*1.21,0,z-.035);door.rotation.y=-side*.92;g.add(door)
    block(door,.078,2.24,.115,-side*.91,1.12,0,red)
    block(door,.98,.14,.138,-side*.48,.076,0,red)
    block(door,.97,.077,.122,-side*.48,2.21,0,red)
    block(door,.32,.045,.15,-side*.75,1.06,.043,silver)
    pane(door,-side*.49,1.14,.015,.94,2.08)
    const planter=side*5.76
    block(g,.92,.35,.63,planter,.18,z+.73,ink)
    for(let i=0;i<5;i++)mesh(new T.IcosahedronGeometry(.22,1),teal,g,[planter+Math.sin(i*1.7)*.31,.46+i%2*.16,z+.70])
  }
  block(g,12.7,.08,1.84,0,.004,z+.92,kitchenTile)
  sign(g,[RESTAURANT_NAME],0,3.39,z+.18,9.7,.61,{bg:'#7a262b',font:146})
  const emblem=new T.Group();emblem.position.set(0,4.25,z-.20);g.add(emblem)
  const ring=mesh(new T.CylinderGeometry(1.02,1.02,.24,48),redTrim,emblem,[0,.66,0]);ring.rotation.x=Math.PI/2
  const face=mesh(new T.CylinderGeometry(.83,.83,.03,48),cream,emblem,[0,.66,.136]);face.rotation.x=Math.PI/2
  sign(emblem,['KFC'],0,.66,.16,1.36,.69,{color:'#8c222a',bg:'#ffe9c8',font:150})
  // Rear-facing blade sign is visible from the main avenue.
  block(g,3.14,1.38,.40,-3.96,4.22,-6.8,red)
  sign(g,['KFC'],-3.96,4.22,-7.02,2.99,1.21,{bg:'#8b292e',rotation:Math.PI,font:165})
}
function tray(item:Meal='combo'){
  const t=new T.Group()
  block(t,.43,.029,.29,0,.024,0,red)
  if(item==='burger'||item==='combo'){
    const x=item==='combo'?-.102:0
    const burger=mesh(new T.SphereGeometry(.098,14,8),chip,t,[x,.101,0]);burger.scale.y=.46
    cylinder(t,.087,.025,[x,.064,0],darkRed,16)
    cylinder(t,.085,.018,[x,.048,0],teal,16)
  }
  if(item==='cola'||item==='combo'){
    const x=item==='combo'?.117:0
    const cup=mesh(new T.CylinderGeometry(.043,.036,.112,14),cream,t,[x,.086,-.064])
    cup.rotation.z=.055
    cylinder(t,.046,.012,[x,.146,-.064],redTrim,15)
    block(t,.012,.068,.012,x+.005,.18,-.076,silver)
  }
  if(item==='fries'||item==='combo'){
    const x=item==='combo'?.083:0
    block(t,.071,.068,.072,x,.07,.061,redTrim)
    for(let k=0;k<5;k++)box(t,[.014,.064+(k%2)*.023,.015],[x-.026+k*.012,.122,.058+(k%2)*.015],chip,.003)
  }
  if(item==='chicken'){
    for(const side of [-1,1]){
      const golden=mesh(new T.IcosahedronGeometry(.103,1),sauce,t,[side*.095,.09,side*.026])
      golden.scale.set(1,.64,.77)
      cylinder(t,.024,.095,[side*.085,.073,side*.098],cream,11).rotation.x=1.38
    }
  }
  return t
}
function booth(g:T.Object3D,i:number){
  const {x,z}=TABLES[i]
  cylinder(g,.30,.066,[x,.035,z],ink,18);cylinder(g,.075,.68,[x,.37,z],ink,16)
  box(g,[.99,.078,1.15],[x,.73,z],birch,.052)
  block(g,.92,.007,1.07,x,.773,z,wood)
  block(g,.39,.007,.33,x,.78,z+.18,cream)
  cylinder(g,.034,.093,[x,.827,z-.42],redTrim,13)
  for(const side of [-1,1]){
    const s=x+side*.84
    box(g,[.52,.115,.66],[s,.45,z],red,.036)
    box(g,[.11,.42,.67],[s+side*.22,.68,z],redTrim,.042)
    block(g,.50,.40,.64,s,.205,z,ink)
  }
  sign(g,[String(i+1)],x,.889,z-.35,.13,.14,{bg:'#8c2b32',font:127})
}
function fitKitchen(g:T.Object3D){
  for(const [i,x] of COUNTERS.entries()){
    block(g,1.96,.97,.70,x,.49,-1.67,red)
    block(g,2.02,.056,.77,x,1.014,-1.67,silver)
    for(let rib=0;rib<9;rib++)block(g,.065,.63,.045,x+(.21*(rib-4)),.53,-1.29,darkRed)
    block(g,.25,.047,.29,x-.52,1.067,-1.61,ink)
    box(g,[.33,.23,.06],[x-.52,1.24,-1.62],ink,.022)
    block(g,.25,.14,.012,x-.52,1.24,-1.58,ice)
    cylinder(g,.055,.09,[x+.65,1.091,-1.69],cream,14)
    sign(g,[`QUEUE ${i+1}`],x,2.18,-1.67,1.42,.28,{bg:'#732a31',font:139})
    block(g,.023,.25,.026,x,2.45,-1.67,ink)
    for(const z of [.3,1.70,3.12])for(const side of [-1,1]){
      block(g,.83,.004,.02,x,.020,z,redTrim)
      block(g,.06,.006,.49,x+side*.41,.020,z+.25,darkRed)
    }
  }
  block(g,4.85,.56,.41,0,2.98,-1.69,ink)
  sign(g,[RESTAURANT_NAME],0,2.98,-1.466,4.68,.46,{bg:'#822c32',font:121})
  for(const [i,x] of GRILLS.entries()){
    block(g,1.42,.9,.69,x,.46,-6.50,silver)
    block(g,1.46,.06,.74,x,.941,-6.5,grey)
    block(g,1.34,.09,.53,x,1,-6.56,ink)
    if(i%2===0){
      for(let j=0;j<5;j++)block(g,.092,.018,.38,x-.39+j*.19,1.056,-6.53,silver)
      cylinder(g,.097,.031,[x+.38,1.076,-6.38],sauce,13)
    }else{
      box(g,[.38,.14,.48],[x-.28,1.08,-6.49],silver,.022)
      for(let j=0;j<8;j++)block(g,.026,.088,.038,x-.42+j%4*.086,1.199,-6.55+Math.floor(j/4)*.14,chip)
    }
    sign(g,[`COOK ${i+1}`],x,1.75,-6.80,1.25,.25,{font:138})
  }
  block(g,7.46,.53,.84,-1.52,2.79,-6.39,silver)
  block(g,7.3,.04,.46,-1.52,2.51,-6.14,glow)
  block(g,.49,1.77,.57,2.61,.89,-6.61,grey)
  for(let i=0;i<3;i++)block(g,.32,.37,.015,2.61,1.48-i*.48,-6.311,ink)
  const passSign=sign(g,['ORDER PICKUP'],3.54,1.99,-1.68,1.08,.25,{bg:'#2b4c49',font:132})
  passSign.rotation.y=-.27
  block(g,.41,1,.82,4,.50,-1.7,red)
  block(g,.44,.05,.86,4,1.025,-1.7,silver)
  const prepared=tray();g.add(prepared);prepared.scale.setScalar(.73);prepared.position.set(4,1.055,-1.78)
}
function office(g:T.Object3D){
  block(g,.13,2.44,3.85,3.32,1.22,-5.08,grey)
  for(const x of [3.75,5.87]){
    block(g,x<4?.85:1.01,2.52,.14,x,1.264,-3.17,grey)
  }
  block(g,2.90,.52,.15,4.75,2.74,-3.17,red)
  sign(g,['MANAGER'],4.75,2.73,-3.073,1.55,.32,{font:148})
  block(g,1.44,.71,.60,4.75,.36,-6.23,wood)
  block(g,1.59,.06,.69,4.75,.746,-6.23,birch)
  block(g,.31,.22,.041,4.37,.91,-6.30,ink)
  block(g,.31,.016,.20,4.37,.786,-6.27,ink)
  block(g,.31,.027,.31,4.94,.79,-6.18,cream)
  sign(g,['SHIFT OFFICE'],4.81,1.89,-6.83,1.56,.49,{bg:'#70343b',font:111})
}
function spill(g:T.Object3D,m:KfcMess){
  const marker=new T.Group();marker.position.set(m.x,0,m.z);g.add(marker)
  if(m.kind==='mop'){
    const drink=new T.Mesh(new T.CircleGeometry(.36,24),new T.MeshStandardMaterial({color:0xb68255,roughness:.24,metalness:.12,transparent:true,opacity:.78}))
    drink.rotation.x=-Math.PI/2;drink.position.y=.032;drink.scale.set(1,.58,1);marker.add(drink)
    const cup=cylinder(marker,.062,.159,[.25,.063,-.08],cream,14);cup.rotation.z=1.4
    for(let i=0;i<3;i++)cylinder(marker,.034,.008,[.3+i*.06,.027,.15-i*.06],sauce,12)
  }else{
    const food=tray();food.position.y=.781;food.rotation.y=.64;food.scale.setScalar(.82);marker.add(food)
    block(marker,.16,.008,.15,-.27,.791,.12,cream)
  }
  return marker
}
function remove(g:T.Group){g.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose()});g.removeFromParent()}

export function buildRestaurant(g:T.Group){
  tiled(g);trimFront(g)
  block(g,12.88,.22,13.96,0,3.94,-.25,ink)
  block(g,12.66,3.82,.20,0,1.91,-7,kitchenTile)
  block(g,12.7,.105,13.56,0,-.057,-.25,red)
  for(const side of [-1,1]){
    const x=side*6.3
    block(g,.20,3.83,7.36,x,1.91,-3.32,side===1?red:grey)
    block(g,.20,.63,6.16,x,.31,3.42,red)
    block(g,.28,1.12,6.22,x,3.30,3.42,cream)
    pane(g,x,1.67,3.42,6.13,2.15,Math.PI/2)
    for(let i=0;i<7;i++)block(g,.15,2.61,.09,x,1.44,.34+i*1.024,ink)
    for(const z of [1.05,3.15,5.19]){
      cylinder(g,.026,.60,[side*3.60,3.49,z],ink,12)
      mesh(new T.CylinderGeometry(.18,.32,.18,16),red,g,[side*3.6,3.13,z])
      cylinder(g,.30,.023,[side*3.6,3.033,z],glow,24)
    }
  }
  block(g,7.92,.12,5.18,-1.87,.071,-4.35,kitchenTile)
  for(let i=0;i<10;i++)block(g,7.6,.008,.021,-1.85,.138,-6.78+i*.51,silver)
  fitKitchen(g);office(g)
  TABLES.forEach((_,i)=>booth(g,i))
  sign(g,MENU.slice(0,3).map(item=>item.name+'  '+item.price),-5.91,2.16,-1.33,1.93,1.29,{bg:'#283437',rotation:Math.PI/2,font:55})
  sign(g,MENU.slice(3).map(item=>item.name+'  '+item.price),5.90,2.16,-1.33,1.93,1.29,{bg:'#283437',rotation:-Math.PI/2,font:64})
  for(const x of [-2.3,2.3]){const light=new T.PointLight(0xffd3a6,32,9);light.position.set(x,3.13,2.6);g.add(light)}
  batchStatic(g)
  const dishes=new Map<number,{item:Meal;mesh:T.Group}>()
  const messes=new Map<string,T.Group>()
  return (view:RestaurantView|undefined)=>{
    const placed=new Set<number>()
    for(const {seat,item} of view?.mealsAt??[]){
      placed.add(seat)
      const old=dishes.get(seat)
      if(old?.item===item)continue
      if(old)remove(old.mesh)
      const {x,z,yaw}=SEATS[seat],food=tray(item);g.add(food)
      food.position.set(x-Math.sin(yaw)*.52,.783,z);food.rotation.y=yaw
      dishes.set(seat,{item,mesh:food})
    }
    for(const [n,old] of dishes)if(!placed.has(n)){remove(old.mesh);dishes.delete(n)}
    const seen=new Set<string>()
    for(const m of view?.messes??[]){
      seen.add(m.id)
      if(!messes.has(m.id))messes.set(m.id,spill(g,m))
    }
    for(const [id,m] of messes)if(!seen.has(id)){remove(m);messes.delete(id)}
  }
}

export function staffProps(parent:T.Group){
  const food=tray();parent.add(food);food.position.set(0,1.02,-.43);food.visible=false
  const mop=new T.Group();parent.add(mop);mop.position.set(.33,0,-.42);mop.visible=false
  cylinder(mop,.021,1.30,[0,.69,0],birch,10)
  box(mop,[.30,.067,.15],[0,.054,.014],teal,.015)
  for(let i=0;i<8;i++)block(mop,.029,.024,.20,.029*(i-3.5),.026,.025,cream)
  return {tray:food,mop}
}
