import {shared} from './map-data.ts'
import {circle,distance,LANDMARKS,PLACES,point,pond,railZ,STREETS,distSegment,type Point} from './city-plan.ts'
import {SIGNAL_HEADS} from './traffic.ts'
export {distSegment} from './geo.ts'
export type Footpath={id:string;points:Point[];width:number;purpose:'entry'|'walk'|'park'|'drive'}
export type StreetProp=Point&{id:string;kind:'lamp'|'bench'|'bin'|'recycling'|'bike'|'scooter'|'bus'|'cabinet'|'hydrant'|'mail'|'bollard'|'sign'|'notice'|'tree';yaw:number;radius:number;label?:string;style?:number}

export const {entrances:ENTRANCES,paths:PATHS,props:STREET_PROPS,seats:PUBLIC_SEATS,hardscape,directory:DIRECTORY}=shared
const fields=new Map<string,StreetProp[]>()
for(const prop of STREET_PROPS){
  const {x,z,radius}=prop
  for(let a=Math.floor((x-radius-.4)/5);a<=Math.floor((x+radius+.4)/5);a++)
    for(let b=Math.floor((z-radius-.4)/5);b<=Math.floor((z+radius+.4)/5);b++){
      const key=a+','+b
      if(!fields.has(key))fields.set(key,[])
      fields.get(key)!.push(prop)
    }
}
export function pathClearance(p:Point,pad=0){
  return PATHS.some(path=>path.purpose!=='drive'&&path.points.slice(1).some((b,i)=>distSegment(p,path.points[i],b)<path.width/2+pad))
}
export function urbanObstacle(x:number,z:number){
  if(LANDMARKS.some(b=>Math.abs(x-b.x)<b.w/2+.20&&Math.abs(z-b.z)<b.d/2+.20))return true
  if(Math.hypot(x-circle.x,z-circle.z)<circle.radius-circle.width/2-.25)return true
  const p=point(x,z)
  if(hardscape.some(b=>Math.abs(x-b.x)<b.w+.16&&Math.abs(z-b.z)<b.d+.16))return true
  if(SIGNAL_HEADS.some(s=>distance(s,p)<.28))return true
  if(Math.abs(x-pond.x)<pond.w/2+.15&&Math.abs(z-pond.z)<pond.d/2+.15&&Math.abs(x-pond.bridge)>.57)return true
  // Continuous fencing keeps the two static rail lines separate from the platform and town.
  if(Math.abs(z-railZ(x))<2.85)return true
  const nearby=fields.get(Math.floor(x/5)+','+Math.floor(z/5))
  return nearby?.some(prop=>prop.kind==='bench'?Math.abs((x-prop.x)*Math.cos(prop.yaw)-(z-prop.z)*Math.sin(prop.yaw))<1.09&&
    Math.abs((x-prop.x)*Math.sin(prop.yaw)+(z-prop.z)*Math.cos(prop.yaw))<.40:distance(p,prop)<prop.radius+.17)??false
}
export function cityPlace(id:string){return PLACES.find(p=>p.id===id)}
