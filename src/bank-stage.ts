import * as T from 'three'
import {ClubGuest} from './casino/roulette-cast.ts'
import {batchStatic} from './casino/scene/static-batch.ts'
import {box,cylinder,limb,mesh,v} from './casino/scene/geometry.ts'

export const bankDesks={
  loans:{point:v(-2.9,1.62,-1.30),camera:v(-2.9,1.63,.92),target:v(-2.85,1.24,-2.44)},
  payments:{point:v(2.9,1.62,-1.30),camera:v(2.9,1.63,.92),target:v(2.85,1.24,-2.44)},
  vault:{point:v(7.35,2.2,-5.87),camera:v(7.4,2.26,.25),target:v(7.36,2.12,-5.88)},
} as const
export type BankDesk=keyof typeof bankDesks
const tau=Math.PI*2
const std=(color:number,metalness=0,roughness=.65)=>new T.MeshStandardMaterial({color,metalness,roughness})
const gilt=std(0xca9a58,.72,.25),bronze=std(0x7b5938,.58,.38),steel=std(0x63898f,.65,.37)
const oak=std(0x483031,.12,.42),leather=std(0x1c4459,.1,.64),blue=std(0x203742,.1,.56)
const ink=std(0x192d36),ivory=std(0xe0d9c5,.16,.38),warm=new T.MeshBasicMaterial({color:0xffdeb3})
function art(width:number,height:number,paint:(ctx:CanvasRenderingContext2D)=>void){
  const canvas=document.createElement('canvas')
  canvas.width=width;canvas.height=height
  paint(canvas.getContext('2d')!)
  const map=new T.CanvasTexture(canvas)
  map.colorSpace=T.SRGBColorSpace
  map.anisotropy=4
  return map
}
function sign(parent:T.Object3D,text:string,width:number,height:number,position:number[],color='#ead7ac'){
  const map=art(768,128,ctx=>{
    ctx.font='600 68px Georgia';ctx.fillStyle=color
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,384,65,740)
  })
  return mesh(new T.PlaneGeometry(width,height),new T.MeshBasicMaterial({map,transparent:true,depthWrite:false}),parent,position,false)
}
function ring(parent:T.Object3D,r:number,t:number,position:number[],m:T.Material=gilt){
  return mesh(new T.TorusGeometry(r,t,10,60),m,parent,position,false)
}
function spotlight(scene:T.Object3D,color:number,power:number,range:number,x:number,y:number,z:number){
  const light=new T.PointLight(color,power,range,2)
  scene.add(light);light.position.set(x,y,z)
}
function makeFloor(scene:T.Object3D){
  const texture=art(512,512,c=>{
    c.fillStyle='#192f36';c.fillRect(0,0,512,512)
    for(let k=0;k<16;k++){
      const x=k%4*128,y=Math.floor(k/4)*128
      c.save();c.translate(x,y)
      const shade=c.createLinearGradient(0,0,115,111)
      shade.addColorStop(0,k%2?'#8e9fa0':'#466370');shade.addColorStop(.56,k%2?'#bac3bb':'#69878d');shade.addColorStop(1,k%2?'#95a4a1':'#465b62')
      c.fillStyle=shade;c.fillRect(2,2,124,124)
      for(let i=0;i<7;i++){
        c.beginPath();c.moveTo(-4,7+i*17);c.bezierCurveTo(41,72+i*6,74,22+i*18,129,17+i*17)
        c.strokeStyle=i%2?'#f0eece29':'#18252222';c.lineWidth=i%2?1:2;c.stroke()
      }
      c.restore()
    }
  })
  texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.repeat.set(6,5)
  const floor=mesh(new T.PlaneGeometry(20.8,15.5),new T.MeshStandardMaterial({map:texture,roughness:.48}),scene,[0,-.019,1.02])
  floor.rotation.x=-Math.PI/2
  const rug=art(256,768,c=>{
    c.fillStyle='#27495a';c.fillRect(0,0,256,768)
    for(let y=28;y<768;y+=52)for(let x=28;x<256;x+=50){
      c.save();c.translate(x,y);c.rotate(Math.PI/4);c.strokeStyle='#e3c08535';c.strokeRect(-7,-7,14,14);c.restore()
    }
    c.lineWidth=2;c.strokeStyle='#b9996d'
    for(const i of [5,12,19])c.strokeRect(i,i,256-2*i,768-2*i)
  })
  const runner=mesh(new T.PlaneGeometry(2.9,8.3),new T.MeshStandardMaterial({map:rug,roughness:.9}),scene,[0,0,2.85])
  runner.rotation.x=-Math.PI/2
}
function windowArch(parent:T.Object3D,x:number){
  const g=new T.Group();g.position.set(x,2.8,-6.28);parent.add(g)
  const shape=new T.Shape()
  shape.moveTo(-1.17,0);shape.lineTo(1.17,0);shape.lineTo(1.17,2.08)
  shape.absarc(0,2.08,1.17,0,Math.PI,false);shape.closePath()
  const texture=art(256,350,c=>{
    const glass=c.createLinearGradient(0,0,0,350)
    glass.addColorStop(0,'#486c9a');glass.addColorStop(.64,'#84afc1');glass.addColorStop(1,'#f4d6a6')
    c.fillStyle=glass;c.fillRect(0,0,256,350)
    const seed=Math.round((x+10)*35)
    for(let i=0;i<17;i++){
      const h=22+(i*23+seed)%65,xx=i*16
      c.fillStyle=i%2?'#485f78':'#526a80';c.fillRect(xx,350-h,15,h)
      c.fillStyle='#efd19895';for(let y=355-h;y<345;y+=11)c.fillRect(xx+3,y,2,3)
    }
  })
  const geo=new T.ShapeGeometry(shape),uv=geo.getAttribute('uv')
  for(let i=0;i<uv.count;i++)uv.setXY(i,(uv.getX(i)+1.17)/2.34,uv.getY(i)/3.25)
  mesh(geo,new T.MeshBasicMaterial({map:texture}),g,[0,0,0],false)
  mesh(new T.TorusGeometry(1.17,.06,9,54,Math.PI),gilt,g,[0,2.08,.04],false)
  for(const side of [-1,1])box(g,[.11,2.08,.13],[side*1.17,1.04,.05],gilt)
  box(g,[.065,3.24,.075],[0,1.61,.05],bronze)
  for(const y of [.67,1.36,2.08])box(g,[2.36,.042,.07],[0,y,.05],bronze)
  box(g,[2.52,.13,.25],[0,0,.05],ivory)
  batchStatic(g)
}
function pendant(parent:T.Object3D,x:number,z:number){
  const g=new T.Group();g.position.set(x,5.04,z);parent.add(g)
  cylinder(g,.034,1.52,[0,.79,0],bronze,12)
  const hoop=ring(g,.65,.026,[0,0,0]);hoop.rotation.x=-Math.PI/2
  for(let i=0;i<9;i++){
    const angle=i*tau/9,xx=Math.cos(angle),zz=Math.sin(angle)
    limb(g,v(0,.14,0),v(xx*.63,0,zz*.63),.018,gilt)
    cylinder(g,.074,.20,[xx*.63,-.08,zz*.63],warm,12)
    cylinder(g,.085,.028,[xx*.63,-.2,zz*.63],gilt,12)
  }
  batchStatic(g)
}
function bench(parent:T.Object3D,x:number,z:number,yaw:number){
  const b=new T.Group();parent.add(b);b.position.set(x,0,z);b.rotation.y=yaw
  box(b,[2.46,.27,.65],[0,.45,0],leather,.075)
  box(b,[2.43,.48,.15],[0,.71,.28],leather,.063)
  for(const xx of [-1.02,1.02]){
    box(b,[.075,.42,.48],[xx,.23,0],bronze,.02)
    box(b,[.08,.27,.58],[xx,.63,0],gilt,.018)
  }
  batchStatic(b)
}
export function bankDesk(parent:T.Object3D,x:number,title:string){
  const g=new T.Group();parent.add(g);g.position.set(x,0,-1.53)
  box(g,[4.02,1.12,.92],[0,.56,0],oak,.105)
  box(g,[4.14,.09,1.08],[0,1.145,0],ivory,.042)
  box(g,[3.58,.50,.024],[0,.56,.478],ink,.015)
  for(const xx of [-1.34,-.68,0,.68,1.34])box(g,[.05,.56,.035],[xx,.56,.50],gilt,.012)
  for(const xx of [-1.83,1.83]){
    cylinder(g,.054,1.56,[xx,1.91,-.08],gilt,12)
    cylinder(g,.083,.047,[xx,2.72,-.08],gilt,16)
  }
  box(g,[3.66,.08,.11],[0,2.66,-.08],bronze,.02)
  box(g,[1.52,.235,.11],[0,2.62,.05],blue,.035)
  sign(g,title,1.35,.22,[0,2.62,.12])
  box(g,[.79,.028,.53],[0,1.202,.11],leather,.03)
  box(g,[.305,.008,.398],[-.12,1.224,.03],ivory,.003).rotation.y=.10
  limb(g,v(.27,1.229,-.05),v(.49,1.23,.08),.012,gilt)
  cylinder(g,.12,.035,[1.56,1.21,.16],bronze,22)
  cylinder(g,.027,.32,[1.56,1.38,.16],gilt,12)
  mesh(new T.SphereGeometry(.1,16,10),warm,g,[1.56,1.57,.16],false).scale.set(1.7,.65,1)
  batchStatic(g)
}

