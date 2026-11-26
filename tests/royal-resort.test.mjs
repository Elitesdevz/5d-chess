import test from 'node:test'
import assert from 'node:assert/strict'
import {ChessStore} from '../server/storage.ts'
import {CityWorlds} from '../server/world.ts'
import {RULES} from '../server/city-arcade.ts'
import {carry,pack,mirrorFood} from '../server/city-inventory.ts'
import {publicView} from '../server/custody.ts'
import {RouletteHall} from '../server/roulette-hall.ts'
import {resortService} from '../server/resort.ts'
import {advanceTable,cardAction,pokerScore} from '../server/card-salon.ts'
import {advanceLottery} from '../server/weekly-lottery.ts'
import {stockApi} from '../server/stock-api.ts'
import {portfolio} from '../server/cas-shares.ts'
import {companies} from '../server/corporate.ts'
import {site,floorHeight,walkingHeight} from '../src/world/model.ts'
import {blackjackTotal,ROOMS,STAY_MS,resortWalkable,slotPays} from '../src/world/resort.ts'
import {nextWeek} from '../src/collection.ts'

function fixture(t,start=Date.now()){
  const db=new ChessStore('.',{memory:true})
  t.after(()=>db.close())
  db.transaction(u=>{for(const name of ['Ada','Bea'])u.users.add(name,{name,hash:'',salt:'',wallet:{coins:1000,starterGranted:true,inventory:[],loadout:{pieces:{},icon:'default'}}})})
  let now=start
  const use=(name,service,body)=>db.transaction(u=>resortService(u,name,'resort:'+service,now,body))
  const sequence=name=>(JSON.parse(db.accountJson(name)).resort?.sequence??0)+1
  const make=(name,data)=>({...data,sequence:sequence(name),id:crypto.randomUUID()})
  const order=(name,service,data)=>use(name,service,make(name,data))
  const play=(name,game,kind,data={})=>{
    const {table}=use(name,game)
    return order(name,game,{kind,round:table.id,revision:table.revision,...data}).table
  }
  const balance=name=>JSON.parse(db.accountJson(name)).wallet.coins
  return {db,use,make,order,play,balance,tick:n=>now+=n,now:()=>now}
}

