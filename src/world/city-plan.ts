export type Point = {x:number;z:number}
export type Bounds = {west:number;east:number;north:number;south:number}
export const point=(x:number,z:number):Point=>({x,z})
export const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.z-b.z)
export const baselineUrban={west:-77,east:77,north:-50,south:46}
export const extension={west:-64,east:76,north:-82,south:-50}
export const area=(b:Bounds)=>(b.east-b.west)*(b.south-b.north)
export const urbanGround=(x:number,z:number)=>Math.abs(x)<79&&z<51&&z> -84

export type Street={id:string;name:string;a:Point;b:Point;width:number;walk:number;limit:number;traffic:boolean}
const street=(id:string,name:string,x:number,z:number,a:number,b:number,width:number,limit:number,walk=1.35,traffic=true):Street=>
  ({id,name,a:point(x,z),b:point(a,b),width,walk,limit,traffic})
export const circle={x:0,z:-65,radius:8,width:3.5}
export const STREETS=[
  street('boulevard','Crown Boulevard',-62.5,11,74,11,6.1,7.4,1.75),
  street('garden','Garden Avenue',-62.5,31,74,31,4.5,5.1),
  street('west','Linden Avenue',-62.5,31,-62.5,-65,3.6,6.4),
  street('east','Eastbank Avenue',74,31,74,-65,4.7,6.4),
  street('court','Court Street',-62.5,-49,74,-49,4.35,5.5),
  street('linden','Linden Street',-62.5,-11.9,-13,-11.9,3.95,4.65),
  street('glass','Glass Street',13,-11.9,74,-11.9,3.95,4.65),
  street('westbank','Westbank Road',-62.5,-30,-12,-30,3.75,4.65),
  street('eastbank','Eastbank Road',12,-30,74,-30,3.75,4.65),
  street('civic','Civic Avenue',-62.5,-65,-8,-65,5.65,6.9,1.7),
  street('market','Market Avenue',8,-65,74,-65,5.65,6.9,1.7),
  street('station','Station Approach',0,-73,0,-77.8,4.9,4.4,1.65),
  street('meridian','Meridian Road',0,-57,0,-49,4.9,5.5),
  street('square','Clock Walk',0,8,0,45,2.9,0,0,false),
  street('mill','Mill Lane',-24,45,24,45,1.9,0,0,false),
  street('green-west','West Garden Walk',-10.4,13,-10.4,31,1.8,0,0,false),
  street('green-east','East Garden Walk',10.4,13,10.4,31,1.8,0,0,false),
] as const

export type LandmarkKind='hall'|'police'|'fire'|'hospital'|'market'|'petrol'|'school'|'station'|'bakery'|'cafe'|'books'|'florist'|'pharmacy'|'barber'|'office'|'restaurant'
type District='centre'|'finance'|'entertainment'|'civic'|'outskirts'
export type Landmark={id:LandmarkKind;name:string;district:District;x:number;z:number;w:number;d:number;h:number;facing:1|-1;street:string}
export const LANDMARKS:Landmark[]=[
  {id:'hall',name:'Meridian Town Hall',district:'centre',x:-7.7,z:21,w:10.4,d:8.8,h:5.6,facing:-1,street:'boulevard'},
  {id:'police',name:'Meridian Police',district:'civic',x:-52,z:-55.5,w:13,d:6.8,h:4.8,facing:-1,street:'civic'},
  {id:'fire',name:'Civic Fire Station',district:'civic',x:-32,z:-55,w:14,d:7.8,h:4.35,facing:-1,street:'civic'},
  {id:'hospital',name:'Northbank Hospital',district:'civic',x:15.7,z:-55.1,w:20,d:8,h:7.7,facing:-1,street:'market'},
  {id:'market',name:'Harvest Market',district:'outskirts',x:42,z:-54.9,w:15.6,d:7.6,h:4.45,facing:-1,street:'market'},
  {id:'petrol',name:'Meridian Petrol',district:'outskirts',x:63,z:-53.9,w:10,d:4,h:3.25,facing:-1,street:'market'},
  {id:'school',name:'Eastbank School',district:'civic',x:60.5,z:-76,w:20,d:9.4,h:6.1,facing:1,street:'market'},
  {id:'station',name:'Meridian Central',district:'outskirts',x:0,z:-81.8,w:16,d:4,h:5.1,facing:1,street:'station'},
  {id:'bakery',name:'Linden Bread & Butter',district:'centre',x:-27,z:-16.75,w:3.6,d:4.2,h:3.85,facing:1,street:'linden'},
  {id:'cafe',name:'Clockwork Café',district:'centre',x:27,z:-16.7,w:3.5,d:4.1,h:3.4,facing:1,street:'glass'},
  {id:'books',name:'Fable Books',district:'entertainment',x:-14.8,z:-17.3,w:4.55,d:6.3,h:4.35,facing:1,street:'linden'},
  {id:'florist',name:'The Foxglove',district:'entertainment',x:15,z:-17.3,w:4.4,d:4.2,h:3.25,facing:1,street:'glass'},
  {id:'pharmacy',name:'Northbank Pharmacy',district:'civic',x:28.65,z:-54.8,w:4.7,d:5.8,h:4.1,facing:-1,street:'market'},
  {id:'barber',name:'Linden Barber',district:'entertainment',x:-13.5,z:-35.9,w:4,d:5.3,h:3.65,facing:1,street:'westbank'},
  {id:'office',name:'Meridian Assurance',district:'finance',x:37.25,z:-6.0,w:6,d:7.25,h:8.9,facing:1,street:'boulevard'},
  {id:'restaurant',name:'The Blue Lantern',district:'entertainment',x:13.95,z:-35.4,w:4.4,d:5.7,h:4.05,facing:1,street:'eastbank'},
]
export const facade=(b:Landmark):Point=>point(b.x,b.z+b.facing*b.d/2)
export const frontage=(b:Landmark,clear=1.6)=>point(b.x,facade(b).z+b.facing*clear)

