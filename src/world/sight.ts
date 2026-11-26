// Arcade visibility is measured in city coordinates. A room label supplies an
// actor's elevation, while architecture and door positions determine occlusion.
import {buildings,FLOOR_HEIGHT,FLOOR_LIST,localSite,PLAN,publicWall,groundZone,walkingHeight,type WorldZone} from './model.ts'
import {doorLeaves,footprint,front,origins,rise,stair,shopCases,type Venue} from './civic-venues.ts'
import {BUILDINGS,residentialOccludes,type ResidentialView} from './residential.ts'
import {center,ROOMS,venues} from './resort.ts'
import {FLEET,LANDMARKS,urbanGround} from './city-plan.ts'
import {STREET_PROPS} from './urban-layout.ts'
import {terrainHeight,townFixture,treeObstacle} from './terrain.ts'
import {vehicleContains,type Vehicle} from './traffic.ts'

type Actor={x:number;z:number;zone:string;height?:number}
type Scene={residential?:ResidentialView;vehicles?:readonly Vehicle[];keys:readonly string[];caveOpen?:boolean}
export const actorHeight=(p:Actor)=>p.height??walkingHeight(p.zone as WorldZone,p.x,p.z)
export const actorDistance=(a:Actor,b:Actor)=>Math.hypot(b.x-a.x,b.z-a.z,actorHeight(b)-actorHeight(a))
const staticBlocks=LANDMARKS.filter(b=>b.id!=='police')
const civicVenues=['station','gunshop'] as const
const leaves={station:doorLeaves('station'),gunshop:doorLeaves('gunshop')}
function civicBlock(id:Venue,x:number,y:number,z:number){
  const {w,d}=footprint[id],f=front[id],ax=Math.abs(x),az=Math.abs(z)
  if(ax>w/2+.13||az>d/2+.13||y<0||y>(id==='station'?6*rise:3.9)+.12)return false
  if(ax>w/2-.10||az>d/2-.10)return Math.abs(z-f.z)>.14||Math.abs(x-f.x)>.92||y>2.39
  if(y<2.3&&leaves[id].some(p=>Math.abs(x-p.x)<p.w/2&&Math.abs(z-p.z)<p.d/2))return true
  if(id==='gunshop')return y>3.76||y<1.38&&shopCases.some(p=>Math.abs(x-p.x)<p.w/2&&Math.abs(z-p.z)<p.d/2)
  const level=Math.round(y/rise)
  if(level>0&&Math.abs(y-level*rise)<.13&&(level===6||ax>stair.half||z<stair.start))return true
  // The two solid switchback flights (including the intermediate landing).
  if(ax<stair.half&&z>stair.start&&z<3.21){
    const t=Math.min(1,(z-stair.start)/(stair.end-stair.start)),h=(x<0?t:2-t)*rise/2
    if(y<5*rise&&Math.abs(y-h-Math.round((y-h)/rise)*rise)<.11)return true
  }
  return y>rise&&ax>1.35&&az>.84
}
function resortBlock(x:number,y:number,z:number,keys:readonly string[]){
  if(Math.abs(x)>9.55||z< -23.1||z>7.86||y<5.85||y>15.45)return false
  if([6,11,15.4].some(h=>Math.abs(y-h)<.13)||Math.abs(x)>9.35||z< -22.9||z>7.66)return true
  const floor=y<11?'hotel:2':'hotel:3',side=Math.abs(x)
  for(const bay of hotelBays){
    if(bay.floor!==floor||bay.side*x<1.60||z<bay.back-.10||z>bay.front+.10)continue
    if(Math.abs(z-bay.back)<.10||Math.abs(z-bay.front)<.10)return true
    const doorway=Math.abs(z-center(bay))<.73
    if(side<1.82&&(!doorway||y-(floor==='hotel:2'?6:11)>2.33||'id' in bay&&!keys.includes(bay.id)))return true
    if('id' in bay&&keys.includes(bay.id)&&side>1.70&&side<3.17&&Math.abs(z-center(bay)+.74)<.06)return true
    if('id' in bay&&side>4.24&&side<8.45&&Math.abs(z-bay.back-1.89)<.13)return true
  }
  return false
}
const hotelBays=[...ROOMS,...venues]
const tallProps=STREET_PROPS.filter(p=>['lamp','tree','sign','notice','bus'].includes(p.kind))
export function clearSight(a:Actor,b:Actor,state:Scene,now:number){
  if(a.zone==='private'||b.zone==='private')return false
  const dx=b.x-a.x,dz=b.z-a.z,base=actorHeight(a)+1.32,dy=actorHeight(b)+1.32-base
  const intersects=(x:number,z:number,w:number,d:number)=>
    Math.abs((a.x+b.x)/2-x)<=w+Math.abs(dx)/2&&Math.abs((a.z+b.z)/2-z)<=d+Math.abs(dz)/2
  const homes=BUILDINGS.filter(h=>intersects(h.x,h.z,12,10))
  const blocks=staticBlocks.filter(p=>intersects(p.x,p.z,p.w/2,p.d/2))
  const civic=civicVenues.filter(id=>intersects(origins[id].x,origins[id].z,footprint[id].w/2+.14,footprint[id].d/2+.14))
  const rooms=buildings.filter(id=>{const p=PLAN[id];return intersects(p.x,p.z,p.width+.2,id==='hotel'?24:Math.max(-p.back,p.front)+.2)})
  const props=tallProps.filter(p=>intersects(p.x,p.z,p.radius+.1,p.radius+.1))
  const cars=state.vehicles?.filter(p=>intersects(p.x,p.z,3.6,3.6))??[]
  // Samples are closer together than the thinnest solid door leaf.
  const steps=Math.max(1,Math.ceil(Math.hypot(dx,dy,dz)/.045))
  for(let i=0;i<=steps;i++){
    const t=i/steps,x=a.x+dx*t,z=a.z+dz*t,y=base+dy*t
    for(const id of rooms){
      const p=PLAN[id],u=x-p.x,v=z-p.z
      if(id==='hotel'&&resortBlock(u,y,v,state.keys))return false
      const height=id==='exchange'?(FLOOR_LIST.length+1)*FLOOR_HEIGHT:id==='kfc'?3.85:5.9
      if(y<0||y>height+.12)continue
      if(publicWall(id,u,v,.12,y>2.8))return false
      if(Math.abs(u)<p.width&&v>p.back&&v<p.front){
        if(Math.abs(y-height)<.12||id==='exchange'&&y>3&&Math.abs(y-Math.round(y/FLOOR_HEIGHT)*FLOOR_HEIGHT)<.13)return false
        if(id==='kfc'&&(Math.abs(u-3.32)<.1&&v< -3.17||Math.abs(v+3.17)<.10&&u>3.15&&Math.abs(u-4.75)>.66))return false
      }
    }
    if(civic.some(id=>civicBlock(id,x-origins[id].x,y,z-origins[id].z)))return false
    if(homes.some(h=>residentialOccludes(h,(x-h.x)*h.facing,y,(z-h.z)*h.facing,state.residential,now)))return false
    if(blocks.some(p=>y>=0&&y<p.h&&Math.abs(x-p.x)<p.w/2&&Math.abs(z-p.z)<p.d/2))return false
    if(cars.some(v=>y>=0&&y<FLEET[v.kind].height&&vehicleContains({x,z},v,0)))return false
    for(const p of props){
      const u=x-p.x,v=z-p.z
      if(p.kind==='bus'){
        const dx=u*Math.cos(p.yaw)-v*Math.sin(p.yaw),dz=v*Math.cos(p.yaw)+u*Math.sin(p.yaw)
        if(Math.abs(dx)<1.19&&Math.abs(dz-.54)<.035&&y<2.06&&y>.40)return false
      }else if(y>=0&&y<(p.kind==='tree'||p.kind==='lamp'?3.5:1.84)&&Math.hypot(u,v)<(p.kind==='tree'?.18:.04))return false
    }
    if(Math.hypot(x,z)<.68&&y<3.8)return false
    const outsideCity=!urbanGround(x,z)
    if(outsideCity){
      const zone=groundZone(x,z)
      if(zone==='cave'||zone==='oasis'){
        const local=localSite(zone,x,z),bed=walkingHeight(zone,x,z)
        if(zone==='cave'&&state.caveOpen===false||y<bed||y<0&&y>bed+3.4||Math.abs(local.x)>2.2&&y<0)return false
      }else if(y<terrainHeight(x,z))return false
    }
    if(y>=0&&y<2.7&&townFixture(x,z)||outsideCity&&treeObstacle(x,z)&&y<terrainHeight(x,z)+3.5)return false
  }
  return true
}
