import test from 'node:test'
import assert from 'node:assert/strict'
import {ChessStore} from '../server/storage.ts'
import {CityWorlds} from '../server/world.ts'
import {RouletteHall} from '../server/roulette-hall.ts'
import {casinoBet} from '../server/casino.ts'
import {DICE_TABLE_INDEX,LIFT,worldMove,floorHeight,riderHeight,site} from '../src/world/model.ts'

import {HOMES,passableLand,terrainHeight} from '../src/world/terrain.ts'

function fixture(t,count=2){
  const store=new ChessStore('.',{memory:true}),roulette=new RouletteHall(store),world=new CityWorlds(store,roulette)
  roulette.stop()
  t.after(()=>store.close())
  const names=Array.from({length:count},(_,i)=>'Walker'+i)
  store.transaction(unit=>{for(const name of names)unit.users.add(name,{name,hash:'',salt:'',wallet:{coins:1000,starterGranted:true,inventory:[],loadout:{icon:'default',pieces:{}}}})})
  let now=Date.now()
  const action=(name,action,data={},delay=1)=>world.update(name,action,{scene:true,...data},now+=delay)
  const move=(name,x,z)=>{
    let view=action(name,'presence')
    for(let i=0;i<23;i++){
      if(Math.hypot(view.you.x-x,view.you.z-z)<.14)return view
      const zone=view.you.zone,next=action(name,'presence',{world:view.id,zone,x,z,yaw:0},900)
      if(next.you.zone==='private')return next
      view=next
    }
    return view
  }
  const room=(name,zone,x,z)=>{const p=site(zone,x,z);return move(name,p.x,p.z)}
  return {store,world,names,action,move,room}
}
test('city holds fifty across zones and keeps excess arrivals separate',t=>{
  const {names,action}=fixture(t,51)
  const first=action(names[0],'teleport',{to:'bank'})
  for(const name of names.slice(1,50))assert.equal(action(name,'presence').id,first.id)
  assert.notEqual(action(names[50],'presence').id,first.id)
  assert.equal(action(names[0],'presence').players.length,49)
  const other=action(names[1],'teleport',{to:'bank'})
  assert.equal(other.id,first.id)
  assert.ok(other.players.some(p=>p.name===names[0]))
  assert.ok(other.players.every(p=>p.name!==names[50]))
})

test('public dice shares one result and a locked bet survives leaving the casino',t=>{
  const {store,names,action,move,room}=fixture(t),[alice,bob]=names
  for(const name of names){
    const hotel=action(name,'teleport',{to:'casino'})
    assert.equal(hotel.you.zone,'hotel')
    assert.equal(room(name,'casino',0,8.45).you.zone,'casino')
    const target=site('casino',6.1,5.3),close=move(name,target.x,target.z)
    assert.ok(Math.hypot(close.you.x-target.x,close.you.z-target.z)<.2)
    assert.equal(action(name,'use',{target:'seat:'+DICE_TABLE_INDEX}).you.chair.table,DICE_TABLE_INDEX)
  }
  const table=action(alice,'presence').hall.tables[DICE_TABLE_INDEX]
  const bet={round:table.round,stake:10,choice:3,requestId:'world-alice-bet'}
  assert.equal(action(alice,'bet',bet).coins,990)
  assert.equal(action(alice,'teleport',{to:'casino'}).you.zone,'hotel')
  const spinning=action(bob,'bet',{...bet,choice:4,requestId:'world-bob-bet'}).hall.tables[DICE_TABLE_INDEX]
  assert.equal(spinning.phase,'spin')
  assert.ok(spinning.spin.pocket>=1&&spinning.spin.pocket<=6)
  assert.deepEqual(action(alice,'presence').tableMotion[DICE_TABLE_INDEX].spin,spinning.spin)
  const finished=action(bob,'presence',{},3300)
  assert.equal(finished.hall.tables[DICE_TABLE_INDEX].prizes.length,2)
  assert.equal(JSON.parse(store.accountJson(alice)).casino.recent[0].result,finished.hall.receipt.result)
})

