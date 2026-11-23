import * as T from 'three'
import {box,mesh,cylinder} from '../casino/scene/geometry.ts'
import {batchStatic} from '../casino/scene/static-batch.ts'
import {COUNTERS,GRILLS,RESTAURANT,RESTAURANT_NAME,MENU,SEATS,TABLES,SUPPLIES,restaurantPoints,type KfcMess,type KitchenHand,type Patty,type OrderItems,type RestaurantView} from './restaurant-model.ts'

const red=metal(0x992e35),redTrim=metal(0xc9383f),cream=metal(0xffe9c8)
const grey=metal(0x394349),ink=metal(0x202b2e),teal=metal(0x426b69)
const wood=metal(0x9a634a),birch=metal(0xdeb68a),silver=metal(0xb0b6ae,.46)
const kitchenTile=metal(0xd7cbc0),darkRed=metal(0x643239),chip=metal(0xf0b958),sauce=metal(0xcc783d)
const glow=new T.MeshBasicMaterial({color:0xffe5b2}),ice=new T.MeshBasicMaterial({color:0xbce3db})
const spillLiquid=new T.MeshStandardMaterial({color:0xb68255,roughness:.24,metalness:.12,transparent:true,opacity:.78})
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
    const door=new T.Group();door.position.set(side*1.21,0,z-.035);door.rotation.y=-side*1.34;g.add(door)
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
  for(const side of [-1,1]){
    const x=side*2.63
    block(g,1.78,.064,.49,x,.501,z+.72,wood)
    block(g,1.78,.28,.04,x,.675,z+.91,red)
    for(const leg of [-.71,.71])block(g,.058,.49,.32,x+leg,.253,z+.72,ink)
  }
  for(const x of [-5.8,5.8]){
    block(g,.15,.62,.19,x,2.04,z+.15,ink)
    block(g,.13,.34,.10,x,2.01,z+.27,glow)
  }
  sign(g,[RESTAURANT_NAME],0,3.39,z+.18,9.7,.61,{bg:'#7a262b',font:146})
  const emblem=new T.Group();emblem.position.set(0,4.25,z-.20);g.add(emblem)
  const ring=mesh(new T.CylinderGeometry(1.02,1.02,.24,48),redTrim,emblem,[0,.66,0]);ring.rotation.x=Math.PI/2
  const face=mesh(new T.CylinderGeometry(.83,.83,.03,48),cream,emblem,[0,.66,.136]);face.rotation.x=Math.PI/2
  sign(emblem,['KFC'],0,.66,.16,1.36,.69,{color:'#8c222a',bg:'#ffe9c8',font:150})
  // Rear-facing blade sign is visible from the main avenue.
  block(g,3.14,1.38,.40,-3.96,4.22,-6.8,red)
  sign(g,['KFC'],-3.96,4.22,-7.02,2.99,1.21,{bg:'#8b292e',rotation:Math.PI,font:165})
}
const rawMeat=metal(0xa94e51),cookedMeat=metal(0x6e422e)
function foodVisual(item:Exclude<KitchenHand,'tray'>){
  const food=new T.Group()
  if(item==='burger'||item==='bun'){
    const top=mesh(new T.SphereGeometry(.096,14,8),chip,food,[0,.071,0]);top.scale.y=.43
    cylinder(food,.088,.022,[0,.03,0],birch,16)
    if(item==='burger'){
      cylinder(food,.091,.027,[0,.052,0],cookedMeat,16)
      cylinder(food,.092,.013,[0,.063,0],teal,16)
      for(const [x,z] of [[-.026,.011],[.027,.019],[.018,-.029]])block(food,.014,.003,.012,x,.103,z,cream)
    }
  }else if(item==='cola'||item==='cup'){
    mesh(new T.CylinderGeometry(.046,.034,.114,14),cream,food,[0,.061,0])
    if(item==='cola'){
      cylinder(food,.048,.011,[0,.124,0],redTrim,15)
      block(food,.011,.068,.011,.012,.157,-.012,silver)
    }
  }else if(item==='fries'||item==='bag'){
    block(food,.089,.085,.066,0,.046,0,redTrim)
    block(food,.076,.013,.061,0,.082,0,darkRed)
    if(item==='fries')for(let k=0;k<7;k++)box(food,[.013,.062+(k%2)*.027,.014],[.013*(k%4-1.5),.105,.022*(Math.floor(k/4)-.5)],chip,.003)
  }else cylinder(food,.089,.029,[0,.024,0],rawMeat,14)
  return food
}
function tray(items:OrderItems={burger:1,fries:1,cola:1}){
  const t=new T.Group()
  block(t,.52,.029,.34,0,.020,0,red)
  const pieces=(['burger','fries','cola'] as const).flatMap(item=>Array.from({length:items[item]},()=>item))
  for(const [i,item] of pieces.entries()){
    const visual=foodVisual(item);visual.scale.setScalar(pieces.length>3?.76:.95)
    visual.position.set((i%3-1)*.166,.034,pieces.length>3?(Math.floor(i/3)-.5)*.163:0)
    t.add(visual)
  }
  return t
}
function supplyFixtures(g:T.Object3D){
  const {bun,raw,bag,cup,fryer,soda,tickets}=SUPPLIES
  for(const [p,title,item] of [[bun,'BUNS','bun'],[raw,'PATTIES','raw']] as const){
    block(g,.6,1.03,.97,-5.99,.52,p.z,silver)
    block(g,.62,.07,.99,-5.98,1.05,p.z,grey)
    for(let i=0;i<5;i++){
      const food=foodVisual(item);food.position.set(-5.99+(i%2-.5)*.224,1.09,p.z+(Math.floor(i/2)-1)*.23);g.add(food)
    }
    sign(g,[title],-6.13,1.51,p.z,.97,.21,{rotation:Math.PI/2,font:147})
  }
  block(g,2.90,.88,.47,-2.78,.45,-4.26,grey)
  block(g,2.97,.082,.51,-2.78,.922,-4.26,silver)
  for(const [p,title,item] of [[bag,'FRIES BAGS','bag'],[cup,'CUPS','cup']] as const){
    for(let i=0;i<4;i++){
      const food=foodVisual(item);food.position.set(p.x+.11*i-.17,.968,-4.25);g.add(food)
    }
    sign(g,[title],p.x,.77,-4.02,1.12,.19,{font:138})
  }
  for(const p of [fryer,soda])block(g,.48,.92,.81,3.00,.46,p.z,silver)
  box(g,[.51,.09,.80],[2.98,.957,fryer.z],grey,.016)
  block(g,.36,.019,.53,2.98,1.003,fryer.z,ink)
  for(let i=0;i<5;i++)block(g,.016,.036,.45,2.84+.06*i,1.032,fryer.z,silver)
  for(let i=0;i<10;i++)block(g,.025,.052,.052,2.88+(i%3)*.091,1.059,fryer.z-.17+(Math.floor(i/3)*.103),chip)
  block(g,.31,.035,.064,2.68,1.07,fryer.z+.18,ink)
  sign(g,['FRYER'],2.737,.74,fryer.z,.72,.23,{rotation:-Math.PI/2,font:137})
  block(g,.43,.48,.75,3.02,1.19,soda.z,red)
  block(g,.33,.17,.62,2.96,1.45,soda.z,darkRed)
  for(let i=0;i<3;i++){
    block(g,.08,.063,.09,2.743,1.26,soda.z+(.19*(i-1)),silver)
    block(g,.044,.090,.12,2.742,1.42,soda.z+(.19*(i-1)),i===1?cream:teal)
  }
  sign(g,['SODA'],2.787,1.61,soda.z,.71,.24,{rotation:-Math.PI/2,font:149})
  const z=-2.09
  box(g,[.55,.075,.36],[tickets.x,1.055,z],wood,.016)
  for(const side of [-1,1])block(g,.033,.14,.36,tickets.x+side*.27,1.13,z,birch)
  block(g,.53,.14,.036,tickets.x,1.13,z+.16,birch)
  const papers=new T.Group();g.add(papers);papers.position.set(tickets.x,1.09,z)
  for(let i=0;i<6;i++){const slip=block(papers,.12,.009,.19,(i-2.5)*.054,.006*i,0,cream);slip.rotation.y=i*.39}
  sign(g,['KITCHEN TICKETS'],tickets.x,.85,-2.035,1.01,.18,{rotation:Math.PI,font:138})
  return papers
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
    for(let j=0;j<5;j++)block(g,.087,.02,.38,x-.39+j*.14,1.056,-6.49,silver)
    block(g,.37,.033,.43,x+.44,1.067,-6.48,birch)
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
    const drink=new T.Mesh(new T.CircleGeometry(.36,24),spillLiquid)
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
  const papers=supplyFixtures(g)
  const screen=document.createElement('canvas');screen.width=480;screen.height=128
  const screenTex=new T.CanvasTexture(screen);screenTex.colorSpace=T.SRGBColorSpace
  mesh(new T.PlaneGeometry(1.76,.48),new T.MeshBasicMaterial({map:screenTex}),g,[3.91,2.48,-2.28],false)
  const display=screen.getContext('2d')!
  let readyCount=-1
  TABLES.forEach((_,i)=>booth(g,i))
  sign(g,MENU.slice(0,3).map(item=>item.name+'  '+item.price),-5.91,2.16,-1.33,1.93,1.29,{bg:'#283437',rotation:Math.PI/2,font:55})
  sign(g,MENU.map(item=>item.name+'  '+item.price),5.90,2.16,-1.33,1.93,1.29,{bg:'#283437',rotation:-Math.PI/2,font:55})
  for(const x of [-2.3,2.3]){const light=new T.PointLight(0xffd3a6,32,9);light.position.set(x,3.13,2.6);g.add(light)}
  batchStatic(g)
  const meals=new Map<string,{key:string;mesh:T.Group}>()
  const stages=new Map<number,{bun:T.Group;raw:T.Group;surface:T.Mesh;phase:Patty;flippedAt:number}>()
  GRILLS.forEach((x,slot)=>{
    const bun=foodVisual('bun'),raw=foodVisual('raw')
    g.add(bun,raw);bun.position.set(x+.44,1.083,-6.47);raw.position.set(x-.18,1.072,-6.48)
    stages.set(slot,{bun,raw,surface:raw.children[0] as T.Mesh,phase:'empty',flippedAt:0})
  })
  const messes=new Map<string,T.Group>()
  const lamp=new T.MeshBasicMaterial({color:0xffcb68,transparent:true,opacity:.78,depthWrite:false})
  const rings=Array.from({length:4},()=>{
    const ring=new T.Mesh(new T.RingGeometry(.29,.32,32),lamp)
    ring.rotation.x=-Math.PI/2;ring.visible=false;g.add(ring)
    return ring
  })
  const update=(view:RestaurantView|undefined)=>{
    const targets=restaurantPoints(view).filter(p=>p.id.startsWith('kfc:kitchen:'))
    for(const [i,ring] of rings.entries()){
      const target=targets[i];ring.visible=!!target
      if(target)ring.position.set(target.x,.149,target.z)
    }
    const ready=view?.pickup.length??0
    if(ready!==readyCount){
      readyCount=ready
      display.fillStyle='#263e3b';display.fillRect(0,0,480,128)
      display.fillStyle='#fbdda9';display.textAlign='center';display.textBaseline='middle'
      display.font='800 58px system-ui';display.fillText(ready?ready+' READY':'PREPARING',240,66)
      screenTex.needsUpdate=true
    }
    papers.visible=!!view?.tickets
    const placed=new Set<string>()
    const place=(id:string,items:OrderItems,x:number,y:number,z:number,yaw=0,scale=1)=>{
      placed.add(id)
      const key=String(items.burger)+items.fries+items.cola
      const old=meals.get(id)
      if(old?.key===key)return
      if(old)remove(old.mesh)
      const food=tray(items);g.add(food);food.position.set(x,y,z);food.rotation.y=yaw;food.scale.setScalar(scale)
      meals.set(id,{key,mesh:food})
    }
    for(const {seat,items} of view?.mealsAt??[]){
      const {x,z,yaw}=SEATS[seat]
      place('seat'+seat,items,x-Math.sin(yaw)*.52,.783,z,yaw,.95)
    }
    if(view?.pickup.length)place('pickup',view.pickup[0].items,4,1.055,-1.76,0,.75)
    for(const [i,props] of stages){
      const data=view?.stations.find(s=>s.slot===i)
      props.bun.visible=!!data?.bun
      props.raw.visible=!!data&&data.patty!=='empty'
      const phase=data?.patty??'empty'
      if(phase==='flipped'&&props.phase==='raw')props.flippedAt=view?.now??0
      else if(phase!=='flipped')props.flippedAt=0
      props.phase=phase
      props.surface.material=phase==='flipped'?cookedMeat:rawMeat
      if(data&&!data.lifted)place('cook'+i,data.done,GRILLS[i]+.45,1.082,-6.12,0,.74)
    }
    for(const [id,old] of meals)if(!placed.has(id)){remove(old.mesh);meals.delete(id)}
    const seen=new Set<string>()
    for(const m of view?.messes??[]){
      seen.add(m.id)
      if(!messes.has(m.id))messes.set(m.id,spill(g,m))
    }
    for(const [id,m] of messes)if(!seen.has(id)){remove(m);messes.delete(id)}
  }
  const tick=(now:number)=>{
    lamp.opacity=.56+.23*Math.sin(now/420)
    for(const {raw,flippedAt} of stages.values()){
      const p=flippedAt?T.MathUtils.clamp((now-flippedAt)/560,0,1):0
      raw.position.y=1.072+Math.sin(p*Math.PI)*.32
      raw.rotation.x=p*Math.PI
    }
  }
  return {update,tick}
}

