import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {ChessStore} from '../server/storage.ts'
import {bankApi} from '../server/bank.ts'
import {stockApi} from '../server/stock-api.ts'
import {book,release} from '../server/custody.ts'
import {settlePrisonDue} from '../server/prison-company.ts'
import {DAY,updateCredit} from '../server/credit.ts'
import {maintainEconomy} from '../server/governance.ts'
import {cashUnits,COMPANIES} from '../server/corporate.ts'

const start=Date.UTC(2026,10,23,12)
function fixture(t,issueShares=true){
  const dir=mkdtempSync(join(tmpdir(),'pri-test-'))
  let db=new ChessStore(dir)
  t.after(()=>{db.close();rmSync(dir,{recursive:true,force:true})})
  const tx=fn=>db.transaction(fn)
  tx(u=>{for(const name of ['Inmate','Second','Small','Large']){
    u.users.add(name,{name,hash:'',salt:'',wallet:{starterGranted:true,coins:2000,inventory:[],loadout:{pieces:{},icon:'default'}}})
  }})
  const shares=(user,symbol,n,price)=>tx(u=>stockApi(u,u.users.get(user),'/api/stocks/order','POST',{symbol,side:'buy',shares:n,price,id:crypto.randomUUID()},start))
  if(issueShares){shares('Small','PRI',1,25);shares('Large','PRI',3,25);shares('Small','BNK',10,.16)}
  const borrow=(name,amount,sequence=1)=>tx(u=>bankApi(u,u.users.get(name),'/api/bank/borrow','POST',{amount,days:7,sequence,id:crypto.randomUUID()},start))
  return {tx,borrow,shares,user:name=>JSON.parse(db.accountJson(name)),state:()=>db.metadataValue(COMPANIES),
    settle:at=>tx(u=>settlePrisonDue(u,at)),restart(){db.close();db=new ChessStore(dir)}}
}

test('PRI pays BNK principal then locked interest and distributes the remaining income once',t=>{
  const f=fixture(t)
  f.borrow('Inmate',100)
  const wallet=f.user('Inmate').wallet.coins,bank=f.state().BNK
  f.tx(u=>book(u,'Inmate',5,start,true))
  f.settle(start+DAY)
  assert.equal(f.state().BNK.receivables,bank.receivables-cashUnits(100))
  assert.equal(f.state().BNK.cash,bank.cash+cashUnits(100))
  assert.equal(f.state().BNK.profit,bank.profit)
  assert.equal(f.state().PRI.lastDividend.paid,0)
  f.restart()
  f.settle(start+2*DAY)
  const second=f.state()
  assert.equal(second.BNK.cash,bank.cash+cashUnits(147.5)) // 150 received, 2.5 servicing expense
  assert.equal(second.BNK.profit-bank.profit,cashUnits(47.5))
  assert.equal(second.BNK.ledger.find(r=>r.kind==='PRI locked interest collected').units,cashUnits(50))
  assert.equal(second.PRI.lastDividend.paid,50)
  assert.equal(f.user('Small').stocks.prisonDividendsPaid,12.5)
  assert.equal(f.user('Large').stocks.prisonDividendsPaid,37.5)
  assert.equal(f.user('Inmate').wallet.coins,wallet)
  f.settle(start+2*DAY);assert.deepEqual(f.state(),second)
  f.tx(u=>maintainEconomy(u,start+2*DAY))
  const holder=f.user('Small')
  assert.ok(holder.stocks.bankDividendsPaid>0)
  for(const symbol of ['PRI','BNK'])assert.equal(holder.notifications.filter(n=>n.title===symbol+' dividend received').length,1)
  f.settle(start+3*DAY)
  assert.equal(f.state().PRI.lastDividend.paid,100)
})

test('time served, ordinary interest and a second inmate settle independently on early and automatic release',t=>{
  const f=fixture(t)
  f.borrow('Inmate',200)
  const loanBefore=f.user('Inmate').bank.loan
  f.tx(u=>book(u,'Inmate',5,start,true))
  f.tx(u=>book(u,'Second',5,start))
  f.tx(u=>release(u,'Inmate',start+DAY/2))
  const bank=f.user('Inmate').bank
  assert.equal(bank.prisonHold,undefined)
  assert.equal(bank.loan.principal,cashUnits(150))
  assert.equal(bank.loan.interest,0)
  assert.equal(bank.loan.rate,loanBefore.rate)
  assert.equal(bank.loan.due,loanBefore.due+DAY/2)
  f.tx(u=>updateCredit(u.users.get('Inmate'),start+1.5*DAY))
  assert.equal(f.user('Inmate').bank.loan.interest,Math.floor(cashUnits(150)*loanBefore.rate/10000))
  f.settle(start+3*DAY)
  assert.equal(f.state().PRI.terms.length,0)
  assert.equal(f.user('Small').stocks.prisonDividendsPaid,25)
  assert.equal(f.user('Large').stocks.prisonDividendsPaid,75)
  assert.equal(f.state().BNK.ledger.some(r=>r.kind==='PRI locked interest collected'),false)
})

test('existing occupied cells start at installation, and release during the premium forgives only the unpaid surcharge',t=>{
  const f=fixture(t,false)
  f.borrow('Inmate',100)
  f.tx(u=>{
    const e=u.metadata(COMPANIES);delete e.PRI;u.putMetadata(COMPANIES,e)
    u.putMetadata('meridianBookings',[{user:'Inmate',cell:1,ends:null}])
    settlePrisonDue(u,start+10)
  })
  assert.equal(f.state().PRI.terms[0].start,start+10)
  f.tx(u=>release(u,'Inmate',start+10+1.25*DAY))
  const a=f.user('Inmate')
  assert.equal(a.bank.loan,undefined);assert.equal(a.bank.prisonHold,undefined)
  assert.equal(f.state().BNK.ledger.find(r=>r.kind==='PRI locked interest collected').units,cashUnits(25))
  assert.equal(f.state().PRI.carry,0)
})

test('BNK checks each Amsterdam midnight and notifies on both consecutive payouts',t=>{
  const f=fixture(t)
  const first=Date.UTC(2026,10,23,23)
  assert.equal(f.state().BNK.nextDividend,first)
  // Installations with the old initial seven-day schedule move to the next daily close.
  f.tx(u=>{const e=u.metadata(COMPANIES);e.dividendCadence='daily-amsterdam-v1';e.BNK.nextDividend=start+7*DAY;u.putMetadata(COMPANIES,e)})
  for(const at of [first,first+DAY]){
    f.tx(u=>{
      const e=u.metadata(COMPANIES);e.BNK.cash+=cashUnits(100);e.BNK.profit+=cashUnits(100);u.putMetadata(COMPANIES,e)
      maintainEconomy(u,at-1)
      assert.equal(u.metadata(COMPANIES).BNK.nextDividend,at)
    })
    f.tx(u=>maintainEconomy(u,at))
    assert.equal(f.state().BNK.nextDividend,at+DAY)
    assert.ok(f.state().BNK.lastDividend.paid>0)
  }
  assert.equal(f.user('Small').notifications.filter(n=>n.title==='BNK dividend received').length,2)
})
