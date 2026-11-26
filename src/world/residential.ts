import type {Position} from '../roulette-hall-model.ts'
import {HOMES} from './terrain.ts'
import {flatEdges,houseDesign,houseLevels,RESIDENCES,UNITS} from './housing.ts'

export const STOREY=3.15
export type HomeZone=`home:${string}:${number}`|`stairs:${string}:${number}`
type Point={x:number;z:number}
export type Rect={l:number;r:number;b:number;f:number}
export type Wall=Point&{length:number;axis:'x'|'z';openings:Opening[];outer:boolean}
type Opening={at:number;width:number;kind:'window'|'door'|'lift';id?:string;unit?:string;reverse?:boolean}
export type Fixture=Point&{id:string;kind:'sofa'|'chair'|'bed'|'fridge'|'counter'|'table'|'coffee'|'media'|'wardrobe'|'vanity'|'toilet'|'shower'|'desk'|'mail'|'plant';w:number;d:number;yaw:number;unit?:string;dining?:boolean}
export type Door=Point&{id:string;axis:'x'|'z';width:number;unit?:string;reverse?:boolean}
export type HomePoint=Point&{id:string;label:string;range:number;unit?:string;door?:Door;pose?:HomePose;exit?:Point}
export type HomePose=Position&{id:string;kind:'sit'|'rest';height:number}
type Floor={walls:Wall[];fixtures:Fixture[];doors:Door[];points:HomePoint[];units:{id:string;rect:Rect;exit:Point}[];tiles:{rect:Rect;kind:'bath'|'kitchen'|'balcony'}[]}
type Stair={x:number;front:number;back:number;width:number}
export type Building={id:string;x:number;z:number;facing:number;rect:Rect;levels:Floor[];style:number;block?:number;stairs?:Stair;lift?:Point}