export function staffProps(parent:T.Group){
  const mop=new T.Group();parent.add(mop);mop.position.set(.33,0,-.42);mop.visible=false
  cylinder(mop,.021,1.30,[0,.69,0],birch,10)
  box(mop,[.30,.067,.15],[0,.054,.014],teal,.015)
  for(let i=0;i<8;i++)block(mop,.029,.024,.20,.029*(i-3.5),.026,.025,cream)
  const cloth=new T.Group();cloth.position.set(.24,1.07,-.44);cloth.visible=false;parent.add(cloth)
  box(cloth,[.14,.035,.19],[0,0,0],teal,.02)
  const apron=new T.Group();parent.add(apron);apron.visible=false
  box(apron,[.25,.45,.045],[0,1.093,-.151],red,.022)
  box(apron,[.249,.036,.055],[0,1.019,-.165],cream,.006)
  box(apron,[.13,.08,.025],[.008,1.177,-.188],cream,.006)
  let previous='',item:T.Group|undefined
  const hold=(hand:KitchenHand|undefined,items?:OrderItems)=>{
    const key=hand==='tray'&&items?`tray:${items.burger}${items.fries}${items.cola}`:hand??''
    if(key===previous)return
    previous=key
    if(item)remove(item)
    item=hand==='tray'?tray(items):hand?foodVisual(hand):undefined
    if(item){item.position.set(hand==='tray'?0:.17,1.08,-.48);parent.add(item)}
  }
  return {mop,cloth,apron,hold}
}
