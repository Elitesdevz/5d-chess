import test from 'node:test'
import assert from 'node:assert/strict'
import {ChessStore} from '../server/storage.ts'
import {stockApi} from '../server/stock-api.ts'
import {companies,saveCompanies,INVENTORY,residentHolder} from '../server/corporate.ts'
import {advanceResidentStocks,offerResidentShares} from '../server/resident-stocks.ts'
import {book,cancelOrders} from '../server/order-book.ts'
import {portfolioPerformance} from '../src/world/portfolio-performance.ts'
import {toStockUnits} from '../src/stock-model.ts'

const start=Date.parse('2026-11-18T10:00:00Z'),halfHour=30*60_000
function fixture(t){
  const db=new ChessStore('.',{memory:true});t.after(()=>db.close())
  db.transaction(u=>{
    for(const name of ['Ada','Bram'])u.users.add(name,{name,hash:'',salt:'',wallet:{starterGranted:true,coins:50_000,inventory:[],loadout:{pieces:{},icon:'default'}}})
  })
  const api=(action='',body={},name='Ada',now=start)=>db.transaction(u=>stockApi(u,u.users.get(name),'/api/stocks'+action,action?'POST':'GET',body,now).value)
  return {db,api}
}

test('LOT market orders fill player limits in price order, reserve holdings and sell the full position once',t=>{
  const {api}=fixture(t)
  assert.equal(api().lottery.ask,25)
  const buy={id:crypto.randomUUID(),symbol:'LOT',side:'buy',shares:5,total:125}
  let view=api('/market',buy)
  assert.equal(view.saleQuotes.LOT,123.75)
  assert.deepEqual(api('/market',buy).portfolio,view.portfolio)
  api('/order',{id:crypto.randomUUID(),symbol:'LOT',side:'buy',shares:2,price:24.9},'Bram')
  const ask={id:crypto.randomUUID(),symbol:'LOT',side:'sell',shares:1,price:32}
  view=api('/order',ask)
  assert.equal(view.saleQuotes.LOT,undefined)
  view=api('/cancel',{id:ask.id,symbol:'LOT'})
  assert.equal(view.saleQuotes.LOT,124.05)
  const sale={id:crypto.randomUUID(),symbol:'LOT',side:'sell',shares:5,total:view.saleQuotes.LOT,sellAll:true}
  assert.throws(()=>api('/market',{...sale,shares:1}),/holding changed/)
  assert.throws(()=>api('/market',{...sale,total:125}),/quote changed/)
  const sold=api('/market',sale)
  assert.equal(sold.coins,49999.05)
  assert.equal(sold.portfolio.positions.LOT,undefined)
  assert.deepEqual(api('/market',sale),sold)
  assert.equal(api('',{},'Bram').portfolio.positions.LOT.shares,2)
  assert.throws(()=>api('/support',{symbol:'LOT',policy:'dividend',value:30,on:true}),/no shareholder board/)
})

test('residents trade small funded orders on the four city books and release stock when offers run out',t=>{
  const {db,api}=fixture(t)
  api()
  const tick=now=>db.transaction(u=>advanceResidentStocks(u,now))
  tick(start)
  for(let turn=1;turn<=24;turn++){
    tick(start+turn*halfHour);tick(start+turn*halfHour)
    const e=db.metadataValue('economyV2')
    for(const c of [e.LOT,e.CAS,e.BNK,e.PRI]){
      assert.equal(c.inventory+Object.values(c.holders).reduce((a,b)=>a+b,0),c.issued)
      for(const id of Object.keys(e.residents))assert.ok((c.holders[id]??0)<=6&&e.residents[id]>=0)
    }
  }
  const e=db.metadataValue('economyV2')
  for(const c of [e.LOT,e.CAS,e.BNK,e.PRI]){
    assert.ok(c.trades.some(t=>residentHolder(t.buy)&&t.shares<=2))
    assert.ok(c.orders.some(o=>residentHolder(o.holder)&&o.side==='sell'&&o.initial<=2))
  }
  const now=start+25*halfHour
  db.transaction(u=>{
    const e=companies(u,now),c=e.LOT,id=Object.keys(e.residents)[0]
    // Player-owned float, one remaining inventory share, and four held by a resident.
    cancelOrders(u,e,c,()=>true,now)
    c.inventory=1;c.holders={Ada:c.issued-5,[id]:4}
    saveCompanies(u,e)
    u.putMetadata('residentStockClock',{next:now,turn:0})
  })
  tick(now)
  db.transaction(u=>{
    const e=companies(u,now),c=e.LOT,id=Object.keys(e.residents)[0]
    assert.equal(c.inventory,1)
    assert.equal(c.holders[id],4)
    assert.equal(book(c,'sell')[0].holder,INVENTORY)
    cancelOrders(u,e,c,o=>o.side==='sell',now);c.inventory=0;c.holders.Ada++
    offerResidentShares(u,e,c,now);offerResidentShares(u,e,c,now)
    assert.deepEqual(book(c,'sell').map(o=>[o.holder,o.shares]),[[id,3]])
    saveCompanies(u,e)
  })
  const price=api('',{},'Bram',now).lottery.ask
  const buy={id:crypto.randomUUID(),symbol:'LOT',side:'buy',shares:3,total:Math.round(price*10000)*3/10000}
  const view=api('/market',buy,'Bram',now)
  assert.equal(view.portfolio.positions.LOT.shares,3)
  assert.equal(view.lottery.asks[0].shares,1)
  assert.equal(view.lottery.asks[0].holder,'Amira (resident)')
  const clock=db.metadataValue('residentStockClock')
  tick(now+100*halfHour)
  assert.equal(db.metadataValue('residentStockClock').turn,clock.turn+1)
})

