import test from 'node:test'
import assert from 'node:assert/strict'
import {LANDMARKS,PARKING,STREETS} from '../src/world/city-plan.ts'
import {BUILDINGS} from '../src/world/residential.ts'
import {at,cells,footprint,galleryZone,origins,venueWalk} from '../src/world/civic-venues.ts'

test('both Civic Avenue parcels clear the streets, sidewalks, parking and neighboring buildings',()=>{
  const neighbors=[
    ...LANDMARKS.filter(b=>b.id!=='police'),
    ...BUILDINGS.map(b=>({id:b.id,x:b.x+b.facing*(b.rect.r+b.rect.l)/2,z:b.z+b.facing*(b.rect.f+b.rect.b)/2,w:b.rect.r-b.rect.l,d:b.rect.f-b.rect.b})),
    ...STREETS.map(s=>{
      const width=s.width+s.walk*2,vertical=s.a.x===s.b.x
      return {id:s.id,x:(s.a.x+s.b.x)/2,z:(s.a.z+s.b.z)/2,w:vertical?width:Math.abs(s.a.x-s.b.x),d:vertical?Math.abs(s.a.z-s.b.z):width}
    }),
    ...PARKING.map(b=>{
      const sin=Math.abs(Math.sin(b.yaw)),cos=Math.abs(Math.cos(b.yaw))
      return {...b,w:sin*4.5+cos*1.85,d:cos*4.5+sin*1.85}
    }),
  ]
  for(const [id,f] of Object.entries(footprint)){
    const o=origins[id]
    for(const n of neighbors)assert.ok(Math.abs(o.x-n.x)>=(f.w+n.w)/2||Math.abs(o.z-n.z)>=(f.d+n.d)/2,id+' overlaps '+n.id)
  }
})

test('every assigned cell faces a public gallery behind its locked boundary',()=>{
  assert.deepEqual(cells.map(c=>c.number),Array.from({length:50},(_,i)=>i+1))
  for(const cell of cells){
    const zone=galleryZone(cell.number),corridor=at(zone,cell.x,0),bed=at(zone,cell.x,cell.z)
    assert.ok(venueWalk(zone,corridor.x,corridor.z))
    assert.equal(venueWalk(zone,bed.x,bed.z),false)
    assert.equal(cells.filter(c=>c.level===cell.level&&c.wing===cell.wing).length,5)
  }
})