test('a suite key grants access to the bed, shower, private drawer and minibar until checkout',t=>{
  const f=fixture(t),roulette=new RouletteHall(f.db),world=new CityWorlds(f.db,roulette)
  roulette.stop()
  const act=(action,data={},dt=20)=>world.update('Ada',action,{scene:true,...data},f.tick(dt))
  f.db.transaction(u=>{
    const a=u.users.get('Ada'),p=pack(a)
    carry(p,'cash',17);carry(p,'cola',2);mirrorFood(a)
  })
  let v=act('teleport',{to:'casino'})
  function walk(x,z){
    const goal=site(v.you.zone,x,z)
    for(let i=0;i<12&&Math.hypot(v.you.x-goal.x,v.you.z-goal.z)>.01;i++)v=act('presence',{world:v.id,...goal,yaw:0},900)
    assert.ok(Math.hypot(v.you.x-goal.x,v.you.z-goal.z)<.1,'walk to '+[x,z])
  }
  assert.throws(()=>act('resort',f.make('Ada',{room:305})),/Visit the resort/)
  walk(-6.25,-4.96);v=act('use',{target:'resort:desk'})
  const order=f.make('Ada',{room:305})
  v=act('resort',order);assert.equal(v.coins,820)
  assert.equal(act('resort',order).coins,820)
  assert.throws(()=>f.order('Bea','desk',{room:305}),/occupied/)
  walk(2.9,5.85);act('use',{target:'resort:lift'})
  v=act('resort-floor',{floor:'hotel:3'});assert.equal(v.you.zone,'hotel:3')
  walk(0,5.85);walk(0,-16.5);walk(-2.45,-16.5);walk(-2.45,-14.7);walk(-6.18,-14.7);walk(-6.18,-11.53)
  assert.equal(act('use',{target:'resort:bed:305'}).you.homePose.kind,'rest')
  v=act('stand-scenery')
  assert.throws(()=>act('use',{target:'drawer:hotel-305'}),/closer/)
  walk(-4.75,-11.43);v=act('use',{target:'drawer:hotel-305'})
  const deposit={operation:'store',item:'cash',amount:12,sequence:v.arcade.sequence}
  v=act('arcade',deposit);assert.deepEqual(v.arcade.drawer,[{item:'cash',count:12}])
  assert.throws(()=>act('arcade',deposit),/Inventory changed/)
  assert.throws(()=>act('arcade',{...deposit,item:'cola',amount:1,sequence:v.arcade.sequence}),/refrigerator/)
  v=act('arcade',{operation:'take',item:'cash',amount:3,sequence:v.arcade.sequence})
  assert.deepEqual(v.arcade.drawer,[{item:'cash',count:9}])
  walk(-3.1,-11.58)
  assert.throws(()=>act('arcade',{...deposit,sequence:v.arcade.sequence}),/storage first/)
  v=act('use',{target:'fridge:hotel-305'})
  assert.ok(v.food.stored)
  assert.equal(act('food',{operation:'store',amount:'all',item:'cola',id:crypto.randomUUID()}).food.stored.cola,2)
  act('close-fridge')
  walk(-2.5,-11.58);walk(-2.5,-22.15);walk(-6.65,-22.15)
  assert.equal(act('use',{target:'resort:bath:305'}).you.shower.room,305)
  // Keep the city session live while expiring the durable deed.
  f.db.transaction(u=>{const d=u.metadata('cityDeeds');d['hotel-305'].until=f.now();u.putMetadata('cityDeeds',d)})
  v=act('presence');assert.equal(v.you.x,0);assert.ok(!v.housing.keys.includes('hotel-305'))
  assert.equal(act('food').food.personal.cola,2)
  assert.deepEqual(f.db.cityPack('Ada').recovery,[{item:'cash',count:9}])
  assert.throws(()=>act('use',{target:'drawer:hotel-305'}),/closer/)
  assert.ok(!resortWalkable('hotel:3',-3,-16.5,[]))
  assert.equal(ROOMS.length,11);assert.equal(new Set(ROOMS.map(r=>r.tier)).size,5)
  assert.ok(walkingHeight('hotel:3',...Object.values(site('hotel:3',6,-17)))<floorHeight('hotel:3')-1)
  assert.equal(STAY_MS,3600_000)
})

test('rebooking an expired room releases the former keyholder’s storage exactly once',t=>{
  const f=fixture(t)
  for(const nextGuest of ['Ada','Bea']){
    f.order('Ada','desk',{room:201})
    f.db.transaction(u=>{
      const a=u.users.get('Ada'),p=pack(a)
      p.drawers['hotel-201']=[{item:'cash',count:8}]
      a.fridges={'hotel-201':{burger:0,fries:0,cola:2}}
    })
    f.tick(STAY_MS)
    const command=f.make(nextGuest,{room:201})
    f.use(nextGuest,'desk',command);f.use(nextGuest,'desk',command)
    const a=JSON.parse(f.db.accountJson('Ada'))
    assert.equal(a.cityPack.drawers['hotel-201'],undefined)
    assert.equal(a.fridges['hotel-201'],undefined)
    const stays=nextGuest==='Ada'?1:2
    assert.equal(a.food.cola,2*stays)
    assert.deepEqual(a.cityPack.recovery,[{item:'cash',count:8*stays}])
    f.tick(STAY_MS)
  }
})

