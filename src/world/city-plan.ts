import {shared} from './map-data.ts'
import {distance,inLane,railHeightZ,railInfluence,type Bounds,type Point,type Street,type Landmark} from './geo.ts'
export * from './geo.ts'
export const baselineUrban={west:-77,east:77,north:-50,south:46}
export const extension={west:-64,east:76,north:-82,south:-50}
export const area=(b:Bounds)=>(b.east-b.west)*(b.south-b.north)


export const {circle,parks:PARKS,parkFeatures:PARK_FEATURES,pond,rail:RAIL}=shared
export const STREETS:Street[]=shared.streets
export const LANDMARKS:Landmark[]=shared.landmarks
export const railZ=(x:number)=>railHeightZ(x,RAIL.z)
export const railwayGround=(x:number,z:number)=>railInfluence(x,z,RAIL.z)
export const onRoad=(p:Point,pad=0)=>STREETS.some(s=>s.traffic&&inLane(p,s,pad))||
  Math.abs(distance(p,circle)-circle.radius)<circle.width/2+pad
export const crossing=(x:number,z:number,axis:'x'|'z',width:number,signal=false)=>({x,z,axis,width,signal})
export const CROSSINGS=shared.crossings
export type VehicleKind='hatch'|'sedan'|'wagon'|'suv'|'van'|'truck'|'taxi'|'police'|'ambulance'|'fire'
export const FLEET:Record<VehicleKind,{w:number;length:number;height:number}>={
  hatch:{w:1.46,length:2.84,height:1.42},sedan:{w:1.54,length:3.38,height:1.36},wagon:{w:1.57,length:3.52,height:1.52},
  suv:{w:1.64,length:3.55,height:1.66},van:{w:1.66,length:3.78,height:1.93},truck:{w:1.73,length:4.18,height:2.1},
  taxi:{w:1.54,length:3.38,height:1.43},police:{w:1.58,length:3.5,height:1.52},ambulance:{w:1.78,length:4.35,height:2.12},fire:{w:1.88,length:4.6,height:2.26}
}
export type Parking=Point&{id:string;street:string;kind?:VehicleKind;yaw:number;paint?:number;use:string;accessX?:number}
export const PARKING:Parking[]=shared.parking
export const parkedCars=PARKING.flatMap(p=>p.kind?[{...p,kind:p.kind,speed:0,turn:0,brake:false}]:[])
export const PLACES=shared.places
export const PREVIEW_BOUNDS={...baselineUrban,north:-93}