export function buildBankArchitecture(scene:T.Object3D,city=false){
  const room=new T.Group();scene.add(room);makeFloor(scene)
  box(room,[21,6.7,.36],[0,3.35,-6.57],blue,.025)
  if(!city)box(room,[21,6.7,.36],[0,3.35,8.4],blue,.025)
  for(const x of [-10.2,10.2]){
    box(room,[.30,6.7,15.1],[x,3.35,.96],blue,.025)
    for(const z of [-5.0,-.7,3.5,7.3]){
      box(room,[.37,4.6,.3],[x*.971,2.3,z],ivory,.035)
      box(room,[.36,.075,.77],[x*.955,2.43,z],gilt,.02)
      box(room,[.19,.39,.32],[x*.943,2.65,z],warm,.035)
    }
  }
  box(room,[20.7,.25,15.2],[0,6.62,.97],ink,.025)
  for(const z of [-6.15,-2.35,1.3,4.95,8.05])box(room,[20,.18,.17],[0,6.39,z],bronze,.024)
  for(const x of [-8,-4,0,4,8])box(room,[.11,.14,14.5],[x,6.37,.84],bronze,.015)
  if(!city)for(const x of [-6.85,-3.48,0,3.48])windowArch(room,x)
  for(const x of [-8.86,-5.12,-1.72,1.72,5.2]){
    cylinder(room,.19,5.65,[x,2.98,-6.02],ivory,22)
    for(const y of [.18,.43,5.77,6.01])cylinder(room,.29,.13,[x,y,-6.02],gilt,18)
  }
  for(const y of [.17,1.47,6.12])box(room,[19.7,.095,.18],[0,y,-6.30],gilt,.02)
  for(const [x,z] of [[-4,-.72],[4,-.72],[0,4.45]]){
    pendant(room,x,z);spotlight(scene,0xffcd91,46,13,x,4.8,z)
  }
  spotlight(scene,0x8dcaef,63,13,0,4,-5.4)
  bench(room,-8.94,4.3,-Math.PI/2);bench(room,8.94,4.3,Math.PI/2)
  bankDesk(room,-2.9,'LOANS');bankDesk(room,2.9,'PAYMENTS')
  box(room,[3.25,.14,.30],[0,.62,-1.52],oak,.045)
  for(const x of [-.69,.69]){
    cylinder(room,.053,.88,[x,.44,-.31],gilt,16)
    cylinder(room,.13,.055,[x,.04,-.31],bronze,16)
  }
  for(const x of [-2.9,2.9]){
    cylinder(room,.31,.11,[x,.51,.25],leather,28)
    cylinder(room,.06,.48,[x,.25,.25],gilt,18)
    cylinder(room,.23,.063,[x,.055,.25],bronze,24)
  }
  box(room,[4.24,.62,.30],[0,3.6,-2.05],ink,.067)
  sign(room,'FIFTH DIMENSION BANK',4.03,.43,[0,3.60,-1.88])
  batchStatic(room)
}
export function buildBankVault(scene:T.Object3D){
  const vault=new T.Group();scene.add(vault);vault.position.set(7.35,0,-6.11)
  box(vault,[3.72,4.45,.52],[0,2.23,-.15],ink,.14)
  box(vault,[3.41,3.88,.24],[0,2.21,.18],steel,.13)
  mesh(new T.CircleGeometry(1.47,64),new T.MeshBasicMaterial({color:0x101c21}),vault,[0,2.18,.323])
  ring(vault,1.56,.067,[0,2.18,.352]);ring(vault,1.4,.032,[0,2.18,.35],bronze)
  const hinge=new T.Group();hinge.position.set(-1.43,2.18,.39);vault.add(hinge)
  const door=new T.Group();door.position.x=1.43;hinge.add(door)
  const plate=cylinder(door,1.35,.17,[0,0,.01],steel,64);plate.rotation.x=Math.PI/2
  ring(door,1.26,.028,[0,0,.122]);ring(door,1.06,.028,[0,0,.132],bronze)
  for(let i=0;i<16;i++){const a=i*tau/16;mesh(new T.SphereGeometry(.054,10,8),gilt,door,[Math.cos(a)*1.19,Math.sin(a)*1.19,.165])}
  const handle=new T.Group();handle.position.z=.185;door.add(handle);ring(handle,.335,.034,[0,0,0],gilt)
  for(let i=0;i<5;i++){const a=i*tau/5;limb(handle,v(),v(Math.cos(a)*.309,Math.sin(a)*.309,0),.016,gilt)}
  mesh(new T.SphereGeometry(.072,16,10),bronze,handle,[0,0,.035],false)
  box(vault,[1.75,.33,.10],[0,4.06,.36],blue,.026)
  sign(vault,'RESERVE',1.53,.30,[0,4.06,.42])
  batchStatic(door);batchStatic(vault)
  return {hinge,handle}
}

