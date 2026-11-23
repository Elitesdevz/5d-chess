import test from 'node:test'
import assert from 'node:assert/strict'
import {ChessStore} from '../server/storage.ts'
import {CityWorlds} from '../server/world.ts'
import {RouletteHall} from '../server/roulette-hall.ts'
import {Restaurant} from '../server/restaurant.ts'
import {RESTAURANT,COUNTERS,MANAGER,PASS,GRILLS,SEATS,STAFF,WORK} from '../src/world/restaurant-model.ts'
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
  const buy={id:'guest-purchase-1',lane:0,item:'cola'}
  r.act(p,'buy',buy,time)
  r.act(p,'buy',buy,time)
  assert.equal(wallet(store,'Alice'),92)
  assert.throws(()=>r.act(p,'eat',{},time),{status:409})
  const restarted=new Restaurant(store)
  let state=restarted.view('Alice',time+1,true)
  assert.ok(state.queues[0].some(t=>t.id===state.meal.id))
  for(let seconds=1;seconds<26;seconds++)restarted.tick(time+seconds*1000)
  state=restarted.view('Alice',time+26000,true)
  assert.equal(state.meal.status,'served')
  const seat=SEATS.findIndex((_,i)=>!state.taken.includes(i))
  const seated=member('Alice',SEATS[seat])
  restarted.act(seated,'sit',{seat},time+26000)
  assert.equal(seated.dining,seat)
  assert.deepEqual(restarted.view('Alice',time+26000,true).mealsAt.find(p=>p.seat===seat),{seat,item:'cola'})
  for(let i=0;i<3;i++)restarted.act(seated,'eat',{},time+26010+i*1000)
  assert.equal(restarted.view('Alice',time+30000,true).meal,undefined)
  restarted.act(seated,'stand',{},time+30000)
  assert.equal(seated.dining,undefined)
  restarted.act(p,'buy',buy,time+31000)
  assert.equal(wallet(store,'Alice'),92)
})
test('cashier, cook and janitor shifts earn once for work on real NPC tickets and messes',t=>{
  const {restaurant:r,store}=fixture(t)
  const cashier=member('Alice',MANAGER),cook=member('Bob',MANAGER),janitor=member('Charlie',MANAGER)
  for(const [p,role] of [[cashier,'cashier'],[cook,'cook'],[janitor,'janitor']])r.act(p,'hire',{role},time)
  r.tick(time+10)
  let state=r.view('Alice',time+10,true)
  const ticket=state.queues[0][0]
  assert.equal(state.staff.cashier[0].name,'Alice')
  assert.equal(state.actors.some(a=>a.id==='cashier0'),false)
  assert.throws(()=>r.act(cashier,'take',{ticket:ticket.id,item:ticket.item},time+5000),{status:409})
  Object.assign(cashier,member('Alice',{x:0,z:-2.72}))
  assert.throws(()=>r.act(cashier,'take',{ticket:ticket.id,item:ticket.item},time+5000),{status:409})
  Object.assign(cashier,member('Alice',{x:COUNTERS[0],z:-2.72}))
  r.act(cashier,'take',{ticket:ticket.id,item:ticket.item},time+5000)
  assert.equal(wallet(store,'Alice'),102)
  assert.throws(()=>r.act(cashier,'take',{ticket:ticket.id,item:ticket.item},time+5100),{status:409})
  Object.assign(cook,member('Bob',{x:GRILLS[0],z:-5.47}))
  const work=(p,point,start)=>{
    r.act(p,'start',{point},start)
    const job=r.view(p.name,start,true).work
    r.act(p,'step',{key:job.key,step:0},start)
    assert.throws(()=>r.act(p,'step',{key:job.key,step:1},start+7),{status:409})
    for(let i=1;i<3;i++)r.act(p,'step',{key:job.key,step:i},start+i*650)
    assert.throws(()=>r.act(p,'step',{key:job.key,step:2},start+2000),{status:409})
    return WORK[job.kind].pay
  }
  const pay=work(cook,'kfc:cook',time+5100)
  assert.equal(wallet(store,'Bob'),100+pay)
  Object.assign(cashier,member('Alice',PASS))
  r.act(cashier,'pickup',{ticket:ticket.id},time+6500)
  assert.equal(r.hasTray('Alice'),true)
  assert.throws(()=>r.act(cashier,'deliver',{},time+6510),{status:409})
  Object.assign(cashier,member('Alice',SEATS[ticket.seat]))
  r.act(cashier,'deliver',{},time+6600)
  assert.equal(wallet(store,'Alice'),106)
  r.tick(time+30650)
  state=r.view('Charlie',time+30650,true)
  assert.ok(state.messes.some(m=>m.kind==='wipe'))
  const mess=state.messes.find(m=>m.kind==='wipe')
  Object.assign(janitor,member('Charlie',{x:mess.x+.83,z:mess.z}))
  assert.equal(work(janitor,'kfc:clean:'+mess.id,time+30651),3)
  assert.equal(wallet(store,'Charlie'),103)
  assert.ok(!r.view('Charlie',time+33000,true).messes.some(m=>m.id===mess.id))
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

test('a Krull combo needs both flipping and bagging before pickup',t=>{
  const {restaurant:r,store}=fixture(t)
  const buyer=member('Alice',counter(0)),cook=member('Bob',MANAGER),cashier=member('Charlie',MANAGER)
  r.act(cook,'hire',{role:'cook'},time)
  r.act(cashier,'hire',{role:'cashier'},time)
  r.act(buyer,'buy',{lane:0,item:'combo',id:'combo-order-001'},time)
  Object.assign(cashier,member('Charlie',{x:COUNTERS[0],z:-2.72}))
  r.act(cashier,'take',{item:'combo',ticket:'combo-order-001'},time)
  Object.assign(cook,member('Bob',{x:GRILLS[0],z:-5.47}))
  for(const [part,kind] of ['flip','fries'].entries()){
    const at=time+part*2500
    r.act(cook,'start',{point:'kfc:cook'},at)
    const task=r.view('Bob',at,true).work
    assert.equal(task.kind,kind)
    for(let step=0;step<3;step++)r.act(cook,'step',{key:task.key,step},at+step*650)
    assert.equal(r.view('Bob',at+1300,true).pickup.some(p=>p.id==='combo-order-001'),part===1)
  }
  assert.equal(wallet(store,'Bob'),107)
  assert.equal(wallet(store,'Alice'),78)
})
