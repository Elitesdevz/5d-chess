import test from 'node:test'
import assert from 'node:assert/strict'
import {ChessStore} from '../server/storage.ts'
import {CityWorlds} from '../server/world.ts'
import {RouletteHall} from '../server/roulette-hall.ts'
import {Restaurant} from '../server/restaurant.ts'
import {RESTAURANT,COUNTERS,MANAGER,PASS,SUPPLIES,stationPoint,SEATS,STAFF,blankOrder} from '../src/world/restaurant-model.ts'
import {CREDIT_ADVISOR,groundZone,site,worldMove} from '../src/world/model.ts'

function fixture(t){
  const store=new ChessStore('.',{memory:true}),hall=new RouletteHall(store)
  hall.stop()
  t.after(()=>store.close())
  const add=name=>store.transaction(u=>u.users.add(name,{name,hash:'',salt:'',wallet:{coins:100,starterGranted:true,inventory:[],loadout:{icon:'default',pieces:{}}}}))
  for(const name of ['Alice','Bob','Charlie','Danni'])add(name)
  return {store,world:new CityWorlds(store,hall),restaurant:new Restaurant(store),add}
}
const member=(name,p)=>({name,zone:'kfc',x:RESTAURANT.x+p.x,z:RESTAURANT.z+p.z,yaw:0,avatar:'default',online:true})
const counter=(i)=>({x:COUNTERS[i],z:-.55})
const wallet=(store,name)=>store.rouletteWallet(name).coins
const time=Date.UTC(2026,10,23,12)

test('the restaurant has a walkable entrance, a separate office door, and physical counter collisions',t=>{
  const {world}=fixture(t)
  const initial=world.update('Alice','teleport',{scene:true,to:'kfc'},time)
  assert.equal(initial.you.zone,'kfc')
  assert.equal(initial.restaurant.staff.cashier.length,3)
  assert.equal(initial.restaurant.staff.cook.length,5)
  assert.equal(initial.restaurant.staff.janitor.length,3)
  assert.equal(initial.restaurant.actors.filter(a=>a.role).length,12)
  const outside={...site('kfc',0,RESTAURANT.front+1),yaw:0}
  const door=worldMove('city',outside,outside.x,RESTAURANT.z+5.7,4)
  assert.equal(groundZone(door.x,door.z),'kfc')
  const stopped=worldMove('kfc',{...site('kfc',0,-.5),yaw:0},RESTAURANT.x,RESTAURANT.z-3,4)
  assert.ok(stopped.z>RESTAURANT.z-1.3)
  const office=worldMove('kfc',{...site('kfc',4.75,-2.7),yaw:0},RESTAURANT.x+4.75,RESTAURANT.z-5,4)
  assert.ok(office.z<RESTAURANT.z-4.9)
  const next=world.update('Alice','teleport',{scene:true,to:'bank'},time+500)
  let bank=next
  const advisor=site('bank',CREDIT_ADVISOR.x,CREDIT_ADVISOR.z)
  for(let i=1;i<=5;i++)bank=world.update('Alice','presence',{scene:true,world:bank.id,...advisor,yaw:0},time+500+i*1100)
  assert.equal(world.update('Alice','use',{scene:true,target:'credit'},time+6400).interaction,'credit')
})

