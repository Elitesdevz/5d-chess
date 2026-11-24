import assert from 'node:assert/strict'
import test from 'node:test'
import {CityLife,cityRoute} from '../server/city-life.ts'
import {CityWorlds} from '../server/world.ts'
import {RouletteHall} from '../server/roulette-hall.ts'
import {ChessStore} from '../server/storage.ts'
import {area,baselineUrban,distance,extension,LANDMARKS,onRoad,PARKING,PLACES,point,railZ} from '../src/world/city-plan.ts'
import {assignResidents,routine} from '../src/world/city-residents.ts'
import {OFFICES,UNITS} from '../src/world/housing.ts'
import {outdoorWalkable,PLAN,worldMove} from '../src/world/model.ts'
import {BUILDINGS,residentialAt,residentialStep} from '../src/world/residential.ts'
import {TERRAIN_EXTENT,terrainHeight} from '../src/world/terrain.ts'
import {alongPath,CityTraffic,LANES,SIGNAL_HEADS,signalPhase,turnPath,vehicleContains} from '../src/world/traffic.ts'
import {ENTRANCES,pathClearance,STREET_PROPS,urbanObstacle} from '../src/world/urban-layout.ts'

test('the larger city has accessible approaches, clear sidewalks and continuous railway',()=>{
  const growth=area(extension)/area(baselineUrban)
  assert.ok(growth>=.25&&growth<=.40)
  assert.ok(ENTRANCES.length>=47)
  for(const e of ENTRANCES){
    assert.equal(outdoorWalkable(e.front.x,e.front.z),true,e.id)
    assert.equal(urbanObstacle(e.front.x,e.front.z),false,e.id)
    assert.ok(pathClearance(e.front),e.id)
    assert.ok(cityRoute(point(0,9),e.front).length>0,e.id)
  }
  const lots=[
    ...[...LANDMARKS,...OFFICES.map((b,i)=>({...b,id:'existing-office-'+i}))].map(b=>
      ({id:b.id,minX:b.x-b.w/2,maxX:b.x+b.w/2,minZ:b.z-b.d/2,maxZ:b.z+b.d/2})),
    ...Object.entries(PLAN).flatMap(([id,b])=>'width' in b?
      [{id,minX:b.x-b.width,maxX:b.x+b.width,minZ:b.z+b.back,maxZ:b.z+b.front}]:[]),
    ...BUILDINGS.map(b=>{
      const {l,r,b:n,f}=b.rect
      return {id:b.id,minX:b.x+Math.min(l*b.facing,r*b.facing),maxX:b.x+Math.max(l*b.facing,r*b.facing),
        minZ:b.z+Math.min(n*b.facing,f*b.facing),maxZ:b.z+Math.max(n*b.facing,f*b.facing)}
    }),
  ]
  for(const [i,b] of lots.entries())for(const a of lots.slice(0,i)){
    assert.ok(Math.min(a.maxX,b.maxX)<=Math.max(a.minX,b.minX)||Math.min(a.maxZ,b.maxZ)<=Math.max(a.minZ,b.minZ),a.id+' / '+b.id)
  }
  for(const p of STREET_PROPS.filter(s=>s.kind==='lamp'))assert.equal(onRoad(p,p.radius),false,p.id)
  for(const head of SIGNAL_HEADS)assert.equal(onRoad(head,.1),false,head.junction)
  for(const p of PARKING)assert.equal(pathClearance(p,-.25),false,p.id)
  for(let x=-TERRAIN_EXTENT;x<TERRAIN_EXTENT;x++){
    assert.ok(Math.abs(railZ(x)-railZ(x+1))<.10)
    assert.ok(Math.abs(terrainHeight(x,railZ(x))-.16)<.27)
  }
})

test('connected traffic circulates, yields on red, and parks without claiming a bay twice',()=>{
  for(const lane of LANES.values()){
    assert.ok(lane.next.length,lane.id)
    for(const id of lane.next){
      const next=LANES.get(id)
      assert.equal(lane.to,next.from)
      assert.ok(turnPath(lane,next).every(p=>onRoad(p,.50)),lane.id+' → '+next.id)
    }
  }
  const traffic=new CityTraffic(1000)
  const visited=new Set(),left=new Set(),stops=new Set()
  let movements=0
  for(let i=1;i<=1250;i++){
    const now=1000+i*240
    traffic.tick(now,[])
    const claimed=new Set()
    for(const trip of traffic.trips){
      const {v,lane}=trip
      if(v.parking){
        assert.ok(!claimed.has(v.parking),'duplicate parked vehicles in '+v.parking)
        claimed.add(v.parking);visited.add(v.id)
      }else if(visited.has(v.id))left.add(v.id)
      if(v.speed>.5)movements++
      if(!trip.link&&lane.length-trip.distance<4&&signalPhase(now,lane.to)!==lane.axis&&SIGNAL_HEADS.some(h=>h.junction===lane.to)&&v.brake)stops.add(v.id)
    }
    if(i%10===0){
      const all=traffic.vehicles
      for(const [index,v] of all.entries())for(const other of all.slice(0,index)){
        assert.equal(vehicleContains(v,other,0)&&vehicleContains(other,v,0),false,v.id+' / '+other.id)
      }
    }
  }
  assert.ok(movements>9000)
  assert.ok(traffic.trips.reduce((total,t)=>total+t.visits,0)>200)
  assert.ok(stops.size>=6)
  assert.ok(visited.size>=3)
  assert.ok(left.size>=3)
})