test('the entrance is once per Dutch day and the private room has no public presence or profit tax',t=>{
  const {store,names,action,move,room}=fixture(t),[alice,bob]=names
  action(alice,'presence')
  move(alice,0,58);move(alice,-40,68)
  const mouth=move(alice,-40,73.25)
  assert.equal(mouth.you.zone,'cave')
  assert.ok(Math.abs(mouth.you.z-73.25)<.14)
  const hid=room(alice,'cave',0,-7.35)
  assert.equal(hid.you.zone,'private')
  assert.deepEqual(hid.players,[])
  assert.equal(action(bob,'presence').players.some(p=>p.name===alice),false)
  const settled=store.transaction(unit=>casinoBet(unit.users.get(alice),[],{game:'dice',choice:2,stake:10,requestId:'world-cave-bet1',sequence:1},hid.now,2,true))
  assert.equal(settled.round.tax,0)
  assert.equal(settled.round.gross,59.85)
  const exited=action(alice,'teleport',{to:'bank'})
  assert.equal(exited.you.zone,'oasis')
  assert.equal(exited.caveOpen,false)
  const exit=move(alice,40,72.65)
  assert.equal(exit.you.zone,'city')
  assert.ok(Math.abs(exit.you.z-72.65)<.14)
  assert.equal(action(alice,'teleport',{to:'bank'}).you.zone,'bank')
  assert.equal(JSON.parse(store.accountJson(alice)).cave.active,false)
  store.transaction(unit=>unit.users.get(bob).wallet.coins=0)
  assert.equal(action(bob,'presence').caveOpen,false)
  move(bob,0,58);move(bob,-40,68)
  assert.equal(move(bob,-40,74).you.zone,'city')
})

test('tower floors and bank transactions require the right physical interaction',t=>{
  const {world,names,action,room}=fixture(t),[name]=names
  action(name,'teleport',{to:'stocks'})
  assert.throws(()=>action(name,'floor',{symbol:'AAPL'}),{status:409})
  room(name,'exchange',-2.45,2)
  room(name,'exchange',-2.45,-3.52)
  room(name,'exchange',0,-3.52)
  const transport=room(name,'exchange',LIFT.x,LIFT.z)
  assert.equal(transport.interaction,'elevator')
  const riding=action(name,'floor',{symbol:'AAPL'})
  assert.equal(riding.you.zone,'exchange')
  assert.equal(riding.you.lift.to,'floor:AAPL')
  assert.ok(riderHeight(riding.you,(riding.you.lift.started+riding.you.lift.ends)/2)>0)
  const landed=action(name,'presence',{},riding.you.lift.ends-riding.now+1)
  assert.equal(landed.you.zone,'floor:AAPL')
  assert.equal(riderHeight(landed.you,landed.now),floorHeight('floor:AAPL'))
  assert.equal(landed.you.x,transport.you.x)
  assert.equal(landed.you.z,transport.you.z)
  assert.equal(landed.you.yaw,Math.PI)
  assert.equal(landed.interaction,undefined)
  assert.equal(world.canTrade(name,'AAPL'),false)
  room(name,'floor:AAPL',0,-.42)
  room(name,'floor:AAPL',-2.7,-.42)
  const desk=action(name,'use',{target:'trader'})
  assert.equal(world.canTrade(name,'AAPL',desk.now),true)
  assert.equal(world.canTrade(name,'MSFT',desk.now),false)
  action(name,'teleport',{to:'bank'})
  room(name,'bank',-2.9,.75)
  action(name,'use',{target:'loans'})
  assert.equal(world.canBank(name,'borrow',desk.now),true)
  assert.equal(world.canBank(name,'repay',desk.now),false)
})


test('hotel and casino doors preserve position, heading and visibility across the threshold',t=>{
  const {names,action,move,room}=fixture(t),[walker,observer]=names
  action(observer,'teleport',{to:'casino'})
  move(walker,3,8);move(walker,3,-5.6);move(walker,0,-5.6)
  const crossed=move(walker,0,-7.35)
  assert.equal(crossed.you.zone,'hotel')
  assert.ok(Math.abs(crossed.you.z+7.35)<.14)
  assert.equal(crossed.you.yaw,0)
  assert.ok(action(observer,'presence').players.some(p=>p.name===walker))
  const casino=room(walker,'casino',0,8.51)
  assert.equal(casino.you.zone,'casino')
  assert.ok(Math.abs(casino.you.z-site('casino',0,8.51).z)<.14)
  assert.ok(casino.players.some(p=>p.name===observer))
  room(walker,'casino',4,8.38)
  const wall=room(walker,'hotel',4,-7.1)
  assert.equal(wall.you.zone,'casino')
})

test('each home opens onto the street and its walls and furniture stop movement',()=>{
  for(const [x,z] of HOMES){
    const walk=(from,tx,tz)=>worldMove('city',from,tx,tz,14)
    const inside=walk({x,z:z+4,yaw:0},x,z)
    assert.ok(Math.abs(inside.z-z)<.05)
    assert.ok(walk(inside,x-4,z).x>x-1.7)
    assert.ok(walk(inside,x+5,z).x<x+3)
    assert.ok(Math.abs(walk(inside,x,z+4).z-z-4)<.05)
  }
})
test('the valley has walkable meadow and a steep enclosing ridge',()=>{
  for(let i=0;i<72;i++){
    const a=i*Math.PI/36,s=Math.sin(a),c=Math.cos(a)
    assert.ok(passableLand(s*67,c*67))
    assert.ok(Array.from({length:56},(_,j)=>78+j).some(r=>!passableLand(s*r,c*r)))
  }
  assert.ok(terrainHeight(0,73)>0)
})
