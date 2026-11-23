import type {CompanyView} from '../equity-v2.ts'
import {kitchenTools} from './kitchen-tools.ts'
import {restaurantPoints} from './restaurant-model.ts'
import {staffProps} from './restaurant-art.ts'
import {WHEEL_X,WHEEL_Z} from '../casino/hall-decor.ts'
import {terrainHeight} from './terrain.ts'
import * as T from 'three'
import {liftPlatform,makeWorldArt,spinWheel} from './art.ts'
import {Figure} from '../casino/hall-stage.ts'
import {resultRotation,v} from '../casino/scene/geometry.ts'
import {CITY,CITY_PORTALS,DICE_TABLE_INDEX,boardPoints,groundZone,interactions,localSite,riderHeight,site,worldMove,WORLD_SPEED,WORLD_TABLES,type WorldAction,type WorldView,type WorldZone} from './model.ts'
import type {Position} from '../roulette-hall-model.ts'

const TAU=Math.PI*2
const STANDING_EYE=1.637,SEATED_EYE=1.47
const routes=[
  [[-14,7],[-13,-5],[-10.5,-5],[-10.5,6.6],[-14,7]],
  [[15,8.5],[23,7.25],[30,8.2],[35,12.7],[24,13.35],[15,8.5]],
  [[-35,8],[-26,7],[-19,8],[-14,14],[-24,13.4],[-35,8]],
  [[-4,15],[-4.6,9],[-3.85,-4],[-4.9,-4],[-4.9,15],[-4,15]],
  [[5,16],[9,7],[8,-4],[12,-5],[12,12],[5,16]],
  [[29.84,25.1],[29.72,14.04],[43.6,14.04],[43.69,29.62],[29.62,29.62],[29.84,25.1]],
  [[-40,30],[-30,27],[-26,26],[-21,29],[-30,32],[-40,30]],
  [[-13.5,43.5],[-13.5,45],[-22,45],[-27,53],[-25.5,53],[-21,46],[-13.5,46],[-13.5,43.5]],
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
function shadow(){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=64
  const ctx=canvas.getContext('2d')!,gradient=ctx.createRadialGradient(32,32,0,32,32,32)
  gradient.addColorStop(0,'#0009');gradient.addColorStop(1,'#0000')
  ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64)
  return new T.CanvasTexture(canvas)
}
type Avatar={figure:Figure;tag?:HTMLElement;props?:ReturnType<typeof staffProps>}
export class CityStage {
  private renderer?:T.WebGLRenderer
  private gl?:WebGL2RenderingContext
  private fence:WebGLSync|null=null
  private art?:ReturnType<typeof makeWorldArt>
  private view?:WorldView
  private camera=new T.PerspectiveCamera(58,1,.05,720)
  private shadow?:T.CanvasTexture
  private figures=new Map<string,Avatar>()
  private npc:Figure[]=[]
  private restaurantNpc=new Map<string,{figure:Figure;props:ReturnType<typeof staffProps>}>()
  private lifts=new Map<string,T.Group>()
  private liftFacing?:{from:number;delta:number;started:number}
  private arrows=new Set<string>()
  private stick={x:0,z:0}
  private voluntaryUnlock=false
  private wasLocked=false
  private onPause:()=>void
  private cameraSeatKey=''
  private viewBlend=0
  private cameraAim=new T.Vector3()
  private tools?:ReturnType<typeof kitchenTools>
  private station?:{point:string;x:number;y:number;phase:number;sent:boolean;fillAt:number}
  private gesture?:(gesture:string)=>void
  private lockedAt=0
  private drag?:{id:number;x:number;y:number}
  private last=0
  private lastStep=0
  private frame=0
  private yaw=0
  private pitch=0
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
  constructor(canvas:HTMLCanvasElement,parent:HTMLElement,onAction:(point?:WorldAction)=>void,onPause:()=>void=()=>{}){
    this.canvas=canvas;this.parent=parent;this.onAction=onAction;this.onPause=onPause
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
    if(value){this.arrows.clear();this.stick={x:0,z:0};this.drag=undefined;this.releaseMouse()}
  }
  set(view:WorldView,offset:number,reposition=false){
    const prior=this.view?.you,next=view.you
    const changedWorld=view.id!==this.view?.id
    const seat=(p:WorldView['you']|undefined)=>p?.barSeat!==undefined?'bar:'+p.barSeat:p?.boardSeat!==undefined?'board:'+p.boardSeat:p?.dining!==undefined?'dining:'+p.dining:p?.chair?'chair:'+p.chair.table+':'+p.chair.index:p?.lounge?'couch:'+p.lounge.couch+':'+p.lounge.index:''
    const seatChanged=seat(prior)!==seat(next)
    if(changedWorld||reposition||seatChanged||next.lift&&!prior?.lift||Math.hypot(next.x-this.position.x,next.z-this.position.z)>1.35){
      this.position={x:next.x,z:next.z,yaw:next.yaw}
    }
    if(changedWorld||reposition||seatChanged){
      this.liftFacing=undefined
      this.yaw=next.yaw;this.pitch=0
      if(next.chair){
        const {x,z}=WORLD_TABLES[next.chair.table],table=site('casino',x,z)
        this.yaw=Math.atan2(next.x-table.x,next.z-table.z)
        this.pitch=-.24
      }
      if(next.dining!==undefined)this.pitch=-.33
      if(next.chair||next.lounge||next.dining!==undefined||next.barSeat!==undefined||next.boardSeat!==undefined)this.releaseMouse()
    }
    if(next.lift&&!prior?.lift){
      const delta=Math.atan2(Math.sin(Math.PI-this.yaw),Math.cos(Math.PI-this.yaw))
      if(this.reduced){this.yaw=Math.PI;this.pitch=0}
      else this.liftFacing={from:this.yaw,delta,started:performance.now()}
    }
    this.clock=offset;this.view=view;this.zone=next.zone;this.caveOpen=view.caveOpen
    if(!this.art&&this.renderer)this.buildScene()
    if(this.art){
      this.art.seal.visible=!this.caveOpen
      this.art.restaurant.update(view.restaurant)
      const target=next.lift?.to??next.zone
      if(target.startsWith('floor:'))this.art.floor(target.slice(6))
    }
  }
  quote(symbol:string,points:{price:number}[],value?:number){this.art?.floor(symbol)?.screens.forEach(update=>update(points,value))}
  ownership(symbol:string,company:CompanyView){this.art?.floor(symbol)?.ownership?.(company)}
  act(){this.onAction(this.nearest)}
  setStation(point:string|undefined,submit:(gesture:string)=>void){
    this.gesture=submit
    if(point===this.station?.point)return
    this.station=point?{point,x:0,y:0,phase:0,sent:false,fillAt:0}:undefined
    this.arrows.clear()
  }
  private moveTool(dx:number,dy:number){
    const s=this.station,r=this.view?.restaurant,job=r?.kitchen
    if(!s||!job||s.sent)return
    s.x=T.MathUtils.clamp(s.x+dx/110,-1,1);s.y=T.MathUtils.clamp(s.y-dy/110,-1,1)
    const now=Date.now()+this.clock
    if(s.point.endsWith(':soda')){
      if(s.y>.32&&Math.abs(s.x)<.23&&!s.fillAt)s.fillAt=performance.now()+560
      if(s.y<.12||Math.abs(s.x)>.33)s.fillAt=0
    }else if(s.point.endsWith(':fryer')){
      if(s.y<-.25)s.phase=1
      if(s.phase&&s.x>.48&&s.y>-.07)this.completeTool('scoop')
    }else if(now>=job.readyAt){
      if(s.y<-.21&&Math.abs(s.x)<.5)s.phase=1
      if(s.phase&&job.patty==='raw'&&s.y>.39)this.completeTool('flip')
      else if(s.phase&&job.patty==='flipped'&&s.x>.56&&s.y>-.12)this.completeTool('assemble')
    }
  }
  private completeTool(gesture:string){
    const s=this.station
    if(!s||s.sent)return
    s.sent=true;this.gesture?.(gesture)
  }
  resetTool(){if(this.station)Object.assign(this.station,{x:0,y:0,phase:0,sent:false,fillAt:0})}
  resumeMouse(){
    if(this.pause||!this.renderer||this.view?.you.chair||this.view?.you.lounge||this.view?.you.dining!==undefined||this.view?.you.barSeat!==undefined||this.view?.you.boardSeat!==undefined||
      !matchMedia('(any-pointer: fine)').matches||document.pointerLockElement===this.canvas)return
    this.lockedAt=performance.now()
    this.canvas.requestPointerLock?.()?.catch(()=>{})
  }
  private releaseMouse(){
    if(document.pointerLockElement!==this.canvas)return
    this.voluntaryUnlock=true;document.exitPointerLock()
  }
  private turn(dx:number,dy:number){
    if(this.pause||!this.renderer||this.view?.you.chair)return
    if(this.station){this.moveTool(dx,dy);return}
    this.liftFacing=undefined
    this.yaw-=dx*.0032
    this.pitch=T.MathUtils.clamp(this.pitch-dy*.0032,-1.34,1.34)
  }
  private buildScene(){
    this.art=makeWorldArt(this.caveOpen)
    this.tools=kitchenTools(this.art.scene)
    this.npc=routes.map((_,i)=>{
      const target=pedestrian(i,Date.now()+this.clock)
      return new Figure(this.art!.scene,{...target,name:['Iris','Marlowe','June','Dion','Rafi','Hana','Vera','Otis'][i],avatar:'default',online:true},this.shadow!)
    })
  }
  private clearScene(){
    for(const entry of this.figures.values()){entry.figure.dispose();entry.tag?.remove()}
    this.figures.clear()
    for(const entry of this.restaurantNpc.values())entry.figure.dispose()
    this.restaurantNpc.clear()
    if(this.art){
      if(this.art.scene.background instanceof T.Texture)this.art.scene.background.dispose()
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
    this.npc=[];this.lifts.clear();this.art=undefined
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
      if(this.station&&k.startsWith('arrow')){
        e.preventDefault();this.moveTool(k==='arrowleft'?-24:k==='arrowright'?24:0,k==='arrowup'?-24:k==='arrowdown'?24:0);return
      }
      if(k==='e'&&!e.repeat){e.preventDefault();this.act();return}
      if(allowed.includes(k)){this.arrows.add(k);e.preventDefault()}
    },{signal})
    window.addEventListener('keyup',e=>this.arrows.delete(e.key.toLowerCase()),{signal})
    window.addEventListener('blur',()=>{this.arrows.clear();this.drag=undefined;this.stick={x:0,z:0}},{signal})
    document.addEventListener('pointerlockchange',()=>{
      const locked=document.pointerLockElement===this.canvas
      if(!locked&&this.wasLocked&&!this.voluntaryUnlock)this.onPause()
      this.wasLocked=locked;this.voluntaryUnlock=false
      if(locked&&(this.pause||this.view?.you.chair||this.view?.you.lounge))this.releaseMouse()
    },{signal})
    document.addEventListener('mousemove',e=>{
      if(document.pointerLockElement!==this.canvas)return
      if(performance.now()-this.lockedAt<250&&Math.hypot(e.movementX,e.movementY)>180)return
      this.turn(e.movementX,e.movementY)
    },{signal})
    this.canvas.addEventListener('pointerdown',e=>{
      if(this.pause||!this.renderer||e.button!==0)return
      this.canvas.focus({preventScroll:true})
      if(e.pointerType==='mouse'){this.resumeMouse();if(!this.station)return}
      if(this.drag)return
      this.canvas.setPointerCapture(e.pointerId);this.drag={id:e.pointerId,x:e.clientX,y:e.clientY}
    },{signal})
    this.canvas.addEventListener('pointermove',e=>{
      if(this.pause||document.pointerLockElement===this.canvas)return
      if(e.pointerType==='mouse'&&!this.station)return
      const d=this.drag
      if(!d||d.id!==e.pointerId)return
      this.turn(e.clientX-d.x,e.clientY-d.y)
      d.x=e.clientX;d.y=e.clientY
    },{signal})
    this.canvas.addEventListener('lostpointercapture',e=>{if(this.drag?.id===e.pointerId)this.drag=undefined},{signal})
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
    if(!this.zone||this.pause||this.station||this.view?.you.chair||this.view?.you.lounge||this.view?.you.dining!==undefined||this.view?.you.barSeat!==undefined||this.view?.you.boardSeat!==undefined||this.view?.you.lift)return
    const keys=this.arrows
    const x=this.stick.x+Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft'))
    const z=this.stick.z+Number(keys.has('s')||keys.has('arrowdown'))-Number(keys.has('w')||keys.has('arrowup'))
    const length=Math.max(1,Math.hypot(x,z)),speed=WORLD_SPEED*dt/length
    if(x||z){
      const dx=x*Math.cos(this.yaw)+z*Math.sin(this.yaw),dz=z*Math.cos(this.yaw)-x*Math.sin(this.yaw)
      const inCave=groundZone(this.position.x,this.position.z)==='cave'
      this.position=worldMove(this.zone,this.position,this.position.x+dx*speed,this.position.z+dz*speed,WORLD_SPEED*dt,this.caveOpen||inCave)
    }
    this.position.yaw=this.yaw
  }
  private prompt(){
    const zone=this.zone?.startsWith('floor:')?this.zone:groundZone(this.position.x,this.position.z)
    const points=zone==='kfc'?restaurantPoints(this.view?.restaurant,this.view?.you.dining).map(p=>({...p,...site(zone,p.x,p.z)})):[...interactions(zone),...boardPoints(zone,this.view?.boardTaken)]
    const seated=this.view?.you.boardSeat!==undefined||this.view?.you.barSeat!==undefined
    const stand=seated?{id:'stand-scenery',label:'Stand up',x:this.position.x,z:this.position.z}:undefined
    const candidate=stand??(this.zone&&!this.view?.you.chair&&!this.view?.you.lounge&&!this.view?.you.lift?points.map(p=>({...p,distance:Math.hypot(this.position.x-p.x,this.position.z-p.z)}))
      .filter(p=>p.distance<=(p.range??1.65)).sort((a,b)=>a.distance-b.distance)[0]:undefined)
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
    const neededLifts=new Set<string>()
    for(const member of roster){
      const local=this.view.you.name===member.name
      const height=riderHeight(member,now)
      let current=this.figures.get(member.name)
      if(!current){
        let tag:HTMLElement|undefined
        if(!local){tag=document.createElement('span');tag.className='world-name';tag.textContent=member.name;this.parent.querySelector('.world-names')!.append(tag)}
        current={figure:new Figure(this.art.scene,member,this.shadow!),tag};this.figures.set(member.name,current)
        if(local)current.figure.hideHead()
      }
      const figure=current.figure
      figure.target=member.dining===undefined&&member.barSeat===undefined&&member.boardSeat===undefined?member:{...member,lounge:{couch:0,index:0}}
      figure.root.position.y=local&&member.zone==='city'?terrainHeight(this.position.x,this.position.z):height
      const cleaning=(member.workingUntil??0)>now&&(member.workKind==='mop'||member.workKind==='wipe')
      if((member.carrying||cleaning||member.kfcRole)&&!current.props)current.props=staffProps(figure.root)
      if(current.props){
        current.props.hold(member.carrying?'tray':member.kitchenHand,member.carriedItems)
        current.props.apron.visible=!!member.kfcRole&&member.dining===undefined
        current.props.cloth.visible=cleaning&&member.workKind==='wipe'
        current.props.mop.visible=cleaning&&member.workKind==='mop'
        current.props.mop.rotation.z=.19+Math.sin(now*.008)*.13
      }
      figure.pose(dt,now,local?this.position:undefined,!!member.carrying||!!member.kitchenHand||(member.workingUntil??0)>now,(member.eatingUntil??0)>now)
      const interior=member.zone==='exchange'||member.zone.startsWith('floor:')
      if(interior&&member.zone.startsWith('floor:'))this.art.floor(member.zone.slice(6))
      if(interior){
        const key=member.lift?member.name:member.zone
        neededLifts.add(key)
        let cabin=this.lifts.get(key)
        if(!cabin){cabin=liftPlatform(this.art.scene);this.lifts.set(key,cabin)}
        cabin.visible=true;cabin.position.y=height
      }
      if(current.tag){
        const mark=figure.root.position.clone().add(v(0,1.91,0)).project(this.camera)
        current.tag.hidden=member.zone!==this.view.you.zone||mark.z<=-1||mark.z>=1||Math.abs(mark.x)>.98||Math.abs(mark.y)>.96||this.camera.position.distanceTo(figure.root.position)>16
        const latest=this.view.chat?.findLast(line=>line.name===member.name&&now-line.at<6500)
        const label=latest?.text??member.name
        if(current.tag.textContent!==label)current.tag.textContent=label
        current.tag.classList.toggle('speech',!!latest)
        if(!current.tag.hidden){current.tag.style.left=(50+50*mark.x)+'%';current.tag.style.top=(50-50*mark.y)+'%'}
      }
    }
    for(const [key,cabin] of this.lifts)if(!neededLifts.has(key))cabin.visible=false
    for(const [name,entry] of this.figures)if(!active.has(name)){entry.figure.dispose();entry.tag?.remove();this.figures.delete(name)}
    this.restaurantCast(dt,now)
    this.npc.forEach((figure,i)=>{if(!this.reduced)figure.target={...figure.target,...pedestrian(i,now)};figure.pose(dt,now)})
  }
  private restaurantCast(dt:number,now:number){
    if(!this.art)return
    const actors=this.view?.restaurant?.actors??[],active=new Set(actors.map(a=>a.id))
    for(const actor of actors){
      const seated=actor.pose==='eat'||actor.pose==='sit'
      const character={...site('kfc',actor.x,actor.z),name:actor.name,online:true,avatar:'default',yaw:actor.yaw,
        lounge:seated?{couch:0,index:0}:undefined}
      let entry=this.restaurantNpc.get(actor.id)
      if(!entry){
        const figure=new Figure(this.art.scene,character,this.shadow!,actor.role??false)
        entry={figure,props:staffProps(figure.root)};this.restaurantNpc.set(actor.id,entry)
      }
      const {figure,props}=entry
      figure.target=character
      props.hold(actor.pose==='tray'?'tray':undefined,actor.items)
      props.mop.visible=actor.pose==='mop'
      props.cloth.visible=actor.pose==='wipe'
      props.cloth.position.x=.24+Math.sin(now*.007)*.10
      props.mop.rotation.z=.19+Math.sin(now*.005)*.14
      figure.pose(dt,now,undefined,actor.pose==='work'||actor.pose==='tray'||actor.pose==='mop'||actor.pose==='wipe',actor.pose==='eat')
    }
    for(const [id,entry] of this.restaurantNpc)if(!active.has(id)){entry.figure.dispose();this.restaurantNpc.delete(id)}
  }
  private cameraView(now:number,dt:number){
    const me=this.view?.you,{x,z}=this.position
    if(this.liftFacing){
      const {started,from,delta}=this.liftFacing,progress=Math.min(1,(performance.now()-started)/420)
      this.yaw=from+delta*progress*progress*(3-2*progress)
      if(progress===1)this.liftFacing=undefined
    }
    this.camera.position.set(x,(me?.zone==='city'?terrainHeight(x,z):me?riderHeight(me,now):0)+(me?.chair||me?.lounge||me?.dining!==undefined||me?.barSeat!==undefined||me?.boardSeat!==undefined?SEATED_EYE:STANDING_EYE),z)
    this.camera.rotation.set(this.pitch,this.yaw,0,'YXZ')
    const chair=me?.chair,round=chair&&this.view?.hall?.tables[chair.table]
    if(chair&&round){
      const table=WORLD_TABLES[chair.table],dice=chair.table===DICE_TABLE_INDEX
      const key=chair.table+':'+chair.index
      if(key!==this.cameraSeatKey){this.cameraSeatKey=key;this.viewBlend=0}
      const wheel=site('casino',table.x+(dice?0:WHEEL_X),table.z+(dice?0:WHEEL_Z))
      const overhead=!dice&&!!round.spin&&now<round.spin.ends+2100
      this.viewBlend=this.reduced?Number(overhead):T.MathUtils.damp(this.viewBlend,Number(overhead),4.8,dt)
      const blend=this.viewBlend
      this.cameraAim.set(T.MathUtils.lerp(wheel.x,me.x*.12+wheel.x*.88,1-blend),1.12,wheel.z)
      this.camera.position.lerp(v(wheel.x,4.85,wheel.z+.72),blend)
      this.camera.lookAt(this.cameraAim)
    }else this.cameraSeatKey=''
    const s=this.station,r=this.view?.restaurant
    if(s&&r?.kitchen&&this.tools){
      const {p,fryer,soda}=this.tools.aim(s.point,r)
      const side=fryer||soda
      this.camera.position.set(p.x-(side?1.16:0),1.90,p.z+(side?0:1.09))
      this.camera.lookAt(p.x,1.16,p.z)
      if(!this.pause&&s.fillAt&&performance.now()>=s.fillAt)this.completeTool('fill')
    }
    this.tools?.show(s?.point,r,s?.x??0,s?.y??0,!!s?.fillAt,!!s?.phase)
    this.camera.updateMatrixWorld()
  }
  private motion(now:number,dt:number){
    if(!this.art)return
    if(!this.reduced){this.art.ambient?.(now);this.art.restaurant.tick(now)}
    if(this.zone==='bank'||this.zone==='exchange')this.art.staff.forEach(actor=>actor.pose(now))
    const zones=[this.view?.you.zone,this.view?.you.lift?.to].filter((z):z is WorldZone=>!!z)
    const open=(zone:WorldZone)=>[this.view?.you,...this.view?.players??[]].some(p=>{
      if(!p||p.zone!==zone||p.lift)return false
      const at=localSite(zone,p.x,p.z)
      return Math.abs(at.x)<2.13&&at.z<-2.8
    })
    this.art.lobbyDoors(open('exchange'),dt)
    for(const zone of new Set(zones)){
      if(!zone.startsWith('floor:'))continue
      const floor=this.art.floor(zone.slice(6))
      floor?.actors.forEach(actor=>actor.pose(now))
      floor?.doors(open(zone),dt)
    }
    if(this.zone==='casino')this.art.bar.tick(this.view?.bar,now)
    const tables=this.view?.hall?.tables??this.view?.tableMotion
    for(const [i,actor] of this.art.actors.entries()){
      const spin=tables?.[i]?.spin
      actor.pose(now,spin&&now<spin.started+800?.25:0)
    }
    this.art.wheels?.forEach((wheel,i)=>{
      this.art?.wagerTokens[i](this.view?.hall?.tables[i]?.wagers)
      const table=tables?.[i],spin=table?.spin,n=spin?.pocket??table?.recent[0]
      if(n===undefined)return
      const progress=spin&&!this.reduced?T.MathUtils.clamp((now-spin.started)/(spin.ends-spin.started),0,1):1
      spinWheel(wheel,n,progress)
    })
    const table=tables?.[DICE_TABLE_INDEX],die=this.art.publicDie,roll=table?.spin
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
      this.cameraView(now,dt);this.avatars(dt,now);this.motion(now,dt)
      this.renderer.render(this.art.scene,this.camera)
      if(this.gl){this.fence=this.gl.fenceSync(this.gl.SYNC_GPU_COMMANDS_COMPLETE,0);this.gl.flush()}
    }else if(!this.renderer)this.drawFlat()
    this.canvas.dataset.zone=this.zone??''
    const darkness=this.parent.querySelector<HTMLElement>('.world-dark')!
    const {x,z}=this.position,ground=!this.zone?.startsWith('floor:')&&groundZone(x,z)
    darkness.style.opacity=ground==='cave'?String(Math.max(0,(7.7-localSite('cave',x,z).z)/15)**1.55*.94):'0'
  }
  private drawFlat(){
    const c=this.canvas,ctx=c.getContext('2d')
    if(!ctx)return
    const w=c.width,h=c.height,size=this.zone==='city'?Math.min(12,w/38):Math.min(42,w/14),o=this.position
    const project=(x:number,z:number)=>[w/2+(x-o.x)*size,h/2+(z-o.z)*size] as const
    ctx.fillStyle='#14272d';ctx.fillRect(0,0,w,h)
    ctx.strokeStyle='#779d9151';ctx.lineWidth=1
    for(let i=-64;i<65;i+=2){const [x,z]=project(i,i);ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.moveTo(0,z);ctx.lineTo(w,z);ctx.stroke()}
    const landmarks=this.zone?.startsWith('floor:')?interactions(this.zone):[
      ...CITY_PORTALS.filter(p=>p.to!=='cave'||this.caveOpen).map(p=>({x:p.x,z:p.z,label:p.label||'Passage'})),
      ...['casino','bank','exchange'].flatMap(zone=>interactions(zone as WorldZone)),
      {...site('hotel',0,-7.9),label:'Gaming floor'},
    ]
    for(const p of landmarks){const [x,y]=project(p.x,p.z);ctx.fillStyle='#8fe2b5';ctx.fillRect(x-8,y-8,16,16);ctx.fillStyle='#dfedda';ctx.font='13px system-ui';ctx.textAlign='center';ctx.fillText(p.label,x,y-12)}
    for(const other of this.view?.players??[]){const [x,z]=project(other.x,other.z);ctx.fillStyle='#f1c78b';ctx.beginPath();ctx.arc(x,z,5,0,TAU);ctx.fill()}
    ctx.fillStyle='#b0eada';ctx.beginPath();ctx.arc(w/2,h/2,7,0,TAU);ctx.fill()
  }
}
