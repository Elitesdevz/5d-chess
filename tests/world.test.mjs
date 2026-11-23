import test from 'node:test'
import assert from 'node:assert/strict'
import {ChessStore} from '../server/storage.ts'
import {CityWorlds} from '../server/world.ts'
import {RouletteHall} from '../server/roulette-hall.ts'
import {casinoBet} from '../server/casino.ts'
import {DICE_TABLE_INDEX} from '../src/world/model.ts'

function fixture(t,count=2){
  const store=new ChessStore('.',{memory:true}),roulette=new RouletteHall(store),world=new CityWorlds(store,roulette)
  roulette.stop()
  t.after(()=>store.close())
  const names=Array.from({length:count},(_,i)=>'Walker'+i)
  store.transaction(unit=>{for(const name of names)unit.users.add(name,{name,hash:'',salt:'',wallet:{coins:1000,starterGranted:true,inventory:[],loadout:{icon:'default',pieces:{}}}})})
  let now=Date.now()
  const action=(name,action,data={},delay=1)=>world.update(name,action,data,now+=delay)
  const move=(name,x,z)=>{
    let view=action(name,'presence')
    for(let i=0;i<23;i++){
      if(Math.hypot(view.you.x-x,view.you.z-z)<.14)return view
      const zone=view.you.zone,next=action(name,'presence',{world:view.id,zone,x,z,yaw:0},900)
      if(next.you.zone!==zone)return next
      view=next
    }
    return view
  }
  return {store,world,names,action,move}
}
test('city holds fifty across zones and keeps excess arrivals separate',t=>{
  const {names,action}=fixture(t,51)
  const first=action(names[0],'teleport',{to:'bank'})
  for(const name of names.slice(1,50))assert.equal(action(name,'presence').id,first.id)
  assert.notEqual(action(names[50],'presence').id,first.id)
  assert.equal(action(names[0],'presence').players.length,0)
  const other=action(names[1],'teleport',{to:'bank'})
  assert.equal(other.id,first.id)
  assert.deepEqual(other.players.map(p=>p.name),[names[0]])
})

test('public dice shares one result and a locked bet survives leaving the casino',t=>{
  const {store,names,action,move}=fixture(t),[alice,bob]=names
  for(const name of names){
    const hotel=action(name,'teleport',{to:'casino'})
    assert.equal(hotel.you.zone,'hotel')
    assert.equal(move(name,0,-7.6).you.zone,'casino')
    const close=move(name,6.1,5.3)
    assert.ok(Math.hypot(close.you.x-6.1,close.you.z-5.3)<.2)
    assert.equal(action(name,'use',{target:'seat:'+DICE_TABLE_INDEX}).you.chair.table,DICE_TABLE_INDEX)
  }
  const table=action(alice,'presence').hall.tables[DICE_TABLE_INDEX]
  const bet={round:table.round,stake:10,choice:3,requestId:'world-alice-bet'}
  assert.equal(action(alice,'bet',bet).coins,990)
  assert.equal(action(alice,'teleport',{to:'city'}).you.zone,'city')
  const spinning=action(bob,'bet',{...bet,choice:4,requestId:'world-bob-bet'}).hall.tables[DICE_TABLE_INDEX]
  assert.equal(spinning.phase,'spin')
  assert.ok(spinning.spin.pocket>=1&&spinning.spin.pocket<=6)
  const finished=action(bob,'presence',{},3300)
  assert.equal(finished.hall.tables[DICE_TABLE_INDEX].prizes.length,2)
  assert.equal(JSON.parse(store.accountJson(alice)).casino.recent[0].result,finished.hall.receipt.result)
})

test('the entrance is once per Dutch day and the private room has no public presence or profit tax',t=>{
  const {store,names,action,move}=fixture(t),[alice,bob]=names
  action(alice,'presence')
  move(alice,-37,24)
  assert.equal(move(alice,-37,30).you.zone,'cave')
  const hid=move(alice,0,-7.7)
  assert.equal(hid.you.zone,'private')
  assert.deepEqual(hid.players,[])
  assert.equal(action(bob,'presence').players.some(p=>p.name===alice),false)
  const settled=store.transaction(unit=>casinoBet(unit.users.get(alice),[],{game:'dice',choice:2,stake:10,requestId:'world-cave-bet1',sequence:1},hid.now,2,true))
  assert.equal(settled.round.tax,0)
  assert.equal(settled.round.gross,59.85)
  const exited=action(alice,'teleport',{to:'bank'})
  assert.equal(exited.you.zone,'oasis')
  assert.equal(exited.caveOpen,false)
  assert.equal(action(alice,'teleport',{to:'bank'}).you.zone,'bank')
  assert.equal(JSON.parse(store.accountJson(alice)).cave.active,false)
  store.transaction(unit=>unit.users.get(bob).wallet.coins=0)
  assert.equal(action(bob,'presence').caveOpen,false)
  move(bob,-37,24)
  assert.equal(move(bob,-37,31).you.zone,'city')
})

test('tower floors and bank transactions require the right physical interaction',t=>{
  const {world,names,action,move}=fixture(t),[name]=names
  action(name,'teleport',{to:'stocks'})
  assert.throws(()=>action(name,'floor',{symbol:'AAPL'}),{status:409})
  move(name,-2.45,2)
  move(name,-2.45,-4.55)
  const transport=move(name,0,-4.55)
  assert.equal(transport.interaction,'elevator')
  assert.equal(action(name,'floor',{symbol:'AAPL'}).you.zone,'floor:AAPL')
  assert.equal(world.canTrade(name,'AAPL'),false)
  move(name,-2.7,-.42)
  const desk=action(name,'use',{target:'trader'})
  assert.equal(world.canTrade(name,'AAPL',desk.now),true)
  assert.equal(world.canTrade(name,'MSFT',desk.now),false)
  action(name,'teleport',{to:'bank'})
  move(name,-2.9,.75)
  action(name,'use',{target:'loans'})
  assert.equal(world.canBank(name,'borrow',desk.now),true)
  assert.equal(world.canBank(name,'repay',desk.now),false)
})