export const PARKS=[
  {id:'central',name:'Meridian Gardens',x:29,z:-75,w:34,d:13,sport:true},
  {id:'south',name:'Mill Green',x:23,z:39,w:13,d:8,sport:false},
  {id:'west',name:'Linden Green',x:-20,z:-55.6,w:9,d:7,sport:false}
]
export const PARK_FEATURES={
  picnic:[point(30.9,-77.9),point(31.4,-72.6)],
  gardensPlay:point(41,-79.07),
  schoolPlay:point(48.3,-76),
  fuel:point(63,-58.8),
}
export const pond={x:24,z:-75.7,w:9.4,d:4.3,bridge:24}
export const RAIL={north:-91,south:-86,stationEdge:10,z:-88.5}
export function railZ(x:number){
  return RAIL.z-4.8*(Math.min(1,Math.max(0,(Math.abs(x)-32)/105))**2)
}
export function railwayGround(x:number,z:number){
  return Math.max(0,Math.min(1,(11-Math.abs(z-railZ(x)))/5))
}
export function inLane(p:Point,s:Street,pad=0){
  const vertical=s.a.x===s.b.x
  const across=vertical?p.x:p.z,along=vertical?p.z:p.x,mid=vertical?s.a.x:s.a.z
  const [a,b]=vertical?[s.a.z,s.b.z]:[s.a.x,s.b.x]
  return Math.abs(across-mid)<s.width/2+pad&&along>Math.min(a,b)-pad&&along<Math.max(a,b)+pad
}
export const onRoad=(p:Point,pad=0)=>STREETS.some(s=>s.traffic&&inLane(p,s,pad))||
  Math.abs(distance(p,circle)-circle.radius)<circle.width/2+pad