test('a city property search respects the motel room key and leaves other guests’ drawers private',t=>{
  const f=fixture(t),roulette=new RouletteHall(f.db),world=new CityWorlds(f.db,roulette)
  roulette.stop()
  f.order('Ada','desk',{room:201});f.order('Bea','desk',{room:202})
  f.db.transaction(u=>{
    for(const [guest,room] of [['Ada','hotel-201'],['Bea','hotel-202']])
      pack(u.users.get(guest)).drawers[room]=[{item:'cash',count:9},{item:'blaster',count:1}]
    Object.assign(pack(u.users.get('Ada')),{stars:3,remaining:600_000})
  })
  world.update('Ada','teleport',{to:'casino',scene:true},f.now())
  const view=world.update('Ada','presence',{scene:true},f.tick(RULES.raidDelay))
  assert.deepEqual(view.arcade.searches,['hotel-201'])
  assert.deepEqual(f.db.cityPack('Ada').drawers['hotel-201'],[{item:'cash',count:9}])
  assert.equal(f.db.cityPack('Bea').drawers['hotel-202'].length,2)
})

test('custody aliases apply to card turns, payouts and the lottery winner',()=>{
  const view={turn:'Ada',resort:{table:{turn:'Ada',result:'Ada wins the pot',seats:[{name:'Ada'}]},lottery:{last:{winner:'Ada'}}}}
  const masked=publicView(view,[{user:'Ada',name:'Inmate 01'}])
  assert.equal(masked.turn,'Ada')
  assert.deepEqual(masked.resort,{table:{turn:'Inmate 01',result:'Inmate 01 wins the pot',seats:[{name:'Inmate 01'}]},lottery:{last:{winner:'Inmate 01'}}})
})

test('poker needs two funded players, conceals cards, draws, bets and pays a five percent rake once',t=>{
  const f=fixture(t)
  const waiting=f.play('Ada','poker','join')
  assert.equal(waiting.phase,'waiting');assert.deepEqual(waiting.seats[0].cards,[])
  assert.throws(()=>f.play('Ada','poker','join'),/unavailable/)
  const table=f.play('Bea','poker','join')
  assert.equal(table.phase,'play');assert.deepEqual(table.seats[0].cards,[])
  assert.equal(table.seats[1].cards.length,5)
  const hand=f.use('Ada','poker').table.seats[0].cards
  assert.throws(()=>f.play('Ada','poker','draw',{discards:[0,0]}),/different/)
  const result=f.play('Ada','poker','draw',{discards:[0,1]})
  assert.deepEqual(result.seats[0].cards.slice(2),hand.slice(2))
  f.play('Bea','poker','draw',{discards:[]});f.play('Ada','poker','raise')
  const end=f.play('Bea','poker','call')
  assert.equal(end.phase,'settled');assert.equal(end.seats.reduce((s,p)=>s+p.paid,0),38)
  assert.equal(f.balance('Ada')+f.balance('Bea'),1998)
  assert.throws(()=>f.play('Bea','poker','call'),/unavailable/)
  assert.ok(pokerScore([12,0,1,2,3])<pokerScore([0,1,2,3,4]))
  assert.ok(pokerScore([12,25,38,51,2])>pokerScore([11,24,37,12,25]))
})

test('blackjack refunds unmatched seats and settles doubled and split hands against a shared dealer',t=>{
  const f=fixture(t)
  f.play('Ada','blackjack','join')
  f.tick(91_000);f.db.transaction(u=>advanceTable(u,'blackjack',f.now()))
  assert.equal(f.balance('Ada'),1000)
  const waiting=f.play('Ada','blackjack','join')
  const shoe=()=>[6,19,7,5,8,6,2,1,8].reverse()
  f.db.transaction(u=>cardAction(u,'blackjack','Bea',{kind:'join',round:waiting.id,revision:waiting.revision},f.now(),shoe))
  const split=f.play('Ada','blackjack','split')
  assert.equal(split.hands.length,3);assert.equal(split.dealer.length,1)
  f.play('Ada','blackjack','double');f.play('Ada','blackjack','stand')
  const end=f.play('Bea','blackjack','stand')
  assert.equal(end.phase,'settled');assert.equal(end.dealer.length,2)
  assert.equal(blackjackTotal([12,25,8]),12)
  assert.equal(f.balance('Ada'),970+end.seats[0].paid)
  assert.equal(f.balance('Bea'),990+end.seats[1].paid)
  assert.equal(f.db.transaction(u=>companies(u,f.now()).CAS.pending),0)
})