test('a meal debits once, survives a restaurant reboot, and can be eaten only while seated',t=>{
  const {store,restaurant:r}=fixture(t)
  const p=member('Alice',counter(0))
  const buy={id:'guest-purchase-1',lane:0,items:{...blankOrder(),cola:1}}
  r.act(p,'buy',buy,time)
  r.act(p,'buy',buy,time)
  assert.equal(wallet(store,'Alice'),92)
  assert.throws(()=>r.act(p,'eat',{},time),{status:409})
  const restarted=new Restaurant(store)
  let state=restarted.view('Alice',time+1,true)
  assert.ok(state.queues[0].some(t=>t.name==='Alice'&&t.items.cola===1))
  for(let seconds=1;seconds<26;seconds++)restarted.tick(time+seconds*1000)
  state=restarted.view('Alice',time+26000,true)
  assert.equal(state.meal.status,'served')
  const seat=SEATS.findIndex((_,i)=>!state.taken.includes(i))
  const seated=member('Alice',SEATS[seat])
  restarted.act(seated,'sit',{seat},time+26000)
  assert.equal(seated.dining,seat)
  assert.deepEqual(restarted.view('Alice',time+26000,true).mealsAt.find(p=>p.seat===seat),{seat,items:{...blankOrder(),cola:1}})
  for(let i=0;i<3;i++)restarted.act(seated,'eat',{},time+26010+i*1000)
  assert.equal(restarted.view('Alice',time+30000,true).meal,undefined)
  restarted.act(seated,'stand',{},time+30000)
  assert.equal(seated.dining,undefined)
  restarted.act(p,'buy',buy,time+31000)
  assert.equal(wallet(store,'Alice'),92)
})
test('a served restaurant tray moves into the diner’s hotbar exactly once',t=>{
  const {store,restaurant}=fixture(t),p=member('Alice',counter(0))
  const items={...blankOrder(),burger:1,cola:2},id='guest-hotbar-tray'
  restaurant.act(p,'buy',{id,lane:0,items},time)
  for(let i=1;i<=35;i++)restaurant.tick(time+i*1000)
  const now=time+36000,view=restaurant.view('Alice',now,true)
  assert.equal(view.meal.status,'served')
  assert.throws(()=>restaurant.act(p,'collect',{id},now),{status:409})
  const seat=SEATS.findIndex((_,i)=>!view.taken.includes(i))
  Object.assign(p,member('Alice',SEATS[seat]))
  restaurant.act(p,'sit',{seat},now)
  restaurant.act(p,'collect',{id},now+1);restaurant.act(p,'collect',{id},now+2)
  assert.equal(restaurant.view('Alice',now+3,true).meal,undefined)
  assert.deepEqual(JSON.parse(store.accountJson('Alice')).cityPack.slots.filter(Boolean),[{item:'burger',count:1},{item:'cola',count:2}])
})
function kitchen(r,person){
  return (where,at,gesture)=>{
    const point=where==='station'?stationPoint(0):where==='send'?PASS:SUPPLIES[where]
    Object.assign(person,member(person.name,point))
    return r.kitchenPoint(person,'kfc:kitchen:'+where,at,gesture)
  }
}
function cookBurger(visit,at){
  visit('bun',at);visit('station',at);visit('raw',at);visit('station',at)
  assert.throws(()=>visit('station',at+899,'flip'),{status:409})
  assert.equal(visit('station',at+900),false)
  visit('station',at+900,'flip')
  assert.throws(()=>visit('station',at+1799,'assemble'),{status:409})
  visit('station',at+1800,'assemble');visit('station',at+1800)
}

