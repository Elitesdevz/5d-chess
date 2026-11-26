import test from 'node:test'
import assert from 'node:assert/strict'
import {clearSight} from '../src/world/sight.ts'
import {footprint,at,threshold} from '../src/world/civic-venues.ts'
import {BUILDINGS,homeZone,residentialSite} from '../src/world/residential.ts'
import {buildings,PLAN,site} from '../src/world/model.ts'
const scene={keys:[]}
const actor=(zone,p)=>({...p,zone})
function both(a,b,expected,state=scene){
  assert.equal(clearSight(a,b,state,1000),expected,JSON.stringify([a,b]))
  assert.equal(clearSight(b,a,state,1000),expected,JSON.stringify([b,a]))
}
test('every ground-floor public entrance admits sight across its opening and blocks the adjacent wall',()=>{
  for(const id of buildings){
    const f=PLAN[id].front,other=id==='casino'?'hotel':'city'
    for(const x of [0,2.8])both(actor(other,site(id,x,f+.65)),actor(id,site(id,x,f-.85)),x===0)
  }
  for(const id of ['station','gunshop']){
    const outside=actor('city',threshold(id,.85)),inside=actor(id,threshold(id,-1))
    both(outside,inside,true)
    both({...outside,x:outside.x+2.2},{...inside,x:inside.x+2.2},false)
    both(actor('city',at(id,footprint[id].w/2+.5,0)),actor(id,at(id,footprint[id].w/2-.6,0)),false)
  }
})
test('a closed residential door occludes the same segment that its open leaf clears',()=>{
  const b=BUILDINGS.find(h=>h.id==='house-0'),door=b.levels[0].doors.find(d=>d.id===b.id)
  const a=actor('city',residentialSite(b,door.x,door.z+.7)),c=actor(homeZone(b.id,0),residentialSite(b,door.x,door.z-.7))
  both(a,c,false)
  both(a,c,true,{keys:[],residential:{doors:{[door.id]:500},lifts:{}}})
})
test('stacked floors, closed motel rooms, vehicles, and isolated sessions block sight',()=>{
  const a=actor('station',at('station',2.7,0))
  both(a,{...a,zone:'precinct:1'},false)
  both(actor('bank',{x:-24,z:6}),actor('private',{x:-24,z:6}),false)
  const b=actor('hotel:2',site('hotel:2',1,1.5)),c=actor('hotel:2',site('hotel:2',3,1.5))
  both(b,c,false);both(b,c,true,{keys:['hotel-202']})
  const left=actor('city',{x:18,z:10}),right=actor('city',{x:18,z:13})
  both(left,right,true)
  both(left,right,false,{keys:[],vehicles:[{kind:'suv',x:18,z:11.6,yaw:0}]})
})
