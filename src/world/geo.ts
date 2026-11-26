export type Point = {x:number;z:number}
export type Bounds = {west:number;east:number;north:number;south:number}
export const point=(x:number,z:number):Point=>({x,z})
export const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.z-b.z)
export type Street={id:string;name:string;a:Point;b:Point;width:number;walk:number;limit:number;traffic:boolean}
export type LandmarkKind='hall'|'police'|'fire'|'hospital'|'market'|'petrol'|'school'|'station'|'bakery'|'cafe'|'books'|'florist'|'pharmacy'|'barber'|'office'|'restaurant'
type District='centre'|'finance'|'entertainment'|'civic'|'outskirts'
export type Landmark={id:LandmarkKind;name:string;district:District;x:number;z:number;w:number;d:number;h:number;facing:1|-1;street:string}
export const facade=(b:Landmark):Point=>point(b.x,b.z+b.facing*b.d/2)
export const frontage=(b:Landmark,clear=1.6)=>point(b.x,facade(b).z+b.facing*clear)

export function inLane(p:Point,s:Street,pad=0){
  const vertical=s.a.x===s.b.x
  const across=vertical?p.x:p.z,along=vertical?p.z:p.x,mid=vertical?s.a.x:s.a.z
  const [a,b]=vertical?[s.a.z,s.b.z]:[s.a.x,s.b.x]
  return Math.abs(across-mid)<s.width/2+pad&&along>Math.min(a,b)-pad&&along<Math.max(a,b)+pad
}
export function nearestSidewalk(p:Point,street:Street){
  const vertical=street.a.x===street.b.x
  const along=vertical?p.z:p.x,mid=vertical?street.a.x:street.a.z
  const offset=(street.width+street.walk)/2*((vertical?p.x:p.z)<mid?-1:1)
  const [a,b]=vertical?[street.a.z,street.b.z]:[street.a.x,street.b.x]
  const at=Math.max(Math.min(a,b)+.15,Math.min(along,Math.max(a,b)-.15))
  return vertical?point(mid+offset,at):point(at,mid+offset)
}
export const distSegment=(p:Point,a:Point,b:Point)=>{
  const x=b.x-a.x,z=b.z-a.z,l=x*x+z*z
  const t=l?Math.max(0,Math.min(1,((p.x-a.x)*x+(p.z-a.z)*z)/l)):0
  return Math.hypot(p.x-a.x-t*x,p.z-a.z-t*z)
}
export function ridgeDistance(x:number,z:number){
  const theta=Math.atan2(z,x)
  return Math.hypot(x,z*.97)-(89+6*Math.sin(theta*3+.8)+4*Math.cos(theta*5))
}
export function trailOffset(x:number,z:number,west:number,east:number){
  const mouth=x<0?west:east
  const t=Math.max(0,Math.min(1,(z-36)/(mouth-36)))
  const route=16+24*t+2*Math.sin(t*Math.PI*2)
  return z>32&&z<mouth+1?Math.abs(Math.abs(x)-route):100
}
export const along=(p:Point,dx:number,dz:number,yaw:number)=>({x:p.x+dx*Math.cos(yaw)+dz*Math.sin(yaw),z:p.z+dz*Math.cos(yaw)-dx*Math.sin(yaw)})

export const urbanGround=(x:number,z:number)=>Math.abs(x)<79&&z<51&&z> -84
export const railHeightZ=(x:number,center:number)=>center-4.8*Math.min(1,Math.max(0,(Math.abs(x)-32)/105))**2
export const railInfluence=(x:number,z:number,center:number)=>Math.max(0,Math.min(1,(11-Math.abs(z-railHeightZ(x,center)))/5))
