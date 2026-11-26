import assert from 'node:assert/strict'
import {cityRoute} from '../server/city-life.ts'
import {at,entrances,insideDoor,stair} from '../src/world/civic-venues.ts'

export function visitorRoute(action,advance){
  let view
  async function read(){view=await action('presence',{});return view}
  async function walk(p){
    for(let i=0;i<60;i++){
      if(Math.hypot(view.you.x-p.x,view.you.z-p.z)<.065)return true
      const before=view.you;advance(850)
      view=await action('presence',{world:view.id,...p,yaw:p.yaw??0})
      if(Math.hypot(view.you.x-before.x,view.you.z-before.z)<.015)return false
    }
    return false
  }
  async function outside(goal){
    for(let i=0;i<15;i++){
      const path=cityRoute(view.you,goal,i?view.traffic?.vehicles:[])
      assert.ok(path.length,'connected street network')
      let free=true
      for(const step of [...path,goal])if(!await walk(step)){free=false;break}
      if(free)return
    }
    assert.fail('Street approach blocked at '+JSON.stringify(view.you)+' toward '+JSON.stringify(goal))
  }
  async function use(target){view=await action('use',{target});return view}
  async function enter(id){
    await read()
    if(view.you.zone==='bank')assert.ok(await walk({x:-24,z:5.65}))
    assert.equal(view.you.zone,'city')
    await outside(entrances[id]);const p=insideDoor(id)
    assert.ok(await walk({...at(id,p.x,p.z),yaw:p.yaw}));return view
  }
  async function step(x,z){assert.ok(await walk(at('station',x,z)),JSON.stringify({x,z,from:view.you}))}
  async function climb(){
    await step(stair.up,0);await step(stair.up,2.90);await step(stair.down,2.90)
    await step(stair.down,stair.start-.38);return view
  }
  async function descend(){
    await step(stair.down,stair.start-.53)
    await step(stair.down,2.90);await step(stair.up,2.90);await step(stair.up,0)
    return view
  }
  return {read,walk,outside,use,enter,climb,descend,step,get view(){return view}}
}
