import type {HomePose} from '../world/residential.ts'
import * as T from 'three'
import {ROULETTE_ORDER,pocketColor,type RouletteChoice} from '../casino-model.ts'
import {LOUNGES,SEAT_OFFSETS,SPAWN,TABLES,WALK_SPEED,walk,type HallPlayer,type HallView,type Position} from '../roulette-hall-model.ts'
import {buildHall,buildHallTables,WHEEL_X,WHEEL_Z} from './hall-decor.ts'
import {box,limb,mesh,v} from './scene/geometry.ts'
import {batchStatic} from './scene/static-batch.ts'

const tau=Math.PI*2
const ease=(p:number)=>p*p*(3-2*p)
const angleBetween=(from:number,to:number)=>Math.atan2(Math.sin(to-from),Math.cos(to-from))
const suits=[0x33495e,0x814855,0x456a61,0x75604e,0x4c476c,0x885742]
const skins=[0xd5aa8a,0x8d5f49,0xae7b5c,0xe2bca1,0x6d4a40,0xb98870]
const material=(color:number,roughness=.78)=>new T.MeshStandardMaterial({color,roughness})
const shoe=material(0x201a1b),shirt=material(0xe0d4be),gold=material(0xc2a16a,.37)
const hairPalette=[0x2d211d,0x332e2a,0x4c342b,0x624d3b].map(color=>material(color))
function contactTexture(){
  const c=document.createElement('canvas');c.width=c.height=64
  const ctx=c.getContext('2d')!,gradient=ctx.createRadialGradient(32,32,2,32,32,31)
  gradient.addColorStop(0,'#0009');gradient.addColorStop(1,'#0000')
  ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64)
  return new T.CanvasTexture(c)
}
export class Figure {
  root=new T.Group()
  target:HallPlayer
  private body=new T.Group()
  private head=new T.Group()
  private arms:T.Group[]=[]
  private legs:T.Group[]=[]
  private knees:T.Group[]=[]
  private gait=0
  private motion=0
  private shadow:T.Mesh<T.PlaneGeometry,T.MeshBasicMaterial>
  private ownedMaterials:T.Material[]
  constructor(scene:T.Scene,player:HallPlayer,shadow:T.Texture,staff:boolean|'cashier'|'cook'|'janitor'|'manager'=false){
    this.target=player
    this.root.position.set(player.x,0,player.z)
    this.root.rotation.y=player.yaw
    scene.add(this.root)
    this.root.add(this.body)
    const code=[...player.name].reduce((acc,c)=>(acc*31+c.charCodeAt(0))>>>0,0)
    const suit=material(staff==='cook'?0xdbc8ae:staff==='cashier'?0x962d39:staff==='janitor'?0x487274:staff?0x202830:suits[code%suits.length]),skin=material(skins[(code>>>4)%skins.length])
    this.ownedMaterials=[suit,skin]
    box(this.body,[.43,.50,.25],[0,1.18,0],suit,.074)
    box(this.body,[.30,.18,.23],[0,.885,0],suit,.041)
    box(this.body,[.16,.37,.022],[0,1.2,-.132],shirt,.006)
    box(this.body,[staff?.16:.046,staff?.049:.21,.022],[0,staff?1.34:1.22,-.15],staff?gold:suit,.008)
    for(const side of [-1,1]){
      const lapel=box(this.body,[.085,.32,.023],[side*.101,1.23,-.135],suit,.006);lapel.rotation.z=side*.19
      const arm=new T.Group();arm.position.set(side*.235,1.37,0);this.body.add(arm);this.arms.push(arm)
      limb(arm,v(0,0,0),v(side*.035,-.22,0),.069,suit)
      limb(arm,v(side*.035,-.22,0),v(side*.031,-.39,-.072),.055,suit)
      mesh(new T.SphereGeometry(.047,12,8),skin,arm,[side*.031,-.43,-.09]).scale.set(.87,1.22,.83)
      const hip=new T.Group();hip.position.set(side*.105,.87,0);this.body.add(hip);this.legs.push(hip)
      limb(hip,v(),v(0,-.37,0),.083,suit)
      const knee=new T.Group();knee.position.y=-.36;hip.add(knee);this.knees.push(knee)
      limb(knee,v(),v(0,-.37,0),.062,suit)
      box(knee,[.139,.085,.23],[0,-.38,-.055],shoe,.03)
      batchStatic(arm);batchStatic(knee)
    }
    mesh(new T.CylinderGeometry(.057,.065,.13,12),skin,this.body,[0,1.46,0])
    this.body.add(this.head)
    mesh(new T.SphereGeometry(.145,20,14),skin,this.head,[0,1.62,0]).scale.set(.88,1.19,.86)
    mesh(new T.SphereGeometry(.138,18,12,0,tau,0,Math.PI*.53),hairPalette[(code>>>2)%hairPalette.length],this.head,[0,1.66,.013]).scale.set(.99,1.15,.97)
    for(const side of [-1,1]){
      mesh(new T.SphereGeometry(.027,9,7),skin,this.head,[side*.122,1.603,0]).scale.set(.73,1.14,.79)
      mesh(new T.SphereGeometry(.011,8,6),shoe,this.head,[side*.043,1.637,-.114])
    }
    mesh(new T.SphereGeometry(.035,10,8),skin,this.head,[0,1.603,-.117]).scale.set(.66,1.05,.73)
    box(this.head,[.045,.009,.007],[0,1.564,-.116],shoe,.003)
    if(staff==='cook'){
      box(this.head,[.28,.077,.245],[0,1.752,.014],shirt,.03)
      for(const x of [-.074,0,.074])mesh(new T.SphereGeometry(.091,12,8),shirt,this.head,[x,1.82,.018])
    }else if(staff==='cashier'||staff==='janitor'){
      box(this.head,[.26,.077,.23],[0,1.76,.016],suit,.037)
      box(this.head,[.21,.018,.15],[0,1.729,-.12],suit,.006)
    }
    batchStatic(this.head)
    batchStatic(this.body)
    this.shadow=new T.Mesh(new T.PlaneGeometry(.97,.85),new T.MeshBasicMaterial({map:shadow,transparent:true,depthWrite:false}))
    this.root.add(this.shadow);this.shadow.position.y=.026
    this.shadow.rotation.x=-Math.PI/2
  }
  hideHead(){this.head.visible=false}
  pose(dt:number,now:number,local?:Position,serving=false,eating=false,homePose?:HomePose){
    const target=local??this.target,chair=this.target.chair||this.target.lounge
    const speed=Math.hypot(target.x-this.root.position.x,target.z-this.root.position.z)
    const f=local?1:1-Math.exp(-dt*10)
    this.root.position.x=T.MathUtils.lerp(this.root.position.x,target.x,f)
    this.root.position.z=T.MathUtils.lerp(this.root.position.z,target.z,f)
    this.root.rotation.y+=angleBetween(this.root.rotation.y,target.yaw)*f
    this.motion=T.MathUtils.damp(this.motion,!chair&&speed>.018?1:0,9,dt)
    this.gait+=dt*(this.motion*8+1)
    const swing=Math.sin(this.gait)*this.motion,breathe=Math.sin(now*.002+target.x)
    this.body.position.y=chair?-.17:breathe*.012+Math.abs(swing)*.032
    this.body.rotation.x=chair?-.09:serving?-.15+breathe*.05:0
    for(let i=0;i<2;i++){
      const side=i===0?1:-1
      this.legs[i].rotation.x=chair?1.28:swing*.53*side
      this.knees[i].rotation.x=chair?-1.35:-Math.max(0,swing*side)*.61
      this.arms[i].rotation.x=chair?.75:serving?1.12+breathe*side*.33:swing*-.38*side+breathe*.025
    }
    const resting=homePose?.kind==='rest'
    this.body.position.z=0
    this.shadow.visible=!homePose
    if(resting){
      this.body.rotation.x=-Math.PI/2
      this.body.position.y=homePose.height+.12
      for(let i=0;i<2;i++){this.legs[i].rotation.x=0;this.knees[i].rotation.x=0;this.arms[i].rotation.x=0}
    }else if(homePose)this.body.position.y=homePose.height-.87
    if(eating)this.arms[0].rotation.x=1.18+Math.max(0,breathe)*.66
  }
  dispose(){
    this.root.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose()})
    for(const m of this.ownedMaterials)m.dispose()
    this.shadow.material.dispose()
    this.root.removeFromParent()
  }
}
export class HallStage {
  private renderer:T.WebGLRenderer
  private scene=new T.Scene()
  private camera=new T.PerspectiveCamera(57,1,.075,45)
  private floorShadow=contactTexture()
  private figures=new Map<string,{figure:Figure;label:HTMLElement}>()
  private wheels:ReturnType<typeof buildHallTables>
  private staff:Figure[]
  private patrons:Figure[]
  private observer:ResizeObserver
  private controls=new AbortController()
  private view?:HallView
  private angle=0
  private tilt=0
  private keys=new Set<string>()
  private touchKeys=new Map<number,string>()
  private drag?:{x:number;y:number;pointer:number;distance:number}
  private seatedYaw=0
  private seatedTilt=0
  private cameraAim=v(0,1.25,1)
  private last=0
  private frame=0
  private frameRequest=0
  private knownRoom=''
  private knownSeat=''
  private selected:RouletteChoice='white'
  private matMarkers:T.Mesh[]=[]
  private celebration:T.Points<T.BufferGeometry,T.PointsMaterial>
  private celebrationPositions=new Float32Array(72*3)
  private reduced=matchMedia('(prefers-reduced-motion: reduce)').matches
  private clockDelta=0
  private stakeStacks:T.Group[][]=[]
  private stakeTimes=new Map<string,number>()
  private seatHands=new T.Group()
  private gl:WebGL2RenderingContext
  private fence:WebGLSync|null=null
  position:Position={...SPAWN}
  get moving(){return Boolean(this.keys.size||this.touchKeys.size||this.drag)}
  constructor(private canvas:HTMLCanvasElement,private labels:HTMLElement,private choose:(choice:RouletteChoice)=>void){
    this.renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'})
    this.gl=this.renderer.getContext() as WebGL2RenderingContext
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.4))
    this.renderer.toneMapping=T.ACESFilmicToneMapping
    this.renderer.toneMappingExposure=1.18
    this.scene.background=new T.Color(0x172724)
    this.scene.fog=new T.FogExp2(0x172724,.025)
    this.scene.add(new T.HemisphereLight(0xdad3c8,0x39251c,1.8))
    const fill=new T.DirectionalLight(0xc7edff,1.15);fill.position.set(-5,8,-5);this.scene.add(fill)
    buildHall(this.scene)
    this.wheels=buildHallTables(this.scene)
    this.stakeStacks=this.wheels.map(({group})=>SEAT_OFFSETS.map(()=>{
      const stack=new T.Group();group.add(stack);stack.visible=false
      for(let i=0;i<4;i++){
        mesh(new T.CylinderGeometry(.046,.046,.013,16),i%2?gold:shirt,stack,[0,i*.016,0],false)
      }
      batchStatic(stack)
      return stack
    }))
    const sleeves=material(0x405355),hands=material(0xc99b78)
    for(const side of [-1,1]){
      limb(this.seatHands,v(side*.28,-.12,.36),v(side*.24,.005,-.02),.079,sleeves)
      mesh(new T.SphereGeometry(.074,14,10),hands,this.seatHands,[side*.23,.018,-.064]).scale.set(.70,.58,1.18)
    }
    batchStatic(this.seatHands)
    this.scene.add(this.seatHands)
    this.seatHands.visible=false
    this.staff=TABLES.map((site,i)=>{
      const p={name:['Croupier Emilia','Croupier Laurent','Croupier Sacha'][i],avatar:'default',x:site.x-.38,z:site.z-1.49,yaw:Math.PI,online:true}
      return new Figure(this.scene,p,this.floorShadow,true)
    })
    this.patrons=[
      {name:'Marcel',x:-3.85,z:6.82,yaw:0,staff:true},
      {name:'Amara',x:-8.28,z:-2.15,yaw:-.4,staff:false},
      {name:'Elias',x:8.38,z:5.2,yaw:-.8,staff:false},
      {name:'Sofia',x:3.9,z:6.35,yaw:1.7,staff:false},
    ].map(({staff,...p})=>new Figure(this.scene,{...p,avatar:'default',online:true},this.floorShadow,staff))
    this.matMarkers=this.wheels.map(wheel=>{
      const m=mesh(new T.TorusGeometry(.072,.010,7,20),gold,wheel.group,[.3,1.059,.35],false)
      m.rotation.x=-Math.PI/2;m.visible=false;return m
    })
    const geometry=new T.BufferGeometry()
    geometry.setAttribute('position',new T.BufferAttribute(this.celebrationPositions,3))
    this.celebration=new T.Points(geometry,new T.PointsMaterial({color:0xffca77,size:.052,transparent:true,opacity:.75,blending:T.AdditiveBlending,depthWrite:false}))
    this.celebration.visible=false;this.celebration.frustumCulled=false;this.scene.add(this.celebration)
    this.camera.position.set(0,2.25,8.45)
    this.bind()
    this.observer=new ResizeObserver(()=>this.fit());this.observer.observe(canvas);this.fit()
    this.frameRequest=requestAnimationFrame(this.update)
  }
  set(view:HallView,clockDelta:number){
    const {chair,lounge}=view.you,seat=chair?'table:'+chair.table+':'+chair.index:lounge?'couch:'+lounge.couch+':'+lounge.index:''
    if(view.room!==this.knownRoom||seat!==this.knownSeat||Math.hypot(view.you.x-this.position.x,view.you.z-this.position.z)>1.8){
      this.position={x:view.you.x,z:view.you.z,yaw:view.you.yaw};this.angle=view.you.yaw;this.tilt=0;this.seatedYaw=0;this.seatedTilt=0
    }
    this.knownRoom=view.room;this.knownSeat=seat;this.clockDelta=clockDelta
    this.view=view
    const liveTickets=new Set<string>()
    for(const table of view.tables)for(const player of table.seats){
      if(!player?.locked)continue
      const key=table.round+player.name
      liveTickets.add(key)
      if(!this.stakeTimes.has(key))this.stakeTimes.set(key,table.spin?.started??view.now)
    }
    for(const key of this.stakeTimes.keys())if(!liveTickets.has(key))this.stakeTimes.delete(key)
    for(const p of view.players){
      let entry=this.figures.get(p.name)
      if(!entry){
        const label=document.createElement('span');label.className='hall-nameplate';label.textContent=p.name;label.hidden=true;this.labels.append(label)
        entry={figure:new Figure(this.scene,p,this.floorShadow),label}
        this.figures.set(p.name,entry)
      }
      entry.figure.target=p
      entry.label.classList.toggle('is-offline',!p.online)
    }
    const names=new Set(view.players.map(p=>p.name))
    for(const [name,entry] of this.figures)if(!names.has(name)){entry.figure.dispose();entry.label.remove();this.figures.delete(name)}
  }
  select(choice:RouletteChoice){this.selected=choice}
  private bind(){
    const {signal}=this.controls
    const active=()=>!document.querySelector('dialog[open]')&&!document.activeElement?.matches('input')
    const directions=['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright']
    window.addEventListener('keydown',e=>{const k=e.key.toLowerCase();if((this.view?.you.chair||this.view?.you.lounge)||!directions.includes(k)||!active()||e.ctrlKey||e.metaKey||e.altKey)return;e.preventDefault();this.keys.add(k)},{signal})
    window.addEventListener('keyup',e=>this.keys.delete(e.key.toLowerCase()),{signal})
    window.addEventListener('blur',()=>{this.keys.clear();this.touchKeys.clear();this.drag=undefined},{signal})
    document.querySelectorAll<HTMLButtonElement>('[data-walk]').forEach(b=>{
      b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);this.touchKeys.set(e.pointerId,b.dataset.walk!)},{signal})
      b.addEventListener('lostpointercapture',e=>this.touchKeys.delete(e.pointerId),{signal})
    })
    this.canvas.addEventListener('pointerdown',e=>{
      const chair=this.view?.you.chair
      if(chair&&this.view?.tables[chair.table].phase==='spin')return
      this.canvas.focus({preventScroll:true});this.canvas.setPointerCapture(e.pointerId)
      this.drag={x:e.clientX,y:e.clientY,pointer:e.pointerId,distance:0}
    },{signal})
    this.canvas.addEventListener('pointermove',e=>{
      if(!this.drag||this.drag.pointer!==e.pointerId)return
      const dx=e.clientX-this.drag.x,dy=e.clientY-this.drag.y
      this.drag.distance+=Math.hypot(dx,dy)
      if(this.view?.you.chair||this.view?.you.lounge){
        this.seatedYaw=T.MathUtils.clamp(this.seatedYaw-dx*.004,-.49,.49)
        this.seatedTilt=T.MathUtils.clamp(this.seatedTilt+dy*.003,-.55,.55)
      }else{
        this.angle-=dx*.006
        this.tilt=T.MathUtils.clamp(this.tilt+dy*.003,-.71,.49)
      }
      this.drag.x=e.clientX;this.drag.y=e.clientY
    },{signal})
    this.canvas.addEventListener('pointerup',e=>{if(this.drag&&this.drag.distance<7)this.pickFelt(e)},{signal})
    this.canvas.addEventListener('lostpointercapture',()=>this.drag=undefined,{signal})
    window.addEventListener('pagehide',e=>{if(!e.persisted)this.dispose()},{signal})
  }
  private pickFelt(event:PointerEvent){
    const chair=this.view?.you.chair
    if(!chair||this.view?.tables[chair.table].phase!=='betting')return
    const rect=this.canvas.getBoundingClientRect(),site=TABLES[chair.table]
    const ray=new T.Raycaster()
    ray.setFromCamera(new T.Vector2((event.clientX-rect.x)/rect.width*2-1,-(event.clientY-rect.y)/rect.height*2+1),this.camera)
    const point=ray.ray.intersectPlane(new T.Plane(v(0,1,0),-1.044),v())
    if(!point)return
    const x=((point.x-site.x-.84)/1.92+.5)*640,y=((point.z-site.z+.11)/1.29+.5)*384
    if(y>=89&&y<265){
      if(x>=25&&x<59){this.choose(0);return}
      if(x>=64&&x<616)this.choose(1+Math.floor((x-64)/46)+Math.floor((y-89)/60)*12)
    }else if(y>=280&&y<322&&x>=64&&x<616){
      this.choose((['low','even','white','black','odd','high'] as const)[Math.floor((x-64)/92)])
    }
  }
  private fit(){
    const w=Math.max(1,this.canvas.clientWidth),h=Math.max(1,this.canvas.clientHeight)
    this.camera.aspect=w/h;this.camera.fov=w<h?66:55;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h,false)
  }
  private move(dt:number){
    if(this.view?.you.chair||this.view?.you.lounge)return
    const pressed=new Set([...this.keys,...this.touchKeys.values()])
    const x=Number(pressed.has('d')||pressed.has('arrowright'))-Number(pressed.has('a')||pressed.has('arrowleft'))
    const z=Number(pressed.has('s')||pressed.has('arrowdown'))-Number(pressed.has('w')||pressed.has('arrowup'))
    if(x||z){
      const a=this.angle
      this.position=centerPath(this.position,x*Math.cos(a)+z*Math.sin(a),z*Math.cos(a)-x*Math.sin(a),dt)
    }
    this.position.yaw=this.angle
  }
  private update=(time:number)=>{
    this.frameRequest=requestAnimationFrame(this.update)
    if(document.hidden||time-this.frame<27||this.gl.isContextLost())return
    if(this.fence){
      if(this.gl.clientWaitSync(this.fence,0,0)===this.gl.TIMEOUT_EXPIRED)return
      this.gl.deleteSync(this.fence)
      this.fence=null
    }
    this.frame=time
    const dt=Math.min(.20,(time-this.last)/1000||.03);this.last=time
    if(!document.querySelector('dialog[open]'))this.move(dt)
    const now=Date.now()+this.clockDelta,chair=this.view?.you.chair,couch=this.view?.you.lounge,active=chair===undefined?undefined:this.view?.tables[chair.table]
    for(const [name,{figure}] of this.figures){
      const me=name===this.view?.you.name
      figure.root.visible=!(me&&chair)
      figure.pose(dt,time,me&&!chair?this.position:undefined)
    }
    this.staff.forEach((figure,i)=>figure.pose(dt,time,undefined,this.view?.tables[i].phase==='spin'))
    const [bartender,amara,elias,sofia]=this.patrons
    bartender.pose(dt,time,undefined,Math.sin(time*.0012)>.25)
    // Slow oval paths keep the guests in the side aisles, clear of seats and tables.
    if(!this.reduced){
      const a=time*.00027,b=time*.00032+2
      amara.target={...amara.target,x:-8.6+Math.sin(a)*.43,z:.45+Math.cos(a)*2.5,yaw:Math.atan2(-Math.cos(a)*.43,Math.sin(a)*2.5)}
      elias.target={...elias.target,x:8.6+Math.sin(b)*.42,z:2+Math.cos(b)*2.85,yaw:Math.atan2(-Math.cos(b)*.42,Math.sin(b)*2.85)}
    }
    for(const guest of [amara,elias,sofia])guest.pose(dt,time)
    this.seatHands.visible=Boolean(chair)&&(!active?.spin||now<active.spin.started+690||now>active.spin.ends+450)
    if(chair&&active){
      const since=now-(this.stakeTimes.get(active.round+this.view!.you.name)??-Infinity)
      const reach=this.reduced?0:Math.sin(Math.PI*T.MathUtils.clamp(since/720,0,1))*.26
      this.seatHands.position.set(this.position.x,1.004,this.position.z-.48-reach)
      this.seatHands.rotation.y=(SEAT_OFFSETS[chair.index]-.1)*.22
    }
    this.wheels.forEach((wheel,i)=>{
      const table=this.view?.tables[i],spin=table?.spin
      this.stakeStacks[i].forEach((stack,j)=>{
        const player=table?.seats[j]
        const at=player&&table?this.stakeTimes.get(table.round+player.name):undefined
        stack.visible=at!==undefined&&(!spin||now<spin.started+950)
        if(!stack.visible||at===undefined)return
        const a=this.reduced?1:T.MathUtils.clamp((now-at)/720,0,1)
        const clearing=spin?ease(T.MathUtils.clamp((now-spin.started-620)/330,0,1)):0
        stack.position.set(T.MathUtils.lerp(SEAT_OFFSETS[j],-.31+(.13*j),clearing),
          1.06+Math.sin(a*Math.PI)*.10,T.MathUtils.lerp(T.MathUtils.lerp(1.19,.81,ease(a)),-.8,clearing))
      })
      this.matMarkers[i].visible=chair?.table===i&&table?.phase==='betting'
      if(this.matMarkers[i].visible){
        const n=this.selected
        const outside=['low','even','white','black','odd','high']
        const uv=typeof n==='number'?n===0?[42,182]:[86+(n-1)%12*46,118+Math.floor((n-1)/12)*60]:[108+outside.indexOf(n)*92,302]
        this.matMarkers[i].position.set(.84+(uv[0]/640-.5)*1.92,1.056,-.11+(uv[1]/384-.5)*1.29)
      }
      if(spin){
        const progress=T.MathUtils.clamp((now-spin.started)/(spin.ends-spin.started),0,1)
        const fraction=this.reduced?1:progress
        const rotor=1-(1-fraction)**2.5
        const ball=1-(1-fraction)**2.8
        wheel.rotor.rotation.y=5*tau*rotor+.62*rotor
        const end=-(ROULETTE_ORDER.indexOf(spin.pocket)+.5)*tau/37
        const angle=end+.62-tau*9*(1-ball)
        const radius=T.MathUtils.lerp(.637,.486,ease(T.MathUtils.clamp((fraction-.62)/.31,0,1)))
        const bounce=fraction>.61&&fraction<.92 ? Math.abs(Math.sin(fraction*103))*.056*(1-fraction):0
        wheel.marker.position.set(WHEEL_X+Math.cos(angle)*radius,1.206+bounce,WHEEL_Z-Math.sin(angle)*radius)
        const aura=wheel.aura.material as T.MeshBasicMaterial
        aura.color.set(pocketColor(spin.pocket)==='rift'?0xd391f0:0xf8cf85)
        wheel.aura.material.opacity=table.phase==='result'?.53+.25*Math.sin(time*.008):.22+.19*Math.sin(time*.007)
      }else{
        wheel.aura.material.opacity=.20+.09*Math.sin(time*.002+i)
        const previous=table?.recent[0]
        if(previous===undefined){
          wheel.rotor.rotation.y=0
          wheel.marker.position.set(WHEEL_X,1.201,WHEEL_Z-.59)
        }else{
          wheel.rotor.rotation.y=.62
          const angle=.62-(ROULETTE_ORDER.indexOf(previous)+.5)*tau/37
          wheel.marker.position.set(WHEEL_X+Math.cos(angle)*.486,1.206,WHEEL_Z-Math.sin(angle)*.486)
        }
      }
    })
    const wanted=v(),aim=v(),local=this.position
    let cameraMode='walk'
    if(chair&&active){
      const site=TABLES[chair.table]
      const spin=active.spin
      if(spin&&!this.reduced&&now>spin.started+720&&now<spin.ends+450){
        cameraMode='wheel'
        wanted.set(site.x+WHEEL_X,3.76,site.z+WHEEL_Z+.12)
        aim.set(site.x+WHEEL_X,1.005,site.z+WHEEL_Z-.024)
      }else{
        cameraMode='seat'
        wanted.set(local.x,1.67,local.z+.22)
        aim.set(site.x+.17+this.seatedYaw*2.1,1.05+this.seatedTilt,site.z-.03)
      }
    }else if(couch){
      cameraMode='lounge'
      const a=local.yaw+this.seatedYaw
      wanted.set(T.MathUtils.clamp(local.x+Math.sin(a)*.79+Math.cos(a)*.79,-10.9,10.9),2.12,local.z+Math.cos(a)*.79-Math.sin(a)*.79)
      aim.set(local.x-Math.sin(a)*2.8,1.24+this.seatedTilt,local.z-Math.cos(a)*2.8)
    }else{
      const distance=this.camera.aspect<1?1.39:1.98
      wanted.set(T.MathUtils.clamp(local.x+Math.sin(this.angle)*distance,-10.85,10.85),2.6,T.MathUtils.clamp(local.z+Math.cos(this.angle)*distance,-6.2,8.3))
      aim.set(local.x-Math.sin(this.angle)*2,1.3+this.tilt*3,local.z-Math.cos(this.angle)*2)
    }
    const smooth=this.reduced?1:1-Math.exp(-dt*(chair?5:10))
    this.camera.position.lerp(wanted,smooth);this.cameraAim.lerp(aim,smooth);this.camera.lookAt(this.cameraAim);this.camera.updateMatrixWorld()
    this.drawPrize(now,chair?.table,active)
    this.renderer.render(this.scene,this.camera)
    this.fence=this.gl.fenceSync(this.gl.SYNC_GPU_COMMANDS_COMPLETE,0)
    this.gl.flush()
    this.canvas.dataset.camera=cameraMode
    this.project(this.camera.aspect)
  }
  private drawPrize(now:number,index:number|undefined,table:HallView['tables'][number]|undefined){
    const receipt=this.view?.receipt
    this.celebration.visible=false
    if(index===undefined||!receipt?.won||!table?.spin||this.reduced)return
    const t=(now-table.spin.ends)/1000
    if(t<0||t>2.8)return
    const count=receipt.choice===0?72:typeof receipt.choice==='number'?49:27
    const site=TABLES[index],geometry=this.celebration.geometry
    this.celebration.material.color.set(receipt.choice===0?0xf0bdff:0xffca77)
    geometry.setDrawRange(0,count)
    this.celebration.visible=true
    this.celebration.material.opacity=Math.max(0,.92*(1-t/2.8))
    for(let i=0;i<count;i++){
      const angle=i*2.399+t*(i%3)*.3,rad=.27+t*(.18+(i%7)*.11)
      this.celebrationPositions[i*3]=site.x+WHEEL_X+Math.cos(angle)*rad
      this.celebrationPositions[i*3+1]=1.22+Math.max(0,t*(1.3+(i%8)*.34)-t*t*.75)
      this.celebrationPositions[i*3+2]=site.z+WHEEL_Z+Math.sin(angle)*rad
    }
    geometry.getAttribute('position').needsUpdate=true
  }
  private project(aspect:number){
    const show=(node:HTMLElement,p:T.Vector3)=>{
      p.project(this.camera)
      const visible=p.z<1&&p.z>-1&&Math.abs(p.x)<.9&&Math.abs(p.y)<.88
      node.hidden=!visible
      if(visible){node.style.left=(50+p.x*50)+'%';node.style.top=(50-p.y*50)+'%'}
    }
    for(const [name,{figure,label}] of this.figures){
      if(name===this.view?.you.name||figure.root.position.distanceTo(this.camera.position)>(aspect<1?8:12)){label.hidden=true;continue}
      show(label,figure.root.position.clone().add(v(0,figure.target.chair||figure.target.lounge?1.59:1.94,0)))
    }
    this.labels.querySelectorAll<HTMLButtonElement>('[data-in-world]').forEach((button,i)=>{
      const site=TABLES[i],distance=Math.hypot(this.position.x-site.x,this.position.z-site.z)
      if(!this.view||this.view.you.chair||this.view.you.lounge||distance>8.0){button.hidden=true;return}
      show(button,v(site.x,2.34,site.z+.25))
    })
    this.labels.querySelectorAll<HTMLButtonElement>('[data-in-lounge]').forEach((button,i)=>{
      const site=LOUNGES[i],distance=Math.hypot(this.position.x-site.x,this.position.z-site.z)
      if(!this.view||this.view.you.chair||this.view.you.lounge||distance>4.5){button.hidden=true;return}
      show(button,v(site.x,1.42,site.z))
    })
  }
  private dispose(){
    this.controls.abort();this.observer.disconnect();cancelAnimationFrame(this.frameRequest)
    this.scene.traverse(obj=>{
      if(obj instanceof T.Mesh||obj instanceof T.Points){
        obj.geometry.dispose()
        for(const material of Array.isArray(obj.material)?obj.material:[obj.material]){
          material.map?.dispose();material.dispose()
        }
      }
    })
    if(this.fence)this.gl.deleteSync(this.fence)
    this.renderer.dispose()
  }
}
function centerPath(from:Position,dx:number,dz:number,dt:number){
  const length=Math.hypot(dx,dz)
  if(!length)return from
  return walk(from,from.x+dx/length*WALK_SPEED*dt,from.z+dz/length*WALK_SPEED*dt,WALK_SPEED*dt)
}