const floor=():Floor=>({walls:[],fixtures:[],doors:[],points:[],units:[],tiles:[]})
const all:Building[]=[]
const bounds=(l:number,r:number,b:number,f:number):Rect=>({l,r,b,f})
export const contains=(r:Rect,x:number,z:number,pad=0)=>x>r.l-pad&&x<r.r+pad&&z>r.b-pad&&z<r.f+pad
const win=(at:number,width=1.65):Opening=>({kind:'window',at,width})
const door=(at:number,id:string,unit?:string,reverse?:boolean):Opening=>({kind:'door',at,width:unit?1.08:1.02,id,unit,reverse})
function wall(f:Floor,axis:Wall['axis'],fixed:number,from:number,to:number,openings:Opening[]=[],outer=false){
  const at=(from+to)/2
  f.walls.push({axis,x:axis==='x'?at:fixed,z:axis==='x'?fixed:at,length:Math.abs(to-from),openings,outer})
  for(const o of openings)if(o.kind==='door'&&o.id){
    const d:Door={id:o.id,axis,x:axis==='x'?o.at:fixed,z:axis==='x'?fixed:o.at,width:o.width,unit:o.unit,reverse:o.reverse}
    f.doors.push(d)
    f.points.push({...d,id:'door:'+d.id,label:'Open door',range:1.29,door:d})
  }
}
const along=(p:Point,dx:number,dz:number,yaw:number)=>({x:p.x+dx*Math.cos(yaw)+dz*Math.sin(yaw),z:p.z+dz*Math.cos(yaw)-dx*Math.sin(yaw)})
function furnish(f:Floor,kind:Fixture['kind'],x:number,z:number,w:number,d:number,yaw=0,unit?:string,dining=false){
  const id=(unit??'lobby')+'-'+f.fixtures.length
  const item={id,kind,x,z,w,d,yaw,unit,dining}
  f.fixtures.push(item)
  if(kind==='chair'||kind==='sofa'||kind==='bed'){
    const count=kind==='sofa'?Math.round(w/.77):1
    for(let i=0;i<count;i++){
      const dx=(i-(count-1)/2)*.67
      const exit=kind==='bed'?along(item,w/2+.40,0,yaw):along(item,dx,(d/2+.38)*(dining?1:-1),yaw)
      const position=kind==='bed'?along(item,0,d*.35,yaw):along(item,dx,0,yaw)
      const pose:HomePose={...position,yaw,id:id+'-'+i,kind:kind==='bed'?'rest':'sit',height:kind==='bed'?.62:.46}
      f.points.push({...exit,id:'furniture:'+pose.id,label:kind==='bed'?'Lie down':'Sit down',range:1.02,pose,exit,unit})
    }
  }
  if(kind==='counter'&&unit)f.points.push({...along(item,0,-d/2-.4,yaw),id:'drawer:'+id,label:'Open storage drawer',range:1.08,unit})
  if(kind==='fridge')f.points.push({...along(item,0,-d/2-.4,yaw),id:'fridge:'+id,label:'Open fridge',range:1.08,unit})
}
function plan(f:Floor,r:Rect,id:string,template:number,upper=false){
  const {l,r:right,b,f:front}=r,w=right-l,row=b+(upper?3:3.18),family=template===2
  const split=l+w*(family?.5:.57)
  const interior=(label:string,at:number,reverse?:boolean)=>door(at,id+'-'+label,undefined,reverse)
  const fixture=(kind:Fixture['kind'],x:number,z:number,w:number,d:number,yaw=0,dining=false)=>furnish(f,kind,x,z,w,d,yaw,id,dining)
  const bedroom=(left:number,edge:number,head:number)=>{
    fixture('bed',left+.84,head+1.16,1.35,2.04)
    if(edge-left>2.7)fixture('wardrobe',edge-.39,head+.55,.68,.93)
  }
  const bathroom=(left:number,edge:number,back:number,end:number)=>{
    f.tiles.push({rect:bounds(left+.07,edge-.07,back+.07,end-.07),kind:'bath'})
    fixture('shower',edge-.53,back+.53,.86,.86)
    fixture('toilet',left+.43,back+.46,.43,.68)
    fixture('vanity',edge-.36,end-.53,.7,.48,Math.PI/2)
  }
  wall(f,'x',row,l,right,[interior('bedroom',split-.74,true),interior(family?'second-bedroom':'bathroom',split+.76)])
  wall(f,'z',split,b,row)
  bedroom(l,split,b)
  if(family)bedroom(split,right,b)
  else bathroom(split,right,b,row)
  if(upper){
    fixture('sofa',l+.96,front-.6,1.55,.78)
    return
  }
  const k=family?right-2.04:l+w*.61
  if(family){
    wall(f,'z',k,row,row+2.25,[interior('bathroom',row+1.12,true)])
    wall(f,'x',row+2.25,k,right)
    bathroom(k,right,row,row+2.25)
  }else if(template===1){
    wall(f,'z',k,row+.06,front,[interior('kitchen',row+1.43,true)])
    fixture('wardrobe',l+.39,row+.57,.59,.91)
  }
  const depth=front-row
  fixture('sofa',l+.51,row+depth*.61,depth>3.65?1.69:1.48,.77,-Math.PI/2)
  if(w>=6.1&&depth>=3.65)fixture('coffee',l+2.06,row+depth*.70,.67,.44,Math.PI/2)
  if(family&&w>7)fixture('media',l+2.32,front-.27,1.25,.39,Math.PI)
  const kitchenFront=family?row+2.25:row
  const run=Math.min(1.72,front-kitchenFront-1.04)
  fixture('counter',right-.34,kitchenFront+run/2+.09,run,.58,Math.PI/2)
  fixture('fridge',right-.4,front-.52,.67,.7,Math.PI/2)
  if(!family&&w>=5.7&&depth>=3.52){
    const tx=template===1?k+.62:right-1.83,tz=front-(template===1?.39:1.6)
    fixture('table',tx,tz,.72,.72)
    fixture('chair',tx,tz-.84,.49,.51,Math.PI,true)
  }else if(family&&w>=7.2){
    fixture('table',l+3.42,front-.72,.85,.7)
    fixture('chair',l+3.42,front-1.56,.51,.5,Math.PI,true)
  }
}
function shell(f:Floor,r:Rect,front:Opening[],rear:Opening[],sideWindows=false){
  wall(f,'x',r.f,r.l,r.r,front,true)
  wall(f,'x',r.b,r.l,r.r,rear,true)
  for(const x of [r.l,r.r])wall(f,'z',x,r.b,r.f,sideWindows?[win((r.b+r.f)/2,1.22)]:[],true)
}
function stairWalls(f:Floor,s:Stair,level:number,last:number){
  const {x,front,back,width}=s
  for(const side of [-1,1])wall(f,'z',x+side*width,back,front)
  wall(f,'x',back,x-width,x+width)
  wall(f,'x',front,x-width,x+width,[
    ...(level<last?[{kind:'lift' as const,at:x-width/2,width:width-.18}]:[]),
    ...(level>0?[{kind:'lift' as const,at:x+width/2,width:width-.18}]:[]),
  ])
}
for(const [block,place] of RESIDENCES.entries()){
  const rect=bounds(-10.4,10.4,-8.5,7.1)
  // The switchback runs towards the street. The hallway is on the north side.
  const stair={x:-8.05,front:1.55,back:6.61,width:1.68}
  const lift={x:8.45,z:3.02},levels=Array.from({length:5},floor)
  const id='block-'+block
  for(const [level,f] of levels.entries()){
    const balcony=level>0&&(level+block)%2===0
    const rear=[-8.3,-5.75,-2.75,.55,3.65].map(n=>win(n,1.55))
    if(balcony){
      rear.push(win(7.01,1.08),door(8.63,id+'-balcony-'+level))
      f.tiles.push({rect:bounds(6.41,10.25,-9.95,-8.5),kind:'balcony'})
    }else rear.push(win(7.75,1.55))
    shell(f,rect,[win(-8,1.42),...(level===0?[door(0,id+'-street'),win(-3.75,2.3),win(4.6,2.2)]:[win(-3.75,2.3),win(0,1.5),win(4.6,2.2)])],
      rear,true)
    stairWalls(f,stair,level,4)
    for(const x of [lift.x-1.12,lift.x+1.12])wall(f,'z',x,2.03,4.42)
    wall(f,'x',4.42,lift.x-1.12,lift.x+1.12)
    wall(f,'x',2.03,lift.x-1.12,lift.x+1.12,[{kind:'lift',at:lift.x,width:1.53}])
    f.points.push({id:'call:'+id,x:lift.x-1.03,z:1.61,label:'Call elevator',range:1.03},{id:'lift:'+id,...lift,label:'Use elevator',range:.99})
    if(level===0){
      furnish(f,'desk',4.6,-.12,2.85,.83,Math.PI)
      furnish(f,'mail',-9.91,-2.93,1.38,.45,Math.PI/2)
      furnish(f,'sofa',-4.25,-6.75,2.22,.83,Math.PI)
      furnish(f,'coffee',-4.25,-5.16,1.25,.63)
      furnish(f,'chair',-6,-5.22,.72,.76,Math.PI/2)
      furnish(f,'chair',-2.35,-5.22,.72,.76,-Math.PI/2)
      furnish(f,'plant',-6.5,4.9,.55,.55)
      furnish(f,'plant',6,5.12,.55,.55)
      furnish(f,'sofa',4.9,-7.19,2.36,.86,Math.PI)
      furnish(f,'chair',7,-5.74,.70,.76,-Math.PI/2)
      furnish(f,'coffee',4.88,-5.68,1.19,.65)
      furnish(f,'plant',1.34,-7.64,.79,.79)
      furnish(f,'plant',9.74,-7.64,.71,.71)
      continue
    }
    const units=UNITS.filter(u=>u.block===block&&u.floor===level)
    for(const [i,u] of units.entries()){
      const l=flatEdges[i],r=flatEdges[i+1],unit=bounds(l,r,-8.5,-1.1)
      const entry=i===2?r-3.5:l+2.46
      wall(f,'x',-1.1,l,r,[door(entry,u.id,u.id)])
      if(i)wall(f,'z',l,-8.5,-1.1)
      f.units.push({id:u.id,rect:unit,exit:{x:entry,z:-.39}})
      plan(f,unit,u.id,i)
      if(i)wall(f,'z',entry-.75,-2.03,-1.1)
      if(i)f.tiles.push({rect:bounds(entry-.62,entry+.58,-2.04,-1.16),kind:'kitchen'})
    }
  }
  all.push({id,...place,facing:1,rect,levels,style:block,block,stairs:stair,lift})
}
for(const [i,[x,z]] of HOMES.entries()){
  const u=UNITS[i],style=houseDesign(i),levels=Array.from({length:houseLevels(i)},floor)
  const rect=style===3?bounds(-3.14,3.14,-4.1,3.35):bounds(-2.94,2.94,-3.85,3.35),id=u.id
  const stair=levels.length>1?{x:1.55,front:1.43,back:-3.51,width:1.25}:undefined
  for(const [level,f] of levels.entries()){
    shell(f,rect,level?[win(-1.45),win(1.52)]:[door(0,id,i%3===0?undefined:id),win(-1.89,1.05),win(1.89,1.05)],
      [win(-1.57,1.38),win(1.52,1.39)],true)
    f.units.push({id,rect,exit:{x:0,z:4.05}})
    if(stair){
      stairWalls(f,stair,level,1)
      const add=(kind:Fixture['kind'],x:number,z:number,w:number,d:number,yaw=0,dining=false)=>furnish(f,kind,x,z,w,d,yaw,id,dining)
      if(level===0){
        wall(f,'x',-2.15,-2.94,.3,[door(-1.35,id+'-wc')])
        f.tiles.push({rect:bounds(-2.85,.21,-3.76,-2.23),kind:'bath'})
        add('shower',-2.37,-3.25,.85,.85);add('toilet',-.2,-3.35,.43,.65)
        add('vanity',-.13,-2.59,.43,.65)
        add('counter',-2.55,-1.17,1.6,.61,-Math.PI/2);add('fridge',-2.53,.15,.68,.71,-Math.PI/2)
        add('sofa',-2.38,1.67,1.67,.79,-Math.PI/2);add('chair',1.25,2.83,.62,.63,-Math.PI/2,true)
        add('table',2.14,2.83,.72,.64)
      }else{
        wall(f,'x',-.93,-2.94,.3,[door(-1.03,id+'-bed-a')])
        wall(f,'z',-.56,1.36,3.35)
        wall(f,'x',1.36,-2.94,-.56,[door(-1.32,id+'-bed-b',undefined,true)])
        add('bed',-2.07,-2.58,1.38,1.99)
        add('bed',-1.96,2.45,1.18,1.52)
        add('wardrobe',-.27,-3.3,.71,.78)
      }
    }else plan(f,rect,id,style===1?1:0)
  }
  all.push({id,x,z,rect,style:style+2,facing:u.facing,levels,stairs:stair})
}