export class BankStage {
  private renderer:T.WebGLRenderer
  private gl:WebGL2RenderingContext
  private fence:WebGLSync|null=null
  private scene=new T.Scene()
  private camera=new T.PerspectiveCamera(60,1,.08,40)
  private look=v(0,1.9,-2.6)
  private eye=v(0,1.82,6.8)
  private yaw=0
  private pitch=.04
  private keys=new Set<string>()
  private touching=new Map<number,string>()
  private drag?:{id:number;x:number;y:number}
  private go?:BankDesk
  private observer:ResizeObserver
  private frame=0
  private raf=0
  private input=new AbortController()
  private tellers:ClubGuest[]
  private vault:ReturnType<typeof buildBankVault>
  private coins:T.InstancedMesh
  private goldEvent=0
  private outgoing=false
  private targetDesk=0
  private reduced=matchMedia('(prefers-reduced-motion:reduce)').matches
  constructor(private canvas:HTMLCanvasElement,private hall:HTMLElement){
    this.renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'})
    this.gl=this.renderer.getContext() as WebGL2RenderingContext
    this.renderer.setPixelRatio(Math.min(1.5,devicePixelRatio));this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.24
    this.scene.background=new T.Color(0x243b46);this.scene.fog=new T.FogExp2(0x243b46,.026)
    this.scene.add(new T.HemisphereLight(0xd5e6ed,0x6f5d4a,2))
    const sun=new T.DirectionalLight(0xffe3b9,1.6);sun.position.set(-3,7,2);this.scene.add(sun)
    buildBankArchitecture(this.scene);this.vault=buildBankVault(this.scene)
    this.tellers=[
      new ClubGuest(this.scene,-2.9,-2.72,0xb38469,0x284557,true,1),
      new ClubGuest(this.scene,2.9,-2.71,0xd5ad86,0x313c59,true,2),
      new ClubGuest(this.scene,8.5,-4.46,0x946344,0x213344,true,0),
    ]
    this.coins=new T.InstancedMesh(new T.CylinderGeometry(.066,.066,.017,16),gilt,18)
    this.coins.visible=false
    this.coins.frustumCulled=false
    this.scene.add(this.coins)
    this.camera.position.copy(this.eye)
    this.bind()
    this.observer=new ResizeObserver(()=>this.fit());this.observer.observe(canvas);this.fit()
    this.raf=requestAnimationFrame(this.tick)
  }
  visit(desk?:BankDesk){this.go=desk;this.drag=undefined;this.keys.clear();this.touching.clear()}
  transaction(kind:'borrow'|'repay'){this.goldEvent=performance.now();this.outgoing=kind==='borrow';this.targetDesk=kind==='borrow'?0:1}
  private fit(){
    const w=Math.max(1,this.canvas.clientWidth),h=Math.max(1,this.canvas.clientHeight)
    this.camera.aspect=w/h;this.camera.fov=w<h?70:57;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h,false)
  }
  private bind(){
    const {signal}=this.input,accepted=['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright']
    window.addEventListener('keydown',event=>{
      if(this.go||event.ctrlKey||event.metaKey||event.altKey||!accepted.includes(event.key.toLowerCase())||
        document.activeElement?.matches('input,button,select,[contenteditable]'))return
      this.keys.add(event.key.toLowerCase());event.preventDefault()
    },{signal})
    window.addEventListener('keyup',e=>this.keys.delete(e.key.toLowerCase()),{signal})
    window.addEventListener('blur',()=>{this.keys.clear();this.touching.clear();this.drag=undefined},{signal})
    this.hall.querySelectorAll<HTMLButtonElement>('[data-bank-walk]').forEach(button=>{
      button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);this.touching.set(e.pointerId,button.dataset.bankWalk!)},{signal})
      button.addEventListener('lostpointercapture',e=>this.touching.delete(e.pointerId),{signal})
    })
    this.canvas.addEventListener('pointerdown',e=>{
      if(this.go)return
      this.canvas.focus({preventScroll:true});this.canvas.setPointerCapture(e.pointerId);this.drag={id:e.pointerId,x:e.clientX,y:e.clientY}
    },{signal})
    this.canvas.addEventListener('pointermove',e=>{
      const drag=this.drag
      if(!drag||drag.id!==e.pointerId)return
      this.yaw-=(e.clientX-drag.x)*.005;this.pitch=T.MathUtils.clamp(this.pitch+(e.clientY-drag.y)*.003,-.43,.51)
      drag.x=e.clientX;drag.y=e.clientY
    },{signal})
    this.canvas.addEventListener('lostpointercapture',()=>this.drag=undefined,{signal})
    window.addEventListener('pagehide',e=>{if(!e.persisted)this.dispose()},{signal})
  }
  private movement(dt:number){
    const active=new Set([...this.keys,...this.touching.values()])
    const x=Number(active.has('d')||active.has('arrowright'))-Number(active.has('a')||active.has('arrowleft'))
    const z=Number(active.has('s')||active.has('arrowdown'))-Number(active.has('w')||active.has('arrowup'))
    if(!x&&!z)return false
    const speed=3.25*dt/Math.hypot(x,z)
    this.eye.x=T.MathUtils.clamp(this.eye.x+(x*Math.cos(this.yaw)+z*Math.sin(this.yaw))*speed,-8.9,8.9)
    this.eye.z=T.MathUtils.clamp(this.eye.z+(z*Math.cos(this.yaw)-x*Math.sin(this.yaw))*speed,-.36,7.6)
    return true
  }
  private tick=(now:number)=>{
    this.raf=requestAnimationFrame(this.tick)
    if(document.hidden||now-this.frame<28||this.gl.isContextLost())return
    if(this.fence){
      if(this.gl.clientWaitSync(this.fence,0,0)===this.gl.TIMEOUT_EXPIRED)return
      this.gl.deleteSync(this.fence);this.fence=null
    }
    const dt=Math.min(.16,(now-this.frame)/1000||.03);this.frame=now
    const desk=this.go?bankDesks[this.go]:undefined,walking=!desk&&this.movement(dt)
    const wanted=desk?.camera??v(this.eye.x,this.eye.y+(!this.reduced&&walking?Math.sin(now*.012)*.036:0),this.eye.z)
    const toward=desk?.target??v(this.eye.x-Math.sin(this.yaw)*4,this.eye.y+this.pitch*4-.25,this.eye.z-Math.cos(this.yaw)*4)
    const easing=this.reduced?1:1-Math.exp(-dt*6.5)
    this.camera.position.lerp(wanted,easing);this.look.lerp(toward,easing);this.camera.lookAt(this.look);this.camera.updateMatrixWorld()
    const phase=this.goldEvent?Math.min(1,(now-this.goldEvent)/2340):1
    const signal=this.reduced?0:Math.sin(phase*Math.PI)
    this.vault.hinge.rotation.y=-.33*(this.go==='vault'?1:signal)
    this.vault.handle.rotation.z=signal*2.2
    this.tellers.forEach((actor,i)=>{
      const pass=i===this.targetDesk?signal:0
      if(i===2)actor.pose(now,0,v(-.28,.85,.09),v(.28,.85,.09))
      else actor.pose(now,pass*.9,v(-.27,1.03,.31+pass*.21),v(.26,1.03,.31+pass*.71),.18+pass*.4)
    })
    this.coins.visible=signal>.04
    if(this.coins.visible){
      const proxy=new T.Object3D(),origin=this.targetDesk===0?-2.9:2.9
      for(let i=0;i<this.coins.count;i++){
        const p=T.MathUtils.clamp((phase-i*.016)/.72,0,1),t=this.outgoing?p:1-p,angle=i*2.399
        proxy.position.set(origin+Math.cos(angle)*.13*(1+t),1.18+Math.sin(p*Math.PI)*(.44+i%5*.063),-2.34+t*3.0+Math.sin(angle)*.19)
        proxy.rotation.set(phase*8+i,.23*i,angle)
        proxy.scale.setScalar(Math.min(1,Math.sin(p*Math.PI)*5+.02))
        proxy.updateMatrix();this.coins.setMatrixAt(i,proxy.matrix)
      }
      this.coins.instanceMatrix.needsUpdate=true
    }
    this.hall.querySelectorAll<HTMLButtonElement>('[data-desk-point]').forEach(button=>{
      const point=bankDesks[button.dataset.deskPoint as BankDesk].point.clone().project(this.camera)
      button.hidden=Boolean(desk)||point.z>=1||point.z<=-1||Math.abs(point.x)>.86||Math.abs(point.y)>.76
      if(!button.hidden){button.style.left=(50+point.x*50)+'%';button.style.top=(50-point.y*50)+'%'}
    })
    this.canvas.dataset.camera=this.go??'lobby'
    this.renderer.render(this.scene,this.camera);this.fence=this.gl.fenceSync(this.gl.SYNC_GPU_COMMANDS_COMPLETE,0);this.gl.flush()
  }
  private dispose(){
    this.input.abort();this.observer.disconnect();cancelAnimationFrame(this.raf)
    if(this.fence)this.gl.deleteSync(this.fence)
    this.scene.traverse(object=>{
      if(object instanceof T.Mesh){
        object.geometry.dispose()
        for(const material of Array.isArray(object.material)?object.material:[object.material]){
          material.map?.dispose();material.dispose()
        }
      }
    })
    this.renderer.dispose()
  }
}
