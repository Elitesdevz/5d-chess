// Dimensions are in city metres. Every floor sits over the Civic Avenue parcel.
import {LANDMARKS} from './city-plan.ts'

const precinct=LANDMARKS.find(b=>b.id==='police')!
export type Venue='station'|'gunshop'
export type Gallery='precinct:1'|'precinct:2'|'precinct:3'|'precinct:4'|'precinct:5'
export type CivicRoom=Venue|Gallery
export const venue=(z:string):z is Venue=>z==='station'||z==='gunshop'
export const gallery=(z:string):z is Gallery=>/^precinct:[1-5]$/.test(z)
export const civicRoom=(z:string):z is CivicRoom=>venue(z)||gallery(z)
export const levelOf=(z:string)=>gallery(z)?Number(z.slice(-1)):0
export const levelZone=(n:number):Gallery|'station'=>n===0?'station':('precinct:'+n) as Gallery
export const rise=3.4
export const origins={station:{x:precinct.x+2.9,z:precinct.z-.55},gunshop:{x:-55.65,z:-74.25}}
export const footprint={station:{w:18.6,d:precinct.d},gunshop:{w:9.8,d:8.4}}
export const design=(z:CivicRoom)=>z==='gunshop'?'gunshop':'station'
export const originOf=(z:CivicRoom)=>origins[design(z)]
export const at=(z:CivicRoom,x:number,zLocal:number)=>({x:originOf(z).x+x,z:originOf(z).z+zLocal})
export const front={station:{x:-.35,z:-footprint.station.d/2,sign:-1},gunshop:{x:0,z:footprint.gunshop.d/2,sign:1}}
// Paired glazed leaves stand open against the door reveals on the interior side.
export function doorLeaves(id:Venue){
  const f=front[id]
  return [-1,1].map(dir=>({x:f.x+dir*.94,z:f.z-f.sign*.45,w:.065,d:.90}))
}
export function threshold(id:Venue,offset:number){const d=front[id];return at(id,d.x,d.z+offset*d.sign)}
export const entrances={station:threshold('station',.75),gunshop:threshold('gunshop',.75)}
export const insideDoor=(id:Venue)=>({x:front[id].x,z:front[id].z-.72*front[id].sign,yaw:id==='station'?Math.PI:0})
export const deskFurniture=[
  {id:'desk',x:-4.45,z:1.65,w:4.3,d:1.04,label:'Speak to the desk officer'},
  {id:'booking',x:4.65,z:1.65,w:3.55,d:1.04,label:'View booking register'},
] as const
export const shopCounter={x:0,z:-2.38,w:6.15,d:1.04}
export const shopCases=[{x:-3.92,z:.35,w:.82,d:3.3},{x:3.92,z:.35,w:.82,d:3.3}]
export const stair={start:.79,end:2.66,split:0,half:1.19,up:-.62,down:.62}
export const galleryZone=(cell:number)=>levelZone(1+Math.floor((cell-1)%25/5))
export const cells=Array.from({length:50},(_,i)=>{
  const wing=i<25?-1:1,slot=i%5,row=slot<3?-1:1,column=slot%3
  const x=wing*(2.63+column*2.55),z=row*2.08
  return {number:i+1,level:1+Math.floor(i%25/5),wing,row,x,z,w:2.55,d:2.45}
})
export function cellPosition(n:number){
  const c=cells[n-1];return {...at('station',c.x,c.z),yaw:c.row<0?Math.PI:0}
}
export function confined(n:number,x:number,z:number){
  const c=cellPosition(n)
  return {x:Math.max(c.x-.96,Math.min(c.x+.96,x)),z:Math.max(c.z-.94,Math.min(c.z+.94,z))}
}
export function tablePosition(n:number){
  const c=cells[n-1];return at('station',c.x+.65,c.z+c.row*.56)
}
export function stairHeight(x:number,z:number){
  if(Math.abs(x)>stair.half||z<stair.start)return 0
  if(z>=stair.end)return rise/2
  const t=(z-stair.start)/(stair.end-stair.start)
  return rise*(x<=0?t:2-t)/2
}
export function civicHeight(zone:CivicRoom,x:number,z:number){
  if(zone==='gunshop')return 0
  const n=levelOf(zone),o=origins.station
  return n*rise+(n<5?stairHeight(x-o.x,z-o.z):0)
}
export function venueWalk(zone:CivicRoom,x:number,z:number){
  const o=originOf(zone),u=x-o.x,v=z-o.z,{w,d}=footprint[design(zone)]
  if(Math.abs(u)>w/2-.24||Math.abs(v)>d/2-.24)return false
  const inside=(r:{x:number;z:number;w:number;d:number})=>Math.abs(u-r.x)<r.w/2+.18&&Math.abs(v-r.z)<r.d/2+.18
  if(venue(zone)&&doorLeaves(zone).some(inside))return false
  if(zone==='gunshop')return v>shopCounter.z+.68&& !shopCases.some(inside)
  if(Math.abs(u)<stair.half&&v>stair.start)return (levelOf(zone)<5||v<1.1)&&(v>=stair.end||Math.abs(u)>.12)
  if(zone==='station')return !deskFurniture.some(inside)&&!(u<-6.7&&v< -1.65)
  return Math.abs(v)<.72||Math.abs(u)<stair.half&&v>=0
}
export function civicActions(zone:CivicRoom){
  const n=levelOf(zone)
  const actions:{id:string;label:string;x:number;z:number;range:number}[]=[]
  if(venue(zone)){
    const p=insideDoor(zone)
    actions.push({...p,id:'exit-venue',label:'Exit to Civic Avenue',range:.85})
  }
  if(zone==='gunshop'){
    actions.push({id:'counter',label:'Visit the armory counter',x:shopCounter.x,z:shopCounter.z+1,range:1.22})
  }else{
    if(!n)for(const d of deskFurniture)actions.push({id:d.id,label:d.label,x:d.x,z:d.z-.97,range:1.22})
    if(n<5)actions.push({id:'gallery-up',label:'Enter jail level '+(n+1),x:stair.down,z:stair.start+.12,range:.32})
    if(n)actions.push({id:'gallery-down',label:'Descend toward '+(n===1?'the lobby':'level '+(n-1)),x:stair.down,z:stair.start-.53,range:.35})
  }
  return actions
}
