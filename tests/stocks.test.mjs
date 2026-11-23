import test from 'node:test'
import assert from 'node:assert/strict'
import {ChessStore} from '../server/storage.ts'
import {stockApi} from '../server/stock-api.ts'
import {COMPANIES,companies,operating,saveCompanies} from '../server/corporate.ts'
import {maintainEconomy} from '../server/governance.ts'
import {DAY} from '../server/credit.ts'
import {STOCK_QUOTES} from '../server/stock-quotes.ts'
import {STOCKS} from '../src/stock-catalog.ts'
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

test('weekly dividends cover losses and pay only eligible outstanding shares',t=>{
  const {store,read}=fixture(t)
  const post=(account,action,data,now)=>store.transaction(unit=>stockApi(unit,unit.users.get(account),'/api/stocks/'+action,'POST',data,now).value)
  read('Alice')
  post('Alice','order',{symbol:'BNK',side:'buy',shares:100,id:'bank-share-alice',price:.16},then)
  post('Bob','order',{symbol:'BNK',side:'buy',shares:300,id:'bank-share-bob1',price:.16},then)
  function postProfit(coins,now){
    store.transaction(unit=>{
      const e=companies(unit,now)
      e.nextPE=then+50*DAY
      e.BNK.cash+=coins*10000;operating(e.BNK,'Operating result',coins*10000,now)
      saveCompanies(unit,e)
    })
  }
  postProfit(-100,then)
  store.transaction(unit=>maintainEconomy(unit,then+7*DAY))
  assert.equal(read('Alice',then+7*DAY).bank.lastDividend.paid,0)
  postProfit(500,then+8*DAY)
  store.transaction(unit=>maintainEconomy(unit,then+14*DAY))
  const paid=read('Alice',then+14*DAY)
  assert.equal(paid.bank.lastDividend.pool,65)
  assert.equal(paid.portfolio.bankDividendsPaid,16.25)
  assert.equal(read('Bob',then+14*DAY).portfolio.bankDividendsPaid,48.75)
  assert.deepEqual(read('Alice',then+14*DAY),paid)
  assert.equal(paid.portfolio.dividends[0].symbol,'BNK')
})

test('a dice receipt contributes to house margin only once',t=>{
  const {store}=fixture(t)
  const data={game:'dice',stake:10,choice:6,sequence:1,requestId:'stock-dice-test-01'}
  const play=()=>store.transaction(unit=>casinoApi(unit,unit.users.get('Alice'),'/api/casino/bet','POST',data).value)
  const result=play()
  assert.equal(store.metadataValue(COMPANIES).CAS.profit,Math.round((result.round.stake*.999-result.round.gross)*10000))
  play()
  assert.equal(store.metadataValue(COMPANIES).CAS.profit,Math.round((result.round.stake*.999-result.round.gross)*10000))
})