test('advisor gains include closed positions, intraday trades and dividends and flag missing history',t=>{
  const {api}=fixture(t),view=api()
  assert.equal(view.dayStart,Date.parse('2026-11-17T23:00:00Z'))
  const previous=view.dayStart-1000
  view.lottery.history=[{at:previous,price:25},{at:start,price:29}]
  view.lottery.price=29;view.lotteryDividends=4
  view.quotes.AAPL={updated:start,price:12,change:2,history:[]}
  const p=view.portfolio
  p.positions={LOT:{shares:2,cost:48}};p.dividends=[{symbol:'LOT',day:'2026-11-18',amount:1,shares:2,at:start}]
  p.trades=[['LOT','buy',3,72,previous],['LOT','sell',1,27,start],['AAPL','buy',10,90,previous],['AAPL','sell',10,120,start]].map(([symbol,side,shares,total,at],i)=>({symbol,side,shares,total,at,sequence:i+1,id:String(i)}))
  p.sequence=p.trades.length
  let report=portfolioPerformance(view)
  assert.equal(report.value,58)
  assert.equal(report.daily,31) // LOT 58 - 75 + 27 + 1; AAPL 120 - 100
  assert.equal(report.lifetime,47) // LOT 58 - 72 + 27 + 4; closed AAPL +30
  assert.equal(report.rows.find(r=>r.symbol==='LOT').daily,toStockUnits(11))
  p.positions.BNK={shares:1,cost:16}
  assert.equal(portfolioPerformance(view).lifetime,undefined)
  delete p.positions.BNK
  p.sequence++
  assert.equal(portfolioPerformance(view).lifetime,undefined)
  view.lottery.history=[]
  assert.equal(portfolioPerformance(view).daily,undefined)
  assert.equal(api('',{},'Ada',Date.parse('2027-03-28T22:15:00Z')).dayStart,Date.parse('2027-03-28T22:00:00Z'))
})

test('an advisor can close a reference position larger than one broker order',t=>{
  const {api,db}=fixture(t)
  db.transaction(u=>u.putMetadata('stockQuotes',{AAPL:{price:2,change:0,percent:0,updated:start,history:[]}}))
  for(const sequence of [1,2])api('/trade',{id:crypto.randomUUID(),symbol:'AAPL',side:'buy',sequence,shares:1000,total:2000})
  assert.equal(api().saleQuotes.AAPL,4000)
  const order={id:crypto.randomUUID(),symbol:'AAPL',side:'sell',sequence:3,shares:2000,total:4000}
  assert.throws(()=>api('/trade',order),{status:400})
  assert.throws(()=>api('/trade',{...order,shares:1000,total:2000,sellAll:true}),/holding changed/)
  const sale=api('/trade',{...order,sellAll:true})
  assert.equal(sale.coins,50000)
  assert.deepEqual(sale.portfolio.positions,{})
})

test('LOT is marked at the last fill and public resale offers can trade away from the initial price',t=>{
  const {api}=fixture(t)
  api();api('/market',{symbol:'LOT',side:'buy',shares:12,total:300,id:crypto.randomUUID()})
  api('/order',{symbol:'LOT',side:'sell',shares:4,price:24.9,id:crypto.randomUUID()})
  const bought=api('/market',{symbol:'LOT',side:'buy',shares:4,total:99.6,id:crypto.randomUUID()},'Bram')
  assert.equal(bought.lottery.price,24.9)
  assert.equal(bought.portfolio.positions.LOT.cost,99.6)
  assert.equal(bought.lottery.history.at(-1).price,24.9)
})