test('legacy lottery shares migrate once, earn the draw dividend and can be sold through the exchange',t=>{
  const boundary=nextWeek(),f=fixture(t,boundary-1000)
  const initial=f.use('Ada','lottery').lottery
  assert.equal(initial.until,boundary)
  f.db.transaction(u=>{
    const {LOT,residents,...previousEconomy}=companies(u,f.now())
    u.putMetadata('economyV2',previousEconomy)
    const draw=u.metadata('royalWeeklyLottery')
    u.putMetadata('royalWeeklyLottery',{...draw,holders:[{name:'Ada',count:3},{name:'Bea',count:1}],principal:100*10000})
    for(const [name,shares] of [['Ada',3],['Bea',1]]){
      const a=u.users.get(name);a.wallet.coins-=shares*25;portfolio(a).positions.LOT={shares,cost:shares*25}
    }
  })
  const stocks=(action,body={})=>f.db.transaction(u=>stockApi(u,u.users.get('Ada'),'/api/stocks'+action,action?'POST':'GET',body,f.now()).value)
  assert.equal(stocks('').lottery.available,996)
  assert.equal(stocks('').lottery.available,996)
  assert.throws(()=>f.order('Ada','lottery',{kind:'buy',count:1}),/Exchange Tower/)
  const ticket=f.make('Bea',{kind:'ticket',count:10,draw:boundary})
  assert.equal(f.use('Bea','lottery',ticket).lottery.pool,99)
  assert.equal(f.use('Bea','lottery',ticket).lottery.mine,10)
  f.tick(1000)
  f.db.transaction(u=>advanceLottery(u,f.now()))
  const next=f.use('Ada','lottery').lottery
  assert.equal(next.pool,0);assert.equal(next.dividends,.75);assert.equal(next.last.winner,'Bea')
  assert.equal(f.balance('Bea'),974.25)
  assert.throws(()=>f.order('Ada','lottery',{kind:'ticket',count:1,draw:boundary}),/new draw/)
  const sale=stocks('/market',{symbol:'LOT',side:'sell',shares:3,sellAll:true,id:crypto.randomUUID(),total:74.25})
  assert.equal(sale.portfolio.dividends[0].symbol,'LOT')
  assert.equal(f.balance('Ada'),1000)
  assert.equal(f.db.metadataValue('royalWeeklyLottery').principal,undefined)
  const lot=f.db.metadataValue('economyV2').LOT
  assert.equal(lot.cash+lot.buybackCash,25.75*10000)
  assert.equal(lot.inventory,999)
  f.tick(2*3600_000)
  const npc=f.use('Bea','lottery').lottery
  assert.ok(npc.npc>=4);assert.equal(npc.pool,npc.npc*99/10)
  assert.deepEqual(f.use('Bea','lottery').lottery,npc)
})

test('slot paytable returns 205/216 and a replay never spins twice',t=>{
  assert.equal(slotPays.reduce((a,b)=>a+b,0),205)
  const f=fixture(t),order=f.make('Ada',{kind:'spin',stake:5})
  const first=f.use('Ada','slots',order),balance=f.balance('Ada')
  assert.equal(first.slots.reels.length,3);assert.equal(balance,995+first.slots.paid)
  assert.deepEqual(f.use('Ada','slots',order),first)
  assert.equal(f.balance('Ada'),balance)
  assert.throws(()=>f.use('Ada','slots',{...order,stake:9}),/balance changed/)
})
