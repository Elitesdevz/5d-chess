import {shared} from './map-data.ts'
import {along} from './geo.ts'
import {UNITS} from './housing.ts'
import type {Position} from '../roulette-hall-model.ts'
export const STOREY=3.15
export type HomeZone=`home:${string}:${number}`|`stairs:${string}:${number}`
type Point={x:number;z:number}
export type Rect={l:number;r:number;b:number;f:number}
export type Wall=Point&{length:number;axis:'x'|'z';openings:Opening[];outer:boolean}
export type Opening={at:number;width:number;kind:'window'|'door'|'lift';id?:string;unit?:string;reverse?:boolean}
export type Fixture=Point&{id:string;kind:'sofa'|'chair'|'bed'|'fridge'|'counter'|'table'|'coffee'|'media'|'wardrobe'|'vanity'|'toilet'|'shower'|'desk'|'mail'|'plant';w:number;d:number;yaw:number;unit?:string;dining?:boolean}
export type Door=Point&{id:string;axis:'x'|'z';width:number;unit?:string;reverse?:boolean}
export type HomePoint=Point&{id:string;label:string;range:number;unit?:string;door?:Door;pose?:HomePose;exit?:Point}
export type HomePose=Position&{id:string;kind:'sit'|'rest';height:number}
export type Floor={walls:Wall[];fixtures:Fixture[];doors:Door[];points:HomePoint[];units:{id:string;rect:Rect;exit:Point}[];tiles:{rect:Rect;kind:'bath'|'kitchen'|'balcony'}[]}
export type Stair={x:number;front:number;back:number;width:number}
export type Building={id:string;x:number;z:number;facing:number;rect:Rect;levels:Floor[];style:number;block?:number;tower?:boolean;baseY?:number;stairs?:Stair;lift?:Point}

export const contains=(r:Rect,x:number,z:number,pad=0)=>x>r.l-pad&&x<r.r+pad&&z>r.b-pad&&z<r.f+pad
export const BUILDINGS:Building[]=shared.buildings
export const buildingById=new Map(BUILDINGS.map(b=>[b.id,b]))
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
  return BUILDINGS.find(b=>!b.baseY&&Math.abs(x-b.x)<12&&Math.abs(z-b.z)<10&&contains(b.rect,(x-b.x)*b.facing,(z-b.z)*b.facing,pad))
}
export function stairHeight(b:Building,z:number,side:number){
  const s=b.stairs!,t=Math.max(0,Math.min(1,((z-s.front)/(s.back-s.front)-.045)/.74))
  return STOREY*.5*(side<0?t:2-t)
}
export function residentialHeight(zone:string,x:number,z:number){
  const a=residentialAt(zone)
  if(!a)return
  const {building:b,level,stairs}=a
  return (b.baseY??0)+level*STOREY+(stairs?stairHeight(b,(z-b.z)*b.facing,(x-b.x)*b.facing-b.stairs!.x):0)
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
  y-=b.baseY??0
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
  return previous&&(level>0||b.baseY)?false:'city'
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
