import test from 'node:test'
import assert from 'node:assert/strict'
import {ChessStore} from '../server/storage.ts'
import {companies,COMPANIES,saveCompanies,PE,assets,liabilities,cashUnits,operating,ESCROW} from '../server/corporate.ts'
import {maintainEconomy,advanceEconomy,supportPolicy,castVote} from '../server/governance.ts'
import {stockApi} from '../server/stock-api.ts'
import {bankApi} from '../server/bank.ts'
import {DAY,income,requireSpending} from '../server/credit.ts'
import {CAS_META} from '../server/cas-shares.ts'
import {equityPrice} from '../src/stock-model.ts'
import {acceptWager,postPayout} from '../server/casino-finance.ts'
import {settleReservedCasino,reserveRouletteStake} from '../server/casino.ts'

const start=Date.UTC(2026,10,23,10)
const at=d=>start+d*DAY
function fixture(t){
  const store=new ChessStore('.',{memory:true})
  t.after(()=>store.close())
  const tx=fn=>store.transaction(fn)
  tx(u=>{for(const name of ['Alice','Bob','Charlie','CasinoOwner']){
    u.users.add(name,{name,hash:'',salt:'',wallet:{starterGranted:true,coins:100000,inventory:[],loadout:{icon:'default',pieces:{}}}})
  }})
  const user=name=>JSON.parse(store.accountJson(name))
  const tick=(now=start)=>tx(u=>maintainEconomy(u,now))
  const change=(fn,now=start)=>tx(u=>{const e=companies(u,now);fn(e,u);saveCompanies(u,e)})
  const state=()=>store.metadataValue(COMPANIES)
  const stock=(name,now=start,action='',data={})=>tx(u=>stockApi(u,u.users.get(name),'/api/stocks'+(action?'/'+action:''),action?'POST':'GET',data,now).value)
  const order=(name,symbol,side,shares,price,id,now=start)=>stock(name,now,'order',{symbol,side,shares,price,id})
  const bank=(name,now=start,action='',data={})=>tx(u=>bankApi(u,u.users.get(name),'/api/bank'+(action?'/'+action:''),action?'POST':'GET',data,now).value)
  return {tx,user,tick,change,state,stock,order,bank}
}
test('the split preserves position values, historical records, PE trades, both company inventories and outstanding loans',t=>{
  const f=fixture(t)
  const cas={float:1600,available:900,equity:2400,cash:cashUnits(60_000),margin:120,history:[{at:start-1,price:19}]}
  const bnk={float:1000,available:600,reserve:cashUnits(120_000),marketCash:cashUnits(50_000)}
  const trade={id:'original-trade',sequence:1,symbol:'CAS',side:'buy',total:14000,shares:700,at:start-1}
  f.tx(u=>{
    u.putMetadata(CAS_META,cas);u.putMetadata('bankExchange',bnk)
    const a=u.users.get('Alice')
    a.stocks={positions:{CAS:{shares:700,cost:14000},BNK:{shares:400,cost:6400}},sequence:1,trades:[trade],dividends:[],dividendsPaid:20}
    a.bank={sequence:1,receipts:[],loan:{id:'old',days:7,original:cashUnits(500),principal:cashUnits(400),interest:42,charged:42,opened:start-1,dueDay:20785,lastDay:20778}}
  })
  f.tick()
  const after=f.stock('Alice'),p=after.portfolio
  const casBefore=equityPrice('CAS',cas),bnkBefore=equityPrice('BNK',bnk)
  assert.equal(Math.round(after.cas.price*p.positions.CAS.shares*100),Math.round(700*casBefore*100))
  assert.equal(Math.round(after.bank.price*p.positions.BNK.shares*100),Math.round(400*bnkBefore*100))
  assert.deepEqual(p.positions,{CAS:{shares:70000,cost:14000},BNK:{shares:40000,cost:6400}})
  assert.deepEqual(p.trades,[trade])
  assert.equal(after.cas.equity,240000)
  assert.equal(after.companies.CAS.inventory,390000)
  assert.equal(after.companies.BNK.inventory,460000)
  assert.equal(after.cas.history[0].price,.19)
  assert.equal(f.user('Alice').wallet.coins,100000)
  assert.equal(f.user('Alice').bank.loan.rate,45)
  assert.equal(f.user('Alice').bank.loan.principal,cashUnits(400))
  f.tick();assert.equal(f.user('Alice').stocks.positions.CAS.shares,70000)
})
test('limit orders match price then time, reserve exactly, reject self trades and release cancellation funds',t=>{
  const f=fixture(t)
  f.tick()
  const a=f.order('Alice','CAS','buy',100,.21,'opening-ask-fill')
  assert.equal(a.coins,99980)
  f.order('Bob','CAS','buy',5,.18,'bob-first-order')
  f.order('Charlie','CAS','buy',7,.18,'charlie-second')
  f.order('CasinoOwner','CAS','buy',3,.19,'owner-best-price')
  const sold=f.order('Alice','CAS','sell',10,.17,'alice-sale-order')
  assert.deepEqual(sold.companies.CAS.trades.slice(0,3).map(x=>[x.buy,x.shares,x.price]),[['Charlie',2,.18],['Bob',5,.18],['CasinoOwner',3,.19]])
  const buy=f.order('Bob','BNK','buy',10,.13,'self-bid-test-1')
  f.order('Bob','BNK','buy',10,.16,'inventory-bnk1')
  const self=f.order('Bob','BNK','sell',4,.12,'self-ask-test-1')
  assert.equal(self.companies.BNK.trades[0].sell,'Company inventory')
  assert.equal(self.companies.BNK.orders.filter(o=>o.side==='sell').length,0)
  assert.throws(()=>f.order('Bob','BNK','sell',11,.12,'not-enough-shares'),{status:409})
  const gone=f.stock('Bob',start,'cancel',{symbol:'BNK',id:'self-bid-test-1'})
  assert.equal(gone.coins,self.coins+1.3)
  assert.equal(buy.companies.BNK.orders[0].shares,10)
  assert.equal(gone.companies.BNK.orders.length,0)
  assert.throws(()=>f.order('Alice','CAS','buy',100001,.2,'too-many-shares'),{status:400})
  assert.throws(()=>f.order('Alice','CAS','buy',1,.20001,'tick-not-exact'),{status:400})
})
test('through insolvency the market stays open, the Day 7 fund has no ordinary cash cap, and repeated dilution keeps investor shares',t=>{
  const f=fixture(t)
  f.tick()
  f.order('Alice','CAS','buy',3000,.2,'hold-through-reset')
  f.change(e=>{e.CAS.obligations=cashUnits(500_000);e.CAS.cash=0;e.nextPE=at(190)})
  f.tick()
  assert.equal(f.state().CAS.bankruptcy.at,start)
  f.order('Alice','CAS','sell',100,.2,'alice-sell-insolvent',at(1))
  f.order('Bob','CAS','buy',100,.2,'bob-buy-insolvent',at(1))
  const before=f.state(),a=f.user('Alice').stocks.positions.CAS.shares
  f.tick(at(7)-1);assert.equal(f.state().CAS.issued,1_000_000)
  f.tick(at(7))
  const after=f.state()
  assert.equal(after.CAS.issued,1_300_000)
  assert.equal(after.CAS.holders[PE]-before.CAS.holders[PE],300000)
  assert.equal(after.CAS.price,before.CAS.price)
  assert.equal(f.user('Alice').stocks.positions.CAS.shares,a)
  assert.equal(after.peCash,before.peCash)
  assert.ok(after.CAS.ledger.find(x=>x.kind==='Private equity recapitalization').units>before.peCash)
  assert.equal(after.CAS.recoveryUntil,at(21))
  assert.equal(after.CAS.policy.coverage,200)
  f.tick(at(7));assert.equal(f.state().CAS.issued,1_300_000)
  f.change(e=>{e.CAS.cash=0},at(23))
  f.tick(at(23));f.tick(at(30))
  assert.equal(f.state().CAS.issued,1_690_000)
  assert.equal(f.user('Alice').stocks.positions.CAS.shares,a)
})
test('a solvent cash shortfall can end with a funded rescue; negative equity survives until recapitalization',t=>{
  for(const solvent of [true,false]){
    const f=fixture(t)
    f.tick()
    f.order('Alice','BNK','buy',4000,.16,'bank-rescue-voter')
    f.change(e=>{
      e.CAS.cash=solvent?cashUnits(4400):0
      if(!solvent)e.CAS.obligations=cashUnits(10_000)
      e.nextPE=at(900)
    })
    f.tick();assert.ok(f.state().CAS.bankruptcy)
    f.tick(at(3))
    const b=f.state().CAS.bankruptcy.offer
    f.stock('Alice',at(4)-1,'vote',{symbol:'BNK',id:b.id,choice:'yes'})
    if(solvent){
      assert.equal(f.state().CAS.bankruptcy,undefined)
      assert.equal(f.state().CAS.loan.principal,cashUnits(750))
      f.tick(at(7));assert.equal(f.state().CAS.issued,1_000_000)
    }else{
      assert.ok(f.state().CAS.bankruptcy.outcome)
      f.tick(at(7));assert.equal(f.state().CAS.issued,1_300_000)
      assert.ok(assets(f.state().CAS)>liabilities(f.state().CAS,at(7)))
    }
  }
})
test('a rejected rescue vote retains shares and recapitalizes; bank recapitalization preserves loan assets',t=>{
  const f=fixture(t)
  f.tick()
  f.order('Alice','BNK','buy',10,.16,'bank-ballot-owner')
  f.bank('Alice',start,'borrow',{id:'existing-personal',sequence:1,days:30,amount:500})
  f.change(e=>{e.CAS.cash=cashUnits(4800);e.nextPE=at(900)})
  f.tick();f.tick(at(3))
  const b=f.state().CAS.bankruptcy.offer
  f.stock('Alice',at(3),'vote',{symbol:'BNK',id:b.id,choice:'no'})
  assert.match(f.state().CAS.bankruptcy.outcome,/rejected/)
  f.tick(at(7))
  assert.equal(f.state().CAS.issued,1_300_000)
  f.change(e=>{e.BNK.cash=0;e.BNK.obligations=cashUnits(200_000)})
  f.tick(at(8));f.tick(at(15))
  assert.equal(f.state().BNK.issued,650000)
  assert.equal(f.state().BNK.receivables,cashUnits(500))
  assert.equal(f.user('Alice').bank.loan.principal,cashUnits(500))
  assert.equal(f.user('Alice').stocks.positions.BNK.shares,10)
})
test('ordinary ballots use strict support and frozen majority, one daily slot and a recovery freeze',t=>{
  const f=fixture(t)
  f.tick()
  f.order('Alice','BNK','buy',600,.16,'alice-voting-lot')
  f.order('Bob','BNK','buy',400,.16,'bob-voting-lot-1')
  f.change((e,u)=>{
    supportPolicy(e.BNK,'Bob',{policy:'reserve',value:40,on:true},start)
    supportPolicy(e.BNK,'Alice',{policy:'lending',value:30,on:true},start)
  })
  const noon=start+2*3600000
  f.tick(noon)
  const first=f.state().ballot
  assert.equal(first.policy,'lending')
  f.order('Bob','BNK','buy',10000,.16,'bob-changes-ownership',noon+1)
  f.stock('Alice',noon+2,'vote',{symbol:'BNK',id:first.id,choice:'yes'})
  assert.equal(f.state().BNK.policy.lending,30)
  assert.equal(f.state().BNK.cooldowns.lending,noon+2+7*DAY)
  assert.equal(f.state().ballot,undefined)
  f.change(e=>{e.BNK.recoveryUntil=noon+14*DAY},noon+3)
  f.tick(noon+DAY);assert.equal(f.state().ballot,undefined)
  assert.ok(f.state().BNK.supports.reserve.Bob)
})
test('credit applies a fixed daily rate, qualifications, late penalties, default collections, and a cooldown',t=>{
  const f=fixture(t)
  f.tick()
  const loan={id:'opening-loan-id',sequence:1,amount:500,days:7}
  assert.equal(f.bank('Alice').score,620)
  assert.equal(f.bank('Alice').limit,500)
  assert.throws(()=>f.bank('Alice',start,'borrow',{...loan,amount:501}),{status:409})
  assert.equal(f.bank('Alice',start,'borrow',loan).loan.rate,.18)
  const paid=f.bank('Alice',at(4),'repay',{id:'paid-in-full-early',sequence:2,amount:null})
  assert.equal(paid.receipt.interest,3.6)
  assert.equal(paid.score,635)
  f.bank('Alice',at(4),'borrow',{...loan,id:'again-loan-payment',sequence:3,days:3})
  assert.equal(f.bank('Alice',at(8)+1).score,555)
  f.tick(at(14));assert.equal(f.bank('Alice',at(14)).score,435)
  assert.throws(()=>f.tx(u=>requireSpending(u.users.get('Alice'),at(14))),{status:409})
  const balance=f.user('Alice').wallet.coins
  f.tx(u=>income(u.users.get('Alice'),cashUnits(100),at(14)))
  assert.equal(f.user('Alice').wallet.coins,balance+75)
  assert.equal(f.user('Alice').bank.receipts[0].kind,'collection')
  const full=f.bank('Alice',at(14),'repay',{id:'repay-default-001',sequence:5,amount:null})
  assert.equal(full.blockedUntil,at(44))
  assert.equal(f.bank('Alice',at(58)).score,445)
  assert.equal(f.bank('Alice',at(58)).limit,0)
})
test('wagers commit backed terms and settle the original payout after policy changes, with no owner tax',t=>{
  const f=fixture(t)
  f.tick()
  const bet={game:'dice',choice:3,requestId:'settle-fixed-odds',sequence:1,stake:100}
  let maximum
  f.tx(u=>{
    maximum=acceptWager(u,bet,start)
    reserveRouletteStake(u.users.get('Alice'),bet.stake)
  })
  assert.equal(maximum,cashUnits(588))
  f.change(e=>{e.CAS.policy.edge=500;e.CAS.policy.open=0})
  assert.throws(()=>f.tx(u=>acceptWager(u,bet,start)),{status:409})
  f.change((e,u)=>{
    const round=settleReservedCasino(u.users.get('Alice'),[],bet,3,start,maximum)
    assert.equal(round.tax,0)
    assert.equal(round.gross,588)
    postPayout(e,round,maximum,start)
  })
  assert.equal(f.state().CAS.pending,0)
  assert.equal(f.state().CAS.profit,cashUnits(-488.1))
  assert.equal(f.user('CasinoOwner').wallet.coins,100000)
})

test('recurring costs can trigger a real shortfall while policy alone cannot declare bankruptcy',t=>{
  const f=fixture(t)
  f.tick()
  f.change(e=>{e.CAS.cash=cashUnits(5024);e.CAS.policy.open=0;e.BNK.policy.reserve=50})
  f.tick(at(1)-1)
  assert.equal(f.state().CAS.bankruptcy,undefined)
  f.tick(at(1))
  assert.equal(f.state().CAS.cash,cashUnits(4999))
  assert.equal(f.state().CAS.bankruptcy.at,at(1))
  assert.equal(f.state().BNK.bankruptcy,undefined)
})