export function nearestSidewalk(p:Point,street:Street){
  const vertical=street.a.x===street.b.x
  const along=vertical?p.z:p.x,mid=vertical?street.a.x:street.a.z
  const offset=(street.width+street.walk)/2*((vertical?p.x:p.z)<mid?-1:1)
  const [a,b]=vertical?[street.a.z,street.b.z]:[street.a.x,street.b.x]
  const at=Math.max(Math.min(a,b)+.15,Math.min(along,Math.max(a,b)-.15))
  return vertical?point(mid+offset,at):point(at,mid+offset)
}
export const crossing=(x:number,z:number,axis:'x'|'z',width:number,signal=false)=>({x,z,axis,width,signal})
export const CROSSINGS=[
  crossing(-7.7,11,'z',6.1,true),crossing(25,11,'z',6.1,true),crossing(59,11,'z',6.1),
  crossing(-51,-30,'z',3.75),crossing(54,-30,'z',3.75),crossing(0,-49,'z',4.35),
  crossing(-49,-65,'z',5.65),crossing(-22,-65,'z',5.65),crossing(28,-65,'z',5.65,true),crossing(59,-65,'z',5.65),
  crossing(-62.5,7,'x',3.6,true),crossing(74,7,'x',4.7,true),crossing(-62.5,-47,'x',3.6),crossing(74,-47,'x',4.7),
  crossing(0,-75.6,'x',4.9),crossing(0,31,'z',4.5)
] as const
export type VehicleKind='hatch'|'sedan'|'wagon'|'suv'|'van'|'truck'|'taxi'|'police'|'ambulance'|'fire'
export const FLEET:Record<VehicleKind,{w:number;length:number;height:number}>={
  hatch:{w:1.46,length:2.84,height:1.42},sedan:{w:1.54,length:3.38,height:1.36},wagon:{w:1.57,length:3.52,height:1.52},
  suv:{w:1.64,length:3.55,height:1.66},van:{w:1.66,length:3.78,height:1.93},truck:{w:1.73,length:4.18,height:2.1},
  taxi:{w:1.54,length:3.38,height:1.43},police:{w:1.58,length:3.5,height:1.52},ambulance:{w:1.78,length:4.35,height:2.12},fire:{w:1.88,length:4.6,height:2.26}
}
export type Parking=Point&{id:string;street:string;kind?:VehicleKind;yaw:number;paint?:number;use:string;accessX?:number}
export const PARKING:Parking[]=[
  {id:'police-1',x:-57.7,z:-60.7,street:'civic',kind:'police',yaw:Math.PI/2,use:'Police'},
  {id:'police-2',x:-52.8,z:-60.7,street:'civic',kind:'police',yaw:Math.PI/2,use:'Police'},
  {id:'fire-1',x:-37,z:-61,street:'civic',kind:'fire',yaw:Math.PI/2,use:'Fire service'},
  {id:'fire-2',x:-26.9,z:-61,street:'civic',kind:'fire',yaw:Math.PI/2,use:'Fire service'},
  {id:'ambulance',x:22,z:-60.5,street:'market',kind:'ambulance',yaw:Math.PI/2,use:'Emergency'},
  {id:'ambulance-2',x:26.8,z:-60.5,street:'market',kind:'ambulance',yaw:Math.PI/2,use:'Emergency'},
  {id:'hospital',x:15,z:-70.25,street:'market',yaw:-Math.PI/2,use:'Hospital',accessX:21.7},
  {id:'grocer',x:44,z:-60.7,street:'market',yaw:Math.PI/2,use:'Customer',accessX:50.5},
  {id:'loading',x:49.8,z:-53.6,street:'market',kind:'van',yaw:Math.PI/2,use:'Loading'},
  {id:'fuel',x:66.1,z:-60.45,street:'market',yaw:Math.PI/2,use:'Fuel',accessX:71.2},
  {id:'station-1',x:-4.15,z:-76.25,street:'station',kind:'taxi',yaw:0,use:'Taxi'},
  {id:'station-2',x:4.15,z:-76.25,street:'station',yaw:Math.PI,use:'Station',accessX:0},
  {id:'bank',x:-27,z:5.9,street:'boulevard',yaw:Math.PI/2,use:'Bank',accessX:-32},
  {id:'hotel',x:10,z:6.6,street:'boulevard',kind:'taxi',yaw:Math.PI/2,use:'Taxi'},
  {id:'linden',x:-47,z:-26,street:'westbank',yaw:Math.PI/2,use:'Residents',accessX:-51},
  {id:'eastbank',x:58,z:-25.8,street:'eastbank',yaw:Math.PI/2,use:'Visitors',accessX:63},
  {id:'court-west',x:-55,z:-25.8,street:'westbank',kind:'wagon',yaw:Math.PI/2,use:'Visitors'},
  {id:'court-east',x:51,z:-25.8,street:'eastbank',kind:'hatch',yaw:Math.PI/2,use:'Visitors'},
  {id:'garden',x:-33.4,z:34.6,street:'garden',kind:'suv',yaw:Math.PI/2,use:'Residents'},
  {id:'driveway',x:-44.4,z:-15.35,street:'linden',kind:'sedan',yaw:Math.PI/2,use:'Private'}
]
export const parkedCars=PARKING.flatMap(p=>p.kind?[{...p,kind:p.kind,speed:0,turn:0,brake:false}]:[])
export const PLACES=[
  {id:'square',name:'Clock Square',x:1.8,z:7.8},
  ...LANDMARKS.map(b=>({id:b.id,name:b.name,...frontage(b)})),
  {id:'bank',name:'Bank',x:-24,z:6.8},{id:'exchange',name:'Stock Exchange',x:24,z:6.9},
  {id:'hotel',name:'Hotel',x:0,z:-5.12},{id:'kfc',name:'Krulliversal Fried Chicken',x:63,z:6.65},
  {id:'gardens',name:'Meridian Gardens',x:30,z:-72.5},{id:'mill-green',name:'Mill Green',x:21,z:39},
  {id:'station-plaza',name:'Station Plaza',x:5.4,z:-78.7}
]
export const PREVIEW_BOUNDS={...baselineUrban,north:-93}