test('an NPC order pays only after an accurate ticket, a complete tray, and delivery to the correct table',t=>{
  const {restaurant:r,store}=fixture(t)
  const cashier=member('Alice',MANAGER),cook=member('Bob',MANAGER),janitor=member('Charlie',MANAGER)
  for(const [p,role] of [[cashier,'cashier'],[cook,'cook'],[janitor,'janitor']])r.act(p,'hire',{role},time)
  r.tick(time+10)
  const ticket=r.view('Alice',time+10,true).queues[0][0],order={ticket:ticket.id,items:ticket.items},at=time+5000
  assert.throws(()=>r.act(cashier,'take',order,at),{status:409})
  Object.assign(cashier,member('Alice',{x:COUNTERS[0],z:-2.72}))
  assert.throws(()=>r.act(cashier,'take',{...order,items:{burger:2,fries:0,cola:0}},at),{status:409})
  r.act(cashier,'take',order,at)
  assert.equal(wallet(store,'Alice'),102)
  assert.throws(()=>r.act(cashier,'take',order,at),{status:409})
  assert.throws(()=>r.kitchenPoint(cook,'kfc:kitchen:tickets',at),{status:409})
  const visit=kitchen(r,cook)
  visit('tickets',at)
  assert.throws(()=>visit('send',at),{status:409})
  cookBurger(visit,at)
  visit('bag',at+2000)
  assert.throws(()=>visit('soda',at+2000,'fill'),{status:409})
  assert.equal(visit('fryer',at+2000),false)
  visit('fryer',at+2000,'scoop');visit('station',at+2000)
  visit('cup',at+2100);visit('soda',at+2100,'fill');visit('station',at+2100)
  visit('station',at+2200)
  assert.equal(wallet(store,'Bob'),100)
  visit('send',at+2300)
  assert.equal(wallet(store,'Bob'),109)
  assert.throws(()=>visit('send',at+2400),{status:409})
  Object.assign(cashier,member('Alice',PASS))
  r.act(cashier,'pickup',{ticket:ticket.id},at+2500)
  assert.deepEqual(r.carriedItems('Alice'),ticket.items)
  assert.throws(()=>r.act(cashier,'deliver',{},at+2510),{status:409})
  Object.assign(cashier,member('Alice',SEATS[ticket.seat]))
  r.act(cashier,'deliver',{},at+2600)
  assert.equal(wallet(store,'Alice'),106)
  r.tick(at+27000)
  const mess=r.view('Charlie',at+27000,true).messes.find(m=>m.kind==='wipe')
  assert.ok(mess)
  Object.assign(janitor,member('Charlie',{x:mess.x+.83,z:mess.z}))
  const point='kfc:clean:'+mess.id
  r.act(janitor,'start',{point},at+27000)
  const task=r.view('Charlie',at+27000,true).work
  for(let step=0;step<3;step++)r.act(janitor,'step',{key:task.key,step},at+27000+step*650)
  assert.equal(wallet(store,'Charlie'),103)
  assert.ok(!r.view('Charlie',at+30000,true).messes.some(m=>m.id===mess.id))
})
test('human jobs are limited to physical slots and NPCs return when players clock out or leave',t=>{
  const {restaurant:r}=fixture(t)
  for(const name of ['Alice','Bob','Charlie'])r.act(member(name,MANAGER),'hire',{role:'cashier'},time)
  const d=member('Danni',MANAGER)
  assert.throws(()=>r.act(d,'hire',{role:'cashier'},time),{status:409})
  assert.equal(r.view('Alice',time,true).staff.cashier.filter(s=>s.player).length,STAFF.cashier)
  r.leave('Bob')
  const now=r.view('Danni',time+1,true)
  assert.equal(now.staff.cashier[1].player,false)
  assert.ok(now.actors.some(a=>a.id==='cashier1'))
  r.act(d,'hire',{role:'cashier'},time+2)
  assert.equal(r.view('Danni',time+2,true).shift.slot,1)
})

test('repeated items require a fresh burger recipe and leaving frees the ticket for the next cook',t=>{
  const {restaurant:r,store}=fixture(t)
  const buyer=member('Alice',counter(0)),cook=member('Bob',MANAGER),cashier=member('Charlie',MANAGER)
  r.act(cook,'hire',{role:'cook'},time)
  r.act(cashier,'hire',{role:'cashier'},time)
  const items={burger:2,fries:0,cola:0}
  r.act(buyer,'buy',{lane:0,items,id:'combo-order-001'},time)
  const ticket=r.view('Alice',time,true).queues[0][0]
  Object.assign(cashier,member('Charlie',{x:COUNTERS[0],z:-2.72}))
  r.act(cashier,'take',{items,ticket:ticket.id},time)
  const visit=kitchen(r,cook)
  visit('tickets',time)
  cookBurger(visit,time)
  assert.throws(()=>visit('send',time+1800),{status:409})
  assert.throws(()=>visit('station',time+1800),{status:409})
  cookBurger(visit,time+2500)
  assert.deepEqual(r.view('Bob',time+4500,true).kitchen.done,items)
  visit('station',time+4500)
  r.leave('Bob')
  assert.equal(r.view('Charlie',time+4500,true).tickets,1)
  assert.equal(wallet(store,'Bob'),100)
  assert.equal(wallet(store,'Alice'),72)
})

test('old paid combos are restored as a burger, fries, and soda without charging again',t=>{
  const {restaurant:r,store}=fixture(t)
  store.transaction(u=>{u.users.get('Alice').restaurant={id:'old-restaurant-meal',item:'combo',lane:0,status:'paid',bites:0}})
  const initial=r.view('Alice',time,true)
  assert.deepEqual(initial.queues[0][0].items,{burger:1,fries:1,cola:1})
  assert.equal(wallet(store,'Alice'),100)
})
