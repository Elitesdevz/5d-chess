import test from 'node:test'
import assert from 'node:assert/strict'
import {ChessStore} from '../server/storage.ts'
import {stockApi} from '../server/stock-api.ts'
import {CAS_META,casState,recordCasinoMargins} from '../server/cas-shares.ts'
import {STOCK_QUOTES} from '../server/stock-quotes.ts'
import {STOCKS} from '../src/stock-catalog.ts'
import {casOrderTotal} from '../src/stock-model.ts'
import {nextReset} from '../src/collection.ts'
import {casinoApi} from '../server/casino-api.ts'

const then=Date.parse('2026-11-18T10:00:00Z')
function fixture(t){
  const store=new ChessStore('.',{memory:true})
  t.after(()=>store.close())
  store.transaction(unit=>{
    for(const name of ['Alice','Bob'])unit.users.add(name,{name,hash:'',salt:'',wallet:{starterGranted:true,coins:10000,inventory:[],loadout:{icon:'default',pieces:{}}}})
    unit.putMetadata(STOCK_QUOTES,{AAPL:{price:175.25,change:2.5,percent:1.45,updated:then,history:[]}})
  })
  const read=(name,now=then)=>store.transaction(unit=>stockApi(unit,unit.users.get(name),'/api/stocks','GET',{},now).value)
  const trade=(name,request,now=then)=>store.transaction(unit=>stockApi(unit,unit.users.get(name),'/api/stocks/trade','POST',request,now).value)
  return {store,read,trade}
}

test('stock orders debit or credit the wallet once and reject stale quotes and overselling',t=>{
  assert.equal(STOCKS.length,100)
  assert.equal(new Set(STOCKS.map(s=>s.symbol)).size,100)
  const {read,trade}=fixture(t)
  const buy={symbol:'AAPL',id:'order-aapl-0001',side:'buy',shares:2,sequence:1,total:350.5}
  assert.throws(()=>trade('Alice',{...buy,total:350.25}),{status:409})
  assert.throws(()=>trade('Alice',buy,then+73*60*60*1000),{status:503})
  const bought=trade('Alice',buy)
  assert.deepEqual(bought.portfolio.positions.AAPL,{shares:2,cost:350.5})
  assert.equal(bought.coins,9649.5)
  assert.deepEqual(trade('Alice',buy),bought)
  assert.throws(()=>trade('Alice',{...buy,sequence:2}),{status:409})
  assert.throws(()=>trade('Alice',{...buy,id:'order-aapl-0002',side:'sell',shares:3,sequence:2,total:525.75}),{status:409})
  const sold=trade('Alice',{...buy,id:'order-aapl-0002',side:'sell',shares:1,sequence:2,total:175.25})
  assert.deepEqual(sold.portfolio.positions.AAPL,{shares:1,cost:175.25})
  assert.equal(read('Alice').coins,9824.75)
})

test('CAS trades conserve the public float and midnight pays the held fraction exactly once',t=>{
  const {store,read,trade}=fixture(t)
  const initial=read('Alice').cas
  assert.equal(initial.float,1000)
  const buy={symbol:'CAS',side:'buy',shares:100,id:'order-casino-01',sequence:1,version:initial.version,total:casOrderTotal(initial,'buy',100)}
  const bought=trade('Alice',buy)
  assert.equal(bought.cas.available,900)
  assert.equal(bought.cas.float,1000)
  assert.equal(bought.portfolio.positions.CAS.shares,100)
  assert.throws(()=>trade('Bob',{...buy,id:'order-casino-02'}),{status:409})
  store.transaction(unit=>recordCasinoMargins(unit,[{stake:1000,gross:0},{stake:150,gross:150}],then))
  const midnight=nextReset(then)
  const paid=read('Alice',midnight)
  assert.equal(paid.coins,bought.coins+7)
  assert.deepEqual(paid.cas.lastDividend,{day:'2026-11-18',pool:70,paid:7})
  assert.equal(paid.portfolio.dividendsPaid,7)
  assert.deepEqual(read('Alice',midnight),paid)
  assert.equal(read('Bob',midnight).coins,10000)
  const sell=trade('Alice',{...buy,side:'sell',sequence:2,id:'order-casino-03',version:paid.cas.version,total:casOrderTotal(paid.cas,'sell',100)},midnight)
  assert.equal(sell.cas.available,1000)
  assert.equal(sell.portfolio.positions.CAS,undefined)
})

test('private equity rebalances within its band and trades only available float',t=>{
  const {store,read}=fixture(t)
  const initial=read('Alice').cas
  const after=store.transaction(unit=>{
    const state=unit.metadata(CAS_META)
    unit.putMetadata(CAS_META,{...state,nextEquity:then})
    return casState(unit,then)
  })
  assert.equal(after.equityMoves[0].side,'sell')
  assert.ok(after.equity>=1500&&after.equity<initial.equity)
  assert.equal(after.equity+after.float,4000)
  assert.equal(after.float,after.available)
  const repurchased=store.transaction(unit=>{
    unit.putMetadata(CAS_META,{...after,equity:1500,float:2500,available:50,nextEquity:then})
    return casState(unit,then)
  })
  assert.equal(repurchased.equityMoves[0].side,'buy')
  assert.equal(repurchased.equity,1550)
  assert.equal(repurchased.float,2450)
  assert.equal(repurchased.available,0)
})

test('a dice receipt contributes to house margin only once',t=>{
  const {store}=fixture(t)
  const data={game:'dice',stake:10,choice:6,sequence:1,requestId:'stock-dice-test-01'}
  const play=()=>store.transaction(unit=>casinoApi(unit,unit.users.get('Alice'),'/api/casino/bet','POST',data).value)
  const result=play()
  assert.equal(store.metadataValue(CAS_META).margin,Math.round((result.round.stake-result.round.gross)*10000))
  play()
  assert.equal(store.metadataValue(CAS_META).margin,Math.round((result.round.stake-result.round.gross)*10000))
})
