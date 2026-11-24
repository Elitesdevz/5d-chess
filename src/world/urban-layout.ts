import {circle,distance,facade,LANDMARKS,nearestSidewalk,onRoad,PARKING,PARKS,PLACES,point,pond,railZ,STREETS,type Point} from './city-plan.ts'
import {BUILDINGS,contains,residentialSite,type HomePoint} from './residential.ts'
import {SIGNAL_HEADS} from './traffic.ts'
import {OFFICES} from './housing.ts'
import {BOULEVARD_TREES,HOMES,MARKET,homeFacing} from './terrain.ts'

export type Footpath={id:string;points:Point[];width:number;purpose:'entry'|'walk'|'park'|'drive'}
const access=(id:string,start:Point,end:Point,w=1.55):Footpath=>({id,points:[start,end],width:w,purpose:'entry'})
const residentialStreet=(z:number,facing:number)=>
  facing<0?'boulevard':z<-32?(z<-37?'court':'westbank'):z<-11?'linden':z<4?'boulevard':z<34?'garden':'mill'
export function homeStreet(x:number,z:number,facing=homeFacing(z)){
  const id=residentialStreet(z,facing)
  return STREETS.find(s=>s.id===(x>0&&id==='linden'?'glass':x>0&&id==='westbank'?'eastbank':id))!
}
export const ENTRANCES=[
  ...BUILDINGS.map(b=>{
    const at=residentialSite(b,0,b.rect.f),road=b.block===undefined?homeStreet(b.x,b.z,b.facing):STREETS.find(s=>s.id===(b.block===2?'civic':b.x<0?'westbank':'eastbank'))!
    return {...at,id:b.id,front:residentialSite(b,0,b.rect.f+.87),road}
  }),
  ...LANDMARKS.map(b=>({...facade(b),id:b.id,front:point(b.x,facade(b).z+.83*b.facing),road:STREETS.find(s=>s.id===b.street)!})),
  ...[[-24,5.02,'bank'],[24,5,'exchange'],[0,-7,'hotel'],[63,5.85,'kfc']].map(([x,z,id])=>({x:Number(x),z:Number(z),id:String(id),front:point(Number(x),Number(z)+.8),road:STREETS[0]})),
]
const route=(id:string,points:Point[],width:number,purpose:Footpath['purpose']='walk'):Footpath=>({id,points,width,purpose})
export const PATHS:Footpath[]=[
  ...ENTRANCES.map(e=>access(e.id,e.front,e.id==='hall'?point(0,15.4):nearestSidewalk(e.front,e.road),e.id.startsWith('block-')?2.1:1.45)),
  route('square', [point(0,4),point(0,11),point(0,15.4)],3.3),
  route('park-high',[point(25,-68.5),point(23,-71.5),point(18,-73.5),point(17,-77.8),point(23,-80.1),point(30,-79.8),point(36,-78.2),point(42.5,-73.4),point(43,-68.5)],1.7,'park'),
  route('park-bridge',[point(24,-70.9),point(24,-73.6),point(24,-78),point(24,-80.1)],1.6,'park'),
  route('park-sport',[point(38,-67.9),point(38,-71),point(42.5,-73.4)],1.72,'park'),
  route('park-west',[point(17,-77.8),point(13,-76.5),point(7.6,-77.85)],1.8,'park'),
  route('station-plaza',[point(-7.3,-78.5),point(7.8,-78.5)],3),
  route('station-platform',[point(8.9,-78.4),point(9.3,-83),point(9.3,-85.4),point(-16.7,-85.4)],1.75),
  route('mill-garden',[point(13,34.4),point(19,37.1),point(25.3,39.2),point(27.2,37.8),point(30,34.5)],1.4,'park'),
  route('west-garden',[point(-19,-62),point(-19,-57),point(-22,-54.2)],1.25,'park'),
  route('school-entrance',[point(60.5,-71.3),point(58.5,-69.6),point(58.5,-67.6)],1.8),
]
for(const bay of PARKING){
  const street=STREETS.find(s=>s.id===bay.street)!
  const road=street.a.x===street.b.x?point(street.a.x,bay.z):point(bay.accessX??bay.x,street.a.z)
  const edge=point((road.x+bay.x)/2,(road.z+bay.z)/2)
  PATHS.push(route(bay.id,[road,edge,point(bay.x,bay.z)],2.25,'drive'))
}
export const distSegment=(p:Point,a:Point,b:Point)=>{
  const x=b.x-a.x,z=b.z-a.z,l=x*x+z*z
  const t=l?Math.max(0,Math.min(1,((p.x-a.x)*x+(p.z-a.z)*z)/l)):0
  return Math.hypot(p.x-a.x-t*x,p.z-a.z-t*z)
}
export function pathClearance(p:Point,pad=0){
  return PATHS.some(path=>path.purpose!=='drive'&&path.points.slice(1).some((b,i)=>distSegment(p,path.points[i],b)<path.width/2+pad))
}
export type StreetProp=Point&{id:string;kind:'lamp'|'bench'|'bin'|'recycling'|'bike'|'scooter'|'bus'|'cabinet'|'hydrant'|'mail'|'bollard'|'sign'|'notice'|'tree';yaw:number;radius:number;label?:string;style?:number}
export const STREET_PROPS:StreetProp[]=[]
const fields=new Map<string,StreetProp[]>()
function add(kind:StreetProp['kind'],x:number,z:number,yaw:number,radius:number,label?:string,style?:number){
  const p=point(x,z)
  if(onRoad(p,radius+.14)||SIGNAL_HEADS.some(h=>distance(h,p)<radius+.44)||pathClearance(p,radius+.12)||PARKING.some(b=>distance(p,b)<radius+2.56)||
    ENTRANCES.some(e=>distance(p,e.front)<radius+1.8)||solidStructure(x,z,radius+.12)||
    MARKET.some(([a,b])=>Math.hypot(x-a,z-b)<2.1+radius)||
    BOULEVARD_TREES.some(a=>Math.abs(Math.abs(x)-a)<.72+radius&&Math.abs(z-14.85)<.55+radius)||
    STREET_PROPS.some(q=>distance(p,q)<q.radius+radius+.29))return false
  const prop={id:kind+'-'+STREET_PROPS.length,kind,x,z,yaw,radius,label,style}
  STREET_PROPS.push(prop)
  for(let a=Math.floor((x-radius-.4)/5);a<=Math.floor((x+radius+.4)/5);a++)
    for(let b=Math.floor((z-radius-.4)/5);b<=Math.floor((z+radius+.4)/5);b++){
      const key=a+','+b
      if(!fields.has(key))fields.set(key,[])
      fields.get(key)!.push(prop)
    }
  return true
}
function solidStructure(x:number,z:number,pad:number){
  if(LANDMARKS.some(b=>Math.abs(x-b.x)<b.w/2+pad&&Math.abs(z-b.z)<b.d/2+pad))return true
  if(OFFICES.some(b=>Math.abs(x-b.x)<b.w/2+pad&&Math.abs(z-b.z)<b.d/2+pad))return true
  if(BUILDINGS.some(b=>contains(b.rect,(x-b.x)*b.facing,(z-b.z)*b.facing,pad)))return true
  return [[0,-14.78,9.55,7.9],[0,-31.58,11.3,8.9],[-24,-2.3,10.3,7.5],[24,-2.5,8.2,7.6],[63,-.65,6.4,7]].some(([a,b,c,d])=>Math.abs(x-a)<c+pad&&Math.abs(z-b)<d+pad)
}
for(const [index,s] of STREETS.entries()){
  if(!s.traffic)continue
  const span=distance(s.a,s.b),dx=(s.b.x-s.a.x)/span,dz=(s.b.z-s.a.z)/span
  for(let i=8;i<span-5;i+=13){
    const side=(Math.round(i/13)+index)%2?1:-1,d=(s.width/2+s.walk+.47)*side
    const x=s.a.x+dx*i-dz*d,z=s.a.z+dz*i+dx*d
    add('lamp',x,z,Math.atan2(dx,dz),.24,undefined,s.limit>6?1:0)
    if(i===8)add('sign',x+dx*1.4,z+dz*1.4,Math.atan2(dx,dz),.24,s.name)
    if(i>12&&Math.round(i)%3===0)add('hydrant',x-dx*2.1,z-dz*2.1,0,.22)
  }
}
for(const [x,z] of HOMES){
  const f=homeFacing(z),dir=f===1?0:Math.PI
  add('mail',x+f*2.35,z+f*4.19,dir,.22)
  if(x%2)add('tree',x-f*2.72,z+f*4.35,0,.37,undefined,2)
}
for(const [x,z,yaw] of [[-5.5,13.7,0],[6.8,16.8,Math.PI],[-9.4,25.4,0],[21.9,-72.4,0],[29.7,-72.3,0],[31.8,-79.8,Math.PI],[19.1,-79.5,Math.PI],[40.8,-73.9,Math.PI],[21.7,38,0],[-20.9,-56.3,0],[-53.5,-31.7,Math.PI],[54,-33.6,0],[-8.5,-77.1,0]]){
  add('bench',x,z,yaw,1.01)
  add('bin',x+1.45,z,yaw,.28)
}
for(const [kind,x,z,yaw,r] of [
  ['bus',-9.9,-77.7,0,1.38],['bus',36.3,-61.38,Math.PI,1.45],['bike',5.3,-79,.0,1.01],
  ['bike',-55.8,-32.8,0,.91],['bike',54.4,-70.2,0,.99],['bike',36.7,-60.4,0,1.01],
  ['scooter',-18.35,4.9,0,.66],['recycling',47.6,-51.15,0,.52],['notice',5.8,14.5,Math.PI,.63],
  ['cabinet',10.25,-86.05,0,.57],['bollard',-2.05,16.3,0,.14],['bollard',2.05,16.3,0,.14]
] as const)add(kind,x,z,yaw,r)
for(const park of PARKS)for(const side of [-1,1])for(let i=0;i<5;i++){
  const x=park.x+(i-2)*park.w/6,z=park.z+side*(park.d/2-.55)
  add('tree',x,z,0,.37,undefined,i%2)
  if(i===2)add('lamp',x+1.15,z,0,.21,undefined,0)
}
export const PUBLIC_SEATS:HomePoint[]=STREET_PROPS.filter(p=>p.kind==='bench').flatMap(p=>[-.48,.48].map((dx,i)=>{
  const c=Math.cos(p.yaw),s=Math.sin(p.yaw),x=p.x+c*dx,z=p.z-s*dx,id=p.id+'-'+i
  const exit={x:x-s*.75,z:z-c*.75}
  return {...exit,id:'furniture:'+id,label:'Sit on bench',range:.86,exit,pose:{x,z,yaw:p.yaw,id,kind:'sit',height:.47}}
}))
export function urbanObstacle(x:number,z:number){
  if(LANDMARKS.some(b=>Math.abs(x-b.x)<b.w/2+.20&&Math.abs(z-b.z)<b.d/2+.20))return true
  if(Math.hypot(x-circle.x,z-circle.z)<circle.radius-circle.width/2-.25)return true
  const p=point(x,z)
  if(SIGNAL_HEADS.some(s=>distance(s,p)<.28))return true
  if(Math.abs(x-pond.x)<pond.w/2+.15&&Math.abs(z-pond.z)<pond.d/2+.15&&Math.abs(x-pond.bridge)>.57)return true
  // Continuous fencing keeps the two static rail lines separate from the platform and town.
  if(Math.abs(z-railZ(x))<2.85)return true
  const nearby=fields.get(Math.floor(x/5)+','+Math.floor(z/5))
  return nearby?.some(prop=>prop.kind==='bench'?Math.abs((x-prop.x)*Math.cos(prop.yaw)-(z-prop.z)*Math.sin(prop.yaw))<1.09&&
    Math.abs((x-prop.x)*Math.sin(prop.yaw)+(z-prop.z)*Math.cos(prop.yaw))<.40:distance(p,prop)<prop.radius+.17)??false
}
export function cityPlace(id:string){return PLACES.find(p=>p.id===id)}
