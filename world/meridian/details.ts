import {distance,point,facade,nearestSidewalk,distSegment,inLane,type Point,type Landmark} from '../../src/world/geo.ts'
import type {Footpath,StreetProp} from '../../src/world/urban-layout.ts'
import type {HomePoint,Building} from '../../src/world/residential.ts'
import type {Resolved} from './parcels.ts'
import type {Venue} from '../../src/world/civic-venues.ts'
import type {civicParcels} from './parcels.ts'
import type {laneNetwork} from './lanes.ts'
export function streetDetails(s:Resolved, BUILDINGS:Building[], civic:ReturnType<typeof civicParcels>, SIGNAL_HEADS:ReturnType<typeof laneNetwork>['signalHeads']){
  const {streets:STREETS,circle,parking:PARKING,parks:PARKS,parkFeatures:PARK_FEATURES,market:MARKET,offices:OFFICES,boulevardTrees:BOULEVARD_TREES,overrides}=s
  const LANDMARKS:Landmark[]=s.landmarks
  const {origins,footprint,front}=civic
  const threshold=(id:Venue,offset:number)=>point(origins[id].x+front[id].x,origins[id].z+front[id].z+offset*front[id].sign)
  const entrances={station:threshold('station',.75),gunshop:threshold('gunshop',.75)}
  const residentialSite=(b:Building,x:number,z:number)=>point(b.x+x*b.facing,b.z+z*b.facing)
  const contains=(r:Building['rect'],x:number,z:number,pad:number)=>x>r.l-pad&&x<r.r+pad&&z>r.b-pad&&z<r.f+pad
  const onRoad=(p:Point,pad:number)=>STREETS.some(r=>r.traffic&&inLane(p,r,pad))||Math.abs(distance(p,circle)-circle.radius)<circle.width/2+pad
  const fountain=point(s.square.x+s.square.fountain.across,s.square.z+s.square.fountain.along)
  const guide={id:'clock-directory',kind:'notice' as const,label:'Clock Square',yaw:s.square.directory.yaw,
    ...point(s.square.x+s.square.directory.across,s.square.z+s.square.directory.along)}
  const roomEntrances=(['hotel','bank','exchange','kfc'] as const).map(id=>({id,...point(s.rooms[id].x,s.rooms[id].z+s.rooms[id].front)}))
  const access=(id:string,start:Point,end:Point,w=1.55):Footpath=>({id,points:[start,end],width:w,purpose:'entry'})
  const ENTRANCES=[
    ...BUILDINGS.map(b=>{
      const at=residentialSite(b,0,b.rect.f),parcel=b.block===undefined?s.houses.find(h=>h.id===b.id)!:s.apartments[b.block],road=STREETS.find(r=>r.id===parcel.street)!
      return {...at,id:b.id,front:residentialSite(b,0,b.rect.f+.87),road}
    }),
    ...Object.entries(entrances).map(([key,front])=>({...threshold(key as Venue,0),id:key==='station'?'police':key,front,road:STREETS.find(r=>r.id===(key==='gunshop'?s.shop.street:LANDMARKS.find(b=>b.id===s.precinct.landmark)!.street))!})),
    ...LANDMARKS.filter(b=>b.id!=='police').map(b=>({...facade(b),id:b.id,front:point(b.x,facade(b).z+.83*b.facing),road:STREETS.find(s=>s.id===b.street)!})),
    ...roomEntrances.map(e=>({...e,front:point(e.x,e.z+.8),road:STREETS.find(r=>r.id===s.rooms[e.id].street)!})),
  ]
  const route=(id:string,points:Point[],width:number,purpose:Footpath['purpose']='walk'):Footpath=>({id,points,width,purpose})
  const PATHS:Footpath[]=[
    ...ENTRANCES.map(e=>access(e.id,e.front,nearestSidewalk(e.front,e.road),e.id.startsWith('block-')?2.1:1.45)),
    ...s.paths as Footpath[],
  ]
  // Split the hotel approach around the fountain. The two signed promenades meet at the forecourt.
  const hotelWalk=PATHS.find(p=>p.id==='hotel')!
  const [door,walk]=hotelWalk.points
  for(const side of [-1,1]){
    const path=[door,point(fountain.x+side*3.85,door.z+1.2),point(fountain.x+side*3.85,fountain.z+3.9),point(walk.x+side*1.65,walk.z)]
    if(side===1)hotelWalk.points=path
    else PATHS.push(route('hotel-west',path,1.45,'entry'))
  }
  for(const bay of PARKING){
    const street=STREETS.find(s=>s.id===bay.street)!
    const road=street.a.x===street.b.x?point(street.a.x,bay.z):point(bay.accessX??bay.x,street.a.z)
    const edge=point((road.x+bay.x)/2,(road.z+bay.z)/2)
    PATHS.push(route(bay.id,[road,edge,point(bay.x,bay.z)],2.25,'drive'))
  }
  function pathClearance(p:Point,pad=0){
    return PATHS.some(path=>path.purpose!=='drive'&&path.points.slice(1).some((b,i)=>distSegment(p,path.points[i],b)<path.width/2+pad))
  }
  const STREET_PROPS:StreetProp[]=[]

  function add(kind:StreetProp['kind'],x:number,z:number,yaw:number,radius:number,label?:string,style?:number,id?:string){
    const p=point(x,z)
    if(s.keepClear.some(k=>Math.abs(x-k.x)<k.w/2+radius&&Math.abs(z-k.z)<k.d/2+radius))return false
    if(onRoad(p,radius+.14)||SIGNAL_HEADS.some(h=>distance(h,p)<radius+.44)||pathClearance(p,radius+.12)||PARKING.some(b=>distance(p,b)<radius+2.56)||
      ENTRANCES.some(e=>distance(p,e.front)<radius+1.8)||solidStructure(x,z,radius+.12)||
      MARKET.some(([a,b])=>Math.hypot(x-a,z-b)<2.1+radius)||
      BOULEVARD_TREES.some(a=>Math.abs(Math.abs(x)-a)<.72+radius&&Math.abs(z-14.85)<.55+radius)||
      STREET_PROPS.some(q=>distance(p,q)<q.radius+radius+.29))return false
    const prop={id:id??kind+'-'+STREET_PROPS.length,kind,x,z,yaw,radius,label,style}
    STREET_PROPS.push(prop)
    return true
  }
  function solidStructure(x:number,z:number,pad:number){
    if(Object.entries(footprint).some(([id,f])=>{const o=origins[id as Venue];return Math.abs(x-o.x)<f.w/2+pad&&Math.abs(z-o.z)<f.d/2+pad}))return true
    if(LANDMARKS.some(b=>Math.abs(x-b.x)<b.w/2+pad&&Math.abs(z-b.z)<b.d/2+pad))return true
    if(OFFICES.some(b=>Math.abs(x-b.x)<b.w/2+pad&&Math.abs(z-b.z)<b.d/2+pad))return true
    if(BUILDINGS.some(b=>contains(b.rect,(x-b.x)*b.facing,(z-b.z)*b.facing,pad)))return true
    return Object.values(s.rooms).some(r=>'width' in r&&Math.abs(x-r.x)<r.width+pad&&z>r.z+r.back-pad&&z<r.z+r.front+pad)
  }
  for(const [index,s] of STREETS.entries()){
    if(!s.traffic)continue
    const span=distance(s.a,s.b),dx=(s.b.x-s.a.x)/span,dz=(s.b.z-s.a.z)/span
    for(let i=8;i<span-5;i+=13){
      const side=(Math.round(i/13)+index)%2?1:-1,d=(s.width/2+s.walk+.47)*side
      const x=s.a.x+dx*i-dz*d,z=s.a.z+dz*i+dx*d
      add('lamp',x,z,Math.atan2(dx,dz),.24,undefined,overrides[s.id]?.lampStyle??(s.limit>6?1:0))
      if(i===8)add('sign',x+dx*1.4,z+dz*1.4,Math.atan2(dx,dz),.24,s.name)
      if(i>12&&Math.round(i)%3===0)add('hydrant',x-dx*2.1,z-dz*2.1,0,.22)
    }
  }
  for(const {x,z,facing:f} of s.houses){
    const dir=f===1?0:Math.PI
    add('mail',x+f*2.35,z+f*4.19,dir,.22)
    if(x%2)add('tree',x-f*2.72,z+f*4.35,0,.37,undefined,2)
  }
  for(const b of s.furnitureGroups){
    const area=b.area==='square'?s.square:s.parks.find(p=>p.id===b.area)??ENTRANCES.find(e=>e.id===b.area)
    if(!area)throw Error('furniture: unknown anchor '+b.area)
    const x=area.x+b.across,z=area.z+b.along,yaw=b.reverse?Math.PI:0
    if(b.seat&&!add('bench',x,z,yaw,1.01,undefined,undefined,b.seat))throw Error(b.seat+': no clear space at '+b.area)
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
    add('tree',x,z,0,.37,undefined,overrides[park.id]?.treeStyle??((s.seed+i+park.id.length)%3))
    if(i===2)add('lamp',x+1.15,z,0,.21,undefined,0)
  }

  for(const rule of s.frontageDetails){
    const e=ENTRANCES.find(e=>e.id===rule.parcel)
    if(!e)throw Error('frontageDetails: unknown parcel '+rule.parcel)
    if(rule.kind!=='lamp'&&rule.kind!=='bench')throw Error(rule.parcel+': unknown frontage detail '+rule.kind)
    const walk=nearestSidewalk(e.front,e.road),length=distance(e.road.a,e.road.b)
    const dx=(e.road.b.x-e.road.a.x)/length,dz=(e.road.b.z-e.road.a.z)/length
    const side=Math.sign((e.front.z-e.road.a.z)*dx-(e.front.x-e.road.a.x)*dz)||1
    const normal=point(-dz*side,dx*side),yaw=Math.atan2(normal.x||0,normal.z)
    const radius=rule.kind==='bench'?1.01:.24
    let placed=false
    for(const shift of [2.4,3.8,5.1,6.5,8.1,9.6]){
      const gap=e.road.walk/2+radius+.3
      const x=walk.x+dx*rule.side*shift+normal.x*gap
      const curbZ=walk.z+dz*rule.side*shift+normal.z*gap
      const z=rule.doorOffset!==undefined?e.z+Math.sign(e.front.z-e.z)*rule.doorOffset:curbZ
      if(Math.abs(Math.abs(x-fountain.x)-6.25)<radius+.65&&[4,-3].some(d=>Math.abs(z-fountain.z-d)<radius+2))continue
      if(distance({x,z},guide)<radius+1.6)continue
      if(add(rule.kind,x,z,yaw,radius,undefined,1,'frontage-'+e.id+'-'+rule.kind)){placed=true;break}
    }
    if(!placed)throw Error(e.id+': no clear frontage for '+rule.kind+'; change its side or doorOffset')
  }
  const park=PARKS.find(p=>p.id==='central')!
  add('notice',park.x+3,park.z+5.45,Math.PI,.63,park.name,undefined,'park-directory')
  const PUBLIC_SEATS:HomePoint[]=STREET_PROPS.filter(p=>p.kind==='bench').flatMap(p=>[-.48,.48].map((dx,i)=>{
    const c=Math.cos(p.yaw),s=Math.sin(p.yaw),x=p.x+c*dx,z=p.z-s*dx,id=p.id+'-'+i
    const exit={x:x-s*.75,z:z-c*.75}
    return {...exit,id:'furniture:'+id,label:'Sit on bench',range:.86,exit,pose:{x,z,yaw:p.yaw,id,kind:'sit',height:.47}}
  }))
  const hardscape=[
    ...PARK_FEATURES.picnic.map(p=>({...p,w:.98,d:.62})),
    {...PARK_FEATURES.gardensPlay,w:.83,d:.70},
    {x:46.03,z:PARK_FEATURES.schoolPlay.z,w:.105,d:3.30},
    ...[-3.75,-2.5,0,2.5,3.75].map(dx=>({x:PARK_FEATURES.fuel.x+dx,z:PARK_FEATURES.fuel.z,w:.32,d:.41})),
  ]

  return {guide,fountain:{...fountain,radius:s.square.fountain.radius},entrances:ENTRANCES,paths:PATHS,props:STREET_PROPS,seats:PUBLIC_SEATS,hardscape}
}
