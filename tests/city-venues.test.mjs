import test from 'node:test'
import assert from 'node:assert/strict'
import {ChessStore} from '../server/storage.ts'
import {RouletteHall} from '../server/roulette-hall.ts'
import {CityWorlds} from '../server/world.ts'
import {pack} from '../server/city-inventory.ts'
import {BITE_MS} from '../src/world/food.ts'
import {storefront,storefrontPoints} from '../src/world/storefronts.ts'
import {LANDMARKS,frontage} from '../src/world/city-plan.ts'
import {outdoorWalkable,site,walkingHeight,worldMove} from '../src/world/model.ts'
import {buildingById,homeZone,residentialSite} from '../src/world/residential.ts'
import {crownBlock,TOWERS,UNITS} from '../src/world/housing.ts'

function guest(t){
  const db=new ChessStore('.',{memory:true}),hall=new RouletteHall(db)
  hall.stop();t.after(()=>db.close())
  db.transaction(tx=>{
    tx.users.add('Guest',{name:'Guest',hash:'',salt:'',wallet:{coins:5000,starterGranted:true,inventory:[],loadout:{pieces:{},icon:'default'}}})
    pack(tx.users.get('Guest')).hp=42
  })
  let now=Date.now(),world=new CityWorlds(db,hall),view
  const act=(op,data={},dt=25)=>view=world.update('Guest',op,{...data,scene:true},now+=dt)
  function walk(x,z){
    for(let i=0;i<32&&Math.hypot(x-view.you.x,z-view.you.z)>.05;i++)act('presence',{world:view.id,x,z,yaw:0},500)
    assert.ok(Math.hypot(x-view.you.x,z-view.you.z)<.08,'walk to '+[x,z])
  }
  function reconnect(){world=new CityWorlds(db,hall)}
  act('presence')
  return {db,act,walk,reconnect}
}

test('every town storefront has a continuous walk from pavement to counter',()=>{
  for(const b of LANDMARKS.filter(b=>b.id!=='police')){
    const [outside,desk]=storefrontPoints.filter(p=>p.id==='front:'+b.id)
    const start=frontage(b,1.15),arrive=worldMove('city',{...start,yaw:0},desk.x,desk.z,15)
    assert.ok(Math.hypot(arrive.x-desk.x,arrive.z-desk.z)<.01,b.name)
    const leave=worldMove('city',arrive,outside.x,outside.z,15)
    assert.ok(Math.abs(leave.z-outside.z)<.01,b.name+' exit')
  }
})

test('street counters require a visit and a hotbar bite settles once across reconnection',t=>{
  for(const p of storefrontPoints)assert.ok(outdoorWalkable(p.x,p.z),p.id)
  const {act,walk,reconnect}=guest(t),stall=storefront('front:stall-0')
  const purchase={operation:'groceries',item:'apple',sequence:0}
  assert.throws(()=>act('arcade',purchase),/Visit the counter/)
  walk(0,11);walk(stall.x,11);walk(stall.x,stall.z)
  act('use',{target:'front:stall-0'})
  let v=act('arcade',purchase)
  assert.equal(v.coins,4996)
  assert.throws(()=>act('arcade',purchase),/Inventory changed/)
  assert.throws(()=>act('arcade',{...purchase,sequence:v.arcade.sequence,item:'tea'}),/available service/)
  const bite={operation:'eat',slot:0,item:'apple',sequence:v.arcade.sequence}
  v=act('arcade',bite)
  assert.equal(v.arcade.bite.item,'apple');assert.equal(v.arcade.slots[0],null);assert.equal(v.arcade.hp,42)
  assert.throws(()=>act('arcade',bite),/Inventory changed/)
  reconnect()
  v=act('presence',{},BITE_MS-100)
  assert.equal(v.arcade.hp,42)
  v=act('presence',{},100)
  assert.equal(v.arcade.hp,62);assert.equal(v.arcade.bite,undefined)
  assert.equal(act('presence',{},BITE_MS).arcade.hp,62)
})

test('Exchange Crown connects the trading lift, housing clerk, residential lift and keyed apartment',t=>{
  const {act,walk}=guest(t)
  const tower=buildingById.get('block-'+crownBlock),unit=UNITS.find(u=>u.block===crownBlock)
  for(const t of TOWERS)assert.ok(UNITS.some(u=>u.name.startsWith(t.name+' · ')))
  let v=act('teleport',{to:'stocks'})
  const local=(x,z)=>{const p=site('exchange',x,z);walk(p.x,p.z)}
  local(3,4);local(3,-3.7);local(0,-3.7);local(0,-5.48)
  act('use',{target:'elevator'});v=act('floor',{symbol:'residences'})
  assert.equal(v.you.zone,homeZone(tower.id,0))
  assert.ok(walkingHeight(v.you.zone,v.you.x,v.you.z)>600)
  const lobby=(x,z)=>{const p=residentialSite(tower,x,z);walk(p.x,p.z)}
  lobby(.65,0);lobby(-1.74,-.23);act('use',{target:'property:desk-'+crownBlock})
  v=act('housing',{unit:unit.id});assert.ok(v.housing.keys.includes(unit.id))
  lobby(tower.lift.x,1.37);lobby(tower.lift.x,3.02);act('use',{target:'lift:'+tower.id})
  act('home-floor',{level:unit.floor});v=act('presence',{},3000)
  assert.equal(v.you.zone,homeZone(tower.id,unit.floor))
  const entry=tower.levels[unit.floor].doors.find(d=>d.unit===unit.id)
  lobby(tower.lift.x,1.07);lobby(entry.x+.72,entry.z);act('use',{target:'door:'+unit.id})
  lobby(entry.x-.85,entry.z)

})