export const BUILDINGS=all
export const buildingById=new Map(all.map(b=>[b.id,b]))
export const homeZone=(id:string,level:number):HomeZone=>`home:${id}:${level}`
export const stairZone=(id:string,level:number):HomeZone=>`stairs:${id}:${level}`
export function residentialSite(b:Building,x:number,z:number){return {x:b.x+x*b.facing,z:b.z+z*b.facing}}
export function residentialAt(zone:string){
  if(!zone.startsWith('home:')&&!zone.startsWith('stairs:'))return
  const [kind,id,index]=zone.split(':'),building=buildingById.get(id),level=Number(index)
  const f=building?.levels[level]
  if(building&&f)return {building,level,f,stairs:kind==='stairs'}
}
export function streetBuilding(x:number,z:number,pad=0){
  return all.find(b=>Math.abs(x-b.x)<12&&Math.abs(z-b.z)<10&&contains(b.rect,(x-b.x)*b.facing,(z-b.z)*b.facing,pad))
}
export function stairHeight(b:Building,z:number,side:number){
  const s=b.stairs!,t=Math.max(0,Math.min(1,((z-s.front)/(s.back-s.front)-.045)/.74))
  return STOREY*.5*(side<0?t:2-t)
}
export function residentialHeight(zone:string,x:number,z:number){
  const a=residentialAt(zone)
  if(!a)return
  const {building:b,level,stairs}=a
  return level*STOREY+(stairs?stairHeight(b,(z-b.z)*b.facing,(x-b.x)*b.facing-b.stairs!.x):0)
}
export interface LiftState {level:number;to?:number;started?:number;ends?:number;opened:number}
export interface ResidentialView {doors:Record<string,number>;lifts:Record<string,LiftState>;fridge?:string;fridges?:string[]}
export function liftHeight(l:LiftState,now:number){
  const t=l.ends&&l.started?Math.max(0,Math.min(1,(now-l.started)/(l.ends-l.started))):0
  return STOREY*(l.level+((l.to??l.level)-l.level)*t*t*(3-2*t))
}
export function liftOpening(l:LiftState,level:number,now:number){
  if(l.to===undefined)return l.level===level?Math.max(0,Math.min(1,(now-l.opened)/330)):0
  if(l.level===level)return Math.max(0,Math.min(1,(l.started!-now)/420))
  return l.to===level?Math.max(0,Math.min(1,(now-l.ends!-220)/330)):0
}
export const openLift=(l:LiftState|undefined,level:number,now:number)=>!!l&&l.to===undefined&&liftOpening(l,level,now)>.82
const radius=.205
function hitsWall(w:Wall,x:number,z:number,radius=.205){
  const side=w.axis==='x'?x:z,depth=w.axis==='x'?z:x
  if(Math.abs(depth-(w.axis==='x'?w.z:w.x))>.11+radius||Math.abs(side-(w.axis==='x'?w.x:w.z))>w.length/2+radius)return false
  return !w.openings.some(o=>o.kind!=='window'&&Math.abs(side-o.at)<o.width/2-radius)
}
export function access(unit:string|undefined,keys:readonly string[]){
  return !unit||keys.includes(unit)||UNITS.some(u=>u.id===unit&&u.block===undefined&&Number(u.id.slice(6))%3===0)
}
export const DOOR_TRAVEL=290
const fraction=(t:number)=>Math.max(0,Math.min(1,t))
export function doorSwing(timestamp:number|undefined,now:number){
  if(!timestamp)return 0
  const t=fraction((now-Math.abs(timestamp))/DOOR_TRAVEL),eased=t*t*(3-2*t)
  return (timestamp>0?eased:1-eased)*Math.PI/2
}
function doorHit(d:Door,x:number,z:number,angle:number,radius=.205){
  const along=(d.axis==='x'?x-d.x:z-d.z)+d.width/2
  const across=(d.axis==='x'?z-d.z:x-d.x)*(d.reverse?1:-1)
  const end=along*Math.cos(angle)+across*Math.sin(angle)
  const normal=across*Math.cos(angle)-along*Math.sin(angle)
  return end>-radius&&end<d.width+radius&&Math.abs(normal)<.047+radius
}
export function residentialOccludes(b:Building,x:number,y:number,z:number,state:ResidentialView|undefined,now:number){
  const level=Math.floor((y+.10)/STOREY),f=b.levels[level]
  if(!contains(b.rect,x,z,.14)||y<0||level>b.levels.length)return false
  const s=b.stairs,inStairwell=s&&Math.abs(x-s.x)<s.width&&z>=Math.min(s.front,s.back)&&z<=Math.max(s.front,s.back)
  const localY=y-level*STOREY
  if(level>0&&localY<.10&&(!inStairwell||!f))return true
  if(!f)return false
  if(f.walls.some(w=>hitsWall(w,x,z,0)))return true
  if(f.doors.some(d=>doorHit(d,x,z,doorSwing(state?.doors[d.id],now),0)))return true
  if(insideLift(b,x,z)&&!openLift(state?.lifts[b.id]??{level:0,opened:0},level,now))return true
  return f.fixtures.some(item=>{
    if(!['fridge','wardrobe','shower'].includes(item.kind)||localY>1.95)return false
    const p=along({x:0,z:0},x-item.x,z-item.z,-item.yaw)
    return Math.abs(p.x)<item.w/2&&Math.abs(p.z)<item.d/2
  })
}
function insideLift(b:Building,x:number,z:number,pad=0){
  return b.lift&&Math.abs(x-b.lift.x)<1.15+pad&&z>2.03-pad&&z<4.42+pad
}
export function aboard(zone:string,x:number,z:number){
  const a=residentialAt(zone)
  return !!a&&!a.stairs&&insideLift(a.building,(x-a.building.x)*a.building.facing,(z-a.building.z)*a.building.facing,-.21)
}
export function residentialStep(zone:string,x:number,z:number,keys:readonly string[],state:ResidentialView|undefined,now:number):false|string {
  const previous=residentialAt(zone),b=previous?.building??streetBuilding(x,z,.32)
  if(!b)return zone
  const dx=(x-b.x)*b.facing,dz=(z-b.z)*b.facing
  let level=previous?.level??0
  let onStairs=previous?.stairs??false
  const s=b.stairs
  if(s){
    const across=dx-s.x,t=(dz-s.front)/(s.back-s.front),width=Math.abs(across)
    if(onStairs){
      if(width>s.width-radius||t>1-radius/Math.abs(s.back-s.front))return false
      if(width<.13&&t<.805)return false
      if(t<=0){if(across>0)level++;onStairs=false}
    }else if(t>0&&t<1&&width<s.width){
      if(t>.11||width>s.width-radius||width<.14)return false
      if(across<0&&level<b.levels.length-1)onStairs=true
      else if(across>0&&level>0){onStairs=true;level--}
      else return false
    }
  }
  if(onStairs)return stairZone(b.id,level)
  const f=b.levels[level]
  if(f.walls.some(w=>hitsWall(w,dx,dz)))return false
  if(f.units.some(u=>!access(u.id,keys)&&(contains(u.rect,dx,dz,-.015)||u===f.units.at(-1)&&f.tiles.some(t=>t.kind==='balcony'&&contains(t.rect,dx,dz,.05)))))return false
  if(f.doors.some(d=>doorHit(d,dx,dz,access(d.unit,keys)?doorSwing(state?.doors[d.id],now):0)))return false
  if(insideLift(b,dx,dz,.16)&&!openLift(state?.lifts[b.id]??{level:0,opened:0},level,now))return false
  if(f.fixtures.some(item=>{
    const p=along({x:0,z:0},dx-item.x,dz-item.z,-item.yaw)
    return Math.abs(p.x)<item.w/2+radius*.83&&Math.abs(p.z)<item.d/2+radius*.83
  }))return false
  if(contains(b.rect,dx,dz)||f.tiles.some(t=>t.kind==='balcony'&&contains({...t.rect,b:t.rect.b+.22,l:t.rect.l+.22,r:t.rect.r-.22,f:t.rect.f+.25},dx,dz)))return homeZone(b.id,level)
  return previous&&level>0?false:'city'
}
export function residentialPoints(zone:string,position:Point,keys:readonly string[],state?:ResidentialView):HomePoint[]{
  const found=residentialAt(zone)
  if(found?.stairs)return []
  const b=found?.building??streetBuilding(position.x,position.z,2)
  if(!b)return []
  const f=b.levels[found?.level??0]
  return f.points.flatMap(p=>{
    if(p.id.startsWith('drawer:')&&(!p.unit||!keys.includes(p.unit)))return []
    if(!found&&!p.door?.id.endsWith('-street')&&p.door?.id!==b.id)return []
    if(!p.door&&(!access(p.unit,keys)||p.unit&&!f.units.some(u=>u.id===p.unit&&contains(u.rect,(position.x-b.x)*b.facing,(position.z-b.z)*b.facing))))return []
    const d=p.door,canOpen=access(d?.unit,keys)
    const label=d?canOpen?(state?.doors[d.id]??0)>0?'Close door':'Open door':'Locked — private residence':p.label
    return [{...p,...residentialSite(b,p.x,p.z),label,
      pose:p.pose?{...p.pose,...residentialSite(b,p.pose.x,p.pose.z),yaw:p.pose.yaw+(b.facing<0?Math.PI:0)}:undefined,
      exit:p.exit?residentialSite(b,p.exit.x,p.exit.z):undefined}]
  })
}
export function unauthorizedHome(zone:string,x:number,z:number,keys:readonly string[]){
  const a=residentialAt(zone)
  if(!a)return
  const {building:b,f}=a
  const dx=(x-b.x)*b.facing,dz=(z-b.z)*b.facing
  return f.units.find(u=>!access(u.id,keys)&&(contains(u.rect,dx,dz,-.02)||u===f.units.at(-1)&&f.tiles.some(t=>t.kind==='balcony'&&contains(t.rect,dx,dz,.05))))
}