test('traffic waits for a pedestrian and both moving and parked cars block a player',()=>{
  const traffic=new CityTraffic(1000),trip=traffic.trips[0],vehicle=trip.v
  const pedestrian=alongPath(trip.lane.points,trip.distance+4)
  for(let i=1;i<=35;i++)traffic.tick(1000+i*75,[pedestrian])
  const stopped={...vehicle}
  assert.ok(stopped.brake)
  assert.ok(stopped.speed<.1)
  assert.equal(vehicleContains(pedestrian,stopped),false)
  const parked=traffic.vehicles.find(v=>v.id==='police-1')
  for(const v of [stopped,parked]){
    const x=v.x+Math.cos(v.yaw)*1.6,z=v.z-Math.sin(v.yaw)*1.6
    const from={x,z,yaw:0},result=worldMove('city',from,v.x,v.z,2,true,[],undefined,5000,[v])
    assert.ok(distance(result,v)>.8,v.id)
  }
  for(let i=36;i<=90;i++)traffic.tick(1000+i*75,[])
  assert.ok(distance(stopped,vehicle)>1)
})

test('residents have stable reserved homes and distinct valid routines',()=>{
  const now=10000,people=assignResidents({},now),units=new Map(UNITS.map(u=>[u.id,u]))
  assert.equal(people.length,36)
  assert.equal(new Set(people.map(r=>r.id)).size,people.length)
  assert.deepEqual(assignResidents({},now+1),people)
  const taken=people[0].home,leased=people[1].home
  const reassigned=assignResidents({[taken]:{holder:'Player',until:0},[leased]:{holder:'Tenant',until:now+1}},now)
  assert.deepEqual(reassigned.map(r=>r.id),people.map(r=>r.id))
  assert.ok(reassigned.every(r=>r.home!==taken&&r.home!==leased))
  for(const r of people){
    assert.equal(units.get(r.home).tenure,'resident')
    assert.equal(units.get(r.home).name,r.address)
    const day=Array.from({length:24},(_,hours)=>routine(r,hours*150000))
    assert.ok(day.some(s=>s.rest))
    assert.ok(day.some(s=>s.id===r.work))
    assert.ok(day.every(s=>s.id==='home'||PLACES.some(p=>p.id===s.id)))
  }
})

test('residents physically descend, return upstairs, use locked doors with their own keys and rest',()=>{
  const start=10*150000,life=new CityLife(start),state={doors:{},lifts:{}}
  life.population.splice(0,life.population.length,life.population[8],life.population[9])
  const [liftUser,stairUser]=life.population,levels=life.population.map(a=>a.zone)
  let usedLift=false,usedStairs=false
  for(let i=1;i<=770;i++){
    life.tick(start+i*240,state,[])
    usedLift ||= Boolean(liftUser.lift)
    usedStairs ||= stairUser.zone.startsWith('stairs:')
  }
  assert.equal(liftUser.zone,'city')
  assert.equal(stairUser.zone,'city')
  assert.ok(usedLift)
  assert.ok(usedStairs)
  for(let i=0;i<=635;i++)life.tick(23*150000+i*240,state,[])
  assert.deepEqual(life.population.map(a=>a.zone),levels)
  assert.ok(life.population.every(a=>a.homePose?.kind==='rest'))
  for(const a of life.population){
    assert.equal(residentialStep(a.zone,a.x,a.z,[],state,23*150000),false)
    assert.ok(residentialAt(a.zone).f.units.some(u=>u.id===a.resident.home))
  }
})

test('nearby players share one authoritative resident and traffic simulation',t=>{
  const store=new ChessStore('.',{memory:true}),hall=new RouletteHall(store)
  hall.stop();t.after(()=>store.close())
  const world=new CityWorlds(store,hall)
  store.transaction(unit=>{
    for(const name of ['StreetAlice','StreetBob'])unit.users.add(name,{name,hash:'',salt:''})
  })
  const now=12*150000
  world.update('StreetAlice','presence',{scene:true},now)
  world.update('StreetBob','presence',{scene:true},now)
  const view=name=>world.update(name,'presence',{scene:true},now+960)
  const a=view('StreetAlice'),b=view('StreetBob')
  assert.equal(a.id,b.id)
  assert.ok(a.residents.length>3)
  assert.deepEqual(a.residents,b.residents)
  assert.deepEqual(a.traffic,b.traffic)
})
