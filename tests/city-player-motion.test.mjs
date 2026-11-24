import assert from 'node:assert/strict'
import test from 'node:test'
import {PlayerMotion} from '../src/world/player-motion.ts'
import {floorHeight} from '../src/world/model.ts'

const player=(x,z,yaw=0)=>({name:'Walker',avatar:'default',online:true,zone:'city',x,z,yaw})
const point=()=>({x:0,z:0,yaw:0,height:0,zone:'city'})

test('a remote avatar moves continuously between confirmed positions and takes the short turn across π',()=>{
  const path=new PlayerMotion(),sample=point()
  path.push(player(0,8,Math.PI-.1),1000)
  path.push(player(1.2,8,-Math.PI+.1),1320)
  path.sample(1450,sample)
  const first=sample.x
  assert.ok(first>0&&first<1.2)
  assert.ok(Math.abs(sample.yaw)>3)
  path.sample(1510,sample)
  assert.ok(sample.x>first&&sample.x<1.2)
  path.sample(1800,sample)
  assert.equal(sample.x,1.2)
  path.push(player(0,8),1210) // An older response cannot rewind the peer.
  path.sample(1950,sample)
  assert.equal(sample.x,1.2)
})

test('teleports and seating take effect at once without drawing an invented walking path',()=>{
  const path=new PlayerMotion(),sample=point()
  path.push(player(0,8),2000)
  path.push(player(30,-15),2250)
  path.sample(2250,sample)
  assert.deepEqual([sample.x,sample.z],[30,-15])
  path.push({...player(30.52,-15),homePose:{id:'bench-A',kind:'sit'}},2500)
  path.sample(2500,sample)
  assert.equal(sample.x,30.52)
})

test('a remote rider stays at the current elevator height while walking uses buffered samples',()=>{
  const path=new PlayerMotion(),sample=point()
  const lift={to:'floor:CAS',started:2000,ends:4000}
  const rider={...player(24,-7.8),zone:'exchange',lift}
  path.push({...rider,lift:undefined},1900)
  path.push(rider,2000)
  path.sample(3000,sample)
  assert.equal(sample.height,floorHeight(lift.to)/2)
  path.push({...rider,zone:lift.to,lift:undefined},4000)
  path.sample(4000,sample)
  assert.equal(sample.height,floorHeight(lift.to))
  assert.equal(sample.zone,lift.to)
})
