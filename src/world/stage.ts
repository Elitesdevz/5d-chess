import * as T from 'three'
import {makeWorldArt,spinWheel} from './art.ts'
import {Figure} from '../casino/hall-stage.ts'
import {resultRotation,v} from '../casino/scene/geometry.ts'
import {WHEEL_X,WHEEL_Z} from '../casino/hall-decor.ts'
import {CITY,CITY_PORTALS,DICE_TABLE_INDEX,interactions,near,worldMove,WORLD_SPEED,WORLD_TABLES,type WorldAction,type WorldView,type WorldZone} from './model.ts'
import type {HallPlayer,Position} from '../roulette-hall-model.ts'

const TAU=Math.PI*2
const routes=[
  [[-16,6],[-17,-4],[-11,-5],[-10,8],[-16,6]],
  [[13,10],[23,10],[24,6.9],[35,8],[24,14],[13,10]],
  [[-35,8],[-26,7],[-19,9],[-14,15],[-24,15],[-35,8]],
  [[-6,18],[-4,11],[-4,-4],[-8,-5],[-8,17],[-6,18]],
  [[5,16],[9,7],[8,-4],[13,-5],[12,12],[5,16]],
  [[31,20],[33,13],[39,13],[45,20],[42,26],[31,20]],
  [[-41,22],[-31,23],[-26,25],[-22,33],[-36,27],[-41,22]],
] as const
const streets=routes.map(route=>{
  let length=0
  const segments=route.slice(1).map((end,i)=>{
    const start=route[i],from=length
    length+=Math.hypot(end[0]-start[0],end[1]-start[1])
    return {start,end,from,to:length}
  })
  return {segments,length}
})
function pedestrian(index:number,time:number){
  const {segments,length}=streets[index],distance=(time*(1.3+index*.05)/1000+index*9)%length
  const {start:a,end:b,from,to}=segments.find(segment=>distance<segment.to)??segments[0],p=(distance-from)/(to-from)
  return {x:a[0]+(b[0]-a[0])*p,z:a[1]+(b[1]-a[1])*p,yaw:Math.atan2(a[0]-b[0],a[1]-b[1])}
}
const EMPTY=()=>v()
function shadow(){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=64
  const ctx=canvas.getContext('2d')!,gradient=ctx.createRadialGradient(32,32,0,32,32,32)
  gradient.addColorStop(0,'#0009');gradient.addColorStop(1,'#0000')
  ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64)
  return new T.CanvasTexture(canvas)
}
type Avatar={figure:Figure;tag?:HTMLElement}
export class CityStage {
  private renderer?:T.WebGLRenderer
  private gl?:WebGL2RenderingContext
  private fence:WebGLSync|null=null
  private art?:ReturnType<typeof makeWorldArt>
  private view?:WorldView
  private camera=new T.PerspectiveCamera(58,1,.09,140)
  private look=v(0,1.4,3)
  private shadow?:T.CanvasTexture
  private figures=new Map<string,Avatar>()
  private npc:Figure[]=[]
  private arrows=new Set<string>()
  private stick={x:0,z:0}
  private drag?:{id:number;x:number;y:number}
  private last=0
  private lastStep=0
  private frame=0
  private yaw=0
  private pitch=.1
  private clock=0
  private zone?:WorldZone
  private caveOpen=true
  private pause=false
  private nearest?:WorldAction
  private input=new AbortController()
  private reduced=matchMedia('(prefers-reduced-motion:reduce)').matches
  private resize:ResizeObserver
  private canvas:HTMLCanvasElement
  private parent:HTMLElement
  private onAction:(point?:WorldAction)=>void
  position:Position={...CITY}
  get moving(){return (this.arrows.size>0||Math.hypot(this.stick.x,this.stick.z)>.09)&&!this.pause}
  constructor(canvas:HTMLCanvasElement,parent:HTMLElement,onAction:(point?:WorldAction)=>void){
    this.canvas=canvas;this.parent=parent;this.onAction=onAction
    try{
      const renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'})
      this.renderer=renderer
      this.gl=renderer.getContext() as WebGL2RenderingContext
      renderer.setPixelRatio(Math.min(devicePixelRatio,1.4));renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.22
      this.shadow=shadow()
    }catch{
      const flat=canvas.cloneNode() as HTMLCanvasElement;canvas.replaceWith(flat);this.canvas=flat
      parent.dataset.flat='true'
    }
    this.resize=new ResizeObserver(()=>this.fit());this.resize.observe(this.canvas)
    this.bind();this.fit();this.frame=requestAnimationFrame(this.tick)
  }
  lock(value:boolean){
    this.pause=value
    if(value){this.arrows.clear();this.stick={x:0,z:0};this.drag=undefined}
  }
  set(view:WorldView,offset:number){
    const prior=this.view?.you,next=view.you
    const changed=view.id!==this.view?.id||next.zone!==prior?.zone
    const seat=(p:WorldView['you']|undefined)=>p?.chair?'chair:'+p.chair.table+':'+p.chair.index:p?.lounge?'couch:'+p.lounge.couch+':'+p.lounge.index:''
    if(changed||seat(prior)!==seat(next)||Math.hypot(next.x-this.position.x,next.z-this.position.z)>1.35){
      this.position={x:next.x,z:next.z,yaw:next.yaw};this.yaw=next.yaw;this.pitch=.1
    }
    this.clock=offset;this.view=view
    if(changed||this.caveOpen!==view.caveOpen&&view.you.zone==='city'){
      this.caveOpen=view.caveOpen;this.zone=view.you.zone
      this.rebuild()
    }
  }
  quote(points:{price:number}[],value?:number){this.art?.screen?.forEach(update=>update(points,value))}
  act(){this.onAction(this.nearest)}
  private rebuild(){
    this.clearScene()
    if(!this.zone||!this.renderer||this.zone==='private')return
    this.art=makeWorldArt(this.zone,this.caveOpen)
    if(this.zone==='city'){
      this.npc=routes.map((_,i)=>{
        const target=pedestrian(i,Date.now()+this.clock)
        return new Figure(this.art!.scene,{...target,name:['Iris','Marlowe','June','Dion','Rafi','Hana','Vera'][i],avatar:'default',online:true},this.shadow!)
      })
    }
    const {x,z,yaw}=this.position
    this.camera.position.copy(this.walkingEye(x,z,yaw))
    this.look.set(x-Math.sin(yaw)*2,1.5,z-Math.cos(yaw)*2)
  }
  private clearScene(){
    for(const entry of this.figures.values()){entry.figure.dispose();entry.tag?.remove()}
    this.figures.clear()
    if(this.art){
      this.art.scene.traverse(obj=>{
        if(obj instanceof T.Mesh){
          obj.geometry.dispose()
          for(const material of Array.isArray(obj.material)?obj.material:[obj.material]){
            if(material.map!==this.shadow)material.map?.dispose()
            material.dispose()
          }
        }
      })
    }
    this.npc=[];this.art=undefined
  }
  private fit(){
    const w=Math.max(1,this.canvas.clientWidth),h=Math.max(1,this.canvas.clientHeight)
    this.camera.aspect=w/h;this.camera.fov=w<h?67:56;this.camera.updateProjectionMatrix()
    if(this.renderer)this.renderer.setSize(w,h,false)
    else {this.canvas.width=w;this.canvas.height=h}
  }
  private bind(){
    const {signal}=this.input,allowed=['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright']
    window.addEventListener('keydown',e=>{
      if(this.pause||e.ctrlKey||e.altKey||e.metaKey||document.activeElement?.matches('input,select,textarea,[contenteditable]'))return
      const k=e.key.toLowerCase()
      if(k==='e'&&!e.repeat){e.preventDefault();this.act();return}
      if(allowed.includes(k)){this.arrows.add(k);e.preventDefault()}
    },{signal})
    window.addEventListener('keyup',e=>this.arrows.delete(e.key.toLowerCase()),{signal})
    window.addEventListener('blur',()=>{this.arrows.clear();this.drag=undefined;this.stick={x:0,z:0}},{signal})
    this.canvas.addEventListener('pointerdown',e=>{
      if(this.pause||e.button!==0)return
      this.canvas.focus({preventScroll:true});this.canvas.setPointerCapture(e.pointerId);this.drag={id:e.pointerId,x:e.clientX,y:e.clientY}
    },{signal})
    this.canvas.addEventListener('pointermove',e=>{
      const d=this.drag
      if(!d||d.id!==e.pointerId)return
      this.yaw-=(e.clientX-d.x)*.005
      this.pitch=T.MathUtils.clamp(this.pitch+(e.clientY-d.y)*.004,-.44,.49)
      d.x=e.clientX;d.y=e.clientY
    },{signal})
    this.canvas.addEventListener('lostpointercapture',()=>this.drag=undefined,{signal})
    const stick=this.parent.querySelector<HTMLElement>('[data-joystick]')!,thumb=stick.querySelector<HTMLElement>('i')!
    let pointer:number|undefined
    const move=(event:PointerEvent)=>{
      const area=stick.getBoundingClientRect(),r=area.width*.32
      const x=(event.clientX-area.x-area.width/2)/r,z=(event.clientY-area.y-area.height/2)/r
      const scale=Math.max(1,Math.hypot(x,z))
      this.stick={x:x/scale,z:z/scale};thumb.style.transform=`translate(${this.stick.x*r}px,${this.stick.z*r}px)`
    }
    stick.addEventListener('pointerdown',e=>{if(this.pause||pointer!==undefined)return;e.preventDefault();pointer=e.pointerId;stick.setPointerCapture(pointer);move(e)},{signal})
    stick.addEventListener('pointermove',e=>{if(e.pointerId===pointer)move(e)},{signal})
    stick.addEventListener('lostpointercapture',()=>{pointer=undefined;this.stick={x:0,z:0};thumb.style.transform=''},{signal})
    window.addEventListener('pagehide',e=>{if(!e.persisted){this.input.abort();this.resize.disconnect();cancelAnimationFrame(this.frame);this.clearScene();this.renderer?.dispose()}},{signal})
  }
  private step(dt:number){
    if(!this.zone||this.pause||this.view?.you.chair||this.view?.you.lounge)return
    const keys=this.arrows
    const x=this.stick.x+Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft'))
    const z=this.stick.z+Number(keys.has('s')||keys.has('arrowdown'))-Number(keys.has('w')||keys.has('arrowup'))
    const length=Math.max(1,Math.hypot(x,z)),speed=WORLD_SPEED*dt/length
    if(x||z){
      const dx=x*Math.cos(this.yaw)+z*Math.sin(this.yaw),dz=z*Math.cos(this.yaw)-x*Math.sin(this.yaw)
      this.position=worldMove(this.zone,this.position,this.position.x+dx*speed,this.position.z+dz*speed,WORLD_SPEED*dt,this.caveOpen)
      this.position.yaw=Math.atan2(-dx,-dz)
    }else this.position.yaw=this.yaw
  }
  private prompt(){
    const candidate=this.zone&&!this.view?.you.chair&&!this.view?.you.lounge?interactions(this.zone).map(p=>({...p,distance:Math.hypot(this.position.x-p.x,this.position.z-p.z)}))
      .filter(p=>p.distance<=(p.range??1.65)).sort((a,b)=>a.distance-b.distance)[0]:undefined
    const was=this.nearest?.id
    this.nearest=candidate
    if(was===candidate?.id)return
    const prompt=this.parent.querySelector<HTMLButtonElement>('[data-world-use]')!
    prompt.hidden=!candidate
    prompt.querySelector('span')!.textContent=candidate?.label??''
  }
  private avatars(dt:number,now:number){
    if(!this.view||!this.art)return
    const roster=[this.view.you,...this.view.players]
    const active=new Set(roster.map(p=>p.name))
    for(const member of roster){
      const local=this.view.you.name===member.name
      let current=this.figures.get(member.name)
      if(!current){
        let tag:HTMLElement|undefined
        if(!local){tag=document.createElement('span');tag.className='world-name';tag.textContent=member.name;this.parent.querySelector('.world-names')!.append(tag)}
        current={figure:new Figure(this.art.scene,member,this.shadow!),tag};this.figures.set(member.name,current)
      }
      const figure=current.figure
      figure.target=member
      figure.root.visible=!(local&&(member.chair||this.zone==='cave'))
      figure.pose(dt,now,local?this.position:undefined)
      if(current.tag){
        const mark=figure.root.position.clone().add(v(0,1.91,0)).project(this.camera)
        current.tag.hidden=mark.z<=-1||mark.z>=1||Math.abs(mark.x)>.98||Math.abs(mark.y)>.96||this.camera.position.distanceTo(figure.root.position)>16
        if(!current.tag.hidden){current.tag.style.left=(50+50*mark.x)+'%';current.tag.style.top=(50-50*mark.y)+'%'}
      }
    }
    for(const [name,entry] of this.figures)if(!active.has(name)){entry.figure.dispose();entry.tag?.remove();this.figures.delete(name)}
    this.npc.forEach((figure,i)=>{if(!this.reduced)figure.target={...figure.target,...pedestrian(i,now)};figure.pose(dt,now)})
  }
  private cameraView(dt:number,now:number){
    const me=this.view?.you,chair=me?.chair,{x,z}=this.position
    const eye=EMPTY(),aim=EMPTY()
    if(chair){
      const table=WORLD_TABLES[chair.table],spin=this.view?.hall?.tables[chair.table]?.spin
      const inSpin=spin&&!this.reduced&&now>spin.started+350&&now<spin.ends+460
      if(inSpin){
        const dice=chair.table===DICE_TABLE_INDEX,wx=table.x+(dice?0:WHEEL_X),wz=table.z+(dice?0:WHEEL_Z)
        eye.set(wx,3.9,wz+.19);aim.set(wx,1.08,wz-.05)
      }else{eye.set(x,1.69,z+.25);aim.set(table.x,1.03,table.z-.06)}
    }else if(me?.lounge){
      eye.set(x+Math.sin(this.yaw)*.99,1.92,z+Math.cos(this.yaw)*.99)
      aim.set(x-Math.sin(this.yaw)*2.1,1.47,z-Math.cos(this.yaw)*2.1)
    }else{
      eye.copy(this.walkingEye(x,z,this.yaw))
      aim.set(x-Math.sin(this.yaw)*2.5,1.39+this.pitch*3,z-Math.cos(this.yaw)*2.5)
    }
    const factor=this.reduced?1:1-Math.exp(-6*dt)
    this.camera.position.lerp(eye,factor);this.look.lerp(aim,factor)
    this.camera.lookAt(this.look);this.camera.updateMatrixWorld()
  }
  private walkingEye(x:number,z:number,yaw:number){
    const cave=this.zone==='cave'||this.zone==='oasis',distance=cave?.18:this.camera.aspect<1?1.65:2.8
    let ex=x+Math.sin(yaw)*distance,ez=z+Math.cos(yaw)*distance
    if(this.zone!=='city'){
      const edge=this.zone==='hotel'?9.28:this.zone==='casino'?10.45:this.zone==='bank'?9.05:cave?2.3:7.8
      ex=T.MathUtils.clamp(ex,-edge,edge)
      ez=T.MathUtils.clamp(ez,cave?-7.5:-5.94,this.zone?.startsWith('floor:')||this.zone==='exchange'?7.11:7.43)
    }
    return v(ex,cave?1.65:2.49,ez)
  }
  private motion(now:number){
    if(!this.art)return
    if(!this.reduced)this.art.ambient?.(now)
    const hall=this.view?.hall
    for(const [i,actor] of this.art.actors.entries()){
      const spin=hall?.tables[i]?.spin
      actor.pose(now,spin&&now<spin.started+800?.25:0)
    }
    this.art.wheels?.forEach((wheel,i)=>{
      const table=hall?.tables[i],spin=table?.spin,n=spin?.pocket??table?.recent[0]
      if(n===undefined)return
      const progress=spin&&!this.reduced?T.MathUtils.clamp((now-spin.started)/(spin.ends-spin.started),0,1):1
      spinWheel(wheel,n,progress)
    })
    const table=hall?.tables[DICE_TABLE_INDEX],die=this.art.publicDie,roll=table?.spin
    if(die){
      const n=roll?.pocket??table?.recent[0]??1
      const p=roll&&!this.reduced?T.MathUtils.clamp((now-roll.started)/(roll.ends-roll.started),0,1):1
      if(p<.86){
        die.rotation.set(p*TAU*5,p*TAU*4,p*TAU*2)
        die.position.set(Math.sin(p*9)*.48,1.165+Math.abs(Math.sin(p*17.5))*(1-p)*.63,.08+Math.sin(p*4)*.24)
      }else{die.quaternion.copy(resultRotation(n));die.position.set(0,1.165,.08)}
    }
  }
  private tick=(time:number)=>{
    this.frame=requestAnimationFrame(this.tick)
    if(document.hidden){this.lastStep=0;return}
    const stepTime=Math.min(.25,(time-(this.lastStep||time))/1000)
    this.lastStep=time
    this.step(stepTime);this.prompt()
    if(this.gl?.isContextLost()||time-this.last<27)return
    if(this.gl&&this.fence){
      if(this.gl.clientWaitSync(this.fence,0,0)===this.gl.TIMEOUT_EXPIRED)return
      this.gl.deleteSync(this.fence);this.fence=null
    }
    const dt=Math.min(.14,(time-this.last)/1000||.035);this.last=time
    if(this.art&&this.renderer){
      const now=Date.now()+this.clock
      this.cameraView(dt,now);this.avatars(dt,now);this.motion(now)
      this.renderer.render(this.art.scene,this.camera)
      if(this.gl){this.fence=this.gl.fenceSync(this.gl.SYNC_GPU_COMMANDS_COMPLETE,0);this.gl.flush()}
    }else if(!this.renderer)this.drawFlat()
    this.canvas.dataset.zone=this.zone??''
    const darkness=this.parent.querySelector<HTMLElement>('.world-dark')!
    darkness.style.opacity=this.zone==='cave'?String(Math.max(0,(7-this.position.z)/14)**1.55*.94):'0'
  }
  private drawFlat(){
    const c=this.canvas,ctx=c.getContext('2d')
    if(!ctx)return
    const w=c.width,h=c.height,size=this.zone==='city'?Math.min(12,w/38):Math.min(42,w/14),o=this.position
    const project=(x:number,z:number)=>[w/2+(x-o.x)*size,h/2+(z-o.z)*size] as const
    ctx.fillStyle='#14272d';ctx.fillRect(0,0,w,h)
    ctx.strokeStyle='#779d9151';ctx.lineWidth=1
    for(let i=-64;i<65;i+=2){const [x,z]=project(i,i);ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.moveTo(0,z);ctx.lineTo(w,z);ctx.stroke()}
    const landmarks=this.zone==='city'?CITY_PORTALS.filter(p=>p.to!=='cave'||this.caveOpen).map(p=>({x:p.x,z:p.z,label:p.label||'Passage'})):
      [...interactions(this.zone??'city'),...(this.zone==='hotel'?[{x:0,z:-7.2,label:'Gaming floor'}]:[]),{x:0,z:this.zone==='cave'?-7.3:7.55,label:this.zone==='cave'?'Dark passage':'Exit'}]
    for(const p of landmarks){const [x,y]=project(p.x,p.z);ctx.fillStyle='#8fe2b5';ctx.fillRect(x-8,y-8,16,16);ctx.fillStyle='#dfedda';ctx.font='13px system-ui';ctx.textAlign='center';ctx.fillText(p.label,x,y-12)}
    for(const other of this.view?.players??[]){const [x,z]=project(other.x,other.z);ctx.fillStyle='#f1c78b';ctx.beginPath();ctx.arc(x,z,5,0,TAU);ctx.fill()}
    ctx.fillStyle='#b0eada';ctx.beginPath();ctx.arc(w/2,h/2,7,0,TAU);ctx.fill()
  }
}
